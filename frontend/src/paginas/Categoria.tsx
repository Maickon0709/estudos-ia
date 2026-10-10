import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChartColumn, Dumbbell, FileText, MessageCircle, Route, Trash2 } from '@/lib/icones'
import { Suspense, lazy, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Carregando, Erro } from '@/components/Estados'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { useTitulo } from '@/lib/titulo'
import { AbaConversa } from './categoria/AbaConversa'
import { AbaMateriais } from './categoria/AbaMateriais'
import { AbaPraticar } from './categoria/AbaPraticar'
import { AbaTrilha } from './categoria/AbaTrilha'

// O painel traz a biblioteca de gráficos (pesada): só carrega quando a aba é aberta.
const AbaPainel = lazy(() => import('./categoria/AbaPainel').then((m) => ({ default: m.AbaPainel })))

const ABAS = ['conversa', 'materiais', 'trilha', 'praticar', 'painel'] as const
type Aba = (typeof ABAS)[number]

export function PaginaCategoria() {
  const { categoriaId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const pedida = params.get('aba') === 'simulado' ? 'praticar' : params.get('aba') // link antigo
  const aba: Aba = ABAS.includes(pedida as Aba) ? (pedida as Aba) : 'conversa'
  const irPara = (nova: Aba) => setParams({ aba: nova }, { replace: true })

  const categoria = useQuery({ queryKey: ['categoria', categoriaId], queryFn: () => api.categoria(categoriaId) })
  useTitulo(categoria.data?.nome)

  if (categoria.isPending) return <Carregando linhas={2} />
  if (categoria.isError) return <Erro erro={categoria.error} />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link to="/categorias" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Categorias
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="mr-auto text-3xl font-semibold">{categoria.data.nome}</h1>
          <ExcluirCategoria id={categoriaId} nome={categoria.data.nome} />
        </div>
      </div>

      <Tabs value={aba} onValueChange={(v) => irPara(v as Aba)} className="gap-6">
        <TabsList>
          <TabsTrigger value="conversa" aria-label="Conversa"><MessageCircle /> <span className="hidden sm:inline">Conversa</span></TabsTrigger>
          <TabsTrigger value="materiais" aria-label="Materiais"><FileText /> <span className="hidden sm:inline">Materiais</span></TabsTrigger>
          <TabsTrigger value="trilha" aria-label="Trilha"><Route /> <span className="hidden sm:inline">Trilha</span></TabsTrigger>
          <TabsTrigger value="praticar" aria-label="Praticar"><Dumbbell /> <span className="hidden sm:inline">Praticar</span></TabsTrigger>
          <TabsTrigger value="painel" aria-label="Painel"><ChartColumn /> <span className="hidden sm:inline">Painel</span></TabsTrigger>
        </TabsList>
        <TabsContent value="conversa">
          <AbaConversa categoriaId={categoriaId} aoConfirmar={() => irPara('trilha')} />
        </TabsContent>
        <TabsContent value="materiais">
          <AbaMateriais categoriaId={categoriaId} irParaConversa={() => irPara('conversa')} />
        </TabsContent>
        <TabsContent value="trilha">
          <AbaTrilha categoriaId={categoriaId} irParaConversa={() => irPara('conversa')} />
        </TabsContent>
        <TabsContent value="praticar">
          <AbaPraticar categoriaId={categoriaId} irParaConversa={() => irPara('conversa')} />
        </TabsContent>
        <TabsContent value="painel">
          <Suspense fallback={<Carregando />}><AbaPainel categoriaId={categoriaId} /></Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ExcluirCategoria({ id, nome }: { id: string; nome: string }) {
  const [aberto, setAberto] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const excluir = useMutation({
    mutationFn: () => api.removerCategoria(id),
    onSuccess: () => {
      toast.success(`Categoria “${nome}” excluída.`)
      queryClient.invalidateQueries({ queryKey: ['categorias'] })
      queryClient.invalidateQueries({ queryKey: ['revisoes'] })
      navigate("/categorias")
    },
  })

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Excluir categoria" title="Excluir categoria">
          <Trash2 />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir “{nome}”?</DialogTitle>
          <DialogDescription>
            A conversa, as trilhas, os exercícios e o histórico desta categoria serão apagados. Não dá para desfazer.
          </DialogDescription>
        </DialogHeader>
        {excluir.isError && <p className="text-sm text-destructive">{excluir.error.message}</p>}
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
          <Button variant="destructive" onClick={() => excluir.mutate()} disabled={excluir.isPending}>
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
