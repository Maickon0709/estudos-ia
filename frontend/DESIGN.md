# DESIGN.md — Estudos IA

Estilo: **Preto, branco e vermelho claro** (escolhido pelo Maickon em 10/10/2026, depois de testar
terracota e índigo + ciano; o índigo com gradientes ficou com "cara de vibe coded"). Editorial e sóbrio:
quase monocromático, com um vermelho claro só para marcar. Baseado nas regras de `taste-skill`, `redesign-skill` e `ui-ux-pro-max`
(repositórios de skills de design para IA), aplicadas para evitar o visual genérico de "site feito por IA".
Os tokens moram em `src/index.css` (`:root` e `.dark`).

## Cores

| Papel | Token | Uso |
|---|---|---|
| Fundo | `--background` | `#FAFAF9` no claro, `#121212` no escuro. |
| Texto | `--foreground` | Quase preto (`#111`), nunca `#000`. |
| Ação | `--primary` | Preto (branco no escuro): botões, foco de interação. |
| Marca | `--destaque` | Vermelho claro: palavra que gira, números, grifo, ícones de apoio, "você está aqui". Nunca em blocos grandes. |
| Superfícies | `--secondary`, `--muted` | Cinzas neutros. |
| Tinta da marca | `--accent` | Rosado bem claro: seleção, hover, célula "Estudos IA" na comparação. |
| Estado | `--sucesso`, `--destructive` | Só para acerto/erro, nunca decoração. |

**Proibido** (aprendido na marra): gradiente colorido em texto ou botão, manchas de luz coloridas, borda que
gira, brilho em volta de botão, linhas horizontais separando as seções da landing.

Sombras neutras (`.sombra-suave`, `.sombra-alta`), só no que flutua de verdade.
Fundos grandes ganham grão sutil (`.textura`) ou grade pontilhada (`.pontilhado`).

## Tipografia

- **Geist** em tudo; títulos peso 620, `letter-spacing: -0.028em`, `text-wrap: balance`.
- **Geist Mono** e `tabular-nums` para números (contadores, cronômetro, notas).
- Sem serifa decorativa (a Fraunces, padrão de IA, foi removida). Ênfase com cor ou peso da mesma fonte.
- Parágrafos com no máximo ~65 caracteres por linha.

## Forma

- Cantos: botões e campos `rounded-lg/xl`, cartões `rounded-2xl`, blocos da landing `rounded-3xl`.
  Selos com canto suave (`rounded-md`), não pílula. Avatar em quadrado arredondado, não círculo.
- Cartão só quando a elevação comunica hierarquia; listas usam divisória ou espaço.

## Landing

- Tema "caderno" (mockup A1, 15/10/2026), só na landing (`.tema-caderno` em `index.css`): papel `#F6F4EE`
  liso (sem quadriculado: a textura é o `FundoFluido`), tinta `#1B1A17`, vermelho `#D9473B`, títulos em Bricolage Grotesque 700
  (`-0.045em`), texto em DM Sans e números em DM Mono. No escuro vira o "quadro" (`#111110`, `#F07A6E`).
  Fontes via `@fontsource` (a CSP só aceita `font-src 'self'`, então nada de Google Fonts).
- Hero editorial (15/10/2026): "Estude" em Bricolage gigante + matéria que troca em **Gloock** vermelha (serifa de
  alto contraste, reta, pouco usada; só peso 400, só nessa palavra). Embaixo, fio fino e duas colunas: o resto da
  frase à esquerda e, numa coluna estreita com fio à esquerda, texto, botões e três provas em mono.
- Produto embaixo do hero (`JanelaProduto`: tela de trilha com dados fictícios fiéis ao app;
  link descartado NÃO aparece nela, porque no app ele nunca chega ao aluno; a conferência fica no bento).
- Ordem: hero → faixa de assuntos → números → fotos por matéria → três armadilhas → quatro passos → tour →
  "escolha como estudar" → bento de recursos → comparação → perguntas → chamada final. Seções em cartões
  brancos com borda fina (`rounded-[18px] ring-1`), títulos com `TituloRevelado`.
