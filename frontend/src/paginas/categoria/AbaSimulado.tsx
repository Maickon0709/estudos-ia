import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowRight, ClipboardCheck, Clock, Play } from '@/lib/icones'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Carregando, Erro } from '@/components/Estados'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

const QUANTIDADES = [5, 10, 15, 20]
const MINUTOS = [5, 10, 15, 30, 45]

export function AbaSimulado({ categoriaId }: { categoriaId: string }) {
  const navigate = useNavigate()
  const [quantidade, setQuantidade] = useState(10)
  const [minutos, setMinutos] = useState(15)
  const historico = useQuery({ queryKey: ['simulados', categoriaId], queryFn: () => api.simulados(categoriaId) })
  const criar = useMutation({
    mutationFn: () => api.criarSimulado(categoriaId, quantidade, minutos),
    onSuccess: (s) => {
      if (s.aviso) toast.info(s.aviso)
      navigate(`/simulados/${s.id}`)
    },
  })

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-xl"><ClipboardCheck className="size-5 text-primary" /> Novo simulado</CardTitle>
          <CardDescription>
            Questões de múltipla escolha sorteadas entre os exercícios desta categoria, com tempo marcado e correção na
            hora. Se faltarem questões para o tamanho escolhido, a IA cria as que faltam antes de começar.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Questões</Label>
              <Select value={String(quantidade)} onValueChange={(v) => setQuantidade(Number(v))}>
                <SelectTrigger className="w-full" aria-label="Quantidade de questões"><SelectValue /></SelectTrigger>
                <SelectContent>{QUANTIDADES.map((q) => <SelectItem key={q} value={String(q)}>{q} questões</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Tempo</Label>
              <Select value={String(minutos)} onValueChange={(v) => setMinutos(Number(v))}>
                <SelectTrigger className="w-full" aria-label="Tempo do simulado"><SelectValue /></SelectTrigger>
                <SelectContent>{MINUTOS.map((m) => <SelectItem key={m} value={String(m)}>{m} minutos</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Button size="lg" onClick={() => criar.mutate()} disabled={criar.isPending}>
            <Play /> {criar.isPending ? 'Preparando as questões… pode levar uns 30 segundos' : 'Começar simulado'}
          </Button>
          {criar.isError && <p className="text-sm text-destructive">{criar.error.message}</p>}
          <p className="text-xs text-muted-foreground">
            Completar questões gasta 1 das ações com IA do dia. Sem trilha na categoria, o simulado usa as que existem
            (mínimo de 3).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-xl">Seus simulados</CardTitle>
        </CardHeader>
        <CardContent>
          {historico.isPending && <Carregando linhas={2} />}
          {historico.isError && <Erro erro={historico.error} />}
          {historico.data?.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum simulado ainda. Que tal o primeiro?</p>
          )}
          <ul className="cascata flex flex-col gap-2">
            {historico.data?.map((s) => {
              const pct = s.acertos !== null ? Math.round((100 * s.acertos) / s.total) : null
              return (
                <li key={s.id}>
                  <Link to={`/simulados/${s.id}`} className="cartao-vivo flex items-center gap-3 rounded-xl border p-3 hover:bg-accent/30">
                    <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl font-heading text-sm font-semibold',
                      pct === null ? 'bg-secondary' : pct >= 80 ? 'bg-sucesso-suave text-sucesso' : pct >= 50 ? 'bg-accent' : 'bg-destructive/10 text-destructive')}>
                      {pct === null ? '…' : `${pct}%`}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-medium">
                        {s.acertos !== null ? `${s.acertos} de ${s.total} acertos` : `${s.total} questões · em andamento`}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        {new Date(s.iniciado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        {s.dentro_do_prazo === false && <Badge variant="outline" className="ml-1">fora do tempo</Badge>}
                      </span>
                    </span>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
