import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Bot, Check, CircleHelp, Compass, MessageCircle, Route, Send, X, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { toast } from 'sonner'
import { Carregando, Erro, Trabalhando, Vazio } from '@/components/Estados'
import { Markdown } from '@/components/Markdown'
import { Dica } from '@/components/Tutorial'
import { RecursoItem } from '@/components/RecursoItem'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { LIMITES } from '@/lib/seguranca'
import type { Mensagem, Proposta } from '@/lib/tipos'
import { cn } from '@/lib/utils'

type Props = { categoriaId: string; aoConfirmar: () => void }

/** Atalhos com as formas de estudar: mandam a mensagem pronta ou abrem a montagem da trilha. */
const ATALHOS: { icone: LucideIcon; rotulo: string; mensagem?: string }[] = [
  { icone: Compass, rotulo: 'Quais são minhas opções?', mensagem: 'Como posso estudar este assunto aqui? Quais são as opções?' },
  { icone: BookOpen, rotulo: 'Me ensine aqui pelo chat', mensagem: 'Quero estudar aqui pelo chat. Me explique do começo, passo a passo, com exemplos.' },
  { icone: Route, rotulo: 'Trilha com vídeos e sites' },
  { icone: CircleHelp, rotulo: 'Me teste com perguntas', mensagem: 'Me faça 3 perguntas, uma de cada vez, para testar o que eu já sei sobre este assunto.' },
]

export function AbaConversa({ categoriaId, aoConfirmar }: Props) {
  const queryClient = useQueryClient()
  const chaveMensagens = ['mensagens', categoriaId]
  const mensagens = useQuery({ queryKey: chaveMensagens, queryFn: () => api.mensagens(categoriaId) })
  const pendentes = useQuery({
    queryKey: ['propostas', categoriaId],
    queryFn: () => api.propostasPendentes(categoriaId),
  })
  const [texto, setTexto] = useState('')
  const [dialogoAberto, setDialogoAberto] = useState(false)
  const [parcial, setParcial] = useState('') // resposta da IA chegando ao vivo
  const fim = useRef<HTMLDivElement>(null)

  const enviar = useMutation({
    mutationFn: (mensagem: string) => {
      setParcial('')
      return api.conversarAoVivo(categoriaId, mensagem, (pedaco) => setParcial((atual) => atual + pedaco))
    },
    onSuccess: ({ pergunta, resposta }) => {
      setTexto('')
      queryClient.setQueryData<Mensagem[]>(chaveMensagens, (antigas = []) => [...antigas, pergunta, resposta])
    },
    onSettled: () => setParcial(''),
  })
  const escrevendo = parcial.length > 0

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [mensagens.data?.length, enviar.isPending, escrevendo])

  function aoEnviar(e?: FormEvent) {
    e?.preventDefault()
    if (texto.trim() && !enviar.isPending) enviar.mutate(texto.trim())
  }

  function aoTeclar(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      aoEnviar()
    }
  }

  const proposta = pendentes.data?.[0]

  return (
    <div className="flex flex-col gap-6">
      <Dica id="conversa" titulo="Escolha como estudar">
        Peça ajuda à tutora e ela mostra as opções: estudar aqui pelo chat, montar uma trilha com vídeos e sites verificados,
        ou praticar. Os atalhos logo acima do campo de mensagem fazem isso com um clique.
      </Dica>
      {proposta && <PropostaCard proposta={proposta} categoriaId={categoriaId} aoConfirmar={aoConfirmar} />}

      <Card className="gap-0 py-0">
        <div className="flex max-h-[55vh] min-h-64 flex-col gap-4 overflow-y-auto p-5">
          {mensagens.isPending && <Carregando linhas={2} />}
          {mensagens.isError && <Erro erro={mensagens.error} />}
          {mensagens.data?.length === 0 && !enviar.isPending && (
            <Vazio icone={<MessageCircle className="size-6" />} titulo="Converse com a sua tutora">
              Conte o que quer aprender e o que já sabe. Você pode estudar aqui mesmo pelo chat ou pedir uma trilha
              com vídeos do YouTube e sites verificados. Use os atalhos abaixo para começar.
            </Vazio>
          )}
          {mensagens.data?.map((m) => <Bolha key={m.id} mensagem={m} />)}
          {enviar.isPending && (
            <>
              <Bolha mensagem={{ papel: 'user', conteudo: enviar.variables }} />
              {parcial ? (
                <Bolha mensagem={{ papel: 'assistant', conteudo: parcial }} escrevendo />
              ) : (
                <Trabalhando>A tutora está pensando…</Trabalhando>
              )}
            </>
          )}
          <div ref={fim} />
        </div>

        <form onSubmit={aoEnviar} className="flex flex-col gap-3 border-t p-4">
          {enviar.isError && <p className="text-sm text-destructive">{enviar.error.message}</p>}
          <div className="flex flex-wrap gap-2" aria-label="Formas de estudar">
            {ATALHOS.map(({ icone: Icone, rotulo, mensagem }) => (
              <button
                key={rotulo}
                type="button"
                disabled={enviar.isPending}
                onClick={() => (mensagem ? enviar.mutate(mensagem) : setDialogoAberto(true))}
                className="flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
              >
                <Icone className="size-3.5 text-primary" /> {rotulo}
              </button>
            ))}
          </div>
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={aoTeclar}
            maxLength={LIMITES.mensagem}
            rows={2}
            placeholder="Escreva sua mensagem… (Enter envia, Shift+Enter quebra linha)"
            aria-label="Mensagem para a tutora"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={!texto.trim() || enviar.isPending}>
              <Send /> Enviar
            </Button>
            <Button type="button" variant="outline" className="ml-auto" onClick={() => setDialogoAberto(true)}>
              <Route /> Montar trilha de estudo
            </Button>
          </div>
        </form>
      </Card>

      <DialogoObjetivo categoriaId={categoriaId} aberto={dialogoAberto} aoMudar={setDialogoAberto} />
    </div>
  )
}

