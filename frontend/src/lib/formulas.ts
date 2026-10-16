// Prepara o texto da IA para o KaTeX (remark-math), antes do markdown. Nasceu de um chat real de porcentagem
// em que as fórmulas apareciam cruas: "[ \frac{20}{100} ... ]".
//
// - O site só desenha fórmula entre $$ e $$: um $ sozinho é o "R$" do dinheiro (remark-math com
//   singleDollarTextMath desligado). O prompt já pede $$, mas a IA às vezes usa \[ \] e \( \):
//   para o markdown, "\[" é só um colchete escapado, então convertemos antes.
// - Dentro da fórmula: "%" é comentário em LaTeX (apagaria o resto da conta) e "$" fecharia a fórmula;
//   os dois viram literais. "0,20" vira "0{,}20" para o KaTeX não pôr espaço depois da vírgula.
// - Código (``` e `...`) fica intacto.

const CODIGO = /(```[\s\S]*?```|`[^`\n]*`)/g

export function limparFormula(conteudo: string): string {
  return conteudo
    .trim()
    .replace(/(^|[^\\])%/g, '$1\\%')
    .replace(/(^|[^\\])\$/g, '$1\\$')
    .replace(/(\d),(?=\d)/g, '$1{,}')
}

function prepararTrecho(texto: string): string {
  return texto
    // já no formato certo: só limpa o conteúdo
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, f: string) => (f.includes('\n') ? `\n$$\n${limparFormula(f)}\n$$\n` : `$$${limparFormula(f)}$$`))
    // bloco: \[ ... \]  →  $$ sozinho na linha
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, f: string) => `\n\n$$\n${limparFormula(f)}\n$$\n\n`)
    // no meio da frase: \( ... \)  →  $$...$$
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, f: string) => `$$${limparFormula(f)}$$`)
}

export function prepararFormulas(texto: string): string {
  if (!/\\\[|\\\(|\$\$/.test(texto)) return texto // caminho rápido: a maioria das mensagens não tem fórmula
  return texto
    .split(CODIGO)
    .map((parte, i) => (i % 2 === 1 ? parte : prepararTrecho(parte)))
    .join('')
}
