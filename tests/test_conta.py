"""Conta: resumo, exportação (LGPD) e exclusão com dupla confirmação."""
import json

import pytest
from postgrest.exceptions import APIError
from supabase_auth.errors import AuthApiError

from app.core import auth, dependencies
from app.core.errors import NaoAutenticadoError, ValidacaoError
from app.repositories.conta_repository import TABELAS_EXPORTADAS, ContaRepository
from app.services.conta_service import ContaService
from app.services.prompts import prompt_tutor
from tests.test_repositorios_estudo import Cliente


class ContaRepoFalso:
    def __init__(self, senha="certa"):
        self._senha = senha
        self.excluiu = False
        self.senhas_testadas = []

    def email(self):
        return "ana@x.com"

    def perfil(self):
        return {"nome": "Ana", "created_at": "2026-10-09", "termos_versao": "2026-10-09",
                "termos_aceitos_em": "2026-10-09T12:00:00+00:00"}

    def senha_confere(self, email, senha):
        self.senhas_testadas.append((email, senha))
        return senha == self._senha

    def exportar(self):
        return {"categorias": [{"nome": "SQL"}]}

    def excluir(self):
        self.excluiu = True

    def atualizar_perfil(self, user_id, campos):
        self.atualizacoes = getattr(self, "atualizacoes", []) + [(user_id, campos)]


def test_resumo():
    r = ContaService(ContaRepoFalso()).resumo()
    assert r["email"] == "ana@x.com" and r["nome"] == "Ana" and r["termos_versao"] == "2026-10-09"


def test_exportar_traz_os_dados():
    dados = ContaService(ContaRepoFalso()).exportar()
    assert dados["dados"] == {"categorias": [{"nome": "SQL"}]} and "exportado_em" in dados


@pytest.mark.parametrize("corpo", [None, {}, {"senha": "certa"}, {"senha": "certa", "confirmacao": "excluir"},
                                   {"confirmacao": "EXCLUIR"}, {"confirmacao": "EXCLUIR", "senha": ""}])
def test_excluir_exige_palavra_e_senha(corpo):
    repo = ContaRepoFalso()
    with pytest.raises(ValidacaoError):
        ContaService(repo).excluir("u1", corpo)
    assert repo.excluiu is False and repo.senhas_testadas == []


def test_excluir_com_senha_errada_nao_apaga():
    repo = ContaRepoFalso()
    with pytest.raises(ValidacaoError, match="Senha incorreta"):
        ContaService(repo).excluir("u1", {"confirmacao": "EXCLUIR", "senha": "errada"})
    assert repo.excluiu is False


def test_excluir_com_tudo_certo_apaga():
    repo = ContaRepoFalso()
    ContaService(repo).excluir("u1", {"confirmacao": "EXCLUIR", "senha": "certa"})
    assert repo.excluiu is True and repo.senhas_testadas == [("ana@x.com", "certa")]


# ---------- repositório ----------
class AuthAnonimo:
    def __init__(self, senha_ok=True):
        self._ok = senha_ok

    def get_user(self, token):
        class U:
            email = "ana@x.com"

        class R:
            user = U()
        return R()

    def sign_in_with_password(self, dados):
        if not self._ok:
            raise AuthApiError("Invalid login credentials", 400, "invalid_credentials")


class Anonimo:
    def __init__(self, senha_ok=True):
        self.auth = AuthAnonimo(senha_ok)


def test_repositorio_exporta_todas_as_tabelas_do_usuario():
    cliente = Cliente(data=[])
    dados = ContaRepository(cliente, Anonimo(), "tk").exportar()
    assert list(dados) == list(TABELAS_EXPORTADAS) and cliente.tabelas == list(TABELAS_EXPORTADAS)
    assert {"flashcards", "simulados", "sessoes_estudo", "metas"} <= set(TABELAS_EXPORTADAS)


def test_repositorio_senha_e_exclusao():
    cliente = Cliente(data=None)
    repo = ContaRepository(cliente, Anonimo(senha_ok=False), "tk")
    assert repo.email() == "ana@x.com"
    assert repo.senha_confere("ana@x.com", "x") is False
    repo.excluir()
    assert cliente.rpcs == [("excluir_minha_conta", {})]
    with pytest.raises(NaoAutenticadoError):
        ContaRepository(Cliente(erro=APIError({"message": "nao_autenticado"})), Anonimo(), "tk").excluir()


# ---------- rotas ----------
@pytest.fixture
def logado(monkeypatch):
    repo = ContaRepoFalso()

    def validar(token):
        if token != "ok":
            raise NaoAutenticadoError("Token inválido.")
        return "u1"

    monkeypatch.setattr(auth, "obter_user_id", validar)
    monkeypatch.setattr(dependencies, "get_conta_service", lambda: ContaService(repo))
    return repo


def test_rotas_da_conta(client, logado):
    h = {"Authorization": "Bearer ok"}
    assert client.get("/conta").status_code == 401
    assert client.get("/conta", headers=h).get_json()["email"] == "ana@x.com"

    arquivo = client.get("/conta/dados", headers=h)
    assert "attachment" in arquivo.headers["Content-Disposition"]
    assert json.loads(arquivo.get_data(as_text=True))["dados"]["categorias"][0]["nome"] == "SQL"

    assert client.delete("/conta", json={"confirmacao": "EXCLUIR", "senha": "errada"}, headers=h).status_code == 400
    assert logado.excluiu is False
    assert client.delete("/conta", json={"confirmacao": "EXCLUIR", "senha": "certa"}, headers=h).status_code == 204
    assert logado.excluiu is True


# ---------- tutora ----------
def test_tutora_oferece_as_opcoes_de_estudo():
    texto = prompt_tutor("SQL")
    for trecho in ("Estudar aqui no chat", "YouTube", "Montar trilha de estudo", "Praticar", "não invente links"):
        assert trecho in texto
