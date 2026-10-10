# Estudos IA — instruções para o Claude Code

Plataforma de estudos com IA tutora: API Flask + Supabase (Postgres). Projeto de portfólio
com foco em back-end Python e dados. Visão completa no `README.md`; o **porquê** de cada
decisão está em `docs/HISTORICO.md` (leia quando for mudar algo estrutural). A conversa
completa em que o projeto nasceu está em `docs/CONVERSA.md` (local, fora do git): consulte
quando precisar do contexto exato de um pedido do Maickon.

## Comandos

- Instalar: `pip install -r requirements-dev.txt`
- Rodar: `flask --app app:create_app run --debug` (precisa do `.env`; modelo em `.env.example`)
- Testes unitários (sem banco e sem internet): `pytest -q`
- Testes de SQL em Postgres real: defina `TEST_DATABASE_URL` (ver README, seção Testes) e rode `pytest -q`
- Teste manual da pesquisa com chaves reais: `python -m scripts.smoke_busca "tema"`
- Docker: `docker compose up --build api` e `docker compose --profile testes run --rm testes`
- Front-end (`frontend/`): `npm install`, `npm run dev` (porta 5173, proxy `/api` → Flask 5000),
  `npm run build`, `npm run lint`. `npm run preview` serve o build com os cabeçalhos de segurança.

## Arquitetura (respeite as camadas)

- `app/routes/`: só HTTP. Recebe, pega o service em `app/core/dependencies.py`, responde.
- `app/services/`: regras de negócio. Não importa Flask nem Supabase.
- `app/services/regras/`: funções puras (adaptação da trilha, revisão espaçada, sequência de dias).
- `app/repositories/`: único lugar que fala com o Supabase.
- `app/integrations/`: Groq, Tavily, YouTube e LinkValidator. Trocar de provedor = nova classe, mesmo método.
- `app/core/errors.py`: erros de domínio. Services levantam esses erros; só o handler em
  `create_app()` vira HTTP. Nunca devolva status HTTP de dentro de um service.
- `migrations/`: SQL versionado e idempotente, aplicado depois de `schema_supabase.sql`.
- `frontend/`: React + TS + Tailwind + shadcn/ui. Fala **só com a API Flask** (nunca direto com o
  Supabase). `src/lib/api.ts` é o único ponto de rede; telas em `src/paginas/`. Visual em `DESIGN.md`.

## Convenções

- Código, mensagens e nomes em português do Brasil (identificadores sem acento).
- Nenhuma chave no código: tudo via `.env`. O `.env` nunca vai para o git nem para a imagem Docker.
- O back-end usa a chave **anon** + JWT do usuário, e o RLS protege os dados. Não usar `service_role`.
- Escrita que mexe em várias tabelas vai numa **função SQL atômica** (`SECURITY INVOKER`),
  não em várias chamadas REST seguidas. Única exceção a `SECURITY INVOKER`: `excluir_minha_conta()`
  (`SECURITY DEFINER`, `search_path=''`), porque a chave anon não apaga `auth.users`; ela só apaga
  `auth.uid()`, nunca um id recebido por parâmetro.
- Testes de SQL locais sem Docker: um Postgres portátil (`embedded-postgres` do npm) na porta 5433
  com `TEST_DATABASE_URL=postgresql://postgres:pg@localhost:5433/postgres`.
- Testes unitários usam dublês (`tests/fakes*.py`) e um transporte HTTP simulado; nada de rede.
- Mudou SQL? Adicione ou ajuste teste em `tests/integracao/` (roda em Postgres real).
- Regra crítica nova: valide por mutação, quebrando a regra de propósito e confirmando que um teste falha.

## Segurança do front-end

- Texto da IA e do usuário é sempre renderizado como texto: proibido `dangerouslySetInnerHTML`
  (o CI barra; a única exceção é o `chart.tsx` do shadcn, que só recebe a config fixa de cores).
- Só `urlSegura()` (`src/lib/seguranca.ts`) gera `href`: apenas http/https, com `noopener noreferrer`.
- Variáveis `VITE_*` vão para o JS público: nunca coloque segredos nelas.
- Cabeçalhos de produção (CSP, anti-clickjacking etc.) em `frontend/cabecalhos-seguranca.json`.
- Sessão em **cookie HttpOnly** (`ei_acesso` ~1 h, `ei_renovacao` 30 dias; Secure, SameSite=Lax),
  gravado pelo back-end (`app/core/auth.py`). O JS nunca vê o token; o front guarda só um "sim/não"
  (`estudos-ia:logado`). Escrita autenticada por cookie exige `X-Requested-With: estudos-ia` (anti-CSRF).
  Token vencido: o front chama `/auth/renovar` uma vez e repete a requisição. `Authorization: Bearer`
  continua aceito para testes e clientes de API. Front e API precisam do MESMO domínio (proxy `/api`).

## Invariantes que não podem quebrar

1. Nenhum link chega ao usuário sem verificação (LinkValidator ou YouTube Data API).
2. A IA escolhe materiais **só pelo número**; não recebe URLs e nada que ela escreva vira link.
3. Gabarito e explicação nunca saem antes da resposta (`COLUNAS_PUBLICAS` no repository + `publico()` no service).
4. Múltipla escolha é corrigida no código, sem IA.
5. Falha da IA ou da busca não grava nada pela metade.
6. LinkValidator: só http/https, portas 80/443, host com IPs apenas públicos, cada redirecionamento revalidado.
7. Respostas da IA são validadas por parsers (`proposta_parser.py`, `exercicio_parser.py`) antes de qualquer gravação.
8. Simulado: gabarito só depois de finalizar; "Não entendi" só depois de responder; chat ao vivo só grava no fim.
9. Cadastro exige aceite dos termos (versão em `TERMOS_VERSAO` no `auth.py` = `VERSAO_TERMOS` no front).

