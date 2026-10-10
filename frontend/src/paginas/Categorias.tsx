import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, FolderPlus, Library, RotateCcw } from '@/lib/icones'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Carregando, Erro, Vazio } from '@/components/Estados'
import { Dica } from '@/components/Tutorial'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { LIMITES } from '@/lib/seguranca'
import { useTitulo } from '@/lib/titulo'

const SUGESTOES = ['Português', 'SQL', 'Inglês', 'Python']

export function PaginaCategorias() {
  useTitulo('Seus estudos')
  const queryClient = useQueryClient()
  const categorias = useQuery({ queryKey: ['categorias'], queryFn: api.categorias })
  const revisoes = useQuery({ queryKey: ['revisoes'], queryFn: api.revisoesHoje })
  const [nome, setNome] = useState('')

  const criar = useMutation({
    mutationFn: (n: string) => api.criarCategoria(n),
    onSuccess: (categoria) => {
      toast.success(`Categoria “${categoria.nome}” criada.`)
      setNome('')
      queryClient.invalidateQueries({ queryKey: ['categorias'] })
    },
  })

  function aoCriar(e: FormEvent) {
    e.preventDefault()
    if (nome.trim()) criar.mutate(nome.trim())
  }

  const pendentes = revisoes.data?.length ?? 0

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Seus estudos</h1>
        <p className="text-muted-foreground">Cada categoria tem sua conversa com a IA, sua trilha e seus exercícios.</p>
      </div>

      <Dica id="categorias" titulo="Uma categoria para cada assunto">
        Crie, por exemplo, “Português” ou “SQL”. Dentro dela você conversa com a tutora, monta a trilha, pratica e acompanha o painel.
      </Dica>

      {pendentes > 0 && (
        <Link
          to="/revisoes"
          className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-accent/50 px-5 py-4 transition-colors hover:bg-accent"
        >
          <RotateCcw className="size-5 text-primary" />
          <span className="flex-1">
            Você tem <strong>{pendentes} {pendentes === 1 ? 'revisão' : 'revisões'}</strong> para hoje.
          </span>
          <ArrowRight className="size-4" />
        </Link>
      )}

      <form onSubmit={aoCriar} className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          maxLength={LIMITES.nomeCategoria}
          placeholder="Nova categoria (ex.: Português)"
          aria-label="Nome da nova categoria"
          className="h-10 sm:max-w-sm"
        />
        <Button type="submit" size="lg" disabled={!nome.trim() || criar.isPending}>
          <FolderPlus /> Criar categoria
        </Button>
      </form>
      {criar.isError && <p className="-mt-6 text-sm text-destructive">{criar.error.message}</p>}

      {categorias.isPending && <Carregando />}
      {categorias.isError && <Erro erro={categorias.error} />}
      {categorias.data?.length === 0 && (
        <Vazio icone={<Library className="size-6" />} titulo="Comece criando uma categoria">
          <p>Ela organiza um assunto que você quer estudar.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGESTOES.map((s) => (
              <Button key={s} variant="outline" size="sm" onClick={() => criar.mutate(s)} disabled={criar.isPending}>
                {s}
              </Button>
            ))}
          </div>
        </Vazio>
      )}

      {!!categorias.data?.length && (
        <div className="cascata grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categorias.data.map((c) => (
            <Link key={c.id} to={`/categorias/${c.id}`} className="group">
              <Card className="cartao-vivo h-full group-hover:border-primary/40 group-hover:bg-accent/20">
                <CardHeader>
                  <CardTitle className="font-heading text-xl">{c.nome}</CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    Abrir <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
