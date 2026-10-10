-- =====================================================================
-- 009 — Trilha a partir dos materiais do aluno.
-- Rode DEPOIS de 008_documentos.sql. Idempotente.
--
-- A IA divide os arquivos do aluno em etapas (do básico ao avançado), mas escolhe
-- as partes SÓ PELO NÚMERO de uma lista que o back-end montou (como já faz com os
-- links): cada parte é um intervalo de trechos de um arquivo. A etapa guarda esses
-- intervalos em `etapa_materiais`, e os exercícios e flashcards da etapa são gerados
-- com o texto deles.
-- =====================================================================

-- ---------- partes dos arquivos ligadas a cada etapa ----------
create table if not exists etapa_materiais (
    id            uuid primary key default gen_random_uuid(),
    etapa_id      uuid not null references etapas(id) on delete cascade,
    documento_id  uuid not null references documentos(id) on delete cascade,
    user_id       uuid not null default auth.uid() references profiles(id) on delete cascade,
    ordem_inicio  integer not null check (ordem_inicio > 0),
    ordem_fim     integer not null,
    pagina_inicio integer check (pagina_inicio > 0),
    pagina_fim    integer check (pagina_fim > 0),
    check (ordem_fim >= ordem_inicio),
    unique (etapa_id, documento_id, ordem_inicio)
);

create index if not exists idx_etapa_materiais_etapa on etapa_materiais(etapa_id);
create index if not exists idx_etapa_materiais_doc   on etapa_materiais(documento_id);

alter table etapa_materiais enable row level security;

-- Dono lê e escreve; para gravar, a etapa E o arquivo precisam ser dele (o RLS das
-- outras tabelas responde "não existe" para o que é de outra pessoa).
drop policy if exists etapa_materiais_proprios on etapa_materiais;
create policy etapa_materiais_proprios on etapa_materiais
    for all
    using (user_id = auth.uid())
    with check (
        user_id = auth.uid()
        and exists (select 1 from etapas e where e.id = etapa_materiais.etapa_id)
        and exists (select 1 from documentos d where d.id = etapa_materiais.documento_id)
    );

grant select, insert, update, delete on etapa_materiais to authenticated;

-- =====================================================================
-- previa_trechos(categoria) -> o começo de cada trecho dos arquivos da categoria.
-- Para montar a lista numerada que vai à IA sem baixar o texto inteiro de todos
-- os arquivos (um PDF grande tem centenas de milhares de caracteres).
-- =====================================================================
create or replace function previa_trechos(p_categoria_id uuid)
returns table (documento_id uuid, nome text, ordem integer, pagina integer, previa text)
language sql
stable
security invoker
set search_path = public
as $$
    select t.documento_id, d.nome, t.ordem, t.pagina, left(t.conteudo, 220)
      from documento_trechos t
      join documentos d on d.id = t.documento_id
     where t.categoria_id = p_categoria_id
     order by d.created_at, t.documento_id, t.ordem
     limit 6000;
$$;

