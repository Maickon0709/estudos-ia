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

## Movimento

- Motivado: entrada de página/aba (`.surgir`), cascata em listas (`.cascata`), tour que avança sozinho.
- Botões afundam de leve ao clicar. Tudo desligado com `prefers-reduced-motion`.

## Voz

- Português do Brasil, frases curtas e diretas. Sem exclamação, sem travessão, sem jargão de marketing
  ("revolucione", "eleve", "sem esforço").
- Erros dizem o que fazer a seguir. Status com palavras, não só cor.
- Ícones: Phosphor (via `src/lib/icones.ts`), nunca emoji.
