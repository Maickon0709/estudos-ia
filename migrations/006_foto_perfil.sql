-- =====================================================================
-- 006 — Foto de perfil (Supabase Storage).
-- Rode DEPOIS de 005_consentimento_exclusao_conta.sql. Idempotente.
--
-- Bucket PRIVADO: a foto não tem link público. O back-end baixa com o JWT do
-- dono e entrega ao site. Cada usuário só lê e grava a própria pasta
-- (<id do usuário>/avatar.webp). A API ainda valida e regrava a imagem.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', false, 1048576, array['image/webp'])
on conflict (id) do update
    set public             = false,
        file_size_limit    = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

-- Coluna para o site saber se há foto (e trocar o cache quando ela muda).
alter table profiles add column if not exists avatar_atualizado_em timestamptz;

drop policy if exists avatares_ler_propria on storage.objects;
create policy avatares_ler_propria on storage.objects
    for select to authenticated
    using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists avatares_enviar_propria on storage.objects;
create policy avatares_enviar_propria on storage.objects
    for insert to authenticated
    with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists avatares_trocar_propria on storage.objects;
create policy avatares_trocar_propria on storage.objects
    for update to authenticated
    using      (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid()::text))
    with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists avatares_apagar_propria on storage.objects;
create policy avatares_apagar_propria on storage.objects
    for delete to authenticated
    using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid()::text));
