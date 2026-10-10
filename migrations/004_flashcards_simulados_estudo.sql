-- =====================================================================
-- 004 — Flashcards, simulados, sessões de estudo (cronômetro), metas
--        semanais e atividade diária (calendário da tela "Hoje").
-- Rode DEPOIS de 003_exercicios_revisoes.sql. Idempotente.
-- =====================================================================

-- ---------- FLASHCARDS (cartões por etapa, com revisão espaçada própria) ----------
create table if not exists flashcards (
    id               uuid primary key default gen_random_uuid(),
    etapa_id         uuid not null references etapas(id) on delete cascade,
    frente           text not null check (char_length(frente) between 1 and 500),
    verso            text not null check (char_length(verso) between 1 and 1000),
    proxima_revisao  date not null default ((now() at time zone 'America/Sao_Paulo')::date),
    intervalo_dias   int  not null default 0 check (intervalo_dias >= 0),
    acertos_seguidos int  not null default 0 check (acertos_seguidos >= 0),
    dominado         boolean not null default false,
    created_at       timestamptz not null default now()
);

-- Histórico de revisões (alimenta o calendário de atividade).
create table if not exists flashcard_revisoes (
    id           uuid primary key default gen_random_uuid(),
    flashcard_id uuid not null references flashcards(id) on delete cascade,
    user_id      uuid not null references profiles(id) on delete cascade,
    lembrou      boolean not null,
    created_at   timestamptz not null default now()
);

-- ---------- SIMULADOS (prova cronometrada com exercícios já gerados) ----------
create table if not exists simulados (
    id               uuid primary key default gen_random_uuid(),
    user_id          uuid not null references profiles(id) on delete cascade,
    categoria_id     uuid not null references categorias(id) on delete cascade,
    limite_segundos  int  not null check (limite_segundos between 60 and 7200),
    total            int  not null check (total between 1 and 50),
    acertos          int  check (acertos >= 0),
    dentro_do_prazo  boolean,
    iniciado_em      timestamptz not null default now(),
    finalizado_em    timestamptz
);

create table if not exists simulado_questoes (
    simulado_id  uuid not null references simulados(id) on delete cascade,
    ordem        int  not null check (ordem >= 1),
    exercicio_id uuid not null references exercicios(id) on delete cascade,
    resposta     text,
    correta      boolean,
    primary key (simulado_id, ordem),
    unique (simulado_id, exercicio_id)
);

-- ---------- SESSÕES DE ESTUDO (cronômetro / Pomodoro) ----------
create table if not exists sessoes_estudo (
    id               uuid primary key default gen_random_uuid(),
    user_id          uuid not null default auth.uid() references profiles(id) on delete cascade,
    categoria_id     uuid references categorias(id) on delete set null,
    tipo             text not null check (tipo in ('foco', 'livre')),
    duracao_segundos int  not null check (duracao_segundos between 60 and 14400),
    iniciada_em      timestamptz not null check (iniciada_em <= now() + interval '5 minutes'),
    created_at       timestamptz not null default now()
);

-- ---------- METAS SEMANAIS (uma linha por usuário) ----------
create table if not exists metas (
    user_id             uuid primary key default auth.uid() references profiles(id) on delete cascade,
    dias_por_semana     int not null check (dias_por_semana between 1 and 7),
    minutos_por_semana  int check (minutos_por_semana between 0 and 10080),
    atualizado_em       timestamptz not null default now()
);

-- ---------- ÍNDICES ----------
create index if not exists idx_flashcards_etapa       on flashcards(etapa_id);
create index if not exists idx_flashcards_revisao     on flashcards(proxima_revisao) where not dominado;
create index if not exists idx_flash_revisoes_user    on flashcard_revisoes(user_id, created_at);
create index if not exists idx_simulados_categoria    on simulados(categoria_id, iniciado_em desc);
create index if not exists idx_sessoes_user           on sessoes_estudo(user_id, iniciada_em);

-- ---------- RLS ----------
alter table flashcards         enable row level security;
alter table flashcard_revisoes enable row level security;
alter table simulados          enable row level security;
alter table simulado_questoes  enable row level security;
alter table sessoes_estudo     enable row level security;
alter table metas              enable row level security;

drop policy if exists flashcards_da_etapa on flashcards;
create policy flashcards_da_etapa on flashcards
    for all
    using      (exists (select 1 from etapas e where e.id = flashcards.etapa_id))
    with check (exists (select 1 from etapas e where e.id = flashcards.etapa_id));

