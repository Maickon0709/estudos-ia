import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Bolha } from '@/components/Bolha'
import { BadgeCheck, CircleX, Loader2, Route, Search, Sparkles } from '@/lib/icones'
import { cn } from '@/lib/utils'

// Demonstração animada do que o produto faz, em três atos que se repetem:
// você pede → a plataforma pesquisa e CONFERE cada link (e descarta o quebrado) → sua trilha fica pronta.
// Conteúdo ilustrativo; o visual é o mesmo do app (Bolha, selos de verificação, etapas).

const ATOS = [
  { id: 'pede', titulo: 'Você pede', icone: Sparkles },
  { id: 'confere', titulo: 'A plataforma confere', icone: Search },
  { id: 'trilha', titulo: 'Sua trilha', icone: Route },
] as const

const DURACAO = 5200 // ms por ato
const PEDIDO = 'Quero aprender SQL para análise de dados. Sou iniciante.'

const ACHADOS = [
  { titulo: 'SQL para iniciantes: curso completo', fonte: 'youtube.com · 42 min', ok: true },
  { titulo: 'Tutorial de SELECT e WHERE', fonte: 'w3schools.com', ok: true },
  { titulo: 'Apostila de SQL (PDF)', fonte: 'site fora do ar', ok: false },
  { titulo: 'Funções de agregação explicadas', fonte: 'sqlbolt.com', ok: true },
]

const ETAPAS = ['Consultas com SELECT', 'Filtros e ordenação', 'JOIN entre tabelas', 'Agrupar e resumir dados']

export function DemoHero() {
  const parado = useReducedMotion()
  const [ato, setAto] = useState(0)
  const [pausado, setPausado] = useState(false)

  useEffect(() => {
    if (parado || pausado) return
    const id = setTimeout(() => setAto((a) => (a + 1) % ATOS.length), DURACAO)
    return () => clearTimeout(id)
  }, [ato, parado, pausado])

  return (
    <div
      className="relative rounded-3xl bg-border p-px sombra-alta"
      onPointerEnter={(e) => e.pointerType === 'mouse' && setPausado(true)}
      onPointerLeave={() => setPausado(false)}
      role="group"
      aria-label="Demonstração: do pedido à trilha"
    >
      <div className="relative flex min-h-[25rem] flex-col gap-5 overflow-hidden rounded-[calc(1.5rem-1px)] bg-card p-5 sm:p-6">
        {/* abas dos três atos, com barra de tempo no ato atual */}
        <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Etapas da demonstração">
          {ATOS.map(({ id, titulo, icone: Icone }, i) => {
            const ativo = i === ato
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={ativo}
                onClick={() => setAto(i)}
                className={cn(
                  'relative flex flex-col items-start gap-1.5 overflow-hidden rounded-xl px-3 py-2.5 text-left text-xs font-medium transition-colors',
                  ativo ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted',
                )}
              >
                <span className="flex items-center gap-1.5">
                  <Icone className="size-3.5" weight={ativo ? 'fill' : 'regular'} />
                  <span className="font-mono">{i + 1}</span>
                </span>
                <span className="leading-tight">{titulo}</span>
                {ativo && !parado && (
                  <span
                    key={`${ato}-${pausado}`}
                    className="absolute bottom-0 left-0 h-0.5 bg-destaque"
                    style={{ animation: `progresso ${DURACAO}ms linear both`, animationPlayState: pausado ? 'paused' : 'running' }}
                  />
                )}
              </button>
            )
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={ato}
            initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-1 flex-col gap-3"
          >
            {ato === 0 && <AtoPedido />}
            {ato === 1 && <AtoConfere />}
            {ato === 2 && <AtoTrilha />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

function AtoPedido() {
  const [letras, setLetras] = useState(0)
  useEffect(() => {
    if (letras >= PEDIDO.length) return
    const id = setTimeout(() => setLetras((n) => n + 1), 28)
    return () => clearTimeout(id)
  }, [letras])
  const pronto = letras >= PEDIDO.length

  return (
    <>
      <Bolha mensagem={{ papel: 'user', conteudo: PEDIDO.slice(0, letras) || ' ' }} escrevendo={!pronto} />
      {pronto && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Bolha
            mensagem={{
              papel: 'assistant',
              conteudo: 'Boa escolha. Vou buscar **vídeos e sites**, conferir se cada link funciona e montar uma trilha do básico ao avançado para você aprovar.',
            }}
          />
        </motion.div>
      )}
    </>
  )
}

function AtoConfere() {
  return (
    <>
      <p className="text-sm text-muted-foreground">Abrindo cada link antes de mostrar a você…</p>
      <ul className="flex flex-col gap-2">
        {ACHADOS.map((a, i) => (
          <LinhaConferida key={a.titulo} {...a} atraso={350 + i * 650} />
        ))}
      </ul>
    </>
  )
}

function LinhaConferida({ titulo, fonte, ok, atraso }: { titulo: string; fonte: string; ok: boolean; atraso: number }) {
  const [conferido, setConferido] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setConferido(true), atraso)
    return () => clearTimeout(id)
  }, [atraso])
  const descartado = conferido && !ok

  return (
    <motion.li
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: descartado ? 0.55 : 1, x: 0 }}
      transition={{ delay: atraso / 4000 }}
      className={cn('flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors', conferido && ok && 'border-sucesso/40')}
    >
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium', descartado && 'line-through')}>{titulo}</p>
        <p className="truncate text-xs text-muted-foreground">{fonte}</p>
      </div>
      {!conferido ? (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> conferindo
        </span>
      ) : ok ? (
        <motion.span initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="flex items-center gap-1 rounded-md bg-sucesso-suave px-2 py-0.5 text-xs font-medium text-sucesso">
          <BadgeCheck className="size-3.5" weight="fill" /> Verificado
        </motion.span>
      ) : (
        <motion.span initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
          <CircleX className="size-3.5" weight="fill" /> Descartado
        </motion.span>
      )}
    </motion.li>
  )
}

function AtoTrilha() {
  return (
    <>
      <p className="text-sm text-muted-foreground">Sua trilha de SQL, com 3 materiais conferidos:</p>
      <ol className="relative flex flex-col gap-2.5 pl-1">
        <motion.span
          aria-hidden
          className="absolute top-4 bottom-4 left-[1.05rem] w-0.5 origin-top bg-destaque"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 1.4, ease: 'easeInOut' }}
        />
        {ETAPAS.map((etapa, i) => (
          <motion.li
            key={etapa}
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.3 }}
            className="relative flex items-center gap-3"
          >
            <span
              className={cn(
                'z-10 grid size-8 shrink-0 place-items-center rounded-full font-mono text-xs font-semibold ring-4 ring-card',
                i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground',
              )}
            >
              {i + 1}
            </span>
            <span className="flex-1 rounded-xl bg-muted/60 px-3 py-2 text-sm">
              {etapa}
              {i === 0 && <span className="ml-2 text-xs font-medium text-destaque">você começa aqui</span>}
            </span>
          </motion.li>
        ))}
      </ol>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5 }}
        className="mt-auto flex items-center justify-between gap-3 rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground"
      >
        <span>Nada é criado antes do seu ok.</span>
        <span className="pulso-suave rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Aprovar trilha</span>
      </motion.div>
    </>
  )
}
