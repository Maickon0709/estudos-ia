-- =====================================================================
-- 005 — Consentimento (termos de uso e privacidade) e exclusão da conta.
-- Rode DEPOIS de 004_flashcards_simulados_estudo.sql. Idempotente.
-- =====================================================================

-- ---------- Registro do aceite dos termos (LGPD: quem aceitou, qual versão, quando) ----------
alter table profiles add column if not exists termos_versao     text;
alter table profiles add column if not exists termos_aceitos_em timestamptz;

-- O cadastro manda a versão aceita nos metadados do usuário; o gatilho grava
-- no perfil junto com a criação da conta (mesma transação: sem conta sem aceite).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, nome, termos_versao, termos_aceitos_em)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
        new.raw_user_meta_data->>'termos_versao',
        case when new.raw_user_meta_data ? 'termos_versao' then now() end
    );
    return new;
end;
$$;

-- =====================================================================
-- excluir_minha_conta(): apaga o usuário logado do Supabase Auth.
--
-- Por que SECURITY DEFINER (a exceção à regra do projeto): com a chave anon,
-- ninguém consegue apagar linhas de auth.users. A função roda com os direitos
-- do dono (postgres), mas SÓ apaga o próprio usuário: o id vem de auth.uid(),
-- nunca de um parâmetro. search_path vazio evita sequestro de nomes.
--
-- A cascata faz o resto: auth.users -> profiles -> categorias, mensagens,
-- trilhas, etapas, exercícios, respostas, revisões, flashcards, simulados,
-- sessões de estudo e metas.
-- =====================================================================
create or replace function excluir_minha_conta()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_uid uuid := auth.uid();
begin
    if v_uid is null then
        raise exception 'nao_autenticado';
    end if;
    delete from auth.users where id = v_uid;
end;
$$;

revoke all on function excluir_minha_conta() from public;
do $$ begin
    if exists (select 1 from pg_roles where rolname = 'anon') then
        execute 'revoke all on function excluir_minha_conta() from anon';
    end if;
end $$;
grant execute on function excluir_minha_conta() to authenticated;