drop policy if exists flash_revisoes_proprias on flashcard_revisoes;
create policy flash_revisoes_proprias on flashcard_revisoes
    for all
    using      (user_id = auth.uid())
    with check (user_id = auth.uid()
                and exists (select 1 from flashcards f where f.id = flashcard_revisoes.flashcard_id));

drop policy if exists simulados_proprios on simulados;
create policy simulados_proprios on simulados
    for all
    using      (user_id = auth.uid())
    with check (user_id = auth.uid()
                and exists (select 1 from categorias c where c.id = simulados.categoria_id));

drop policy if exists simulado_questoes_do_simulado on simulado_questoes;
create policy simulado_questoes_do_simulado on simulado_questoes
    for all
    using      (exists (select 1 from simulados s where s.id = simulado_questoes.simulado_id))
    with check (exists (select 1 from simulados s where s.id = simulado_questoes.simulado_id)
                and exists (select 1 from exercicios x where x.id = simulado_questoes.exercicio_id));

drop policy if exists sessoes_proprias on sessoes_estudo;
create policy sessoes_proprias on sessoes_estudo
    for all
    using      (user_id = auth.uid())
    with check (user_id = auth.uid()
                and (categoria_id is null
                     or exists (select 1 from categorias c where c.id = sessoes_estudo.categoria_id)));

drop policy if exists metas_proprias on metas;
create policy metas_proprias on metas
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =====================================================================
-- VIEWS (security_invoker: o RLS de quem consulta vale)
-- =====================================================================

-- Atividade por dia no fuso de Brasília: exercícios respondidos, flashcards
-- revisados, minutos cronometrados e simulados feitos. Alimenta o calendário.
create or replace view v_atividade_diaria
with (security_invoker = true) as
select
    dia,
    sum(respostas)::int  as respostas,
    sum(flashcards)::int as flashcards,
    (sum(segundos) / 60)::int as minutos,
    sum(simulados)::int  as simulados
from (
    select (created_at at time zone 'America/Sao_Paulo')::date as dia,
           1 as respostas, 0 as flashcards, 0 as segundos, 0 as simulados
      from respostas
    union all
    select (created_at at time zone 'America/Sao_Paulo')::date, 0, 1, 0, 0
      from flashcard_revisoes
    union all
    select (iniciada_em at time zone 'America/Sao_Paulo')::date, 0, 0, duracao_segundos, 0
      from sessoes_estudo
    union all
    select (finalizado_em at time zone 'America/Sao_Paulo')::date, 0, 0, 0, 1
      from simulados where finalizado_em is not null
) a
group by dia;

-- A sequência de dias passa a contar qualquer estudo, não só exercícios.
create or replace view v_dias_estudo
with (security_invoker = true) as
select dia from v_atividade_diaria;

-- Minutos cronometrados por categoria e semana (segunda-feira como início).
create or replace view v_estudo_semanal
with (security_invoker = true) as
select
    categoria_id,
    date_trunc('week', iniciada_em at time zone 'America/Sao_Paulo')::date as semana,
    (sum(duracao_segundos) / 60)::int as minutos
from sessoes_estudo
group by categoria_id, semana;

-- Flashcards para revisar, com o contexto da etapa e da categoria.
create or replace view v_flashcards_pendentes
with (security_invoker = true) as
select
    f.id, f.frente, f.verso, f.proxima_revisao, f.intervalo_dias, f.acertos_seguidos,
    e.id     as etapa_id,
    e.titulo as etapa,
    c.id     as categoria_id,
    c.nome   as categoria
from flashcards f
join etapas     e on e.id = f.etapa_id
join trilhas    t on t.id = e.trilha_id
join categorias c on c.id = t.categoria_id
where not f.dominado;

