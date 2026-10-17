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
  | { tipo: 'triangulo'; base: number; altura: number; rotuloBase: string; rotuloAltura: string; unidade: string; centro: string; forma: 'qualquer' | 'retangulo' | 'equilatero' | 'isosceles'; hipotenusa: string }
  | { tipo: 'barras'; titulo: string; itens: { rotulo: string; valor: number }[]; linha: number | null; rotuloLinha: string }
  | { tipo: 'partes'; total: number; destaque: number; rotulo: string }
  | { tipo: 'proporcao'; cabecalho: [string, string]; linhas: [string, string][]; relacao: 'direta' | 'inversa' }
  // figuras planas
  | { tipo: 'losango'; diagonalMaior: number; diagonalMenor: number; unidade: string; centro: string }
  | { tipo: 'paralelogramo'; base: number; altura: number; unidade: string; centro: string }
  | { tipo: 'trapezio'; baseMaior: number; baseMenor: number; altura: number; unidade: string; centro: string }
  | { tipo: 'poligono'; lados: number; lado: number | null; unidade: string; centro: string }
  | { tipo: 'angulo'; graus: number; rotulo: string }
  | { tipo: 'pizza'; titulo: string; itens: { rotulo: string; valor: number }[] }
  | { tipo: 'fracao'; partes: number; destaque: number; rotulo: string }
  // sólidos (perspectiva simples, arestas de trás tracejadas)
  | { tipo: 'cilindro'; raio: number; altura: number; unidade: string; centro: string }
  | { tipo: 'cone'; raio: number; altura: number; unidade: string; centro: string }
  | { tipo: 'esfera'; raio: number; unidade: string; centro: string }
  | { tipo: 'piramide'; ladosBase: number; lado: number | null; altura: number | null; unidade: string; centro: string }
  | { tipo: 'prisma'; ladosBase: number; lado: number | null; altura: number | null; unidade: string; centro: string }
  // gráficos e conjuntos
  | { tipo: 'plano'; pontos: { x: number; y: number; rotulo: string }[]; ligar: boolean; titulo: string }
  | { tipo: 'reta_numerica'; inicio: number; fim: number; destaques: number[] }
  | { tipo: 'venn'; a: string; b: string; soA: string; ambos: string; soB: string; fora: string }

const TEXTO_MAX = 32
const BARRAS_MAX = 8
const PARTES_MAX = 100
const LINHAS_MAX = 4
const PONTOS_MAX = 30
const FATIAS_MAX = 24

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

/** Medida desconhecida que o aluno vai descobrir: "?", "x", "h" (texto curto que não é número). */
function incognita(valor: unknown): string | null {
  if (typeof valor !== 'string' || numero(valor) !== null) return null
  const t = texto(valor)
  return t && t.length <= 12 ? t : null
}

/**
 * Medidas de uma figura em que alguma pode ser "?" (ex.: a hipotenusa no Pitágoras, o lado que falta).
 * A desconhecida é desenhada com um tamanho parecido com o das outras e mostra o próprio texto no rótulo.
 * Devolve null se algum valor não for nem número nem incógnita.
 */
function medidas(valores: unknown[], unidade: string): { n: number[]; rotulos: string[] } | null {
  const n = valores.map((v) => numero(v))
  const desconhecidas = valores.map(incognita)
  if (n.some((v, i) => v === null && desconhecidas[i] === null)) return null
  const conhecidas = n.filter((v): v is number => v !== null)
  const referencia = conhecidas.length ? (conhecidas.reduce((a, b) => a + b, 0) / conhecidas.length) * 0.8 : 4
  const finais = n.map((v) => v ?? referencia)
  return { n: finais, rotulos: finais.map((v, i) => desconhecidas[i] ?? medida(v, unidade)) }
}

/** Número qualquer (pode ser zero ou negativo), para gráficos e reta numérica. */
function real(valor: unknown): number | null {
  const n = typeof valor === 'string' ? Number(valor.replace(',', '.')) : valor
  return typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1e6 ? n : null
}

function inteiro(valor: unknown, minimo: number, maximo: number): number | null {
  const n = numero(valor)
  return n !== null && Number.isInteger(n) && n >= minimo && n <= maximo ? n : null
}

