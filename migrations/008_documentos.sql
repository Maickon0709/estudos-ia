-- =====================================================================
-- 008 — Materiais do aluno (PDF, Word, PowerPoint, texto) para a tutora usar.
-- Rode DEPOIS de 007_limite_uso.sql. Idempotente.
--
-- Como funciona (RAG com a busca textual do próprio Postgres, sem custo extra):
-- a API tira o texto do arquivo e o divide em trechos de ~1.200 caracteres.
-- Cada trecho ganha um tsvector em português (o "índice remissivo": "estudando"
-- acha "estudar"). Quando o aluno pergunta no chat, buscar_trechos() devolve os
-- trechos mais parecidos com a pergunta e só eles vão para a IA.
--
-- O arquivo original NÃO é guardado (só o texto): ocupa menos e expõe menos dados.
-- =====================================================================

-- Tira os acentos: "mitocondria" (digitado às pressas) tem que achar "mitocôndria".
-- translate() é imutável, então pode alimentar a coluna gerada e o índice
-- (a extensão unaccent não é imutável e exigiria um embrulho com o schema fixo).
-- Texto e pergunta passam pela MESMA função, então os radicais sempre batem.
create or replace function sem_acento(p_texto text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
    select translate(
        p_texto,
        'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç',
        'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'
    )
$$;

create table if not exists documentos (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null default auth.uid() references profiles (id) on delete cascade,
    categoria_id uuid not null references categorias (id) on delete cascade,
    nome         text not null check (char_length(nome) between 1 and 200),
    tipo         text not null check (tipo in ('pdf', 'docx', 'pptx', 'txt', 'md')),
    paginas      integer check (paginas > 0),
    caracteres   integer not null check (caracteres > 0),
    trechos      integer not null check (trechos > 0),
    truncado     boolean not null default false,
    created_at   timestamptz not null default now()
);

create table if not exists documento_trechos (
    id           bigint generated always as identity primary key,
    documento_id uuid not null references documentos (id) on delete cascade,
    -- Repetidos do documento para a busca filtrar sem join (e o RLS ser direto).
    user_id      uuid not null default auth.uid() references profiles (id) on delete cascade,
    categoria_id uuid not null references categorias (id) on delete cascade,
    ordem        integer not null check (ordem > 0),
    pagina       integer check (pagina > 0),
    conteudo     text not null check (char_length(conteudo) between 1 and 4000),
    busca        tsvector generated always as (to_tsvector('portuguese', public.sem_acento(conteudo))) stored,
    unique (documento_id, ordem)
);

create index if not exists idx_documentos_categoria on documentos (categoria_id, created_at);
create index if not exists idx_trechos_categoria    on documento_trechos (categoria_id);
create index if not exists idx_trechos_busca        on documento_trechos using gin (busca);

alter table documentos        enable row level security;
alter table documento_trechos enable row level security;

drop policy if exists documentos_proprios on documentos;
create policy documentos_proprios on documentos
    for all
    using (user_id = auth.uid())
    with check (
        user_id = auth.uid()
        and exists (select 1 from categorias c where c.id = documentos.categoria_id)
    );

drop policy if exists trechos_proprios on documento_trechos;
create policy trechos_proprios on documento_trechos
    for all
    using (user_id = auth.uid())
    with check (
        user_id = auth.uid()
        and exists (
            select 1 from documentos d
             where d.id = documento_trechos.documento_id
               and d.categoria_id = documento_trechos.categoria_id
        )
    );

-- =====================================================================
-- criar_documento(categoria, nome, tipo, paginas, truncado, trechos) -> jsonb
-- Grava o documento e TODOS os trechos numa transação só: se algo falhar no
-- meio, não sobra documento sem trecho (invariante 5).
-- p_trechos: [{"ordem": 1, "pagina": 3 | null, "conteudo": "..."}, ...]
-- =====================================================================
create or replace function criar_documento(
    p_categoria_id uuid, p_nome text, p_tipo text, p_paginas integer,
    p_truncado boolean, p_trechos jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_doc documentos;
    v_qtd integer;
begin
    if v_uid is null then
        raise exception 'nao_autenticado';
    end if;
    if not exists (select 1 from categorias where id = p_categoria_id) then
        raise exception 'categoria_nao_encontrada' using errcode = 'P0002';
    end if;
    if jsonb_typeof(p_trechos) is distinct from 'array' then
        raise exception 'trechos_invalidos';
    end if;
    v_qtd := jsonb_array_length(p_trechos);
    if v_qtd = 0 or v_qtd > 1000 then
        raise exception 'trechos_invalidos';
    end if;
    -- Teto por usuário: protege o plano gratuito do banco (500 MB para o site todo).
    if (select count(*) from documentos where user_id = v_uid) >= 30 then
        raise exception 'documentos_demais';
    end if;

    insert into documentos (user_id, categoria_id, nome, tipo, paginas, caracteres, trechos, truncado)
    values (
        v_uid, p_categoria_id, p_nome, p_tipo, p_paginas,
        (select sum(char_length(t ->> 'conteudo')) from jsonb_array_elements(p_trechos) t),
        v_qtd, coalesce(p_truncado, false)
    )
    returning * into v_doc;

    insert into documento_trechos (documento_id, user_id, categoria_id, ordem, pagina, conteudo)
    select v_doc.id, v_uid, p_categoria_id, (t ->> 'ordem')::int, (t ->> 'pagina')::int, t ->> 'conteudo'
      from jsonb_array_elements(p_trechos) t;

    return to_jsonb(v_doc);
end;
$$;

-- =====================================================================
-- buscar_trechos(categoria, consulta, limite) -> os trechos mais parecidos.
--
-- plainto_tsquery junta as palavras com E ("&"): uma pergunta longa quase nunca
-- teria TODAS as palavras num trecho só. Trocamos por OU ("|") e deixamos o
-- ts_rank ordenar: trecho com mais palavras da pergunta (e mais raras) sobe.
-- Palavras vazias ("o", "que", "é") já somem no plainto_tsquery.
-- =====================================================================
create or replace function buscar_trechos(p_categoria_id uuid, p_consulta text, p_limite integer default 5)
returns table (documento_id uuid, nome text, pagina integer, conteudo text, relevancia real)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
    v_consulta tsquery := plainto_tsquery('portuguese', sem_acento(coalesce(p_consulta, '')));
begin
    if numnode(v_consulta) = 0 then
        return;
    end if;
    v_consulta := replace(v_consulta::text, ' & ', ' | ')::tsquery;

    return query
        select t.documento_id, d.nome, t.pagina, t.conteudo, ts_rank(t.busca, v_consulta) as relevancia
          from documento_trechos t
          join documentos d on d.id = t.documento_id
         where t.categoria_id = p_categoria_id
           and t.busca @@ v_consulta
         order by relevancia desc, t.documento_id, t.ordem
         limit least(greatest(coalesce(p_limite, 5), 1), 10);
end;
$$;

do $$
declare f text;
begin
    foreach f in array array[
        'criar_documento(uuid, text, text, integer, boolean, jsonb)',
        'buscar_trechos(uuid, text, integer)'
    ] loop
        execute format('revoke all on function %s from public', f);
        if exists (select 1 from pg_roles where rolname = 'anon') then
            execute format('revoke all on function %s from anon', f);
        end if;
        execute format('grant execute on function %s to authenticated', f);
    end loop;
end $$;

grant select, insert, update, delete on documentos, documento_trechos to authenticated;
