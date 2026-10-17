/**
 * Figuras do chat: a IA não desenha nem manda imagem. Ela escreve um bloco ```figura com um JSON curto
 * (o tipo e as medidas) e o site desenha em SVG com componentes fixos. Este arquivo só LÊ e valida o
 * JSON: tipo fora da lista, número inválido ou texto longo demais são barrados ou cortados aqui.
 * Nada do JSON vira HTML, link ou imagem de fora; os textos entram no SVG como texto puro.
 */

export type Figura =
  | { tipo: 'segmento'; medida: number; unidade: string; rotulo: string }
  | { tipo: 'retangulo'; largura: number; altura: number; unidade: string; rotuloLargura: string; rotuloAltura: string; quadriculado: boolean; centro: string }
  | { tipo: 'caixa'; comprimento: number; largura: number; altura: number; unidade: string; rotuloComprimento: string; rotuloLargura: string; rotuloAltura: string; centro: string }
  | { tipo: 'circulo'; raio: number; unidade: string; mostrar: 'raio' | 'diametro'; centro: string }
  | { tipo: 'triangulo'; base: number; altura: number; unidade: string; centro: string }
  | { tipo: 'barras'; titulo: string; itens: { rotulo: string; valor: number }[]; linha: number | null; rotuloLinha: string }
  | { tipo: 'partes'; total: number; destaque: number; rotulo: string }
  | { tipo: 'proporcao'; cabecalho: [string, string]; linhas: [string, string][]; relacao: 'direta' | 'inversa' }

const TEXTO_MAX = 32
const BARRAS_MAX = 8
const PARTES_MAX = 100
const LINHAS_MAX = 4

function texto(valor: unknown, padrao = ''): string {
  if (typeof valor !== 'string' && typeof valor !== 'number') return padrao
  const limpo = String(valor).replace(/\s+/g, ' ').trim()
  return limpo ? limpo.slice(0, TEXTO_MAX) : padrao
}

/** Aceita 29.7 ou "29,7"; devolve null se não for um número positivo e razoável. */
function numero(valor: unknown, maximo = 1e6): number | null {
  const n = typeof valor === 'string' ? Number(valor.replace(',', '.')) : valor
  return typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= maximo ? n : null
}

/** 29.7 → "29,7" (vírgula decimal, como o aluno escreve). */
export function formatar(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

/** Rótulo padrão de uma medida: "5 m" ou só "5" sem unidade. */
export function medida(n: number, unidade: string): string {
  return unidade ? `${formatar(n)} ${unidade}` : formatar(n)
}

export function lerFigura(bruto: string): Figura | null {
  let dados: unknown
  try {
    dados = JSON.parse(bruto)
  } catch {
    return null
  }
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return null
  const d = dados as Record<string, unknown>
  const unidade = texto(d.unidade).slice(0, 6)
  const centro = texto(d.centro)

  switch (d.tipo) {
    case 'segmento': {
      const n = numero(d.medida)
      return n ? { tipo: 'segmento', medida: n, unidade, rotulo: texto(d.rotulo, 'comprimento') } : null
    }
    case 'retangulo': {
      const largura = numero(d.largura)
      const altura = numero(d.altura)
      if (!largura || !altura) return null
      return {
        tipo: 'retangulo', largura, altura, unidade, centro,
        rotuloLargura: texto(d.rotulo_largura, medida(largura, unidade)),
        rotuloAltura: texto(d.rotulo_altura, medida(altura, unidade)),
        quadriculado: d.quadriculado === true,
      }
    }
    case 'caixa': {
      const comprimento = numero(d.comprimento)
      const largura = numero(d.largura ?? d.profundidade)
      const altura = numero(d.altura)
      if (!comprimento || !largura || !altura) return null
      return {
        tipo: 'caixa', comprimento, largura, altura, unidade, centro,
        rotuloComprimento: texto(d.rotulo_comprimento, medida(comprimento, unidade)),
        rotuloLargura: texto(d.rotulo_largura ?? d.rotulo_profundidade, medida(largura, unidade)),
        rotuloAltura: texto(d.rotulo_altura, medida(altura, unidade)),
      }
    }
    case 'circulo': {
      const raio = numero(d.raio)
      return raio ? { tipo: 'circulo', raio, unidade, centro, mostrar: d.mostrar === 'diametro' ? 'diametro' : 'raio' } : null
    }
    case 'triangulo': {
      const base = numero(d.base)
      const altura = numero(d.altura)
      return base && altura ? { tipo: 'triangulo', base, altura, unidade, centro } : null
    }
    case 'barras': {
      if (!Array.isArray(d.itens)) return null
      const itens = d.itens
        .slice(0, BARRAS_MAX)
        .map((item) => {
          const i = (item ?? {}) as Record<string, unknown>
          const valor = typeof i.valor === 'number' && Number.isFinite(i.valor) && i.valor >= 0 ? Math.min(i.valor, 1e6) : null
          return valor === null ? null : { rotulo: texto(i.rotulo, '?').slice(0, 12), valor }
        })
        .filter((i): i is { rotulo: string; valor: number } => i !== null)
      if (itens.length === 0) return null
      return { tipo: 'barras', titulo: texto(d.titulo), itens, linha: numero(d.linha), rotuloLinha: texto(d.rotulo_linha, 'média') }
    }
    case 'partes': {
      const total = numero(d.total, PARTES_MAX)
      if (!total || !Number.isInteger(total)) return null
      const destaque = typeof d.destaque === 'number' && Number.isInteger(d.destaque) ? Math.min(Math.max(d.destaque, 0), total) : 0
      return { tipo: 'partes', total, destaque, rotulo: texto(d.rotulo, `${destaque} de ${total}`) }
    }
    case 'proporcao': {
      const cab = Array.isArray(d.cabecalho) ? d.cabecalho : []
      if (!Array.isArray(d.linhas)) return null
      const linhas = d.linhas
        .slice(0, LINHAS_MAX)
        .filter((l): l is unknown[] => Array.isArray(l) && l.length >= 2)
        .map((l) => [texto(l[0], '?').slice(0, 14), texto(l[1], '?').slice(0, 14)] as [string, string])
      if (linhas.length < 2) return null
      return {
        tipo: 'proporcao', linhas,
        cabecalho: [texto(cab[0]).slice(0, 14), texto(cab[1]).slice(0, 14)],
        relacao: d.relacao === 'inversa' ? 'inversa' : 'direta',
      }
    }
    default:
      return null
  }
}
