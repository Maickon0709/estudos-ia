import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, MessageCircle, Trash2, Upload } from '@/lib/icones'
import { useRef, type ChangeEvent } from 'react'
import { toast } from 'sonner'
import { Carregando, Erro, Trabalhando, Vazio } from '@/components/Estados'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api } from '@/lib/api'
import type { Documento } from '@/lib/tipos'

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

  function aoEscolher(e: ChangeEvent<HTMLInputElement>) {
    const escolhido = e.target.files?.[0]
    e.target.value = '' // permite escolher o mesmo arquivo de novo
    if (!escolhido) return
    if (escolhido.size > MAX_BYTES) return void toast.error('O arquivo pode ter no máximo 4 MB.')
    enviar.mutate(escolhido)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="mr-auto max-w-xl text-sm text-muted-foreground">
          Envie apostilas, resumos e slides. Quando você perguntar no chat, a tutora procura os trechos certos
          nos seus materiais e diz de qual arquivo e página tirou a resposta.
        </p>
        <input ref={arquivo} type="file" accept={ACEITOS} className="hidden" onChange={aoEscolher} />
        <Button onClick={() => arquivo.current?.click()} disabled={enviar.isPending}>
          <Upload /> {enviar.isPending ? 'Lendo o arquivo…' : 'Enviar material'}
        </Button>
      </div>

      {enviar.isPending && <Trabalhando>Lendo o arquivo e separando o texto em trechos…</Trabalhando>}
      {documentos.isPending && <Carregando linhas={2} />}
      {documentos.isError && <Erro erro={documentos.error} />}
      {documentos.data?.length === 0 && !enviar.isPending && (
        <Vazio icone={<FileText className="size-6" />} titulo="Nenhum material ainda">
          PDF, Word (.docx), PowerPoint (.pptx), .txt ou .md, até 4 MB. PDF escaneado (foto da página) ainda não
          dá para ler. O arquivo não fica guardado: só o texto, para a tutora consultar.
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
