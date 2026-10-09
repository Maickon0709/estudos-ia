-- =====================================================================
-- Site de Estudos com IA — Schema para Supabase (Postgres)
-- Cole no SQL Editor do Supabase e execute de uma vez.
-- =====================================================================

-- ---------- ENUMS ----------
create type papel_mensagem  as enum ('user', 'assistant');
create type status_proposta as enum ('pendente', 'confirmada', 'rejeitada');
create type status_etapa    as enum ('nao_iniciado', 'em_andamento', 'concluido');
create type tipo_recurso    as enum ('link', 'video', 'playlist');
create type nivel_exercicio as enum ('basico', 'intermediario', 'avancado');
create type tipo_exercicio  as enum ('multipla_escolha', 'discursiva');

-- ---------- PROFILES ----------
-- 1 linha por usuário do Supabase Auth
create table profiles (
    id         uuid primary key references auth.users(id) on delete cascade,
    nome       text,
    created_at timestamptz not null default now()
);

-- Cria o profile automaticamente quando alguém se cadastra
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, nome)
    values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)));
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function handle_new_user();

-- ---------- CATEGORIAS ----------
create table categorias (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references profiles(id) on delete cascade,
    nome       text not null check (char_length(nome) between 1 and 80),
    created_at timestamptz not null default now(),
    unique (user_id, nome)
);

-- ---------- MENSAGENS (chat por categoria) ----------
create table mensagens (
    id           uuid primary key default gen_random_uuid(),
    categoria_id uuid not null references categorias(id) on delete cascade,
    papel        papel_mensagem not null,
    conteudo     text not null,
    created_at   timestamptz not null default now()
);

-- ---------- PROPOSTAS (o que a IA sugeriu, aguardando confirmação) ----------
create table propostas (
    id           uuid primary key default gen_random_uuid(),
    categoria_id uuid not null references categorias(id) on delete cascade,
    payload      jsonb not null,           -- JSON estruturado devolvido pela IA
    status       status_proposta not null default 'pendente',
    created_at   timestamptz not null default now(),
    decidida_em  timestamptz
);

-- ---------- TRILHAS ----------
create table trilhas (
    id           uuid primary key default gen_random_uuid(),
    categoria_id uuid not null references categorias(id) on delete cascade,
    proposta_id  uuid references propostas(id) on delete set null,
    titulo       text not null,
    created_at   timestamptz not null default now()
);

-- ---------- ETAPAS (checkpoints da trilha) ----------
create table etapas (
    id           uuid primary key default gen_random_uuid(),
    trilha_id    uuid not null references trilhas(id) on delete cascade,
    ordem        int  not null check (ordem >= 1),
    titulo       text not null,
    descricao    text,
    status       status_etapa not null default 'nao_iniciado',
    ja_sabia     boolean not null default false,   -- usuário marcou "já sei"
    tentativas   int not null default 0,
    taxa_acerto  numeric(5,2) not null default 0 check (taxa_acerto between 0 and 100),
    concluida_em timestamptz,
    unique (trilha_id, ordem)
);

-- ---------- RECURSOS (links, vídeos, playlists reais e validados) ----------
create table recursos (
    id          uuid primary key default gen_random_uuid(),
    etapa_id    uuid not null references etapas(id) on delete cascade,
    tipo        tipo_recurso not null,
    titulo      text not null,
    url         text not null,
    validado_em timestamptz               -- quando o link_validator confirmou que responde
);

-- ---------- EXERCÍCIOS ----------
create table exercicios (
    id          uuid primary key default gen_random_uuid(),
    etapa_id    uuid not null references etapas(id) on delete cascade,
    nivel       nivel_exercicio not null,
    tipo        tipo_exercicio  not null,
    enunciado   text not null,
    opcoes      jsonb,                    -- alternativas (múltipla escolha)
    gabarito    text not null,
    explicacao  text,
    fontes      jsonb,                    -- material pesquisado que embasou o exercício
    created_at  timestamptz not null default now()
);

-- ---------- RESPOSTAS ----------
create table respostas (
    id           uuid primary key default gen_random_uuid(),
    exercicio_id uuid not null references exercicios(id) on delete cascade,
    user_id      uuid not null references profiles(id) on delete cascade,
    resposta     text not null,
    correta      boolean not null,
    feedback     text,
    created_at   timestamptz not null default now()
);

-- ---------- REVISÕES (revisão espaçada) ----------
create table revisoes (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references profiles(id) on delete cascade,
    exercicio_id    uuid not null references exercicios(id) on delete cascade,
    proxima_revisao date not null,
    intervalo_dias  int  not null default 1 check (intervalo_dias >= 1),
    acertos_seguidos int not null default 0,
    unique (user_id, exercicio_id)
);

