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

## Arquitetura (respeite as camadas)

- `app/routes/`: só HTTP. Recebe, pega o service em `app/core/dependencies.py`, responde.
- `app/services/`: regras de negócio. Não importa Flask nem Supabase.
- `app/services/regras/`: funções puras (adaptação da trilha, revisão espaçada, sequência de dias).
- `app/repositories/`: único lugar que fala com o Supabase.
- `app/integrations/`: Groq, Tavily, YouTube e LinkValidator. Trocar de provedor = nova classe, mesmo método.
- `app/core/errors.py`: erros de domínio. Services levantam esses erros; só o handler em
  `create_app()` vira HTTP. Nunca devolva status HTTP de dentro de um service.
- `migrations/`: SQL versionado e idempotente, aplicado depois de `schema_supabase.sql`.

## Convenções

- Código, mensagens e nomes em português do Brasil (identificadores sem acento).
- Nenhuma chave no código: tudo via `.env`. O `.env` nunca vai para o git nem para a imagem Docker.
- O back-end usa a chave **anon** + JWT do usuário, e o RLS protege os dados. Não usar `service_role`.
- Escrita que mexe em várias tabelas vai numa **função SQL atômica** (`SECURITY INVOKER`),
  não em várias chamadas REST seguidas.
- Testes unitários usam dublês (`tests/fakes*.py`) e um transporte HTTP simulado; nada de rede.
- Mudou SQL? Adicione ou ajuste teste em `tests/integracao/` (roda em Postgres real).
- Regra crítica nova: valide por mutação, quebrando a regra de propósito e confirmando que um teste falha.

## Invariantes que não podem quebrar

1. Nenhum link chega ao usuário sem verificação (LinkValidator ou YouTube Data API).
2. A IA escolhe materiais **só pelo número**; não recebe URLs e nada que ela escreva vira link.
3. Gabarito e explicação nunca saem antes da resposta (`COLUNAS_PUBLICAS` no repository + `publico()` no service).
4. Múltipla escolha é corrigida no código, sem IA.
5. Falha da IA ou da busca não grava nada pela metade.
6. LinkValidator: só http/https, portas 80/443, host com IPs apenas públicos, cada redirecionamento revalidado.
7. Respostas da IA são validadas por parsers (`proposta_parser.py`, `exercicio_parser.py`) antes de qualquer gravação.

## Estado atual

- Roadmap do back-end completo: auth, categorias, chat, pesquisa verificada, propostas com
  confirmação atômica, trilha e checklist, exercícios por nível, correção, trilha adaptativa,
  revisão espaçada, painel, CI e Docker.
- ~424 testes: 396 unitários + 28 de SQL em Postgres real.
- **Não testado ao vivo** (faltavam as chaves): Groq, Tavily, YouTube e o caminho Supabase ↔ Flask.
  O build do Docker só foi validado por emulação; o build real acontece no CI.
- No Supabase, rodar nesta ordem: `schema_supabase.sql`, `migrations/002_propostas.sql`,
  `migrations/003_exercicios_revisoes.sql`.

## Próximos passos sugeridos

1. Smoke test com as chaves reais e um fluxo completo contra o Supabase.
2. Front-end.
3. Limite de uso por usuário e cache de pesquisas (Tavily gratuito: 1.000 créditos/mês; cada
   pesquisa ou proposta gasta 2).
4. Endurecer escritas e leituras sensíveis com funções `SECURITY DEFINER` (ver "Limites conhecidos" no README).