/** Itens [{rotulo, valor}] de barras e pizza: valores >= 0, no máximo 8. */
function listaValores(itens: unknown): { rotulo: string; valor: number }[] {
  if (!Array.isArray(itens)) return []
  return itens
    .slice(0, BARRAS_MAX)
    .map((item) => {
      const i = (item ?? {}) as Record<string, unknown>
      const valor = real(i.valor)
      return valor === null || valor < 0 ? null : { rotulo: texto(i.rotulo, '?').slice(0, 12), valor }
    })
    .filter((i): i is { rotulo: string; valor: number } => i !== null)
}

/** 29.7 → "29,7" (vírgula decimal, como o aluno escreve). */
export function formatar(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

/** Rótulo padrão de uma medida: "5 m" ou só "5" sem unidade. */
export function medida(n: number, unidade: string): string {
  return unidade ? `${formatar(n)} ${unidade}` : formatar(n)
}

/** "Retângulo", "regra de 3" → "retangulo", "regra_de_3": a IA nem sempre escreve o nome exato do tipo. */
function nomeTipo(valor: unknown): string {
  if (typeof valor !== 'string') return ''
  return valor.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[\s-]+/g, '_')
}

// Nomes naturais que a IA usa no lugar dos tipos da lista. Nasceu de um chat real: {"tipo": "quadrado", "lado": 4}
// apareceu como "Não consegui desenhar esta figura".
const APELIDOS: Record<string, string> = {
  quadrado: 'retangulo', retangulo: 'retangulo', area: 'retangulo',
  cubo: 'caixa', paralelepipedo: 'caixa', bloco: 'caixa', volume: 'caixa',
  regua: 'segmento', linha: 'segmento', comprimento: 'segmento', medida: 'segmento',
  circunferencia: 'circulo', grafico: 'barras', barra: 'barras', grafico_de_barras: 'barras',
  fracao: 'fracao', fracoes: 'fracao', pizza_fracao: 'fracao', probabilidade: 'partes', porcentagem: 'partes', grade: 'partes',
  regra_de_3: 'proporcao', regra_de_tres: 'proporcao', regra_de_tres_simples: 'proporcao',
  rombo: 'losango', trapezoide: 'trapezio', poligono_regular: 'poligono',
  triangulo_retangulo: 'triangulo', pitagoras: 'triangulo',
  pentagono: 'poligono', hexagono: 'poligono', heptagono: 'poligono', octogono: 'poligono', eneagono: 'poligono',
  decagono: 'poligono', dodecagono: 'poligono',
  setor: 'pizza', grafico_de_setores: 'pizza', setores: 'pizza',
  cilindro: 'cilindro', lata: 'cilindro', cone: 'cone', bola: 'esfera',
  piramide_quadrangular: 'piramide', piramide_triangular: 'piramide', tetraedro: 'piramide', piramide_hexagonal: 'piramide',
  prisma_triangular: 'prisma', prisma_hexagonal: 'prisma', prisma_pentagonal: 'prisma',
  plano_cartesiano: 'plano', grafico_de_funcao: 'plano', funcao: 'plano', grafico_de_linha: 'plano', pontos: 'plano',
  reta: 'reta_numerica', reta_real: 'reta_numerica',
  diagrama_de_venn: 'venn', conjuntos: 'venn',
}

// quantos lados tem o polígono ou a base do sólido quando a IA usa o nome ("hexagono", "prisma_triangular")
const NOMES_POLIGONO: Record<string, number> = {
  pentagono: 5, hexagono: 6, heptagono: 7, octogono: 8, eneagono: 9, decagono: 10, dodecagono: 12,
}
const LADOS_BASE: Record<string, number> = {
  piramide_triangular: 3, tetraedro: 3, piramide_quadrangular: 4, piramide_hexagonal: 6,
  prisma_triangular: 3, prisma_pentagonal: 5, prisma_hexagonal: 6,
}

/** JSON.parse que perdoa a vírgula sobrando no fim ("{...,}"), erro comum de IA. */
function lerJson(bruto: string): unknown {
  try {
    return JSON.parse(bruto)
  } catch {
    try {
      return JSON.parse(bruto.replace(/,\s*([}\]])/g, '$1'))
    } catch {
      return null
    }
  }
}

/** Quantas partes estão pintadas: a IA usa vários nomes ("destaque", "comidas", "numerador"...). */
function pintadas(d: Record<string, unknown>): unknown {
  return d.destaque ?? d.pintadas ?? d.numerador ?? d.comidas ?? d.selecionadas ?? d.usadas ?? d.parte ?? 0
}