-- =====================================================================
-- revisar_flashcard(id, lembrou, revisao) -> jsonb
-- Numa transação: registra a revisão no histórico e agenda a próxima.
-- p_revisao vem do back-end (mesma regra de revisão espaçada dos exercícios):
--   {"remover": true} -> cartão dominado
--   {proxima_revisao, intervalo_dias, acertos_seguidos} -> reagenda
-- =====================================================================
create or replace function revisar_flashcard(p_flashcard_id uuid, p_lembrou boolean, p_revisao jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_card flashcards;
begin
    if v_uid is null then
        raise exception 'nao_autenticado';
    end if;

    select * into v_card from flashcards where id = p_flashcard_id for update;
    if not found then
        raise exception 'flashcard_nao_encontrado' using errcode = 'P0002';
    end if;

    insert into flashcard_revisoes (flashcard_id, user_id, lembrou)
    values (p_flashcard_id, v_uid, p_lembrou);

    if coalesce((p_revisao ->> 'remover')::boolean, false) then
        update flashcards set dominado = true where id = p_flashcard_id
        returning * into v_card;
    else
        update flashcards
           set proxima_revisao  = (p_revisao ->> 'proxima_revisao')::date,
               intervalo_dias   = (p_revisao ->> 'intervalo_dias')::int,
               acertos_seguidos = (p_revisao ->> 'acertos_seguidos')::int
         where id = p_flashcard_id
        returning * into v_card;
    end if;

    return to_jsonb(v_card);
end;
$$;

-- =====================================================================
-- criar_simulado(categoria, quantidade, limite) -> uuid
-- Sorteia exercícios de MÚLTIPLA ESCOLHA já gerados na categoria (sem
-- custo de IA) e cria o simulado com as questões numa transação só.
-- =====================================================================
create or replace function criar_simulado(p_categoria_id uuid, p_quantidade int, p_limite_segundos int)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_ids uuid[];
    v_simulado uuid;
begin
    if v_uid is null then
        raise exception 'nao_autenticado';
    end if;
    if not exists (select 1 from categorias where id = p_categoria_id) then
        raise exception 'categoria_nao_encontrada' using errcode = 'P0002';
    end if;

    select array_agg(id) into v_ids from (
        select x.id
          from exercicios x
          join etapas  e on e.id = x.etapa_id
          join trilhas t on t.id = e.trilha_id
         where t.categoria_id = p_categoria_id
           and x.tipo = 'multipla_escolha'
         order by random()
         limit p_quantidade
    ) sorteio;

    if coalesce(array_length(v_ids, 1), 0) < 3 then
        raise exception 'exercicios_insuficientes';
    end if;

    insert into simulados (user_id, categoria_id, limite_segundos, total)
    values (v_uid, p_categoria_id, p_limite_segundos, array_length(v_ids, 1))
    returning id into v_simulado;

    insert into simulado_questoes (simulado_id, ordem, exercicio_id)
    select v_simulado, ordem, exercicio_id
      from unnest(v_ids) with ordinality as q(exercicio_id, ordem);

    return v_simulado;
end;
$$;

-- =====================================================================
-- finalizar_simulado(simulado, itens) -> jsonb
-- O back-end corrige no código (sem IA) e manda [{ordem, resposta, correta}].
-- A linha fica travada: dois envios simultâneos não finalizam duas vezes.
-- =====================================================================
create or replace function finalizar_simulado(p_simulado_id uuid, p_itens jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_sim simulados;
    v_acertos int;
begin
    if auth.uid() is null then
        raise exception 'nao_autenticado';
    end if;

    select * into v_sim from simulados where id = p_simulado_id for update;
    if not found then
        raise exception 'simulado_nao_encontrado' using errcode = 'P0002';
    end if;
    if v_sim.finalizado_em is not null then
        raise exception 'simulado_ja_finalizado';
    end if;

    update simulado_questoes q
       set resposta = i.resposta,
           correta  = coalesce(i.correta, false)
      from jsonb_to_recordset(p_itens) as i(ordem int, resposta text, correta boolean)
     where q.simulado_id = p_simulado_id and q.ordem = i.ordem;

    -- Questão sem resposta conta como errada.
    update simulado_questoes set correta = false
     where simulado_id = p_simulado_id and correta is null;

    select count(*) filter (where correta) into v_acertos
      from simulado_questoes where simulado_id = p_simulado_id;

    update simulados
       set finalizado_em   = now(),
           acertos         = v_acertos,
           -- 30 s de tolerância para a latência da rede
           dentro_do_prazo = now() <= iniciado_em + make_interval(secs => limite_segundos + 30)
     where id = p_simulado_id
    returning * into v_sim;

    return to_jsonb(v_sim);
end;
$$;

-- ---------- Permissões das funções: só o papel logado ----------
do $$
declare
    f text;
begin
    foreach f in array array[
        'revisar_flashcard(uuid, boolean, jsonb)',
        'criar_simulado(uuid, int, int)',
        'finalizar_simulado(uuid, jsonb)'
    ] loop
        execute format('revoke all on function %s from public', f);
        if exists (select 1 from pg_roles where rolname = 'anon') then
            execute format('revoke all on function %s from anon', f);
        end if;
        execute format('grant execute on function %s to authenticated', f);
    end loop;
end $$;

grant select on v_atividade_diaria, v_dias_estudo, v_estudo_semanal, v_flashcards_pendentes to authenticated;
