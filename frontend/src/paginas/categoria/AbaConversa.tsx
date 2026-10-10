import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Check, CircleHelp, Compass, Dumbbell, FileText, Lightbulb, MessageCircle, Route, Send, Sparkles, X, type Icone as LucideIcon } from '@/lib/icones'
import { Fragment, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Carregando, Erro, Trabalhando, Vazio } from '@/components/Estados'
import { Bolha } from '@/components/Bolha'
import { Dica } from '@/components/Tutorial'
import { MaterialItem } from '@/components/MaterialItem'
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
import { cn } from '@/lib/utils'
import type { AcaoChat, Fonte, Mensagem, Proposta } from '@/lib/tipos'

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
  const [objetivo, setObjetivo] = useState('') // texto do diálogo "Montar trilha"
  // Pedidos que só a plataforma atende (trilha, exercícios salvos): id da resposta -> ação + o que o aluno pediu.
  const [acoes, setAcoes] = useState<Record<string, { acao: Exclude<AcaoChat, null>; pedido: string }>>({})
  const [params, setParams] = useSearchParams()
  const [parcial, setParcial] = useState('') // resposta da IA chegando ao vivo
  // Materiais usados em cada resposta desta visita (id da resposta -> fontes). Não ficam no histórico.
  const [fontes, setFontes] = useState<Record<string, Fonte[]>>({})
  const fim = useRef<HTMLDivElement>(null)

  const enviar = useMutation({
    mutationFn: (mensagem: string) => {
      setParcial('')
      return api.conversarAoVivo(categoriaId, mensagem, (pedaco) => setParcial((atual) => atual + pedaco))
    },
    onSuccess: ({ pergunta, resposta, fontes: usadas, acao }) => {
      setTexto('')
      if (usadas.length) setFontes((atuais) => ({ ...atuais, [resposta.id]: usadas }))
      if (acao) setAcoes((atuais) => ({ ...atuais, [resposta.id]: { acao, pedido: pergunta.conteudo } }))
      queryClient.setQueryData<Mensagem[]>(chaveMensagens, (antigas = []) => [...antigas, pergunta, resposta])
    },
    onSettled: () => setParcial(''),
  })
  const escrevendo = parcial.length > 0

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [mensagens.data?.length, enviar.isPending, escrevendo])

  /** Abre a montagem da trilha, já com o pedido do aluno como objetivo (ele pode editar). */
  function montarTrilha(pedido = '') {
    setObjetivo(pedido.slice(0, LIMITES.objetivo))
    setDialogoAberto(true)
  }

  // Vindo das abas Trilha/Praticar ("Montar trilha agora"), a URL traz ?montar=1: o diálogo já abre.
  const montagemPedida = params.get('montar') === '1'
  function mudarDialogo(aberto: boolean) {
    setDialogoAberto(aberto)
    if (!aberto && montagemPedida) {
      setParams((atuais) => {
        const novos = new URLSearchParams(atuais)
        novos.delete('montar')
        return novos
      }, { replace: true })
    }
  }

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
      <Dica id="conversa-v2" titulo="Como funciona a conversa">
        A tutora explica, tira dúvidas e faz perguntas de treino aqui mesmo. Ela não cria nada sozinha: a trilha só existe
        depois que você clica em <strong>Montar trilha de estudo</strong> (abaixo do chat), escreve o objetivo e confirma a
        proposta. Aí ela aparece na aba Trilha, e os exercícios salvos ficam na aba Praticar.
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
          {mensagens.data?.map((m) => (
            <Fragment key={m.id}>
              <Bolha mensagem={m} />
              {fontes[m.id] && <Fontes lista={fontes[m.id]} />}
              {acoes[m.id] && (
                <CartaoAcao
                  acao={acoes[m.id].acao}
                  montar={() => montarTrilha(acoes[m.id].pedido)}
                  treinarNoChat={() => enviar.mutate('Me faça perguntas de treino sobre este assunto, uma de cada vez, e corrija cada resposta.')}
                />
              )}
            </Fragment>
          ))}
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
                onClick={() => (mensagem ? enviar.mutate(mensagem) : montarTrilha())}
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
            <Button type="button" variant="outline" className="ml-auto" onClick={() => montarTrilha()}>
              <Route /> Montar trilha de estudo
            </Button>
          </div>
        </form>
      </Card>

      <DialogoObjetivo categoriaId={categoriaId} aberto={dialogoAberto || montagemPedida} aoMudar={mudarDialogo}
        objetivo={objetivo} setObjetivo={setObjetivo} />
    </div>
  )
}


