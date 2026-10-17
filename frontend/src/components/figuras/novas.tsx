import { Centro, Cota, Svg } from '@/components/figuras/base'
import { COTA, escala, FORMA, LINHA, TEXTO, TEXTO_SUAVE } from '@/components/figuras/estilo'
import { type Figura, formatar, medida } from '@/lib/figuras'

/**
 * Figuras planas (losango, paralelogramo, trapézio, polígonos, ângulo, pizza), sólidos em perspectiva
 * (cilindro, cone, esfera, pirâmide, prisma) e gráficos (plano cartesiano, reta numérica, Venn).
 * Sólidos: perspectiva simples com a base achatada; o que fica atrás aparece tracejado, como nos livros.
 */

const TRACEJADO = '5 4'
const ACHATAR = 0.36 // quanto a base de um sólido é achatada para parecer vista de cima
const TONS = ['fill-primary', 'fill-primary/75', 'fill-primary/55', 'fill-primary/40', 'fill-primary/28', 'fill-primary/18', 'fill-primary/10', 'fill-muted-foreground/30']

const NOME_POLIGONO: Record<number, string> = {
  3: 'triângulo equilátero', 4: 'quadrado', 5: 'pentágono', 6: 'hexágono', 7: 'heptágono', 8: 'octógono',
  9: 'eneágono', 10: 'decágono', 11: 'undecágono', 12: 'dodecágono',
}
const NOME_BASE: Record<number, string> = { 3: 'triangular', 4: 'quadrangular', 5: 'pentagonal', 6: 'hexagonal', 7: 'heptagonal', 8: 'octogonal' }

type Ponto = { x: number; y: number }
const caminho = (pontos: Ponto[]) => `M${pontos.map((p) => `${p.x} ${p.y}`).join(' L')} z`

/** Marca de ângulo reto no canto (x, y), virada para dentro (dx, dy = ±1). */
function Reto({ x, y, dx = 1, dy = -1 }: { x: number; y: number; dx?: number; dy?: number }) {
  return <path d={`M${x + 10 * dx} ${y} v${10 * dy} h${-10 * dx}`} className="stroke-foreground" fill="none" strokeWidth={1} />
}

/** Base de um sólido: polígono regular achatado. "fundo" = vértice da metade de trás (fica tracejado). */
function baseAchatada(lados: number, cx: number, cy: number, raio: number) {
  const giro = Math.PI / 2 + Math.PI / lados + 0.25
  return Array.from({ length: lados }, (_, i) => {
    const t = giro + (2 * Math.PI * i) / lados
    return { x: cx + raio * Math.cos(t), y: cy + raio * ACHATAR * Math.sin(t), t }
  })
}

/** Aresta i → i+1 da base fica atrás quando o meio dela está na metade de cima da elipse. */
const arestaDeTras = (base: { t: number }[], i: number) => Math.sin(base[i].t + Math.PI / base.length) < -1e-6

/** Vértice escondido: atrás e sem ser o mais à esquerda ou à direita (esses formam o contorno). */
function verticeEscondido(base: { x: number; t: number }[], i: number) {
  const xs = base.map((p) => p.x)
  return Math.sin(base[i].t) < -0.05 && base[i].x !== Math.min(...xs) && base[i].x !== Math.max(...xs)
}

/** Altura em pixels de um sólido, proporcional à medida real (com limites para caber). */
function alturaDesenho(altura: number | null, largura: number | null, padrao = 130) {
  if (!altura || !largura) return padrao
  return Math.min(Math.max((altura / largura) * 190, 70), 175)
}

/** Passo "redondo" (1, 2, 5, 10, 20…) para no máximo ~12 marcas num intervalo. */
function passoRedondo(intervalo: number, marcas = 12) {
  const bruto = intervalo / marcas
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  return [1, 2, 5, 10].map((m) => m * potencia).find((p) => p >= bruto) ?? 10 * potencia
}

