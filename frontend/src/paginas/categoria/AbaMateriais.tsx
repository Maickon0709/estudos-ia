import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, MessageCircle, Trash2, Upload } from '@/lib/icones'
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { toast } from 'sonner'
import { Carregando, Erro, Trabalhando, Vazio } from '@/components/Estados'
import { Dica } from '@/components/Tutorial'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api } from '@/lib/api'
import type { Documento } from '@/lib/tipos'
import { cn } from '@/lib/utils'

type Props = { categoriaId: string; irParaConversa: () => void }

// O tipo de verdade é descoberto pela API pelo conteúdo; aqui só filtramos a janela de escolha.
const ACEITOS = '.pdf,.docx,.pptx,.txt,.md,application/pdf'
const MAX_BYTES = 4 * 1024 * 1024
const ROTULO: Record<Documento['tipo'], string> = {
  pdf: 'PDF', docx: 'Word', pptx: 'PowerPoint', txt: 'Texto', md: 'Markdown',
}

export function AbaMateriais({ categoriaId, irParaConversa }: Props) {
  const queryClient = useQueryClient()
  const chave = ['documentos', categoriaId]
  const arquivo = useRef<HTMLInputElement>(null)
  const documentos = useQuery({ queryKey: chave, queryFn: () => api.documentos(categoriaId) })

  const enviar = useMutation({
    mutationFn: (escolhido: File) => api.enviarDocumento(categoriaId, escolhido),
    onSuccess: (novo) => {
      queryClient.setQueryData<Documento[]>(chave, (antigos = []) => [novo, ...antigos])
      toast.success(
        novo.truncado
          ? `“${novo.nome}” enviado. Era grande demais: a tutora vai usar só a primeira parte.`
          : `“${novo.nome}” enviado. A tutora já pode usar no chat.`,
      )
    },
    onError: (erro) => toast.error(erro.message),
  })
  const remover = useMutation({
    mutationFn: (documento: Documento) => api.removerDocumento(documento.id),
    onSuccess: (_, documento) => {
      queryClient.setQueryData<Documento[]>(chave, (antigos = []) => antigos.filter((d) => d.id !== documento.id))
      toast.success(`“${documento.nome}” apagado.`)
    },
    onError: (erro) => toast.error(erro.message),
  })

  const [arrastando, setArrastando] = useState(false)
  const profundidade = useRef(0) // dragenter/dragleave disparam também nos filhos: conta para não piscar

  function receber(escolhido: File | undefined) {
    if (!escolhido || enviar.isPending) return
    if (escolhido.size > MAX_BYTES) return void toast.error('O arquivo pode ter no máximo 4 MB.')
    enviar.mutate(escolhido)
  }

  function aoEscolher(e: ChangeEvent<HTMLInputElement>) {
    const escolhido = e.target.files?.[0]
    e.target.value = '' // permite escolher o mesmo arquivo de novo
    receber(escolhido)
  }

  const temArquivo = (e: DragEvent) => e.dataTransfer.types.includes('Files')
  const soltar = {
    onDragEnter: (e: DragEvent) => {
      if (!temArquivo(e)) return
      e.preventDefault()
      profundidade.current += 1
      setArrastando(true)
    },
    onDragOver: (e: DragEvent) => {
      if (!temArquivo(e)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    },
    onDragLeave: () => {
      profundidade.current = Math.max(0, profundidade.current - 1)
      if (profundidade.current === 0) setArrastando(false)
    },
    onDrop: (e: DragEvent) => {
      if (!temArquivo(e)) return
      e.preventDefault()
      profundidade.current = 0
      setArrastando(false)
      if (e.dataTransfer.files.length > 1) toast.info('Um arquivo por vez: enviei só o primeiro.')
      receber(e.dataTransfer.files[0])
    },
  }

  return (
    <div className="flex flex-col gap-6">
      <Dica id="materiais-uso" titulo="Como usar seus materiais">
        Depois de enviar, vá à aba Conversa e pergunte. Experimente: <strong>“Resuma meus materiais”</strong> para uma visão
        geral, <strong>“Explique a página 5 da aula 1”</strong> ou <strong>“O que é estudo de viabilidade?”</strong>. A tutora
        mostra de qual arquivo e página tirou a resposta. Ela não lê o arquivo inteiro de uma vez, só os trechos que combinam
        com a pergunta. A trilha (aba Trilha) ainda usa vídeos e sites da internet, não os seus arquivos. Mantenha nesta
        categoria só materiais do mesmo assunto: um PDF de outra matéria acaba misturado nas respostas.
      </Dica>
      <input ref={arquivo} type="file" accept={ACEITOS} className="hidden" onChange={aoEscolher} />
      {/* Área de soltar: também é um botão (teclado e toque abrem a janela de escolha) */}
      <button
        type="button"
        {...soltar}
        onClick={() => arquivo.current?.click()}
        disabled={enviar.isPending}
        className={cn(
          'group flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors',
          'hover:border-primary/60 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
          'disabled:cursor-wait disabled:opacity-70',
          arrastando && 'soltar-ativo border-transparent bg-accent',
        )}
      >
        <span
          className={cn(
            'grid size-12 place-items-center rounded-2xl bg-accent text-primary transition-transform duration-300 motion-reduce:transition-none',
            arrastando ? '-translate-y-1 scale-110' : 'group-hover:-translate-y-0.5',
          )}
        >
          <Upload className="size-6" weight={arrastando ? 'bold' : 'regular'} />
        </span>
        <span className="font-medium">
          {enviar.isPending ? 'Lendo o arquivo…' : arrastando ? 'Solte para enviar' : 'Arraste um arquivo aqui ou clique para escolher'}
        </span>
        <span className="max-w-md text-sm text-muted-foreground">
          PDF, Word, PowerPoint, .txt ou .md, até 4 MB. No chat, a tutora procura os trechos certos e diz de qual arquivo e página tirou a resposta.
        </span>
      </button>

      {enviar.isPending && <Trabalhando>Lendo o arquivo e separando o texto em trechos…</Trabalhando>}
      {documentos.isPending && <Carregando linhas={2} />}
      {documentos.isError && <Erro erro={documentos.error} />}
      {documentos.data?.length === 0 && !enviar.isPending && (
        <Vazio icone={<FileText className="size-6" />} titulo="Nenhum material ainda">
          Envie apostilas, resumos e slides. PDF escaneado (foto da página) ainda não dá para ler. O arquivo não
          fica guardado: só o texto, para a tutora consultar.
        </Vazio>
      )}

      {!!documentos.data?.length && (
        <>
          <ul className="flex flex-col gap-3">
            {documentos.data.map((d) => (
              <li key={d.id}>
                <Card className="flex-row items-center gap-4 px-5 py-4">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                    <FileText className="size-5" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate font-medium" title={d.nome}>{d.nome}</span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{ROTULO[d.tipo]}</Badge>
                      {d.paginas && <span>{d.paginas} {d.tipo === 'pptx' ? 'slides' : 'páginas'}</span>}
                      <span>{d.trechos} trechos</span>
                      {d.truncado && <span className="text-amber-700 dark:text-amber-400">só a primeira parte</span>}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Apagar ${d.nome}`}
                    title="Apagar material"
                    disabled={remover.isPending}
                    onClick={() => remover.mutate(d)}
                  >
                    <Trash2 />
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
          <Button variant="outline" className="w-fit" onClick={irParaConversa}>
            <MessageCircle /> Perguntar sobre os materiais
          </Button>
        </>
      )}
    </div>
  )
}