-- ---------- ÍNDICES ----------
create index idx_categorias_user      on categorias(user_id);
create index idx_mensagens_categoria  on mensagens(categoria_id, created_at);
create index idx_propostas_categoria  on propostas(categoria_id, status);
create index idx_trilhas_categoria    on trilhas(categoria_id);
create index idx_etapas_trilha        on etapas(trilha_id, ordem);
create index idx_recursos_etapa       on recursos(etapa_id);
create index idx_exercicios_etapa     on exercicios(etapa_id, nivel);
create index idx_respostas_user       on respostas(user_id, created_at);
create index idx_respostas_exercicio  on respostas(exercicio_id);
create index idx_revisoes_pendentes   on revisoes(user_id, proxima_revisao);

-- =====================================================================
-- ROW LEVEL SECURITY
-- Cada usuário só enxerga e altera o que é dele.
-- Obs.: o subselect respeita o RLS da tabela "pai", então a cadeia
-- categorias -> trilhas -> etapas -> exercicios fica protegida.
-- Obs.: a service_role key do Supabase IGNORA o RLS. Nunca exponha no front.
-- =====================================================================
alter table profiles   enable row level security;
alter table categorias enable row level security;
alter table mensagens  enable row level security;
alter table propostas  enable row level security;
alter table trilhas    enable row level security;
alter table etapas     enable row level security;
alter table recursos   enable row level security;
alter table exercicios enable row level security;
alter table respostas  enable row level security;
alter table revisoes   enable row level security;

create policy profiles_proprio on profiles
    for all using (id = auth.uid()) with check (id = auth.uid());

create policy categorias_proprias on categorias
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy mensagens_da_categoria on mensagens
    for all
    using      (exists (select 1 from categorias c where c.id = mensagens.categoria_id))
    with check (exists (select 1 from categorias c where c.id = mensagens.categoria_id));

create policy propostas_da_categoria on propostas
    for all
    using      (exists (select 1 from categorias c where c.id = propostas.categoria_id))
    with check (exists (select 1 from categorias c where c.id = propostas.categoria_id));

create policy trilhas_da_categoria on trilhas
    for all
    using      (exists (select 1 from categorias c where c.id = trilhas.categoria_id))
    with check (exists (select 1 from categorias c where c.id = trilhas.categoria_id));

create policy etapas_da_trilha on etapas
    for all
    using      (exists (select 1 from trilhas t where t.id = etapas.trilha_id))
    with check (exists (select 1 from trilhas t where t.id = etapas.trilha_id));

create policy recursos_da_etapa on recursos
    for all
    using      (exists (select 1 from etapas e where e.id = recursos.etapa_id))
    with check (exists (select 1 from etapas e where e.id = recursos.etapa_id));

create policy exercicios_da_etapa on exercicios
    for all
    using      (exists (select 1 from etapas e where e.id = exercicios.etapa_id))
    with check (exists (select 1 from etapas e where e.id = exercicios.etapa_id));

create policy respostas_proprias on respostas
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy revisoes_proprias on revisoes
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =====================================================================
-- VIEWS DO PAINEL DE PROGRESSO
-- security_invoker = o RLS do usuário que consulta é respeitado.
-- =====================================================================

-- % de etapas concluídas por categoria
create view v_progresso_categoria
with (security_invoker = true) as
select
    c.id   as categoria_id,
    c.nome as categoria,
    count(e.id)                                         as total_etapas,
    count(e.id) filter (where e.status = 'concluido')   as etapas_concluidas,
    coalesce(round(
        100.0 * count(e.id) filter (where e.status = 'concluido')
        / nullif(count(e.id), 0), 1), 0)                as pct_concluido
from categorias c
left join trilhas t on t.categoria_id = c.id
left join etapas  e on e.trilha_id    = t.id
group by c.id, c.nome;

-- Taxa de acerto por categoria e nível
create view v_acerto_por_nivel
with (security_invoker = true) as
select
    c.id        as categoria_id,
    x.nivel     as nivel,
    count(r.id)                                         as total_respostas,
    count(r.id) filter (where r.correta)                as acertos,
    coalesce(round(
        100.0 * count(r.id) filter (where r.correta)
        / nullif(count(r.id), 0), 1), 0)                as taxa_acerto
from respostas r
join exercicios x on x.id = r.exercicio_id
join etapas     e on e.id = x.etapa_id
join trilhas    t on t.id = e.trilha_id
join categorias c on c.id = t.categoria_id
group by c.id, x.nivel;

-- Pontos fracos: etapas com menor taxa de acerto (com pelo menos 1 tentativa)
create view v_pontos_fracos
with (security_invoker = true) as
select
    t.categoria_id,
    e.id          as etapa_id,
    e.titulo      as etapa,
    e.tentativas,
    e.taxa_acerto
from etapas e
join trilhas t on t.id = e.trilha_id
where e.tentativas > 0
order by e.taxa_acerto asc;
