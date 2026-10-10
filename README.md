# Estudos IA

![CI](https://github.com/Maickon0709/estudos-ia/actions/workflows/ci.yml/badge.svg)

API (Flask + Supabase) e site (React) de uma plataforma de estudos com IA tutora. O estudante cria
**categorias** (ex.: Português, SQL), conversa com a IA, recebe uma **trilha** montada só
com **material real e verificado** da web e do YouTube, marca o progresso num **checklist**,
pratica com **exercícios por nível** corrigidos automaticamente, revisa o que errou com
**revisão espaçada** e acompanha tudo num **painel**.

## O que tem aqui

| Área | Destaques |
|---|---|
| Arquitetura | Camadas `routes → services → repositories`, integrações externas atrás de interfaces |
| Segurança | RLS no Postgres, JWT do usuário repassado ao banco, proteção SSRF, gabarito nunca exposto antes da resposta |
| IA sem alucinar link | A IA escolhe materiais **por número** de uma lista verificada e nem vê as URLs |
| Banco | Funções SQL **atômicas** (confirmar proposta, registrar resposta), views do painel |
| Regras de negócio | Trilha adaptativa, revisão espaçada e sequência de dias como funções puras |
| Qualidade | ~430 testes; SQL testado em **Postgres real**; regras críticas validadas por **mutação** |
| Front-end | React + TypeScript + Tailwind + shadcn/ui, animações do React Bits, CSP e testes no navegador |
| Entrega | CI no GitHub Actions com Postgres de serviço, Docker multi-stage, deploy na Vercel |

## Arquitetura

```
routes/        HTTP: recebe, delega e responde (sem regra de negócio)
services/      regras de negócio e validações (sem HTTP, sem banco)
  regras/      funções puras: adaptação da trilha, revisão espaçada, sequência de dias
repositories/  único lugar que fala com o Supabase
integrations/  IA (Groq), busca (Tavily), YouTube, validador de links
core/          auth, erros de domínio, dependências, validações comuns
migrations/    SQL versionado (rodar em ordem)
```

Fluxo: `route → service → repository → Supabase (Postgres com RLS)`.

## Front-end

Site em `frontend/` (Vite + React + TypeScript + Tailwind + shadcn/ui). Detalhes em
[`frontend/README.md`](frontend/README.md); identidade visual em [`frontend/DESIGN.md`](frontend/DESIGN.md).

```bash
# terminal 1: API
flask --app app:create_app run --debug
# terminal 2: site (http://localhost:5173), o Vite repassa /api para o Flask
cd frontend && npm install && npm run dev
```

## Fluxo do estudante

1. **Categoria** → `POST /categorias`
2. **Conversa** com a IA tutora sobre objetivo, nível e tempo → `POST /categorias/<id>/chat`
3. **Proposta de trilha** → `POST /categorias/<id>/propostas`: pesquisa verificada + IA monta as etapas
4. **Confirma** → `POST /propostas/<id>/confirmar`: o banco cria trilha, etapas e recursos de uma vez
5. **Estuda** pela trilha → `GET /trilhas/<id>`, marca etapas → `PATCH /etapas/<id>`
6. **Pratica** → `POST /etapas/<id>/exercicios` e `POST /exercicios/<id>/responder`
7. **Revisa** o que errou → `GET /revisoes/hoje`
8. **Acompanha** → `GET /categorias/<id>/painel`

## Decisões de engenharia

### Conteúdo real, nunca inventado
- O back-end pesquisa (Tavily: uma busca na web e outra no YouTube) e **verifica** cada item.
- **Links da web**: o `LinkValidator` confere se respondem. Com **proteção SSRF**: só http/https
  nas portas 80/443, host que resolva apenas para IPs públicos, cada redirecionamento revalidado,
  sem baixar o corpo da página. Limite conhecido: janela de DNS rebinding.
- **Vídeos e playlists**: a YouTube Data API confirma que existem e são públicos (vídeo removido
  muitas vezes ainda responde HTTP 200). A chave é **opcional**: sem ela, os vídeos saem
  `nao_verificado` em vez de a pesquisa falhar.
- Na proposta, a IA **escolhe materiais pelo número** e não recebe URLs. O que ela escrever de
  URL é descartado. Textos da web vão marcados como *dados, não instruções* (contra prompt injection).

### Banco: atomicidade e isolamento
- **RLS** em todas as tabelas; o Flask usa a chave **anon** + JWT do usuário. A `service_role` não é usada.
- `confirmar_proposta` cria trilha, etapas e recursos **numa transação**, trava a proposta com
  `FOR UPDATE` (clique duplo = uma trilha só) e recusa URLs `javascript:`/`data:`.
- `registrar_resposta` grava a resposta, recalcula a etapa e aplica a revisão espaçada
  **numa transação**: se qualquer parte falhar, nada fica gravado.
- Views com `security_invoker` alimentam o painel respeitando o RLS.

### Exercícios e correção
- Níveis **básico, intermediário e avançado**, gerados pela IA com base nas fontes da etapa.
- **Múltipla escolha é corrigida no código**: sem IA, sem custo, sem erro. Discursiva é corrigida
  pela IA comparando com o gabarito (a resposta do aluno vai delimitada como dado).
- O **gabarito nunca sai antes da resposta**: a listagem seleciona colunas explícitas no
  repository *e* o service filtra de novo (defesa em profundidade).

### Trilha adaptativa (`services/regras/adaptacao.py`)
- Intermediário libera com **≥ 80%** em 3+ exercícios do básico, ou direto com **"já sei"**.
- Avançado libera com ≥ 80% em 3+ do intermediário.
- **Reforço**: < 50% em 4+ respostas de um nível reabre a etapa concluída e desfaz um "já sei"
  que não se confirmou.
- Concluir é decisão do estudante (checklist manual). Ao dominar o avançado, só sugerimos.

### Revisão espaçada (`services/regras/revisao.py`)
- Errou → revisão amanhã. Acertando as revisões, o intervalo cresce **1 → 3 → 7 → 15 → 30 dias**;
  com 5 acertos seguidos o conteúdo é considerado dominado e sai da revisão.
- "Hoje" segue o fuso de Brasília (o servidor da Vercel roda em UTC).

### Painel
Progresso por categoria, acerto por nível, 5 pontos fracos, revisões pendentes e **sequência de
dias estudados** (vale até o fim do dia: se ainda não estudou hoje, a sequência de ontem continua).

## Rodando localmente

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env             # preencha as chaves (veja o arquivo)
flask --app app:create_app run --debug
```

**Banco (Supabase → SQL Editor), nesta ordem:**

1. `schema_supabase.sql` — tabelas, RLS e views
2. `migrations/002_propostas.sql` — confirmação atômica de propostas
3. `migrations/003_exercicios_revisoes.sql` — respostas, revisão espaçada e views do painel
4. `migrations/004_flashcards_simulados_estudo.sql` — flashcards, simulados, cronômetro, metas e calendário
5. `migrations/005_consentimento_exclusao_conta.sql` — aceite dos termos e exclusão da conta (LGPD)
6. `migrations/006_foto_perfil.sql` — bucket privado de fotos de perfil (Storage) e suas políticas
7. `migrations/007_limite_uso.sql` — limite diário de uso por usuário (chat, IA e pesquisa)

As migrações são idempotentes (podem rodar de novo sem quebrar).

**Teste da pesquisa com as chaves reais** (sem banco e sem login; gasta 2 créditos do Tavily):

```bash
python -m scripts.smoke_busca "crase na língua portuguesa"
```

## Docker

```bash
docker compose up --build api                      # API em http://localhost:8000/health
docker compose --profile testes run --rm testes    # suíte completa com Postgres descartável
```

O `Dockerfile` é multi-stage: `producao` (gunicorn, usuário sem privilégios, só `app/` e `api/`)
e `testes`. O `.env` nunca entra na imagem; as chaves vêm do `env_file` na hora de rodar.

## Testes

```bash
pytest                                             # unitários (sem banco, sem internet)
```

- Unitários usam dublês de repositório, IA, busca e YouTube e um transporte HTTP simulado.
- **SQL em Postgres real** (`tests/integracao`): RLS entre usuários, confirmação atômica,
  rollback em proposta inválida, clique duplo simultâneo, registro de resposta, revisões e views.
  Rodam quando `TEST_DATABASE_URL` aponta para um Postgres 15+ (no CI isso é automático):

  ```bash
  docker run --rm -e POSTGRES_PASSWORD=pg -p 5433:5432 postgres:16
  TEST_DATABASE_URL=postgresql://postgres:pg@localhost:5433/postgres pytest
  ```

  `tests/integracao/supabase_shim.sql` imita o mínimo do Supabase (`auth.uid()`, papel
  `authenticated`) e é **só para testes**: não rode no Supabase.
- **Teste de mutação**: as regras críticas foram quebradas de propósito (vazamento de gabarito,
  SSRF, trava do clique duplo, limiares da adaptação, intervalos da revisão, dono do exercício
  no SQL...) e os testes falharam em todas, como devem.

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/cadastro` | `{email, senha, nome}` |
| POST | `/auth/login` | `{email, senha}` → `access_token` |
| GET/POST | `/categorias` | listar / criar `{nome}` |
| GET/PATCH/DELETE | `/categorias/<id>` | detalhe / renomear / remover |
| POST | `/categorias/<id>/chat` | `{mensagem}` → `{pergunta, resposta}` |
| GET | `/categorias/<id>/mensagens` | histórico do chat |
| POST | `/categorias/<id>/pesquisar` | `{consulta}` → recursos verificados |
| POST | `/categorias/<id>/propostas` | `{objetivo}` → proposta `pendente` |
| GET | `/categorias/<id>/propostas?status=` | listar propostas |
| GET | `/propostas/<id>` | detalhe |
| POST | `/propostas/<id>/confirmar` | → `{trilha_id, proposta}` |
| POST | `/propostas/<id>/rejeitar` | → proposta `rejeitada` |
| GET | `/categorias/<id>/trilhas` | trilhas da categoria |
| GET | `/trilhas/<id>` | trilha com etapas, recursos e progresso |
| PATCH | `/etapas/<id>` | checklist: `{status?, ja_sabia?}` |
| POST | `/etapas/<id>/exercicios` | `{nivel, quantidade?}` (1 a 5) → exercícios sem gabarito |
| GET | `/etapas/<id>/exercicios?nivel=` | listar sem gabarito |
| POST | `/exercicios/<id>/responder` | `{resposta}` → correção, gabarito, efeitos na etapa e na revisão |
| GET | `/revisoes/hoje?categoria_id=` | exercícios para revisar hoje |
| GET | `/categorias/<id>/painel` | progresso, acerto por nível, pontos fracos, revisões, sequência |
| GET | `/health` | verificação |

Tudo exceto `/auth/*` e `/health` exige `Authorization: Bearer <access_token>`.
Erros: `{"erro": "<codigo>", "mensagem": "..."}` com 400, 401, 404, 409, 422 ou 502.

## Deploy (Vercel)

Um projeto só: o site (build do Vite em `frontend/dist`) na raiz e a API Flask em `/api`, no
**mesmo domínio**, porque a sessão usa cookies HttpOnly. Tudo já está no `vercel.json`:
build do front, função Python (`api/index.py`, até 60 s), roteamento (`/api/*` → Flask, o resto →
`index.html`) e os mesmos cabeçalhos de segurança de `frontend/cabecalhos-seguranca.json`.

1. Na Vercel: **Add New → Project → Import** o repositório do GitHub. Não mude as configurações
   de build: elas vêm do `vercel.json`.
2. Em **Environment Variables** (Production), cadastre:
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GROQ_API_KEY`, `GROQ_MODEL`, `TAVILY_API_KEY` e
   `YOUTUBE_API_KEY` (opcional).
3. **Deploy.** Com o endereço final em mãos (ex.: `https://estudos-ia.vercel.app`), crie também
   `VITE_SITE_URL` com ele e faça um **Redeploy**: o build passa a gerar `sitemap.xml` e as URLs
   absolutas da imagem de compartilhamento.
4. No Supabase, rode as migrações na ordem (seção acima) se ainda não rodou.

Depois de cada `git push` na `main`, a Vercel publica sozinha. O chat ao vivo usa streaming; se a
plataforma segurar a resposta, ela aparece inteira no fim, sem erro.

## Limites conhecidos

- **Limite de uso por usuário (feito)**: por dia, 60 mensagens de chat, 30 gerações/correções com IA e
  6 pesquisas ou trilhas (cada uma gasta 2 créditos do Tavily, que dá 1.000/mês). Ajustável por
  variáveis `LIMITE_*_DIA`. O contador fica no banco (`uso_diario`), porque na Vercel cada requisição
  pode cair numa instância diferente; só a função `consumir_uso()` (SECURITY DEFINER, só `auth.uid()`)
  escreve nele, então o usuário não consegue zerar o próprio contador. Falta: cache de pesquisas.
- **Escrita direta pela API do Supabase**: o RLS deixa o dono escrever nas próprias linhas. Com a
  chave anon, um usuário poderia, *só na própria conta*, criar proposta com link não verificado,
  ler gabaritos ou chamar `registrar_resposta` dizendo que acertou. Fechar isso exige mover essas
  escritas/leituras para funções `SECURITY DEFINER` e revogar o acesso direto.
- O fluxo completo foi testado ao vivo contra o Supabase, a Groq, o Tavily e o YouTube reais.
  O build do Docker roda no CI.

## Roadmap

- [x] Auth + categorias
- [x] Chat com IA por categoria
- [x] Busca na web + YouTube + validador de links
- [x] Propostas e confirmação
- [x] Trilha e checklist
- [x] Exercícios por nível e correção
- [x] Trilha adaptativa, revisão espaçada e painel de progresso
- [x] CI (GitHub Actions) e Docker
- [x] Front-end
- [x] Limite de uso por usuário
- [ ] Cache de pesquisas
- [ ] Endurecer escritas sensíveis com funções `SECURITY DEFINER`
