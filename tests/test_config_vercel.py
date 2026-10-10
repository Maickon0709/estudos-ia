"""O vercel.json aplica os mesmos cabeçalhos de segurança testados no preview do Vite."""
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]


def test_cabecalhos_de_seguranca_iguais_ao_preview():
    vercel = json.loads((RAIZ / "vercel.json").read_text(encoding="utf-8"))
    esperados = json.loads((RAIZ / "frontend" / "cabecalhos-seguranca.json").read_text(encoding="utf-8"))
    globais = next(h for h in vercel["headers"] if h["source"] == "/(.*)")
    assert {h["key"]: h["value"] for h in globais["headers"]} == esperados


def test_api_e_site_no_mesmo_dominio():
    vercel = json.loads((RAIZ / "vercel.json").read_text(encoding="utf-8"))
    destinos = {r["source"]: r["destination"] for r in vercel["rewrites"]}
    assert destinos["/api/:caminho*"] == "/api/index"     # API no mesmo domínio (cookies da sessão)
    assert destinos["/:caminho*"] == "/index.html"         # rotas do site (SPA) caem no index
    assert vercel["outputDirectory"] == "frontend/dist"