/**
 * Cartão que aparece embaixo da resposta quando o aluno pediu algo que só a plataforma faz.
 * Sem ele, "faça uma trilha" ficava só na conversa e a aba Trilha continuava vazia.
 */
function CartaoAcao({ acao, montar, treinarNoChat }: { acao: Exclude<AcaoChat, null>; montar: () => void; treinarNoChat: () => void }) {
  const trilha = acao === 'trilha'
  return (
    <div className="ml-11 flex flex-col gap-3 rounded-2xl border border-destaque/30 bg-accent/40 p-4 text-sm" role="note">
      <p className="flex items-center gap-2 font-medium">
        <Lightbulb className="size-4 text-destaque" weight="fill" />
        {trilha ? 'Para a trilha aparecer na aba Trilha' : 'Exercícios salvos ficam na aba Praticar'}
      </p>
      <p className="text-muted-foreground">
        {trilha
          ? 'A tutora não cria a trilha pela conversa. Clique abaixo, confira o objetivo e escolha de onde vêm os materiais: “Tudo junto” usa seus arquivos e completa com vídeos e sites verificados; também dá para usar só os arquivos ou só a internet. Você aprova antes de salvar.'
          : 'Exercícios por nível, flashcards e simulados nascem das etapas de uma trilha confirmada. Sem trilha ainda? Monte uma, ou treine agora aqui no chat com perguntas uma de cada vez.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={montar}><Route /> Montar trilha de estudo</Button>
        {!trilha && <Button size="sm" variant="outline" onClick={treinarNoChat}><Dumbbell /> Treinar aqui no chat</Button>}
      </div>
    </div>
  )
}

/** O texto do objetivo mora na aba: assim "Montar trilha" no cartão do chat já abre com o pedido do aluno. */
function DialogoObjetivo({ categoriaId, aberto, aoMudar, objetivo, setObjetivo }: {
  categoriaId: string; aberto: boolean; aoMudar: (v: boolean) => void; objetivo: string; setObjetivo: (v: string) => void
}) {
  const queryClient = useQueryClient()
  const documentos = useQuery({ queryKey: ['documentos', categoriaId], queryFn: () => api.documentos(categoriaId), enabled: aberto })
  const totalArquivos = documentos.data?.length ?? 0
  // Quem já enviou arquivos começa com "Tudo junto" (arquivos + internet); dá para trocar.
  const [escolhida, setEscolhida] = useState<Origem | null>(null)
  const origem: Origem = escolhida ?? (totalArquivos > 0 ? 'misto' : 'internet')
  const gerar = useMutation({
    mutationFn: () => {
      const alvo = objetivo.trim()
      if (origem === 'misto') return api.gerarPropostaMisto(categoriaId, alvo)
      if (origem === 'materiais') return api.gerarPropostaMateriais(categoriaId, alvo)
      return api.gerarProposta(categoriaId, alvo)
    },
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
            A plataforma propõe uma trilha em etapas, do básico ao avançado. Nada é salvo antes de você confirmar. Depois de
            confirmada, ela fica na aba Trilha e libera os exercícios na aba Praticar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2" role="radiogroup" aria-label="De onde vêm os materiais">
          <OpcaoOrigem
            ativa={origem === 'misto'}
            desativada={totalArquivos === 0}
            onClick={() => setEscolhida('misto')}
            icone={<Sparkles className="size-4" />}
            titulo="Tudo junto"
            texto={totalArquivos > 0
              ? 'Seus arquivos como base, mais vídeos e sites verificados para explicar de outro jeito e aprofundar.'
              : 'Envie seus arquivos na aba Materiais para juntar com vídeos e sites.'}
          />
          <OpcaoOrigem
            ativa={origem === 'materiais'}
            desativada={totalArquivos === 0}
            onClick={() => setEscolhida('materiais')}
            icone={<FileText className="size-4" />}
            titulo={totalArquivos > 0 ? `Só meus arquivos (${totalArquivos})` : 'Só meus arquivos'}
            texto={totalArquivos > 0
              ? 'Etapas com as partes dos seus PDFs e slides. Os exercícios usam o texto deles.'
              : 'Envie PDFs, Word ou slides na aba Materiais para usar esta opção.'}
          />
          <OpcaoOrigem
            ativa={origem === 'internet'}
            onClick={() => setEscolhida('internet')}
            icone={<Route className="size-4" />}
            titulo="Só vídeos e sites"
            texto="A plataforma pesquisa no YouTube e em sites confiáveis e confere cada link."
          />
        </div>
        <Textarea
          value={objetivo}
          onChange={(e) => setObjetivo(e.target.value)}
          maxLength={LIMITES.objetivo}
          rows={3}
          placeholder="Ex.: dominar o uso da crase, do básico ao avançado"
          disabled={gerar.isPending}
        />
        {gerar.isPending && (
          <Trabalhando>
            {origem === 'materiais'
              ? 'Organizando seus arquivos em etapas… leva uns 10 segundos.'
              : origem === 'misto'
                ? 'Pesquisando vídeos e sites e juntando com seus arquivos… leva uns 15 segundos.'
                : 'Pesquisando materiais e montando a trilha… leva uns 10 segundos.'}
          </Trabalhando>
        )}
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

type Origem = 'misto' | 'materiais' | 'internet'

function OpcaoOrigem({ ativa, desativada = false, onClick, icone, titulo, texto }: {
  ativa: boolean; desativada?: boolean; onClick: () => void; icone: ReactNode; titulo: string; texto: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={ativa}
      disabled={desativada}
      onClick={onClick}
      className={cn(
        'flex flex-col gap-1 rounded-xl border p-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        ativa ? 'border-destaque bg-accent/50' : 'hover:border-foreground/30',
      )}
    >
      <span className="flex items-center gap-2 font-medium">{icone} {titulo}</span>
      <span className="text-xs text-muted-foreground">{texto}</span>
    </button>
  )
}

function PropostaCard({ proposta, categoriaId, aoConfirmar }: { proposta: Proposta; categoriaId: string; aoConfirmar: () => void }) {
  const queryClient = useQueryClient()
  const decidir = useMutation({
    mutationFn: async (acao: 'confirmar' | 'rejeitar'): Promise<unknown> =>
      acao === 'confirmar' ? api.confirmarProposta(proposta.id) : api.rejeitarProposta(proposta.id),
    onSuccess: (_, acao) => {
      queryClient.setQueryData(['propostas', categoriaId], [])
      toast.success(acao === 'confirmar' ? 'Trilha criada. Ela já está na aba Trilha.' : 'Proposta descartada.')
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
                {etapa.materiais?.map((m) => <MaterialItem key={`${m.documento_id}-${m.ordem_inicio}`} material={m} />)}
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

/** De onde a tutora tirou a resposta (arquivo e página). Só texto: nome de arquivo nunca vira link. */
function Fontes({ lista }: { lista: Fonte[] }) {
  return (
    <p className="-mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 pl-1 text-xs text-muted-foreground">
      <FileText className="size-3.5 text-primary" />
      <span>Dos seus materiais:</span>
      {lista.map((f) => (
        <span key={`${f.documento_id}-${f.pagina}`} className="rounded-full border px-2 py-0.5">
          {f.nome}{f.pagina ? `, p. ${f.pagina}` : ''}
        </span>
      ))}
    </p>
  )
}
