import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Coffee, Pause, Play, RotateCcw, Save, Timer } from '@/lib/icones'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { comemorar } from '@/lib/comemorar'
import { cn } from '@/lib/utils'

type Modo = 'foco' | 'pausa' | 'livre'

type Estado = {
  modo: Modo
  acumulado: number // segundos contados antes do último "play"
  rodandoDesde: number | null // Date.now() do último "play"
  inicioSessao: string | null // ISO do primeiro "play" desta sessão
  categoriaId: string | null
}

const ALVO: Record<Modo, number | null> = { foco: 25 * 60, pausa: 5 * 60, livre: null }
const NOME: Record<Modo, string> = { foco: 'Foco 25 min', pausa: 'Pausa 5 min', livre: 'Livre' }
const CHAVE = 'estudos-ia:cronometro'
const MINIMO_PARA_SALVAR = 60
const INICIAL: Estado = { modo: 'foco', acumulado: 0, rodandoDesde: null, inicioSessao: null, categoriaId: null }

function carregar(): Estado {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? 'null')
    if (salvo && typeof salvo.acumulado === 'number' && salvo.modo in ALVO) return salvo
  } catch { /* começa do zero */ }
  return INICIAL
}

function decorrido(e: Estado, agora = Date.now()) {
  return Math.floor(e.acumulado + (e.rodandoDesde ? (agora - e.rodandoDesde) / 1000 : 0))
}

function relogio(segundos: number) {
  const s = Math.max(0, segundos)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function Cronometro() {
  const queryClient = useQueryClient()
  const [estado, setEstado] = useState<Estado>(carregar)
  const [, setTique] = useState(0)
  const salvando = useRef(false)
  const categorias = useQuery({ queryKey: ['categorias'], queryFn: api.categorias })

  const atualizar = useCallback((novo: Estado) => {
    setEstado(novo)
    try { localStorage.setItem(CHAVE, JSON.stringify(novo)) } catch { /* só na memória */ }
  }, [])

  const salvar = useCallback(async (segundos: number, tipo: 'foco' | 'livre', e: Estado) => {
    if (salvando.current || segundos < MINIMO_PARA_SALVAR || !e.inicioSessao) return false
    salvando.current = true
    try {
      await api.registrarSessao({
        categoria_id: e.categoriaId,
        tipo,
        duracao_segundos: Math.min(segundos, 4 * 3600),
        iniciada_em: e.inicioSessao,
      })
      queryClient.invalidateQueries({ queryKey: ['hoje'] })
      queryClient.invalidateQueries({ queryKey: ['painel'] })
      return true
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : 'Não consegui salvar o tempo de estudo.')
      return false
    } finally {
      salvando.current = false
    }
  }, [queryClient])

  const rodando = estado.rodandoDesde !== null
  const passou = decorrido(estado)
  const alvo = ALVO[estado.modo]
  const mostrado = alvo === null ? passou : alvo - passou

  // Relógio: um "tique" por segundo enquanto roda; ao bater o alvo, fecha o ciclo.
  useEffect(() => {
    if (!rodando) return
    const id = setInterval(() => {
      setTique((t) => t + 1)
      if (alvo !== null && decorrido(estado) >= alvo) {
        if (estado.modo === 'foco') {
          void salvar(alvo, 'foco', estado).then((ok) => {
            if (ok) {
              comemorar()
              toast.success('Foco concluído. Hora de uma pausa de 5 minutos.')
            }
          })
          atualizar({ ...INICIAL, modo: 'pausa', categoriaId: estado.categoriaId })
        } else {
          toast('Pausa encerrada. Bora voltar?')
          atualizar({ ...INICIAL, modo: 'foco', categoriaId: estado.categoriaId })
        }
      }
    }, 1000)
    return () => clearInterval(id)
  }, [rodando, alvo, estado, atualizar, salvar])

  function alternar() {
    if (rodando) {
      atualizar({ ...estado, acumulado: passou, rodandoDesde: null })
    } else {
      atualizar({ ...estado, rodandoDesde: Date.now(), inicioSessao: estado.inicioSessao ?? new Date().toISOString() })
    }
  }

  function trocarModo(modo: Modo) {
    atualizar({ ...INICIAL, modo, categoriaId: estado.categoriaId })
  }

  async function encerrar() {
    // Encerrar antes do fim: o tempo vale como estudo livre (o "foco" é o ciclo completo de 25 min).
    if (await salvar(passou, 'livre', estado)) toast.success(`${Math.floor(passou / 60)} min de estudo salvos.`)
    atualizar({ ...INICIAL, modo: estado.modo, categoriaId: estado.categoriaId })
  }

  const podeSalvar = estado.modo !== 'pausa' && passou >= MINIMO_PARA_SALVAR

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={rodando ? 'secondary' : 'ghost'}
          size="sm"
          aria-label="Cronômetro de estudo"
          title="Cronômetro de estudo"
          className={cn('gap-1.5 tabular-nums', rodando && 'text-primary')}
        >
          {estado.modo === 'pausa' ? <Coffee /> : <Timer />}
          {(rodando || passou > 0) && <span className="text-xs">{relogio(mostrado)}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 text-xs">
            {(Object.keys(ALVO) as Modo[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => trocarModo(m)}
                className={cn('rounded-lg px-2 py-1.5 transition-colors',
                  estado.modo === m ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                {NOME[m].split(' ')[0]}
              </button>
            ))}
          </div>

          <p className="text-center font-heading text-5xl font-semibold tabular-nums" aria-live="polite">
            {relogio(mostrado)}
          </p>
          <p className="-mt-3 text-center text-xs text-muted-foreground">{NOME[estado.modo]}</p>

          {estado.modo !== 'pausa' && (
            <Select
              value={estado.categoriaId ?? 'nenhuma'}
              onValueChange={(v) => atualizar({ ...estado, categoriaId: v === 'nenhuma' ? null : v })}
            >
              <SelectTrigger className="w-full" aria-label="Categoria do estudo"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Sem categoria</SelectItem>
                {categorias.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <div className="flex gap-2">
            <Button className="flex-1" onClick={alternar}>
              {rodando ? <><Pause /> Pausar</> : <><Play /> {passou > 0 ? 'Continuar' : 'Começar'}</>}
            </Button>
            {podeSalvar ? (
              <Button variant="outline" onClick={encerrar} title="Encerrar e salvar o tempo">
                <Save /> Salvar
              </Button>
            ) : (
              <Button variant="outline" size="icon" onClick={() => trocarModo(estado.modo)} aria-label="Zerar" title="Zerar">
                <RotateCcw />
              </Button>
            )}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            O tempo entra no seu calendário e no painel da categoria.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
