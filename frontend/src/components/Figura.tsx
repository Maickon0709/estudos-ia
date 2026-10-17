import { Centro, Cota, Svg } from '@/components/figuras/base'
import { DesenhoNovo } from '@/components/figuras/novas'
import { COTA, escala, FORMA, LINHA, TEXTO, TEXTO_SUAVE } from '@/components/figuras/estilo'
import { type Figura as Dados, formatar, lerFigura, medida } from '@/lib/figuras'

/**
 * Desenha em SVG a figura que a IA descreveu em JSON (bloco ```figura). Só tipos fixos; todo texto entra
 * como texto do SVG (o React escapa), sem imagem de fora e sem link. Enquanto a resposta chega aos
 * pedaços o JSON ainda está incompleto: mostra "desenhando…" até fechar; se no fim não valer, não mostra nada.
 */
export function Figura({ codigo, escrevendo }: { codigo: string; escrevendo?: boolean }) {
  const dados = lerFigura(codigo)
  if (!dados) {
    // resposta pronta e figura inválida: some em silêncio (um aviso de erro no meio da aula só atrapalha)
    if (escrevendo === false) return null
    return (
      <div className="quadro-figura text-center text-xs text-muted-foreground" role="status">
        Desenhando a figura…
      </div>
    )
  }
  return (
    <figure className="quadro-figura">
      <Desenho dados={dados} />
    </figure>
  )
}

