"""Fábrica de clientes Supabase.

Dois tipos de cliente, ambos com a chave ANON:
- anon_client(): para cadastro/login e para validar tokens.
- user_client(token): carrega o JWT do usuário nas chamadas ao banco.
  Assim o Postgres sabe quem é auth.uid() e o RLS faz a proteção.
"""
from flask import current_app
from supabase import Client, create_client


def anon_client() -> Client:
    return create_client(
        current_app.config["SUPABASE_URL"],
        current_app.config["SUPABASE_ANON_KEY"],
    )


def user_client(token: str) -> Client:
    client = anon_client()
    client.postgrest.auth(token)
    return client