/** Fração como pizza: um todo cortado em partes iguais, com algumas pintadas (3/8 = 3 de 8 fatias). */
function lerFracao(d: Record<string, unknown>): Figura | null {
  const partes = inteiro(d.partes ?? d.fatias ?? d.total ?? d.denominador, 1, FATIAS_MAX)
  if (!partes) return null
  const destaque = Math.min(inteiro(pintadas(d), 0, FATIAS_MAX) ?? 0, partes)
  const conta = `${destaque}/${partes} = ${formatar((destaque / partes) * 100)}%`
  // rótulo sem número ("pizza") não pode esconder a fração: ela vem junto
  const rotulo = texto(d.rotulo)
  return { tipo: 'fracao', partes, destaque, rotulo: !rotulo ? conta : /\d/.test(rotulo) ? rotulo : `${rotulo}: ${conta}` }
}

export function lerFigura(bruto: string): Figura | null {
  const dados = lerJson(bruto.trim())
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return null
  const d = { ...(dados as Record<string, unknown>) }
  const unidade = texto(d.unidade).slice(0, 6)
  const centro = texto(d.centro)
  const nome = nomeTipo(d.tipo)
  // quadrado e cubo: um lado só vale para todas as medidas
  const lado = d.lado ?? d.aresta
  const uniforme = ['retangulo', 'caixa', 'segmento'].includes(APELIDOS[nome] ?? nome)
  if (lado !== undefined && uniforme) {
    d.largura ??= lado
    d.altura ??= lado
    d.comprimento ??= lado
    d.medida ??= lado
  }
  if (d.raio === undefined && d.diametro !== undefined) {
    const diametro = numero(d.diametro)
    d.raio = diametro ? diametro / 2 : null
    d.mostrar ??= 'diametro'
  }
  // retângulo descrito como comprimento x largura (ou base x altura)
  if (nome !== 'caixa' && APELIDOS[nome] !== 'caixa' && d.comprimento !== undefined && d.altura === undefined) {
    d.altura = d.largura
    d.largura = d.comprimento
  }
  d.largura ??= d.base

  switch (APELIDOS[nome] ?? nome) {
    case 'segmento': {
      const n = numero(d.medida ?? d.comprimento ?? d.valor)
      return n ? { tipo: 'segmento', medida: n, unidade, rotulo: texto(d.rotulo, 'comprimento') } : null
    }
    case 'retangulo': {
      const m = medidas([d.largura, d.altura], unidade)
      if (!m) return null
      const [largura, altura] = m.n
      return {
        tipo: 'retangulo', largura, altura, unidade, centro,
        rotuloLargura: texto(d.rotulo_largura, m.rotulos[0]),
        rotuloAltura: texto(d.rotulo_altura, m.rotulos[1]),
        quadriculado: d.quadriculado === true,
      }
    }
    case 'caixa': {
      const m = medidas([d.comprimento, d.largura ?? d.profundidade, d.altura], unidade)
      if (!m) return null
      const [comprimento, largura, altura] = m.n
      return {
        tipo: 'caixa', comprimento, largura, altura, unidade, centro,
        rotuloComprimento: texto(d.rotulo_comprimento, m.rotulos[0]),
        rotuloLargura: texto(d.rotulo_largura ?? d.rotulo_profundidade, m.rotulos[1]),
        rotuloAltura: texto(d.rotulo_altura, m.rotulos[2]),
      }
    }
    case 'circulo': {
      const raio = numero(d.raio)
      return raio ? { tipo: 'circulo', raio, unidade, centro, mostrar: d.mostrar === 'diametro' ? 'diametro' : 'raio' } : null
    }
    case 'triangulo': {
      const lado = numero(d.base ?? d.lado)
      const equilatero = nomeTipo(d.forma) === 'equilatero' && lado ? (lado * Math.sqrt(3)) / 2 : undefined
      const m = medidas([d.base ?? d.cateto ?? d.lado, d.altura ?? d.cateto2 ?? equilatero], unidade)
      if (!m) return null
      const [base, altura] = m.n
      const forma = nome === 'triangulo_retangulo' || nome === 'pitagoras' ? 'retangulo' : nomeTipo(d.forma)
      return {
        tipo: 'triangulo', base, altura, unidade, centro, rotuloBase: m.rotulos[0], rotuloAltura: m.rotulos[1],
        forma: forma === 'retangulo' || forma === 'equilatero' || forma === 'isosceles' ? forma : 'qualquer',
        hipotenusa: texto(d.hipotenusa),
      }
    }
    case 'losango': {
      const diagonalMaior = numero(d.diagonal_maior ?? d.D)
      const diagonalMenor = numero(d.diagonal_menor ?? d.d)
      return diagonalMaior && diagonalMenor ? { tipo: 'losango', diagonalMaior, diagonalMenor, unidade, centro } : null
    }
    case 'paralelogramo': {
      const base = numero(d.base ?? d.largura)
      const altura = numero(d.altura)
      return base && altura ? { tipo: 'paralelogramo', base, altura, unidade, centro } : null
    }
    case 'trapezio': {
      const baseMaior = numero(d.base_maior ?? d.B)
      const baseMenor = numero(d.base_menor ?? d.b)
      const altura = numero(d.altura)
      if (!baseMaior || !baseMenor || !altura) return null
      return { tipo: 'trapezio', baseMaior: Math.max(baseMaior, baseMenor), baseMenor: Math.min(baseMaior, baseMenor), altura, unidade, centro }
    }
    case 'poligono': {
      const lados = inteiro(d.lados ?? NOMES_POLIGONO[nome], 3, 12)
      return lados ? { tipo: 'poligono', lados, lado: numero(d.lado), unidade, centro } : null
    }
    case 'angulo': {
      const graus = numero(d.graus ?? d.valor, 360)
      return graus ? { tipo: 'angulo', graus, rotulo: texto(d.rotulo, `${formatar(graus)}°`) } : null
    }
    case 'fracao':
      return lerFracao(d)
    case 'pizza': {
      if (!Array.isArray(d.itens)) return lerFracao(d) // {"tipo": "pizza", "fatias": 8, "comidas": 3}
      const itens = listaValores(d.itens)
      return itens.length ? { tipo: 'pizza', titulo: texto(d.titulo), itens } : null
    }
    case 'cilindro':
    case 'cone': {
      const raio = numero(d.raio)
      const altura = numero(d.altura)
      return raio && altura ? { tipo: (APELIDOS[nome] ?? nome) as 'cilindro' | 'cone', raio, altura, unidade, centro } : null
    }
    case 'esfera': {
      const raio = numero(d.raio)
      return raio ? { tipo: 'esfera', raio, unidade, centro } : null
    }
    case 'piramide':
    case 'prisma': {
      const tipo = (APELIDOS[nome] ?? nome) as 'piramide' | 'prisma'
      const ladosBase = inteiro(d.lados_base ?? d.lados ?? LADOS_BASE[nome], 3, 8) ?? (tipo === 'piramide' ? 4 : 3)
      return { tipo, ladosBase, lado: numero(d.lado ?? d.aresta_base), altura: numero(d.altura), unidade, centro }
    }
    case 'plano': {
      if (!Array.isArray(d.pontos)) return null
      const pontos = d.pontos
        .slice(0, PONTOS_MAX)
        .map((p) => {
          const par = Array.isArray(p) ? { x: p[0], y: p[1], rotulo: p[2] } : ((p ?? {}) as Record<string, unknown>)
          const x = real(par.x)
          const y = real(par.y)
          return x === null || y === null ? null : { x, y, rotulo: texto(par.rotulo).slice(0, 10) }
        })
        .filter((p): p is { x: number; y: number; rotulo: string } => p !== null)
      return pontos.length ? { tipo: 'plano', pontos, ligar: d.ligar === true, titulo: texto(d.titulo) } : null
    }
    case 'reta_numerica': {
      const inicio = real(d.inicio)
      const fim = real(d.fim)
      if (inicio === null || fim === null || fim <= inicio) return null
      const destaques = (Array.isArray(d.destaques) ? d.destaques : [])
        .map(real)
        .filter((n): n is number => n !== null && n >= inicio && n <= fim)
        .slice(0, 8)
      return { tipo: 'reta_numerica', inicio, fim, destaques }
    }
    case 'venn':
      return {
        tipo: 'venn', a: texto(d.a, 'A').slice(0, 16), b: texto(d.b, 'B').slice(0, 16),
        soA: texto(d.so_a).slice(0, 18), ambos: texto(d.ambos).slice(0, 18), soB: texto(d.so_b).slice(0, 18), fora: texto(d.fora).slice(0, 24),
      }
    case 'barras': {
      const itens = listaValores(d.itens)
      if (itens.length === 0) return null
      return { tipo: 'barras', titulo: texto(d.titulo), itens, linha: numero(d.linha), rotuloLinha: texto(d.rotulo_linha, 'média') }
    }
    case 'partes': {
      const total = numero(d.total, PARTES_MAX)
      if (!total || !Number.isInteger(total)) return null
      const destaque = Math.min(inteiro(pintadas(d), 0, PARTES_MAX) ?? 0, total)
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