## Estado atual

- Roadmap do back-end completo: auth, categorias, chat, pesquisa verificada, propostas com
  confirmação atômica, trilha e checklist, exercícios por nível, correção, trilha adaptativa,
  revisão espaçada, painel, CI e Docker.
- ~589 testes: 538 unitários + 51 de SQL em Postgres real.
- Repositório no GitHub (`Maickon0709/estudos-ia`); o CI passou, inclusive o build real do Docker.
- **Testado ao vivo em 09/10/2026** contra o Supabase, a Groq e o Tavily reais: cadastro, login,
  RLS entre dois usuários, chat, pesquisa, proposta, confirmação (com clique duplo recusado),
  trilha, checklist, geração e correção de exercícios, revisão e painel.
- Modelo da Groq: `openai/gpt-oss-120b`. O `llama-3.3-70b-versatile` não está liberado para a
  conta (erro `model_not_found`). Para ver os modelos disponíveis: `GET /openai/v1/models`.
- YouTube Data API testada ao vivo: vídeos saem `verificado`, com título oficial, canal e duração.
- Filtros de relevância em `pesquisa_service.py`, ambos nascidos de achados no teste ao vivo:
  `DOMINIOS_SOCIAIS` (um reel do Instagram virou material) e `CATEGORIAS_YOUTUBE_FORA`
  (categoria "10" = Música; "crase na língua portuguesa" trouxe o clipe da banda Lingua Ignota).
- Front-end completo (login, categorias, chat, proposta → confirmação, trilha com checklist,
  exercícios por nível, revisões e painel), testado de ponta a ponta no Edge headless contra a API
  e as chaves reais, com a CSP de produção ligada e um teste de XSS. Ainda sem deploy.
- Segunda rodada (10/10/2026): página inicial pública (React Bits: Aurora, SpotlightCard…), tela
  "Hoje" com calendário de calor e meta semanal, chat ao vivo (SSE) com markdown seguro, "Não entendi",
  trilha como mapa, confete, modo escuro, flashcards, simulado cronometrado, cronômetro de foco,
  aba "Praticar", atalhos de estudo no chat (a tutora oferece: chat, trilha com YouTube/sites, praticar),
  termos/privacidade com aceite no cadastro, guia "Como usar", página Conta (baixar dados e excluir).
  Back-end e SQL testados; **telas logadas novas ainda não testadas ao vivo** (dependem das migrações 004 e 005).
- No Supabase, rodar nesta ordem: `schema_supabase.sql`, `migrations/002_propostas.sql`,
  `migrations/003_exercicios_revisoes.sql`, `migrations/004_flashcards_simulados_estudo.sql`,
  `migrations/005_consentimento_exclusao_conta.sql`, `migrations/006_foto_perfil.sql`.
- Ao vivo em 10/10/2026: migrações 004 e 005 já aplicadas no Supabase do Maickon; `/hoje`, `/conta`,
  aceite dos termos e **exclusão de conta** confirmados (login falha depois de excluir).
  Falta rodar a 006 (foto de perfil): sem ela o Storage responde "Bucket not found".
- Foto de perfil: bucket PRIVADO `avatares`, arquivo `<user_id>/avatar.webp`; a API valida o conteúdo
  (Pillow), recorta 256x256, regrava em WebP sem metadados (some o GPS) e entrega ao site como blob:.
  Excluir a conta apaga a foto ANTES (o Storage fica fora da cascata do banco).
- SEO: descrição por página (`useTitulo(titulo, descricao)`), `og.jpg` 1200x630, manifesto e ícones.
  `frontend/seo.ts` gera `robots.txt` sempre e `sitemap.xml` + URLs absolutas só com `VITE_SITE_URL`.
- Terceira rodada (10/10/2026): login em cookie HttpOnly + anti-CSRF + renovação automática; landing com
  "Por que existe" e tour interativo (`TourProduto.tsx`); boas-vindas em 5 passos e dicas de primeira
  visita (`Tutorial.tsx`, "Rever tutorial" na Conta); transições CSS (`.surgir`, `.cascata`, `.cartao-vivo`
  em `index.css`). Teste ao vivo no navegador: 25/25 (inclui as checagens de segurança da sessão).
- Decisões: sem banner de cookies (os cookies da sessão são estritamente necessários) (o site não usa cookies; o armazenamento local é só o essencial);
  analytics fica para o deploy (preferir uma opção sem cookies, como Vercel Web Analytics ou Umami,
  e atualizar a Política de Privacidade).

## Próximos passos sugeridos

1. Deploy (Vercel) do site e da API, aplicando `cabecalhos-seguranca.json`.
2. Upload de PDFs/documentos como fonte (RAG com busca textual do Postgres).
3. Limite de uso por usuário e cache de pesquisas (Tavily gratuito: 1.000 créditos/mês; cada
   pesquisa ou proposta gasta 2).
4. Endurecer escritas e leituras sensíveis com funções `SECURITY DEFINER` (ver "Limites conhecidos" no README).
