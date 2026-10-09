# Histórico de decisões

Resumo da conversa em que o projeto foi planejado e construído (08 e 09/10/2026), para quem
for continuar o trabalho entender **por que** as coisas são como são.

## 1. A ideia (requisitos do Maickon)

- Site de estudos com uma IA que auxilia o estudante. Cadastro e login.
- O estudante cria **categorias** (ex.: Português). Cada categoria tem sua própria conversa com a IA.
- A IA pesquisa e sugere **conteúdo real**: links da web e vídeos/playlists do YouTube.
- **Só com a confirmação do estudante** a IA cria, dentro da categoria, a matéria, a trilha,
  os checkpoints e os exercícios.
- Checklist do que já estudou, do que já sabe e do que não sabe: **marcado manualmente**.
- Exercícios em nível **básico, intermediário e avançado**, conforme o pedido do estudante,
  corrigidos com base no conteúdo pesquisado.
- Stack escolhida: **Supabase** (banco) e **Vercel** (deploy).

## 2. Diferenciais em relação ao NotebookLM

O NotebookLM parte das fontes que o usuário traz; este projeto parte de um **objetivo** e monta
o caminho. Para se diferenciar de verdade, foram incluídos: **trilha adaptativa** ao desempenho,
**revisão espaçada** dos pontos fracos e **painel de progresso** por categoria.

## 3. Pesquisa de serviços (08/10/2026, conferir antes de pagar algo)

- **Tavily** (escolhido): 1.000 créditos/mês grátis, sem cartão; busca básica = 1 crédito.
  Feito para IA, com filtro por domínio.
- **Serper**: 2.500 consultas de teste; depois US$ 50 por 50 mil. Dados vieram de um agregador
  (a página oficial não abriu na pesquisa).
- **Brave Search API**: o plano gratuito acabou em fevereiro de 2026. Descartado.
- **YouTube Data API**: a documentação oficial dizia que `search.list` tem limite próprio de
  ~100 chamadas/dia por projeto. Por isso a busca de vídeos usa o Tavily filtrando
  `youtube.com`, e a API do YouTube só **confirma** os vídeos (`videos.list`/`playlists.list`,
  1 unidade cada, até 50 ids). A chave do YouTube é opcional; sem ela, vídeos saem `nao_verificado`.
- **IA**: Groq (o Maickon já usava no projeto pessoal Cérebro Claude). Nome do modelo fica no
  `.env` porque os modelos mudam.

## 4. Construção, etapa por etapa

1. **Auth + categorias** em camadas (routes → services → repositories), RLS no Supabase,
   chave anon + JWT do usuário.
2. **Chat por categoria**: últimas 20 mensagens como contexto; pergunta e resposta gravadas num
   INSERT só, com `created_at` explícito (o `now()` do Postgres é igual dentro da transação).
   Se a IA falha, nada é gravado.
3. **Pesquisa verificada**: Tavily (2 créditos por pesquisa) + LinkValidator com proteção SSRF
   + YouTube Data API. Motivo da verificação: vídeo removido muitas vezes ainda responde HTTP 200.
4. **Propostas**: a IA recebe a lista verificada **numerada e sem URLs** e devolve JSON com os
   números escolhidos. A confirmação é a função SQL `confirmar_proposta` (atômica, com
   `FOR UPDATE` contra clique duplo, recusa `javascript:`/`data:`).
5. **Trilha e checklist**: `PATCH /etapas/<id>` com `status` e `ja_sabia`.
6. **Exercícios**: gerados pela IA a partir das fontes da etapa; múltipla escolha corrigida no
   código, discursiva pela IA; gabarito escondido até a resposta. `registrar_resposta` é atômica.
7. **Adaptação**: 80% em 3+ libera o próximo nível; "já sei" pula o básico; < 50% em 4+ pede
   reforço, reabre etapa concluída e desfaz "já sei". Concluir continua manual.
   **Revisão espaçada**: 1 → 3 → 7 → 15 → 30 dias; 5 acertos seguidos = dominado.
   **Painel**: progresso, acerto por nível, pontos fracos, revisões e sequência de dias (fuso de Brasília).
8. **CI** (GitHub Actions com Postgres de serviço) e **Docker** multi-stage.

## 5. Como foi verificado

- O SQL (schema e migrações) foi executado e testado num **Postgres 16 real**: RLS entre dois
  usuários, atomicidade, rollback, clique duplo simultâneo e views.
- **Teste de mutação**: as regras críticas foram quebradas de propósito e os testes falharam em
  todas (vazamento de gabarito, SSRF, trava do clique duplo, limiares da adaptação, intervalos
  da revisão, dono do exercício no SQL, entre outras).
- Ambiente limpo instalado só pelo `requirements-dev.txt` passou a suíte inteira.
- O build da imagem Docker **não** rodou (o Docker Hub estava bloqueado no ambiente); a imagem
  foi emulada rodando o gunicorn só com `app/` e `api/`.

## 6. Pendências e riscos conhecidos

- Nada foi testado com as chaves reais (Groq, Tavily, YouTube) nem o caminho Supabase ↔ Flask.
- O formato exato de retorno do `rpc` do supabase-py foi tratado de forma defensiva (aceita
  valor puro, lista ou objeto).
- Para vídeos removidos, a documentação do YouTube não deixava claro se vêm como item ausente ou
  erro 404; o cliente trata os dois.
- Sem limite de uso por usuário (custos de Tavily e Groq).
- Com a chave anon, um usuário consegue, só na própria conta, ler gabaritos e se marcar como
  certo pela API do Supabase. Solução: funções `SECURITY DEFINER` e revogar acesso direto.