export function DesenhoNovo({ dados }: { dados: Figura }) {
  switch (dados.tipo) {
    case 'losango': {
      const [w, h] = escala(dados.diagonalMaior, dados.diagonalMenor, 280, 170)
      const cx = 200
      const cy = 20 + h / 2
      const D = medida(dados.diagonalMaior, dados.unidade)
      const d = medida(dados.diagonalMenor, dados.unidade)
      return (
        <Svg largura={400} altura={h + (dados.centro ? 72 : 48)} titulo={`losango de diagonais ${D} e ${d}`}>
          <path d={`M${cx - w / 2} ${cy} L${cx} ${cy - h / 2} L${cx + w / 2} ${cy} L${cx} ${cy + h / 2} z`} className={FORMA} strokeWidth={2} />
          <line x1={cx - w / 2} y1={cy} x2={cx + w / 2} y2={cy} className="stroke-foreground" strokeDasharray={TRACEJADO} strokeWidth={1.3} />
          <line x1={cx} y1={cy - h / 2} x2={cx} y2={cy + h / 2} className="stroke-foreground" strokeDasharray={TRACEJADO} strokeWidth={1.3} />
          <Reto x={cx} y={cy} />
          <text x={cx + w / 4} y={cy + 17} textAnchor="middle" className={TEXTO}>D = {D}</text>
          <text x={cx + 8} y={cy - h / 4} className={TEXTO}>d = {d}</text>
          <Centro x={200} y={h + 52} texto={dados.centro} />
        </Svg>
      )
    }

    case 'paralelogramo': {
      const [w, h] = escala(dados.base, dados.altura, 220, 140)
      const s = Math.min(70, w * 0.35)
      const x = (400 - w - s) / 2
      const y = 20
      return (
        <Svg largura={400} altura={h + (dados.centro ? 92 : 70)} titulo={`paralelogramo de base ${medida(dados.base, dados.unidade)} e altura ${medida(dados.altura, dados.unidade)}`}>
          <path d={`M${x} ${y + h} L${x + w} ${y + h} L${x + w + s} ${y} L${x + s} ${y} z`} className={FORMA} strokeWidth={2} />
          <line x1={x + s} y1={y} x2={x + s} y2={y + h} className="stroke-foreground" strokeDasharray={TRACEJADO} strokeWidth={1.3} />
          <Reto x={x + s} y={y + h} />
          <text x={x + s + 8} y={y + h / 2} dominantBaseline="middle" className={TEXTO}>altura {medida(dados.altura, dados.unidade)}</text>
          <Cota x1={x} y1={y + h + 16} x2={x + w} y2={y + h + 16} rotulo={`base ${medida(dados.base, dados.unidade)}`} lado={1} />
          <Centro x={200} y={y + h + 64} texto={dados.centro} />
        </Svg>
      )
    }

    case 'trapezio': {
      const k = Math.min(280 / dados.baseMaior, 140 / dados.altura)
      const W = dados.baseMaior * k
      const b = Math.max(dados.baseMenor * k, 30)
      const h = Math.max(dados.altura * k, 40)
      const x = (400 - W) / 2
      const y = 40
      const xb = 200 - b / 2
      return (
        <Svg largura={400} altura={h + (dados.centro ? 112 : 90)} titulo={`trapézio de bases ${medida(dados.baseMaior, dados.unidade)} e ${medida(dados.baseMenor, dados.unidade)}`}>
          <path d={`M${x} ${y + h} L${x + W} ${y + h} L${xb + b} ${y} L${xb} ${y} z`} className={FORMA} strokeWidth={2} />
          <line x1={xb} y1={y} x2={xb} y2={y + h} className="stroke-foreground" strokeDasharray={TRACEJADO} strokeWidth={1.3} />
          <Reto x={xb} y={y + h} />
          <text x={xb + 8} y={y + h / 2} dominantBaseline="middle" className={TEXTO}>altura {medida(dados.altura, dados.unidade)}</text>
          <Cota x1={xb} y1={y - 14} x2={xb + b} y2={y - 14} rotulo={`base menor ${medida(dados.baseMenor, dados.unidade)}`} />
          <Cota x1={x} y1={y + h + 16} x2={x + W} y2={y + h + 16} rotulo={`base maior ${medida(dados.baseMaior, dados.unidade)}`} lado={1} />
          <Centro x={200} y={y + h + 64} texto={dados.centro} />
        </Svg>
      )
    }

    case 'poligono': {
      const n = dados.lados
      const R = 85
      const cx = 200
      const cy = 105
      // um lado sempre deitado embaixo, para a medida do lado ficar legível
      const giro = Math.PI / 2 + Math.PI / n
      const pontos = Array.from({ length: n }, (_, i) => ({ x: cx + R * Math.cos(giro + (2 * Math.PI * i) / n), y: cy + R * Math.sin(giro + (2 * Math.PI * i) / n) }))
      const yBase = cy + R * Math.cos(Math.PI / n)
      const nome = `${NOME_POLIGONO[n]}${n > 4 ? ' regular' : ''} · ${n} lados`
      return (
        <Svg largura={400} altura={dados.centro ? 262 : 240} titulo={nome}>
          <path d={caminho(pontos)} className={FORMA} strokeWidth={2} />
          {pontos.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.5} className="fill-foreground" />)}
          {dados.lado && (
            <text x={cx} y={yBase - 8} textAnchor="middle" className={TEXTO}>lado {medida(dados.lado, dados.unidade)}</text>
          )}
          <text x={cx} y={yBase + 24} textAnchor="middle" className={TEXTO_SUAVE}>{nome}</text>
          <Centro x={cx} y={yBase + 46} texto={dados.centro} />
        </Svg>
      )
    }

    case 'angulo': {
      const g = dados.graus
      const rad = (g * Math.PI) / 180
      const vx = 150
      const vy = g > 180 ? 120 : 175
      const L = 170
      const r = 42
      const fim = { x: vx + L * Math.cos(rad), y: vy - L * Math.sin(rad) }
      const arco = { x: vx + r * Math.cos(rad), y: vy - r * Math.sin(rad) }
      const meio = { x: vx + 66 * Math.cos(rad / 2), y: vy - 66 * Math.sin(rad / 2) }
      const tipo = g < 90 ? 'agudo (menor que 90°)' : g === 90 ? 'reto (90°)' : g < 180 ? 'obtuso (entre 90° e 180°)' : g === 180 ? 'raso (180°)' : 'maior que 180°'
      return (
        <Svg largura={400} altura={g > 180 ? 260 : 215} titulo={`ângulo de ${formatar(g)} graus`}>
          {g === 90 ? (
            <path d={`M${vx + 18} ${vy} v-18 h-18`} className="fill-primary/15 stroke-primary" strokeWidth={1.5} />
          ) : (
            <path d={`M${vx} ${vy} L${vx + r} ${vy} A${r} ${r} 0 ${g > 180 ? 1 : 0} 0 ${arco.x} ${arco.y} z`} className="fill-primary/15 stroke-primary" strokeWidth={1.5} />
          )}
          <line x1={vx} y1={vy} x2={vx + L} y2={vy} className="stroke-foreground" strokeWidth={2} />
          <line x1={vx} y1={vy} x2={fim.x} y2={fim.y} className="stroke-foreground" strokeWidth={2} />
          <circle cx={vx} cy={vy} r={3} className="fill-foreground" />
          <text x={meio.x} y={meio.y} textAnchor="middle" dominantBaseline="middle" className="fill-primary text-[14px] font-semibold">{dados.rotulo}</text>
          <text x={200} y={g > 180 ? 250 : 205} textAnchor="middle" className={TEXTO_SUAVE}>ângulo {tipo}</text>
        </Svg>
      )
    }

    case 'pizza': {
      const total = dados.itens.reduce((soma, i) => soma + i.valor, 0) || 1
      const cx = 115
      const cy = 110
      const r = 88
      // fatia i vai do acumulado até i ao acumulado até i+1 (começa no topo e gira no sentido do relógio)
      const angulo = (ate: number) => -Math.PI / 2 + (2 * Math.PI * dados.itens.slice(0, ate).reduce((soma, i) => soma + i.valor, 0)) / total
      const fatias = dados.itens.map((item, i) => {
        const parte = item.valor / total
        const a = { x: cx + r * Math.cos(angulo(i)), y: cy + r * Math.sin(angulo(i)) }
        const b = { x: cx + r * Math.cos(angulo(i + 1)), y: cy + r * Math.sin(angulo(i + 1)) }
        const d = parte >= 0.9999 ? '' : `M${cx} ${cy} L${a.x} ${a.y} A${r} ${r} 0 ${parte > 0.5 ? 1 : 0} 1 ${b.x} ${b.y} z`
        return { item, parte, d, tom: TONS[i % TONS.length] }
      })
      return (
        <Svg largura={400} altura={dados.titulo ? 240 : 225} titulo={dados.titulo || 'gráfico de setores'}>
          {fatias.map((f, i) =>
            f.d ? <path key={i} d={f.d} className={`${f.tom} stroke-card`} strokeWidth={2} /> : <circle key={i} cx={cx} cy={cy} r={r} className={f.tom} />,
          )}
          {fatias.map((f, i) => (
            <g key={`l${i}`}>
              <rect x={235} y={30 + i * 22} width={13} height={13} rx={3} className={f.tom} />
              <text x={255} y={41 + i * 22} className={TEXTO}>
                {f.item.rotulo} · {formatar(f.parte * 100)}%
              </text>
            </g>
          ))}
          {dados.titulo && <text x={cx} y={228} textAnchor="middle" className={TEXTO}>{dados.titulo}</text>}
        </Svg>
      )
    }

    case 'cilindro':
    case 'cone': {
      const cone = dados.tipo === 'cone'
      const rx = 85
      const ry = rx * ACHATAR * 0.8
      const H = alturaDesenho(dados.altura, dados.raio * 2)
      const cx = 170
      const yTopo = 20 + (cone ? 0 : ry)
      const yBase = yTopo + H
      const raio = `raio ${medida(dados.raio, dados.unidade)}`
      const altura = `altura ${medida(dados.altura, dados.unidade)}`
      const frente = `A${rx} ${ry} 0 0 0 ${cx + rx} ${yBase}`
      return (
        <Svg largura={400} altura={yBase + ry + (dados.centro ? 50 : 26)} titulo={`${cone ? 'cone' : 'cilindro'} de ${raio} e ${altura}`}>
          {cone ? (
            <path d={`M${cx} ${yTopo} L${cx - rx} ${yBase} ${frente} z`} className={FORMA} strokeWidth={2} />
          ) : (
            <>
              <path d={`M${cx - rx} ${yTopo} L${cx - rx} ${yBase} ${frente} L${cx + rx} ${yTopo}`} className="fill-primary/12 stroke-primary" strokeWidth={2} />
              <ellipse cx={cx} cy={yTopo} rx={rx} ry={ry} className="fill-primary/25 stroke-primary" strokeWidth={2} />
            </>
          )}
          {/* metade de trás da base, escondida */}
          <path d={`M${cx - rx} ${yBase} A${rx} ${ry} 0 0 1 ${cx + rx} ${yBase}`} className="stroke-primary" fill="none" strokeDasharray={TRACEJADO} strokeWidth={1.3} />
          {cone && (
            <>
              <line x1={cx} y1={yTopo} x2={cx} y2={yBase} className="stroke-foreground" strokeDasharray={TRACEJADO} strokeWidth={1.3} />
              <Reto x={cx} y={yBase} />
              <Cota x1={cx + rx + 18} y1={yTopo} x2={cx + rx + 18} y2={yBase} rotulo={altura} lado={1} />
            </>
          )}
          {/* raio: no topo do cilindro, na base do cone */}
          <line x1={cx} y1={cone ? yBase : yTopo} x2={cx + rx} y2={cone ? yBase : yTopo} className="stroke-foreground" strokeWidth={1.5} />
          <circle cx={cx} cy={cone ? yBase : yTopo} r={2.5} className="fill-foreground" />
          <text x={cx + rx / 2} y={(cone ? yBase : yTopo) - 6} textAnchor="middle" className={TEXTO}>{raio}</text>
          {!cone && <Cota x1={cx + rx + 18} y1={yTopo} x2={cx + rx + 18} y2={yBase} rotulo={altura} lado={1} />}
          <Centro x={200} y={yBase + ry + 30} texto={dados.centro} />
        </Svg>
      )
    }

    case 'esfera': {
      const r = 85
      const cx = 200
      const cy = 100
      const ry = r * 0.28
      return (
        <Svg largura={400} altura={dados.centro ? 230 : 205} titulo={`esfera de raio ${medida(dados.raio, dados.unidade)}`}>
          <circle cx={cx} cy={cy} r={r} className={FORMA} strokeWidth={2} />
          <path d={`M${cx - r} ${cy} A${r} ${ry} 0 0 1 ${cx + r} ${cy}`} className="stroke-primary" fill="none" strokeDasharray={TRACEJADO} strokeWidth={1.2} />
          <path d={`M${cx - r} ${cy} A${r} ${ry} 0 0 0 ${cx + r} ${cy}`} className="stroke-primary" fill="none" strokeWidth={1.4} />
          <line x1={cx} y1={cy} x2={cx + r} y2={cy} className="stroke-foreground" strokeWidth={1.5} />
          <circle cx={cx} cy={cy} r={2.5} className="fill-foreground" />
          <text x={cx + r / 2} y={cy - 7} textAnchor="middle" className={TEXTO}>raio {medida(dados.raio, dados.unidade)}</text>
          <Centro x={cx} y={cy + r + 24} texto={dados.centro} />
        </Svg>
      )
    }

    case 'prisma':
    case 'piramide': {
      const n = dados.ladosBase
      const R = 95
      const cx = 175
      const raioReal = dados.lado ? dados.lado / (2 * Math.sin(Math.PI / n)) : null
      const H = alturaDesenho(dados.altura, raioReal ? raioReal * 2 : null)
      const yBase = 24 + H + R * ACHATAR
      const base = baseAchatada(n, cx, yBase, R)
      const xs = base.map((p) => p.x)
      const piramide = dados.tipo === 'piramide'
      const topo = base.map((p) => ({ x: p.x, y: p.y - H }))
      const apice = { x: cx, y: yBase - H }
      const nome = `${piramide ? 'pirâmide' : 'prisma'} de base ${NOME_BASE[n] ?? `de ${n} lados`}`
      // lado da base com a medida: a aresta da frente mais baixa
      const iFrente = base.map((_, i) => i).filter((i) => !arestaDeTras(base, i)).sort((a, b) => (base[b].y + base[(b + 1) % n].y) - (base[a].y + base[(a + 1) % n].y))[0]
      const p1 = base[iFrente]
      const p2 = base[(iFrente + 1) % n]
      return (
        <Svg largura={400} altura={yBase + R * ACHATAR + (dados.centro ? 70 : 46)} titulo={nome}>
          {/* faces da frente */}
          {base.map((p, i) => {
            if (arestaDeTras(base, i)) return null
            const q = base[(i + 1) % n]
            const face = piramide ? [p, q, apice] : [p, q, topo[(i + 1) % n], topo[i]]
            return <path key={`f${i}`} d={caminho(face)} className="fill-primary/12" />
          })}
          {!piramide && <path d={caminho(topo)} className="fill-primary/25 stroke-primary" strokeWidth={2} />}
          {/* arestas da base: as de trás tracejadas */}
          {base.map((p, i) => {
            const q = base[(i + 1) % n]
            const tras = arestaDeTras(base, i)
            return <line key={`b${i}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} className="stroke-primary" strokeWidth={tras ? 1.2 : 2} strokeDasharray={tras ? TRACEJADO : undefined} />
          })}
          {/* arestas laterais */}
          {base.map((p, i) => {
            const escondida = verticeEscondido(base, i)
            const fim = piramide ? apice : topo[i]
            return <line key={`l${i}`} x1={p.x} y1={p.y} x2={fim.x} y2={fim.y} className="stroke-primary" strokeWidth={escondida ? 1.2 : 2} strokeDasharray={escondida ? TRACEJADO : undefined} />
          })}
          {piramide ? (
            <>
              <line x1={cx} y1={apice.y} x2={cx} y2={yBase} className="stroke-foreground" strokeDasharray={TRACEJADO} strokeWidth={1.3} />
              <circle cx={cx} cy={yBase} r={2.5} className="fill-foreground" />
              {dados.altura && <Cota x1={Math.max(...xs) + 18} y1={apice.y} x2={Math.max(...xs) + 18} y2={yBase} rotulo={`altura ${medida(dados.altura, dados.unidade)}`} lado={1} />}
            </>
          ) : (
            dados.altura && <Cota x1={Math.max(...xs) + 18} y1={yBase - H} x2={Math.max(...xs) + 18} y2={yBase} rotulo={`altura ${medida(dados.altura, dados.unidade)}`} lado={1} />
          )}
          {dados.lado && p1 && p2 && (
            <text x={(p1.x + p2.x) / 2} y={(p1.y + p2.y) / 2 + 20} textAnchor="middle" className={TEXTO}>lado {medida(dados.lado, dados.unidade)}</text>
          )}
          <text x={200} y={yBase + R * ACHATAR + 38} textAnchor="middle" className={TEXTO_SUAVE}>{nome}</text>
          <Centro x={200} y={yBase + R * ACHATAR + 60} texto={dados.centro} />
        </Svg>
      )
    }

    case 'plano': {
      const xs = dados.pontos.map((p) => p.x)
      const ys = dados.pontos.map((p) => p.y)
      // pontos inteiros: marcas de 1 em 1 (nada de 0,5 entre eles)
      const minimoX = xs.every(Number.isInteger) ? 1 : 0
      const minimoY = ys.every(Number.isInteger) ? 1 : 0
      const passoX = Math.max(passoRedondo(Math.max(...xs, 0) - Math.min(...xs, 0) || 1, 10), minimoX)
      const passoY = Math.max(passoRedondo(Math.max(...ys, 0) - Math.min(...ys, 0) || 1, 8), minimoY)
      const x0 = Math.floor(Math.min(...xs, 0) / passoX) * passoX - passoX
      const x1 = Math.ceil(Math.max(...xs, 0) / passoX) * passoX + passoX
      const y0 = Math.floor(Math.min(...ys, 0) / passoY) * passoY - passoY
      const y1 = Math.ceil(Math.max(...ys, 0) / passoY) * passoY + passoY
      const topo = dados.titulo ? 30 : 14
      const px = (x: number) => 30 + ((x - x0) / (x1 - x0)) * 350
      const py = (y: number) => topo + ((y1 - y) / (y1 - y0)) * 230
      const marcasX = Array.from({ length: Math.round((x1 - x0) / passoX) + 1 }, (_, i) => x0 + i * passoX)
      const marcasY = Array.from({ length: Math.round((y1 - y0) / passoY) + 1 }, (_, i) => y0 + i * passoY)
      const mostrarPar = dados.pontos.length <= 6
      return (
        <Svg largura={400} altura={topo + 250} titulo={dados.titulo || 'plano cartesiano'}>
          {dados.titulo && <text x={200} y={18} textAnchor="middle" className={TEXTO}>{dados.titulo}</text>}
          {marcasX.map((m) => <line key={`gx${m}`} x1={px(m)} y1={py(y0)} x2={px(m)} y2={py(y1)} className="stroke-muted-foreground/20" strokeWidth={1} />)}
          {marcasY.map((m) => <line key={`gy${m}`} x1={px(x0)} y1={py(m)} x2={px(x1)} y2={py(m)} className="stroke-muted-foreground/20" strokeWidth={1} />)}
          <line x1={px(x0)} y1={py(0)} x2={px(x1)} y2={py(0)} className={LINHA} strokeWidth={1.5} markerEnd="url(#fig-seta)" />
          <line x1={px(0)} y1={py(y0)} x2={px(0)} y2={py(y1)} className={LINHA} strokeWidth={1.5} markerEnd="url(#fig-seta)" />
          <text x={px(x1) - 4} y={py(0) - 6} textAnchor="end" className={TEXTO_SUAVE}>x</text>
          <text x={px(0) + 6} y={py(y1) + 10} className={TEXTO_SUAVE}>y</text>
          {marcasX.slice(1, -1).map((m) => m !== 0 && <text key={`tx${m}`} x={px(m)} y={py(0) + 14} textAnchor="middle" className={TEXTO_SUAVE}>{formatar(m)}</text>)}
          {marcasY.slice(1, -1).map((m) => m !== 0 && <text key={`ty${m}`} x={px(0) - 5} y={py(m) + 4} textAnchor="end" className={TEXTO_SUAVE}>{formatar(m)}</text>)}
          {dados.ligar && dados.pontos.length > 1 && (
            <polyline points={dados.pontos.map((p) => `${px(p.x)},${py(p.y)}`).join(' ')} className="stroke-primary" fill="none" strokeWidth={2.2} strokeLinejoin="round" />
          )}
          {dados.pontos.map((p, i) => (
            <g key={i}>
              <circle cx={px(p.x)} cy={py(p.y)} r={4} className="fill-primary stroke-card" strokeWidth={1.5} />
              {(p.rotulo || mostrarPar) && (
                <text x={px(p.x) - 7} y={py(p.y) - 8} textAnchor="end" className="fill-foreground text-[11px] font-medium" paintOrder="stroke" stroke="var(--card)" strokeWidth={3}>
                  {p.rotulo ? `${p.rotulo} ` : ''}({formatar(p.x)}; {formatar(p.y)})
                </text>
              )}
            </g>
          ))}
        </Svg>
      )
    }

    case 'reta_numerica': {
      const { inicio, fim } = dados
      const passo = passoRedondo(fim - inicio, 12)
      const primeira = Math.ceil(inicio / passo) * passo
      const marcas = Array.from({ length: Math.floor((fim - primeira) / passo + 1e-9) + 1 }, (_, i) => primeira + i * passo)
      const px = (v: number) => 30 + ((v - inicio) / (fim - inicio)) * 340
      return (
        <Svg largura={400} altura={100} titulo={`reta numérica de ${formatar(inicio)} a ${formatar(fim)}`}>
          <line x1={14} y1={60} x2={386} y2={60} className={LINHA} strokeWidth={1.6} markerStart="url(#fig-seta)" markerEnd="url(#fig-seta)" />
          {marcas.map((m) => (
            <g key={m}>
              <line x1={px(m)} y1={54} x2={px(m)} y2={66} className={LINHA} strokeWidth={1.2} />
              <text x={px(m)} y={84} textAnchor="middle" className={TEXTO_SUAVE}>{formatar(m)}</text>
            </g>
          ))}
          {dados.destaques.map((d, i) => (
            <g key={`d${i}`}>
              <circle cx={px(d)} cy={60} r={5.5} className="fill-primary stroke-card" strokeWidth={1.5} />
              <text x={px(d)} y={42} textAnchor="middle" className="fill-primary text-[13px] font-semibold">{formatar(d)}</text>
            </g>
          ))}
        </Svg>
      )
    }

    case 'venn':
      return (
        <Svg largura={400} altura={dados.fora ? 230 : 210} titulo={`diagrama de Venn: ${dados.a} e ${dados.b}`}>
          <rect x={20} y={8} width={360} height={dados.fora ? 212 : 194} rx={12} className={`fill-transparent ${COTA}`} strokeWidth={1} />
          <circle cx={160} cy={112} r={78} className={FORMA} strokeWidth={2} />
          <circle cx={240} cy={112} r={78} className={FORMA} strokeWidth={2} />
          <text x={120} y={28} textAnchor="middle" className={TEXTO}>{dados.a}</text>
          <text x={280} y={28} textAnchor="middle" className={TEXTO}>{dados.b}</text>
          <text x={122} y={116} textAnchor="middle" className={TEXTO}>{dados.soA}</text>
          <text x={200} y={116} textAnchor="middle" className="fill-foreground text-[13px] font-semibold">{dados.ambos}</text>
          <text x={278} y={116} textAnchor="middle" className={TEXTO}>{dados.soB}</text>
          {dados.fora && <text x={200} y={210} textAnchor="middle" className={TEXTO_SUAVE}>fora: {dados.fora}</text>}
        </Svg>
      )

    default:
      return null
  }
}
