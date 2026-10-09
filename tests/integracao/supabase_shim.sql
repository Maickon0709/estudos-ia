-- Imitação MÍNIMA do que o Supabase já fornece, só para testes locais.
-- NÃO rode isto no Supabase de verdade.
create extension if not exists pgcrypto;

create schema if not exists auth;

create table if not exists auth.users (
    id                 uuid primary key default gen_random_uuid(),
    email              text,
    raw_user_meta_data jsonb default '{}'::jsonb
);

-- No Supabase, auth.uid() lê o "sub" do JWT da requisição.
create or replace function auth.uid() returns uuid
language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin;
    end if;
end $$;

grant usage on schema public, auth to authenticated;
grant execute on function auth.uid() to authenticated;
-- No Supabase, o papel authenticated já recebe estes privilégios por padrão;
-- quem protege as linhas é o RLS.
alter default privileges in schema public grant all on tables to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;