function Desenho({ dados }: { dados: Dados }) {
  switch (dados.tipo) {
    case 'segmento': {
      const { medida: n, unidade } = dados
      // a IA às vezes já escreve a medida no rótulo ("comprimento = 12 cm"): não repete
      const rotulo = dados.rotulo.includes(formatar(n)) ? dados.rotulo : `${dados.rotulo}: ${medida(n, unidade)}`
      const x0 = 30
      const comp = 340
      // marcas da régua: de 1 em 1 até 20; acima disso, 10 divisões
      const passo = n <= 20 ? 1 : n / 10
      const marcas = Array.from({ length: Math.floor(n / passo + 1e-9) + 1 }, (_, i) => i * passo)
      const legenda = new Set([0, marcas.length - 1, ...(n <= 20 ? marcas.map((_, i) => i).filter((i) => i % 5 === 0) : [])])
      return (
        <Svg largura={400} altura={150} titulo={rotulo}>
          <Cota x1={x0} y1={30} x2={x0 + comp} y2={30} rotulo={rotulo} />
          <rect x={x0} y={48} width={comp} height={26} rx={6} className={FORMA} strokeWidth={1.5} />
          <line x1={x0 - 10} y1={92} x2={x0 + comp + 10} y2={92} className={LINHA} strokeWidth={1.5} />
          {marcas.map((m, i) => {
            const x = x0 + (m / n) * comp
            return (
              <g key={i}>
                <line x1={x} y1={92} x2={x} y2={legenda.has(i) ? 104 : 99} className={LINHA} strokeWidth={1} />
                {legenda.has(i) && (
                  <text x={x} y={120} textAnchor="middle" className={TEXTO_SUAVE}>
                    {formatar(m)}
                  </text>
                )}
              </g>
            )
          })}
          <line x1={x0} y1={74} x2={x0} y2={92} className={COTA} strokeDasharray="3 3" />
          <line x1={x0 + comp} y1={74} x2={x0 + comp} y2={92} className={COTA} strokeDasharray="3 3" />
          {unidade && (
            <text x={x0 + comp / 2} y={140} textAnchor="middle" className={TEXTO_SUAVE}>
              régua em {unidade}
            </text>
          )}
        </Svg>
      )
    }

    case 'retangulo': {
      const [w, h] = escala(dados.largura, dados.altura, 260, 150)
      const x = (400 - w) / 2 + 20
      const y = 20
      const grade = dados.quadriculado && Number.isInteger(dados.largura) && Number.isInteger(dados.altura) && dados.largura <= 20 && dados.altura <= 20
      return (
        <Svg largura={400} altura={h + 70} titulo={`retângulo de ${dados.rotuloLargura} por ${dados.rotuloAltura}`}>
          <rect x={x} y={y} width={w} height={h} className={FORMA} strokeWidth={2} />
          {grade && (
            <g className="stroke-primary/35" strokeWidth={1}>
              {Array.from({ length: dados.largura - 1 }, (_, i) => {
                const gx = x + ((i + 1) * w) / dados.largura
                return <line key={`c${i}`} x1={gx} y1={y} x2={gx} y2={y + h} />
              })}
              {Array.from({ length: dados.altura - 1 }, (_, i) => {
                const gy = y + ((i + 1) * h) / dados.altura
                return <line key={`l${i}`} x1={x} y1={gy} x2={x + w} y2={gy} />
              })}
            </g>
          )}
          <Cota x1={x} y1={y + h + 16} x2={x + w} y2={y + h + 16} rotulo={dados.rotuloLargura} lado={1} />
          <Cota x1={x - 16} y1={y} x2={x - 16} y2={y + h} rotulo={dados.rotuloAltura} />
          {dados.centro && (
            <>
              <rect x={x + w / 2 - 62} y={y + h / 2 - 13} width={124} height={26} rx={8} className="fill-card/90" />
              <Centro x={x + w / 2} y={y + h / 2} texto={dados.centro} />
            </>
          )}
        </Svg>
      )
    }

    case 'caixa': {
      // perspectiva simples: frente (comprimento x altura) e fundo deslocado na diagonal (largura)
      const [w, h] = escala(dados.comprimento, dados.altura, 210, 120)
      const p = Math.min(Math.max((dados.largura / Math.max(dados.comprimento, dados.altura)) * 110, 30), 80)
      const dx = p * 0.8
      const dy = p * 0.55
      const x = 95
      const y = 18 + dy
      const frente = `M${x} ${y} h${w} v${h} h${-w} z`
      const topo = `M${x} ${y} l${dx} ${-dy} h${w} l${-dx} ${dy} z`
      const lado = `M${x + w} ${y} l${dx} ${-dy} v${h} l${-dx} ${dy} z`
      return (
        <Svg largura={400} altura={y + h + 46} titulo={`caixa: ${dados.rotuloComprimento} por ${dados.rotuloLargura} por ${dados.rotuloAltura}`}>
          <path d={`M${x} ${y + h} l${dx} ${-dy} v${-h} M${x + dx} ${y + h - dy} h${w}`} className={COTA} strokeDasharray="4 4" fill="none" />
          <path d={topo} className="fill-primary/25 stroke-primary" strokeWidth={1.5} />
          <path d={lado} className="fill-primary/10 stroke-primary" strokeWidth={1.5} />
          <path d={frente} className={FORMA} strokeWidth={2} />
          <Cota x1={x} y1={y + h + 16} x2={x + w} y2={y + h + 16} rotulo={`comprimento ${dados.rotuloComprimento}`} lado={1} />
          <Cota x1={x - 16} y1={y} x2={x - 16} y2={y + h} rotulo={`altura ${dados.rotuloAltura}`} />
          <line x1={x + w + 12} y1={y + h + 6} x2={x + w + dx + 12} y2={y + h - dy + 6} className={COTA} strokeWidth={1.2} markerStart="url(#fig-seta)" markerEnd="url(#fig-seta)" />
          <text x={x + w + dx / 2 + 20} y={y + h - dy / 2 + 18} className={TEXTO}>
            largura {dados.rotuloLargura}
          </text>
          <Centro x={x + w / 2} y={y + h / 2} texto={dados.centro} />
        </Svg>
      )
    }

    case 'circulo': {
      const r = 70
      const cx = 200
      const cy = 95
      const diametro = dados.mostrar === 'diametro'
      const valor = diametro ? dados.raio * 2 : dados.raio
      return (
        <Svg largura={400} altura={200} titulo={`círculo de ${diametro ? 'diâmetro' : 'raio'} ${medida(valor, dados.unidade)}`}>
          <circle cx={cx} cy={cy} r={r} className={FORMA} strokeWidth={2} />
          <circle cx={cx} cy={cy} r={3} className="fill-foreground" />
          <line x1={diametro ? cx - r : cx} y1={cy} x2={cx + r} y2={cy} className="stroke-foreground" strokeWidth={1.6} />
          <text x={diametro ? cx : cx + r / 2} y={cy - 8} textAnchor="middle" className={TEXTO}>
            {diametro ? 'diâmetro' : 'raio'} {medida(valor, dados.unidade)}
          </text>
          <Centro x={cx} y={cy + r + 20} texto={dados.centro} />
        </Svg>
      )
    }

    case 'triangulo': {
      const [w, h] = escala(dados.base, dados.altura, 240, 140)
      const x = (400 - w) / 2
      const y = 20
      const reto = dados.forma === 'retangulo'
      // retângulo: ângulo reto embaixo à esquerda; equilátero e isósceles: topo no meio
      const topo = reto ? x : dados.forma === 'qualquer' ? x + w * 0.35 : x + w / 2
      const base = dados.rotuloBase
      const altura = dados.rotuloAltura
      return (
        <Svg largura={400} altura={h + (dados.centro ? 92 : 70)} titulo={`triângulo ${reto ? 'retângulo ' : ''}de base ${base} e altura ${altura}`}>
          <path d={`M${x} ${y + h} L${topo} ${y} L${x + w} ${y + h} z`} className={FORMA} strokeWidth={2} />
          {!reto && <line x1={topo} y1={y} x2={topo} y2={y + h} className="stroke-foreground" strokeDasharray="5 4" strokeWidth={1.4} />}
          <path d={`M${topo} ${y + h - 10} h10 v10`} className="stroke-foreground" fill="none" strokeWidth={1} />
          {reto ? (
            <>
              <Cota x1={x - 16} y1={y} x2={x - 16} y2={y + h} rotulo={`cateto ${altura}`} />
              <text x={x + w / 2 + 10} y={y + h / 2 - 8} className={TEXTO}>
                {dados.hipotenusa || 'hipotenusa'}
              </text>
            </>
          ) : (
            <Cota x1={x + w + 18} y1={y} x2={x + w + 18} y2={y + h} rotulo={`altura ${altura}`} lado={1} />
          )}
          <Cota x1={x} y1={y + h + 16} x2={x + w} y2={y + h + 16} rotulo={`${reto ? 'cateto' : 'base'} ${base}`} lado={1} />
          <Centro x={200} y={y + h + 64} texto={dados.centro} />
        </Svg>
      )
    }

    case 'barras': {
      const maior = Math.max(...dados.itens.map((i) => i.valor), dados.linha ?? 0) || 1
      const base = 170
      const alto = 130
      const largura = 340 / dados.itens.length
      const y = (v: number) => base - (v / maior) * alto
      return (
        <Svg largura={400} altura={210} titulo={dados.titulo || 'gráfico de barras'}>
          {dados.titulo && (
            <text x={200} y={16} textAnchor="middle" className={TEXTO}>
              {dados.titulo}
            </text>
          )}
          <line x1={30} y1={base} x2={380} y2={base} className={LINHA} strokeWidth={1.5} />
          {dados.itens.map((item, i) => {
            const bx = 40 + i * largura + largura * 0.15
            const bw = largura * 0.7
            return (
              <g key={i}>
                <rect x={bx} y={y(item.valor)} width={bw} height={base - y(item.valor)} rx={4} className={FORMA} strokeWidth={1.5} />
                <text x={bx + bw / 2} y={y(item.valor) - 6} textAnchor="middle" className={TEXTO}>
                  {formatar(item.valor)}
                </text>
                <text x={bx + bw / 2} y={base + 18} textAnchor="middle" className={TEXTO_SUAVE}>
                  {item.rotulo}
                </text>
              </g>
            )
          })}
          {dados.linha !== null && (
            <g>
              <line x1={30} y1={y(dados.linha)} x2={380} y2={y(dados.linha)} className="stroke-foreground" strokeDasharray="6 4" strokeWidth={1.4} />
              <rect x={300} y={y(dados.linha) - 20} width={82} height={17} rx={5} className="fill-card/90" />
              <text x={380} y={y(dados.linha) - 7} textAnchor="end" className="fill-foreground text-[12px] font-semibold">
                {dados.rotuloLinha} {formatar(dados.linha)}
              </text>
            </g>
          )}
        </Svg>
      )
    }

    case 'partes': {
      const colunas = dados.total <= 10 ? dados.total : 10
      const linhas = Math.ceil(dados.total / colunas)
      const lado = Math.min(32, 300 / colunas)
      const largura = colunas * lado
      const x0 = (400 - largura) / 2
      return (
        <Svg largura={400} altura={linhas * lado + 50} titulo={dados.rotulo}>
          {Array.from({ length: dados.total }, (_, i) => (
            <rect
              key={i}
              x={x0 + (i % colunas) * lado + 2}
              y={10 + Math.floor(i / colunas) * lado + 2}
              width={lado - 4}
              height={lado - 4}
              rx={Math.min(6, lado / 4)}
              className={i < dados.destaque ? 'fill-primary stroke-primary' : 'fill-transparent stroke-muted-foreground/50'}
              strokeWidth={1.2}
            />
          ))}
          <text x={200} y={linhas * lado + 38} textAnchor="middle" className={TEXTO}>
            {dados.rotulo}
          </text>
        </Svg>
      )
    }

    case 'proporcao': {
      const linhas = dados.linhas
      const altura = 50 + linhas.length * 44
      const yLinha = (i: number) => 62 + i * 44
      const inversa = dados.relacao === 'inversa'
      return (
        <Svg largura={400} altura={altura + 10} titulo={`regra de três ${dados.relacao}`}>
          {dados.cabecalho.map((c, i) => (
            <text key={i} x={i === 0 ? 130 : 270} y={24} textAnchor="middle" className="fill-muted-foreground text-[12px] font-semibold uppercase">
              {c}
            </text>
          ))}
          {linhas.map(([a, b], i) => (
            <g key={i}>
              <rect x={70} y={yLinha(i) - 18} width={120} height={32} rx={8} className={FORMA} strokeWidth={1.2} />
              <rect x={210} y={yLinha(i) - 18} width={120} height={32} rx={8} className={FORMA} strokeWidth={1.2} />
              <text x={130} y={yLinha(i) + 3} textAnchor="middle" dominantBaseline="middle" className={TEXTO}>{a}</text>
              <text x={270} y={yLinha(i) + 3} textAnchor="middle" dominantBaseline="middle" className={TEXTO}>{b}</text>
            </g>
          ))}
          {/* setas: mesmo sentido = direta (um cresce, o outro cresce); sentidos opostos = inversa */}
          <line x1={48} y1={yLinha(0) - 12} x2={48} y2={yLinha(linhas.length - 1) + 8} className="stroke-primary" strokeWidth={2} markerEnd="url(#fig-seta)" />
          <line
            x1={352}
            y1={inversa ? yLinha(linhas.length - 1) + 8 : yLinha(0) - 12}
            x2={352}
            y2={inversa ? yLinha(0) - 12 : yLinha(linhas.length - 1) + 8}
            className="stroke-primary"
            strokeWidth={2}
            markerEnd="url(#fig-seta)"
          />
          <text x={200} y={altura + 4} textAnchor="middle" className={TEXTO_SUAVE}>
            {inversa ? 'setas opostas: grandezas inversamente proporcionais' : 'setas no mesmo sentido: grandezas diretamente proporcionais'}
          </text>
        </Svg>
      )
    }

    default:
      return <DesenhoNovo dados={dados} />
  }
}
