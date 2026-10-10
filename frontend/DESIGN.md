# DESIGN.md — Estudos IA

Estilo: **Terracota + Ardósia**. Ferramenta de estudo para adultos: calma, legível, com um único
destaque quente. Baseado nas regras de `taste-skill`, `redesign-skill` e `ui-ux-pro-max`
(repositórios de skills de design para IA), aplicadas para evitar o visual genérico de "site feito por IA".
Os tokens moram em `src/index.css` (`:root` e `.dark`).

## Cores

| Papel | Token | Uso |
|---|---|---|
| Fundo | `--background` | Quase branco levemente frio (ardósia). Nunca creme, nunca branco puro. |
| Texto | `--foreground` | Tinta ardósia escura. Nunca `#000`. |
| Destaque | `--primary` | Terracota. A ÚNICA cor de destaque: CTA, links, foco, marcador "você está aqui". |
| Superfícies | `--secondary`, `--muted` | Ardósia clara, mesma família de cinza (nada de misturar cinza quente e frio). |
| Tinta do destaque | `--accent` | Terracota bem clara: seleção, hover, faixa final da landing. |
| Estado | `--sucesso`, `--destructive` | Só para acerto/erro, nunca decoração. |

Sombras tingidas de ardósia (`.sombra-suave`, `.sombra-alta`), só no que flutua de verdade.
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

- Hero dividido: texto à esquerda, componentes REAIS do app à direita (nada de prévia falsa feita com divs).
- Cada seção com um layout diferente (lista dividida, linha do tempo, tour, bento assimétrico).
- No máximo um rótulo pequeno acima de título a cada três seções.
- Um texto só para a mesma ação ("Criar conta grátis").
- Números e comparações só com dados verdadeiros do produto (conferidos no código). Sem depoimento inventado.

## Movimento

- Motivado: entrada de página/aba (`.surgir`), cascata em listas (`.cascata`), tour que avança sozinho.
- Botões afundam de leve ao clicar. Tudo desligado com `prefers-reduced-motion`.
- Interativo na landing (inspirado no React Bits e no 21st.dev, recolorido para terracota):
  `FundoPontos` (grade que foge do cursor, canvas 2D, pausa fora da tela), `TelaInclinada` (tour que se
  endireita com a rolagem), linha do tempo que se desenha com o scroll, `CartaoBrilho` (luz e borda que
  seguem o mouse, leve inclinação) e `CountUp` nos números. Efeitos de mouse ignoram toque.
- Sem WebGL nem biblioteca nova: só `motion`, `gsap` (já instalados), CSS e canvas.

## Voz

- Português do Brasil, frases curtas e diretas. Sem exclamação, sem travessão, sem jargão de marketing
  ("revolucione", "eleve", "sem esforço").
- Erros dizem o que fazer a seguir. Status com palavras, não só cor.
- Ícones: Phosphor (via `src/lib/icones.ts`), nunca emoji.
