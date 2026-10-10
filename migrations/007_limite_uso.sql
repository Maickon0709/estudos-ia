-- =====================================================================
-- 007 — Limite de uso por usuário (por dia, no fuso de Brasília).
-- Rode DEPOIS de 006_foto_perfil.sql. Idempotente.
--
-- Por quê: Groq e Tavily têm cota gratuita para o site INTEIRO (Tavily:
-- 1.000 créditos/mês). Sem limite, um único usuário (ou um script) gasta a
-- cota de todos. O contador mora no banco porque na Vercel cada requisição
-- pode cair numa instância diferente: contador em memória não funcionaria.
-- =====================================================================

create table if not exists uso_diario (
    user_id    uuid not null references auth.users (id) on delete cascade,
    dia        date not null,
    tipo       text not null check (tipo in ('chat', 'ia', 'pesquisa')),
    quantidade integer not null default 0 check (quantidade >= 0),
    primary key (user_id, dia, tipo)
);

alter table uso_diario enable row level security;

-- O usuário pode VER o próprio consumo (para a tela mostrar "restam X").
drop policy if exists "uso_diario: ver o proprio" on uso_diario;
create policy "uso_diario: ver o proprio" on uso_diario
    for select using (auth.uid() = user_id);

-- ...mas NÃO pode escrever: senão bastaria zerar o contador pela API REST
-- do Supabase. Sem política de escrita e sem privilégio, só a função abaixo mexe.
revoke insert, update, delete on uso_diario from authenticated;
do $$ begin
    if exists (select 1 from pg_roles where rolname = 'anon') then
        execute 'revoke all on uso_diario from anon';
    end if;
end $$;

-- =====================================================================
-- consumir_uso(tipo, limite): soma 1 ao contador de hoje e devolve o total,
-- ou levanta 'limite_atingido' sem somar nada.
--
-- SECURITY DEFINER (segunda exceção do projeto, mesmo cuidado da
-- excluir_minha_conta): o usuário não tem permissão de escrita na tabela,
-- então a função escreve com os direitos do dono. Ela só mexe na linha de
-- auth.uid(), nunca num id recebido. Chamar direto com um limite maior não
-- adianta: a API usa o próprio limite, e somar no próprio contador só gasta
-- a cota de quem chamou.
--
-- Atômica: o "insert ... on conflict do update ... where" trava a linha, então
-- duas requisições simultâneas no último uso não passam as duas.
-- =====================================================================
create or replace function consumir_uso(p_tipo text, p_limite integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_uid   uuid := auth.uid();
    v_dia   date := (now() at time zone 'America/Sao_Paulo')::date;
    v_total integer;
begin
    if v_uid is null then
        raise exception 'nao_autenticado';
    end if;
    if p_tipo not in ('chat', 'ia', 'pesquisa') then
        raise exception 'tipo_invalido';
    end if;
    if p_limite is null or p_limite < 1 then
        raise exception 'limite_invalido';
    end if;

    insert into public.uso_diario as u (user_id, dia, tipo, quantidade)
    values (v_uid, v_dia, p_tipo, 1)
    on conflict (user_id, dia, tipo) do update
        set quantidade = u.quantidade + 1
        where u.quantidade < p_limite
    returning u.quantidade into v_total;

    if v_total is null then  -- a linha existia e já estava no limite
        raise exception 'limite_atingido';
    end if;
    return v_total;
end;
$$;

revoke all on function consumir_uso(text, integer) from public;
do $$ begin
    if exists (select 1 from pg_roles where rolname = 'anon') then
        execute 'revoke all on function consumir_uso(text, integer) from anon';
    end if;
end $$;
grant execute on function consumir_uso(text, integer) to authenticated;
