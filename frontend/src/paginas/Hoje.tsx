import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, Flame, Layers, Library, RotateCcw, Target } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Calendario } from '@/components/Calendario'
import { Dica } from '@/components/Tutorial'
import CountUp from '@/components/CountUp'
import { Carregando, Erro, Vazio } from '@/components/Estados'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { api } from '@/lib/api'
import type { Hoje } from '@/lib/tipos'
import { useTitulo } from '@/lib/titulo'
import { cn } from '@/lib/utils'

function saudacao() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

function dataPorExtenso(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  })
}

export function PaginaHoje() {
  useTitulo('Hoje')
  const hoje = useQuery({ queryKey: ['hoje'], queryFn: api.hoje })

  if (hoje.isPending) return <Carregando linhas={4} />
  if (hoje.isError) return <Erro erro={hoje.error} />
  const h = hoje.data
  const pendentes = h.revisoes_pendentes + h.flashcards_pendentes

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground first-letter:uppercase">{dataPorExtenso(h.hoje)}</p>
        <h1 className="text-3xl font-semibold">{saudacao()}! Bora estudar?</h1>
      </div>

      <Dica id="hoje" titulo="Esta é a sua tela do dia">
        Aqui ficam o que revisar hoje, sua sequência de dias, a meta da semana (clique em “Definir”) e o calendário de estudos.
        O cronômetro de foco fica no ícone de relógio, lá no topo.
      </Dica>

      <div className="cascata grid gap-4 md:grid-cols-3">
        <Card className="gap-2">
          <CardHeader className="flex flex-row items-center gap-2 text-sm text-muted-foreground">
            <Flame className={cn('size-4', h.estudou_hoje ? 'text-primary' : 'text-muted-foreground')} /> Sequência
          </CardHeader>
          <CardContent>
            <p className="font-heading text-4xl font-semibold">
              <CountUp to={h.sequencia_dias} duration={1} /> <span className="text-lg font-normal">{h.sequencia_dias === 1 ? 'dia' : 'dias'}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {h.estudou_hoje ? 'Você já estudou hoje. Mandou bem!' : 'Estude hoje para não perder a sequência.'}
            </p>
          </CardContent>
        </Card>

        <MetaSemana h={h} />

        <Card className={cn('gap-2', pendentes > 0 && 'border-primary/40 bg-accent/30')}>
          <CardHeader className="flex flex-row items-center gap-2 text-sm text-muted-foreground">
            <RotateCcw className="size-4 text-primary" /> Para revisar hoje
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex gap-6">
              <div>
                <p className="font-heading text-4xl font-semibold"><CountUp to={h.revisoes_pendentes} duration={1} /></p>
                <p className="text-xs text-muted-foreground">exercícios</p>
              </div>
              <div>
                <p className="font-heading text-4xl font-semibold"><CountUp to={h.flashcards_pendentes} duration={1} /></p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground"><Layers className="size-3" /> flashcards</p>
              </div>
            </div>
            <Button asChild size="sm" variant={pendentes > 0 ? 'default' : 'outline'} className="self-start">
              <Link to="/revisoes">{pendentes > 0 ? 'Revisar agora' : 'Ver revisões'} <ArrowRight /></Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-xl"><CalendarDays className="size-5 text-primary" /> Seu calendário de estudos</CardTitle>
          <CardDescription>Exercícios, flashcards, simulados e minutos de foco de cada dia.</CardDescription>
        </CardHeader>
        <CardContent>
          <Calendario atividade={h.atividade} hoje={h.hoje} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="font-heading text-xl">Suas categorias</CardTitle>
          <Button asChild variant="ghost" size="sm"><Link to="/categorias">Ver todas <ArrowRight /></Link></Button>
        </CardHeader>
        <CardContent>
          {h.categorias.length === 0 ? (
            <Vazio icone={<Library className="size-6" />} titulo="Comece criando uma categoria">
              <p>Ela organiza um assunto que você quer estudar.</p>
              <Button asChild className="mt-4"><Link to="/categorias">Criar categoria</Link></Button>
            </Vazio>
          ) : (
            <ul className="cascata grid gap-3 sm:grid-cols-2">
              {h.categorias.map((c) => (
                <li key={c.id}>
                  <Link to={`/categorias/${c.id}?aba=trilha`} className="cartao-vivo flex flex-col gap-2 rounded-xl border p-4 hover:border-primary/40 hover:bg-accent/20">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium">{c.nome}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.total_etapas ? `${c.etapas_concluidas}/${c.total_etapas} etapas` : 'sem trilha'}
                      </span>
                    </span>
                    <Progress value={c.pct_concluido} aria-label={`Progresso em ${c.nome}`} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MetaSemana({ h }: { h: Hoje }) {
  const meta = h.meta
  const pctDias = meta?.dias_por_semana ? Math.min(100, (100 * h.semana.dias_estudados) / meta.dias_por_semana) : 0
  const cumpriu = meta?.dias_por_semana ? h.semana.dias_estudados >= meta.dias_por_semana : false

  return (
    <Card className="gap-2">
      <CardHeader className="flex flex-row items-center gap-2 text-sm text-muted-foreground">
        <Target className="size-4 text-primary" /> Meta da semana
        <span className="ml-auto"><DialogoMeta atual={meta} /></span>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {meta?.dias_por_semana ? (
          <>
            <p className="font-heading text-4xl font-semibold">
              {h.semana.dias_estudados}<span className="text-lg font-normal text-muted-foreground">/{meta.dias_por_semana} dias</span>
            </p>
            <Progress value={pctDias} aria-label="Dias estudados na semana" />
            <p className="text-xs text-muted-foreground">
              {cumpriu ? 'Meta de dias cumprida! 🎉' : `Faltam ${meta.dias_por_semana - h.semana.dias_estudados} dia(s).`}
              {meta.minutos_por_semana ? ` · ${h.semana.minutos}/${meta.minutos_por_semana} min de foco` : ''}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Defina quantos dias por semana você quer estudar. Metas pequenas e constantes funcionam melhor.</p>
        )}
      </CardContent>
    </Card>
  )
}

function DialogoMeta({ atual }: { atual: Hoje['meta'] }) {
  const queryClient = useQueryClient()
  const [aberto, setAberto] = useState(false)
  const [dias, setDias] = useState(atual?.dias_por_semana ?? 4)
  const [minutos, setMinutos] = useState(atual?.minutos_por_semana ?? 120)
  const salvar = useMutation({
    mutationFn: () => api.salvarMeta({ dias_por_semana: dias, minutos_por_semana: minutos || null }),
    onSuccess: () => {
      toast.success('Meta salva.')
      queryClient.invalidateQueries({ queryKey: ['hoje'] })
      setAberto(false)
    },
  })

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="xs">{atual?.dias_por_semana ? 'Editar' : 'Definir'}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Meta da semana</DialogTitle>
          <DialogDescription>A semana começa na segunda-feira.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label>Dias de estudo por semana</Label>
          <div className="grid grid-cols-7 gap-1">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <Button key={n} type="button" variant={dias === n ? 'default' : 'outline'} size="sm" onClick={() => setDias(n)}>
                {n}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="minutos-meta">Minutos de foco por semana (opcional)</Label>
          <Input id="minutos-meta" type="number" min={0} max={10080} step={5} value={minutos}
            onChange={(e) => setMinutos(Math.max(0, Math.min(10080, Number(e.target.value) || 0)))} />
        </div>
        {salvar.isError && <p className="text-sm text-destructive">{salvar.error.message}</p>}
        <DialogFooter>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>Salvar meta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
