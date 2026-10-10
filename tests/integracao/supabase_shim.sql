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

-- ---------- Storage (mínimo para testar as políticas da migração 006) ----------
create schema if not exists storage;
grant usage on schema storage to authenticated;

create table if not exists storage.buckets (
    id                 text primary key,
    name               text not null,
    public             boolean default false,
    file_size_limit    bigint,
    allowed_mime_types text[]
);

create table if not exists storage.objects (
    id         uuid primary key default gen_random_uuid(),
    bucket_id  text references storage.buckets(id),
    name       text not null,
    owner      uuid,
    created_at timestamptz default now(),
    unique (bucket_id, name)
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated;

-- No Supabase: pastas do caminho, sem o nome do arquivo ('a/b/c.png' -> {a,b}).
create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant execute on function storage.foldername(text) to authenticated;
