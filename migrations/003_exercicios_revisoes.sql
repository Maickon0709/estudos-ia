-- =====================================================================
-- 003 — Exercícios, respostas, revisão espaçada e painel
-- Rode DEPOIS de 002_propostas.sql. Idempotente.
-- =====================================================================

-- ---------- Acerto por etapa e nível (alimenta a trilha adaptativa) ----------
create or replace view v_acerto_etapa_nivel
with (security_invoker = true) as
select
    x.etapa_id,
    x.nivel,
    count(r.id)                          as total,
    count(r.id) filter (where r.correta) as acertos
from respostas r
join exercicios x on x.id = r.exercicio_id
group by x.etapa_id, x.nivel;

-- ---------- Dias em que o usuário estudou (sequência de dias no painel) ----------
-- Fuso fixo de Brasília: "estudou hoje" segue o relógio do estudante.
create or replace view v_dias_estudo
with (security_invoker = true) as
select distinct (r.created_at at time zone 'America/Sao_Paulo')::date as dia
from respostas r;

-- ---------- Revisões pendentes, SEM gabarito nem explicação ----------
create or replace view v_revisoes_pendentes
with (security_invoker = true) as
select
    v.exercicio_id,
    v.proxima_revisao,
    v.intervalo_dias,
    v.acertos_seguidos,
    x.nivel,
    x.tipo,
    x.enunciado,
    x.opcoes,
    e.id     as etapa_id,
    e.titulo as etapa,
    c.id     as categoria_id,
    c.nome   as categoria
from revisoes v
join exercicios x on x.id = v.exercicio_id
join etapas     e on e.id = x.etapa_id
join trilhas    t on t.id = e.trilha_id
join categorias c on c.id = t.categoria_id;

-- =====================================================================
-- registrar_resposta(...) -> jsonb com o desempenho da etapa por nível
--
-- Numa transação só:
--   1. grava a resposta do usuário logado;
--   2. recalcula tentativas e taxa de acerto da etapa;
--   3. aplica a revisão espaçada decidida pelo back-end (p_revisao):
--        null                -> não mexe
--        {"remover": true}   -> apaga (conteúdo dominado)
--        {proxima_revisao, intervalo_dias, acertos_seguidos} -> cria/atualiza
--
-- SECURITY INVOKER: o RLS vale. Exercício de outro usuário = não encontrado.
-- =====================================================================
create or replace function registrar_resposta(
    p_exercicio_id uuid,
    p_resposta     text,
    p_correta      boolean,
    p_feedback     text,
    p_revisao      jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_uid       uuid := auth.uid();
    v_etapa_id  uuid;
    v_resp_id   uuid;
    v_niveis    jsonb;
begin
    if v_uid is null then
        raise exception 'nao_autenticado';
    end if;

    select etapa_id into v_etapa_id from exercicios where id = p_exercicio_id;
    if not found then
        raise exception 'exercicio_nao_encontrado' using errcode = 'P0002';
    end if;

    insert into respostas (exercicio_id, user_id, resposta, correta, feedback)
    values (p_exercicio_id, v_uid, p_resposta, p_correta, p_feedback)
    returning id into v_resp_id;

    update etapas e
       set tentativas  = s.total,
           taxa_acerto = s.taxa
      from (
            select count(*) as total,
                   coalesce(round(100.0 * count(*) filter (where r.correta)
                                  / nullif(count(*), 0), 2), 0) as taxa
              from respostas r
              join exercicios x on x.id = r.exercicio_id
             where x.etapa_id = v_etapa_id
           ) s
     where e.id = v_etapa_id;

    if p_revisao is not null then
        if coalesce((p_revisao ->> 'remover')::boolean, false) then
            delete from revisoes where user_id = v_uid and exercicio_id = p_exercicio_id;
        else
            insert into revisoes (user_id, exercicio_id, proxima_revisao, intervalo_dias, acertos_seguidos)
            values (
                v_uid,
                p_exercicio_id,
                (p_revisao ->> 'proxima_revisao')::date,
                (p_revisao ->> 'intervalo_dias')::int,
                (p_revisao ->> 'acertos_seguidos')::int
            )
            on conflict (user_id, exercicio_id) do update
               set proxima_revisao  = excluded.proxima_revisao,
                   intervalo_dias   = excluded.intervalo_dias,
                   acertos_seguidos = excluded.acertos_seguidos;
        end if;
    end if;

    select coalesce(jsonb_object_agg(nivel, jsonb_build_object('total', total, 'acertos', acertos)), '{}'::jsonb)
      into v_niveis
      from v_acerto_etapa_nivel
     where etapa_id = v_etapa_id;

    return jsonb_build_object('resposta_id', v_resp_id, 'etapa_id', v_etapa_id, 'niveis', v_niveis);
end;
$$;

revoke all on function registrar_resposta(uuid, text, boolean, text, jsonb) from public;
do $$ begin
    if exists (select 1 from pg_roles where rolname = 'anon') then
        execute 'revoke all on function registrar_resposta(uuid, text, boolean, text, jsonb) from anon';
    end if;
end $$;
grant execute on function registrar_resposta(uuid, text, boolean, text, jsonb) to authenticated;

-- Views novas também para o papel logado (no Supabase, isso já é o padrão).
grant select on v_acerto_etapa_nivel, v_dias_estudo, v_revisoes_pendentes to authenticated;