-- =====================================================================
-- confirmar_proposta(id) -> id da trilha criada
--
-- Igual à da migração 002, mais: cada etapa pode trazer "materiais":
--   [{"documento_id": uuid, "ordem_inicio": int, "ordem_fim": int,
--     "pagina_inicio": int|null, "pagina_fim": int|null}]
-- Tudo numa transação só: ou cria trilha + etapas + recursos + materiais e marca
-- a proposta como confirmada, ou não muda NADA (inclusive se um arquivo foi
-- apagado entre a proposta e a confirmação).
--
-- SECURITY INVOKER: roda com as permissões de quem chamou, então o RLS continua
-- valendo. Arquivo de outro usuário não passa no WITH CHECK de etapa_materiais.
-- =====================================================================
create or replace function confirmar_proposta(p_proposta_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_prop      propostas%rowtype;
    v_etapas    jsonb;
    v_trilha_id uuid;
    v_etapa     jsonb;
    v_ordem     bigint;
    v_etapa_id  uuid;
    v_rec       jsonb;
    v_mat       jsonb;
begin
    -- FOR UPDATE trava a linha: dois cliques simultâneos são enfileirados,
    -- e o segundo já encontra status 'confirmada'.
    select * into v_prop from propostas where id = p_proposta_id for update;
    if not found then
        raise exception 'proposta_nao_encontrada' using errcode = 'P0002';
    end if;
    if v_prop.status <> 'pendente' then
        raise exception 'proposta_ja_decidida';
    end if;

    v_etapas := v_prop.payload -> 'etapas';
    if coalesce(jsonb_typeof(v_etapas), '') <> 'array' then
        raise exception 'proposta_invalida';
    end if;
    if jsonb_array_length(v_etapas) not between 1 and 20 then
        raise exception 'proposta_invalida';
    end if;

    insert into trilhas (categoria_id, proposta_id, titulo)
    values (
        v_prop.categoria_id,
        v_prop.id,
        coalesce(nullif(trim(v_prop.payload ->> 'titulo'), ''), 'Trilha de estudos')
    )
    returning id into v_trilha_id;

    for v_etapa, v_ordem in
        select value, ordinality from jsonb_array_elements(v_etapas) with ordinality
    loop
        if coalesce(jsonb_typeof(v_etapa), '') <> 'object'
           or nullif(trim(v_etapa ->> 'titulo'), '') is null then
            raise exception 'proposta_invalida';
        end if;

        insert into etapas (trilha_id, ordem, titulo, descricao)
        values (v_trilha_id, v_ordem, trim(v_etapa ->> 'titulo'), v_etapa ->> 'descricao')
        returning id into v_etapa_id;

        if coalesce(jsonb_typeof(v_etapa -> 'recursos'), 'array') <> 'array'
           or coalesce(jsonb_typeof(v_etapa -> 'materiais'), 'array') <> 'array' then
            raise exception 'proposta_invalida';
        end if;

        for v_rec in
            select value from jsonb_array_elements(coalesce(v_etapa -> 'recursos', '[]'::jsonb))
        loop
            -- Defesa em profundidade: só http(s). Barra javascript:, data:, etc.
            if coalesce(v_rec ->> 'url', '') !~* '^https?://' then
                raise exception 'proposta_invalida';
            end if;

            insert into recursos (
                etapa_id, tipo, titulo, url, trecho, canal,
                duracao_segundos, total_videos, verificacao, validado_em
            )
            values (
                v_etapa_id,
                (v_rec ->> 'tipo')::tipo_recurso,
                coalesce(nullif(trim(v_rec ->> 'titulo'), ''), v_rec ->> 'url'),
                v_rec ->> 'url',
                v_rec ->> 'trecho',
                v_rec ->> 'canal',
                (v_rec ->> 'duracao_segundos')::int,
                (v_rec ->> 'total_videos')::int,
                coalesce(v_rec ->> 'verificacao', 'nao_verificado'),
                (v_rec ->> 'validado_em')::timestamptz
            );
        end loop;

        for v_mat in
            select value from jsonb_array_elements(coalesce(v_etapa -> 'materiais', '[]'::jsonb))
        loop
            if coalesce(jsonb_typeof(v_mat), '') <> 'object' then
                raise exception 'proposta_invalida';
            end if;
            begin
                insert into etapa_materiais (
                    etapa_id, documento_id, ordem_inicio, ordem_fim, pagina_inicio, pagina_fim
                )
                values (
                    v_etapa_id,
                    (v_mat ->> 'documento_id')::uuid,
                    (v_mat ->> 'ordem_inicio')::int,
                    (v_mat ->> 'ordem_fim')::int,
                    (v_mat ->> 'pagina_inicio')::int,
                    (v_mat ->> 'pagina_fim')::int
                );
            exception
                -- arquivo apagado (FK), de outra pessoa (RLS), id ou números inválidos
                when foreign_key_violation or insufficient_privilege or invalid_text_representation
                     or check_violation or not_null_violation or numeric_value_out_of_range
                     or unique_violation then
                    raise exception 'material_indisponivel';
            end;
        end loop;
    end loop;

    update propostas set status = 'confirmada', decidida_em = now() where id = v_prop.id;
    return v_trilha_id;
end;
$$;

do $$
declare f text;
begin
    foreach f in array array['confirmar_proposta(uuid)', 'previa_trechos(uuid)'] loop
        execute format('revoke all on function %s from public', f);
        if exists (select 1 from pg_roles where rolname = 'anon') then
            execute format('revoke all on function %s from anon', f);
        end if;
        execute format('grant execute on function %s to authenticated', f);
    end loop;
end $$;
