# DESIGN.md — Estudos IA

Estilo: **Warm indie SaaS**. Acolhedor como um caderno de estudos, organizado como um produto.
Os tokens moram em `src/index.css` (`:root` e `.dark`); este arquivo explica o porquê.
Para trocar de identidade visual, substitua este arquivo por um `DESIGN.md` do Refero Styles
e ajuste os tokens.

## Cores

| Papel | Token | Uso |
|---|---|---|
| Fundo creme | `--background` | Fundo da página. Nunca branco puro: cansa menos a vista em sessões longas. |
| Café | `--foreground` | Texto. Marrom escuro em vez de preto, mantém o calor sem perder contraste. |
| Terracota | `--primary` | Ação principal (um botão primário por tela), links, foco. |
| Areia / pêssego | `--secondary`, `--accent` | Superfícies de apoio, chips, hover. |
| Sálvia | `--sucesso` | Acerto, etapa concluída, link verificado. |
| Vermelho tijolo | `--destructive` | Erro, resposta errada, excluir. |

Gráficos: terracota, sálvia, mostarda, ardósia (`--chart-1..4`), nessa ordem.

## Tipografia

- Títulos (`h1`–`h3`): **Fraunces** (serifada com personalidade, "indie").
- Texto e interface: **Geist** (sem serifa, legível em tamanhos pequenos).
- Títulos curtos e em frase normal ("Sua trilha", não "SUA TRILHA").

## Forma

- Cantos generosos: `--radius: 0.9rem`. Cards e botões arredondados, nada de cantos retos.
- Bordas suaves (areia) em vez de sombras pesadas. Sombra só para o que flutua (diálogos).
- Espaço em branco farto: cards com `p-6`, seções separadas por `gap-6`/`gap-8`.

## Movimento (React Bits)

- Animação é tempero: `BlurText` no título da tela de entrada e `CountUp` nos números do painel.
- Telas de uso diário (trilha, exercícios, chat) não animam conteúdo; só transições curtas.

## Voz

- Português do Brasil, segunda pessoa, frases curtas e encorajadoras.
- Erros dizem o que fazer a seguir ("Tente descrever o objetivo de outro jeito").
- Status com palavras, não só cor (acessibilidade): "Verificado", "Concluída", "Errou".
