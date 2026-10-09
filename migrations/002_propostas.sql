-- =====================================================================
-- 002 — Propostas -> trilha (confirmação atômica)
-- Rode DEPOIS de schema_supabase.sql, no SQL Editor do Supabase.
-- Pode ser rodada mais de uma vez sem quebrar (idempotente).
-- =====================================================================

-- ---------- recursos: dados que a pesquisa verificada já traz ----------
alter table recursos
    add column if not exists trecho           text,
    add column if not exists canal            text,
    add column if not exists duracao_segundos int check (duracao_segundos >= 0),
    add column if not exists total_videos     int check (total_videos >= 0),
    add column if not exists verificacao      text not null default 'nao_verificado';

do $$ begin
    if not exists (select 1 from pg_constraint where conname = 'recursos_verificacao_check') then
        alter table recursos add constraint recursos_verificacao_check
            check (verificacao in ('verificado', 'nao_verificado'));
    end if;
end $$;

-- Uma proposta vira no máximo UMA trilha (defesa extra contra clique duplo).
create unique index if not exists uq_trilhas_proposta
    on trilhas(proposta_id) where proposta_id is not null;

-- =====================================================================
-- confirmar_proposta(id) -> id da trilha criada
--
-- Tudo numa transação só: ou cria trilha + etapas + recursos e marca a
-- proposta como confirmada, ou não muda NADA.
--
-- SECURITY INVOKER: roda com as permissões de quem chamou, então o RLS
-- continua valendo. Proposta de outro usuário é "não encontrada".
--
-- Erros (lidos pelo back-end pela mensagem):
--   proposta_nao_encontrada  -> 404
--   proposta_ja_decidida     -> 409
--   proposta_invalida        -> 422
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

        if coalesce(jsonb_typeof(v_etapa -> 'recursos'), 'array') <> 'array' then
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
    end loop;

    update propostas set status = 'confirmada', decidida_em = now() where id = v_prop.id;
    return v_trilha_id;
end;
$$;

-- Só usuários logados podem chamar.
revoke all on function confirmar_proposta(uuid) from public;
do $$ begin
    if exists (select 1 from pg_roles where rolname = 'anon') then
        execute 'revoke all on function confirmar_proposta(uuid) from anon';
    end if;
end $$;
grant execute on function confirmar_proposta(uuid) to authenticated;