function Bolha({ mensagem, escrevendo = false }: { mensagem: Pick<Mensagem, 'papel' | 'conteudo'>; escrevendo?: boolean }) {
  const usuario = mensagem.papel === 'user'
  return (
    <div className={cn('flex gap-3', usuario && 'flex-row-reverse')}>
      {!usuario && (
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Bot className="size-4" />
        </span>
      )}
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
          usuario ? 'rounded-tr-sm bg-primary whitespace-pre-wrap text-primary-foreground' : 'rounded-tl-sm bg-secondary',
        )}
      >
        {/* Mensagem do estudante: texto puro. Da IA: markdown seguro (sem HTML e sem links). */}
        {usuario ? mensagem.conteudo : <Markdown texto={mensagem.conteudo} />}
        {escrevendo && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-primary align-text-bottom" aria-hidden />}
      </div>
    </div>
  )
}

function DialogoObjetivo({ categoriaId, aberto, aoMudar }: { categoriaId: string; aberto: boolean; aoMudar: (v: boolean) => void }) {
  const queryClient = useQueryClient()
  const [objetivo, setObjetivo] = useState('')
  const gerar = useMutation({
    mutationFn: () => api.gerarProposta(categoriaId, objetivo.trim()),
    onSuccess: (proposta) => {
      queryClient.setQueryData(['propostas', categoriaId], [proposta])
      setObjetivo('')
      aoMudar(false)
    },
  })

  return (
    <Dialog open={aberto} onOpenChange={(v) => !gerar.isPending && aoMudar(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>O que você quer aprender?</DialogTitle>
          <DialogDescription>
            A tutora pesquisa materiais reais, confere cada link e propõe uma trilha. Nada é salvo antes de você confirmar.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={objetivo}
          onChange={(e) => setObjetivo(e.target.value)}
          maxLength={LIMITES.objetivo}
          rows={3}
          placeholder="Ex.: dominar o uso da crase, do básico ao avançado"
          disabled={gerar.isPending}
        />
        {gerar.isPending && <Trabalhando>Pesquisando materiais e montando a trilha… leva uns 10 segundos.</Trabalhando>}
        {gerar.isError && <p className="text-sm text-destructive">{gerar.error.message}</p>}
        <DialogFooter>
          <Button onClick={() => gerar.mutate()} disabled={objetivo.trim().length < 3 || gerar.isPending}>
            Gerar proposta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PropostaCard({ proposta, categoriaId, aoConfirmar }: { proposta: Proposta; categoriaId: string; aoConfirmar: () => void }) {
  const queryClient = useQueryClient()
  const decidir = useMutation({
    mutationFn: async (acao: 'confirmar' | 'rejeitar'): Promise<unknown> =>
      acao === 'confirmar' ? api.confirmarProposta(proposta.id) : api.rejeitarProposta(proposta.id),
    onSuccess: (_, acao) => {
      queryClient.setQueryData(['propostas', categoriaId], [])
      toast.success(acao === 'confirmar' ? 'Trilha criada! Bons estudos.' : 'Proposta descartada.')
      if (acao === 'confirmar') {
        queryClient.invalidateQueries({ queryKey: ['trilhas', categoriaId] })
        aoConfirmar()
      }
    },
  })
  const { payload } = proposta

  return (
    <Card className="border-primary/40 bg-accent/20">
      <CardHeader>
        <Badge className="w-fit">Proposta aguardando você</Badge>
        <CardTitle className="font-heading text-xl">{payload.titulo}</CardTitle>
        <CardDescription>Objetivo: {payload.objetivo}</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-5">
          {payload.etapas.map((etapa, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div>
                  <p className="font-medium">{etapa.titulo}</p>
                  {etapa.descricao && <p className="text-sm text-muted-foreground">{etapa.descricao}</p>}
                </div>
                {etapa.recursos.map((r) => <RecursoItem key={r.url} recurso={r} />)}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        <Button onClick={() => decidir.mutate('confirmar')} disabled={decidir.isPending}>
          <Check /> Confirmar e criar a trilha
        </Button>
        <Button variant="ghost" onClick={() => decidir.mutate('rejeitar')} disabled={decidir.isPending}>
          <X /> Descartar
        </Button>
        {decidir.isError && <p className="w-full text-sm text-destructive">{decidir.error.message}</p>}
      </CardFooter>
    </Card>
  )
}