- Fotos reais (Unsplash) em `public/imagens/*.webp`, sem metadados, com `alt` descritivo, `loading="lazy"` e
  largura/altura fixas (sem pulo de layout). Créditos no README.
- No máximo um rótulo pequeno acima de título a cada três seções.
- Um texto só para a mesma ação ("Criar conta grátis").
- Números e comparações só com dados verdadeiros do produto (conferidos no código). Sem depoimento inventado.

## Movimento

- Motivado: entrada de página/aba (`.surgir`), cascata em listas (`.cascata`), tour que avança sozinho.
- Botões afundam de leve ao clicar. Tudo desligado com `prefers-reduced-motion`.
- Fluidez global por `data-slot` do shadcn (`index.css`, "Fluidez em todo o site"), sem mexer em cada tela:
  botões sobem 1px com mola (`--mola`) e o principal ganha sombra e um brilho que atravessa; ícone sozinho
  cresce e gira um pouco; setas (`data-seta`, marcadas em `lib/icones.ts`) andam na direção delas no hover
  de qualquer link ou botão; cartões entram em cascata (`backwards`, para não travar o transform do hover)
  e os clicáveis sobem; campos, abas, checkbox (visto com pulinho) e barra de progresso com transição.
  No menu, a pílula do item ativo desliza entre os itens (`layoutId` do motion), no topo e na barra do celular.
  Troca de página: sobe e ganha foco (blur 4px → 0).
- Landing: hero em cascata, CTAs magnéticos (`Magnetico`), produto do hero deitado em 3D que fica de pé
  com a rolagem e inclina com o mouse (`CartaoBrilho`), brilho em todos os cartões das seções.
- Interativo na landing (inspirado no React Bits e no 21st.dev, recolorido para a paleta):
  fundo da landing, do login e de todas as telas logadas (`FundoFluido fixo`, no `Layout`): linhas finas cinza numa correnteza lenta que vira redemoinho
  e acende em vermelho perto do cursor. Os rastros mais fracos nunca somem e formam uma trama de fios; ao
  abrir, ~25 s de correnteza são simulados em poucos quadros (`AQUECER`) para a trama já aparecer.
  O contêiner da página precisa de `isolation: isolate` se tiver fundo opaco, senão o canvas fica atrás dele;
  `FundoPontos` continua no projeto como alternativa),
  `DemoHero` (pedido → links conferidos, com um descartado → trilha), `EscolhaJeito` (três jeitos clicáveis,
  com demonstração; a de prática é uma questão de verdade), `TituloRevelado` (títulos palavra por palavra),
  faixa infinita de assuntos, `.grifo` (marca-texto vermelho que se desenha), `.foto-pb` (foto em preto e
  branco que ganha cor no hover), `TelaInclinada` (tour que se
  endireita com a rolagem), linha do tempo que se desenha com o scroll, `CartaoBrilho` (luz e borda que
  seguem o mouse, leve inclinação) e `CountUp` nos números. Efeitos de mouse ignoram toque.
- Sem WebGL nem biblioteca nova: só `motion`, `gsap` (já instalados), CSS e canvas.

## Fórmulas e figuras no chat

- Fórmula em LaTeX entre `$$` vira desenho (KaTeX); a que fica sozinha na linha ganha o quadro `.quadro-formula`.
- Figura: a IA escreve um bloco ` ```figura ` com um JSON curto (tipo + medidas) e o site desenha em SVG
  (`lib/figuras.ts` valida, `components/Figura.tsx` desenha) no quadro `.quadro-figura`. Tipos: segmento (régua),
  retangulo (com quadriculado para m²), caixa (comprimento × largura × altura), circulo, triangulo, barras (com
  linha da média), partes (dado, 25 de 100) e proporcao (regra de 3 direta/inversa). Nada de imagem de fora,
  link ou HTML: tipo desconhecido não desenha. Enquanto a resposta chega aparece "Desenhando a figura…".

## Voz

- Português do Brasil, frases curtas e diretas. Sem exclamação, sem travessão, sem jargão de marketing
  ("revolucione", "eleve", "sem esforço").
- Erros dizem o que fazer a seguir. Status com palavras, não só cor.
- Ícones: Phosphor (via `src/lib/icones.ts`), nunca emoji.
