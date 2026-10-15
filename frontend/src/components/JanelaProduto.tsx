import { Check } from '@/lib/icones'
import { cn } from '@/lib/utils'

// Tela de exemplo do hero da landing ("produto no centro", mockup A1). Dados fictícios, mas fiéis ao app:
// categorias, revisões do dia, trilha com etapas por nível e materiais conferidos. Link descartado não
// aparece aqui de propósito: na trilha real ele nunca chega ao aluno (a conferência aparece no bento "Fontes").
// No celular só a coluna da trilha aparece.

const CATEGORIAS = ['Python para dados', 'Inglês para entrevista', 'Crase e vírgula', 'Cinemática']

const ETAPAS = [
  { titulo: 'Variáveis, tipos e print', nivel: 'Básico', estado: 'feita' },
  { titulo: 'Listas, dicionários e laços', nivel: 'Básico', estado: 'feita' },
  { titulo: 'Funções e arquivos CSV', nivel: 'Intermediário', estado: 'feita' },
  { titulo: 'Primeiros passos com pandas', nivel: 'Você está aqui', estado: 'atual' },
  { titulo: 'Limpeza e agrupamento', nivel: 'Avançado', estado: 'futura' },
  { titulo: 'Gráficos e primeira análise', nivel: 'Avançado', estado: 'futura' },
] as const

const MATERIAIS = [
  { selo: 'Vídeo conferido', titulo: 'Pandas para iniciantes, aula 1', site: 'youtube.com' },
  { selo: 'Site conferido', titulo: '10 minutes to pandas', site: 'pandas.pydata.org' },
]

export function JanelaProduto() {
  return (
    <figure className="w-full overflow-hidden rounded-[20px] bg-card text-left shadow-[0_0_0_1px_var(--border),0_30px_80px_-30px_rgb(0_0_0/0.3)]">
      <figcaption className="sr-only">Exemplo da tela de uma trilha de estudo, com dados fictícios</figcaption>
      <div aria-hidden className="flex h-10 items-center gap-1.5 border-b px-4">
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="ml-4 font-mono text-xs text-muted-foreground">estudos-ia / Python para dados</span>
      </div>

      <div className="grid min-h-[440px] lg:grid-cols-[220px_1fr_300px]">
        {/* esquerda: categorias e o dia */}
        <div className="hidden flex-col gap-1 border-r bg-muted p-5 text-sm lg:flex">
          <span className="mb-1.5 text-xs text-muted-foreground">Categorias</span>
          {CATEGORIAS.map((c, i) => (
            <span key={c} className={cn('rounded-lg px-2.5 py-2', i === 0 ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground')}>{c}</span>
          ))}
          <span className="mt-4 mb-1.5 text-xs text-muted-foreground">Hoje</span>
          <span className="flex justify-between px-2.5 py-2">Revisões <b className="font-mono font-medium text-destaque">4</b></span>
          <span className="flex justify-between px-2.5 py-2">Sequência <b className="font-mono font-medium">12 dias</b></span>
        </div>

        {/* centro: a trilha */}
        <div className="flex flex-col gap-4 p-5 sm:p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="text-[21px]">Trilha · do print ao pandas</h3>
            <span className="font-mono text-[13px] text-muted-foreground">3 de 6 etapas</span>
          </div>
          <div className="h-1.5 rounded-full bg-border"><div className="h-full w-1/2 rounded-full bg-destaque" /></div>
          <ol className="mt-2 flex flex-col gap-0.5">
            {ETAPAS.map(({ titulo, nivel, estado }) => (
              <li
                key={titulo}
                className={cn('flex items-center gap-3 rounded-[10px] p-3', estado === 'atual' && 'bg-accent', estado === 'futura' && 'text-muted-foreground')}
              >
                {estado === 'feita' && (
                  <span className="grid size-6 shrink-0 place-items-center rounded-[7px] bg-foreground text-background">
                    <Check className="size-3.5" weight="bold" aria-label="Concluída" />
                  </span>
                )}
                {estado === 'atual' && (
                  <span className="grid size-6 shrink-0 place-items-center rounded-[7px] ring-2 ring-destaque ring-inset">
                    <span className="size-2 rounded-[2px] bg-destaque" />
                  </span>
                )}
                {estado === 'futura' && <span className="size-6 shrink-0 rounded-[7px] ring-1 ring-border ring-inset" />}
                <span className={cn('flex-1', estado === 'atual' && 'font-medium')}>{titulo}</span>
                <span className={cn('text-xs', estado === 'atual' ? 'font-medium text-accent-foreground' : 'text-muted-foreground')}>{nivel}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* direita: materiais da etapa, conferidos antes de aparecer */}
        <div className="hidden flex-col gap-3 border-l bg-muted p-5 lg:flex">
          <span className="text-xs text-muted-foreground">Materiais da etapa</span>
          {MATERIAIS.map(({ selo, titulo, site }) => (
            <div key={titulo} className="flex flex-col gap-1.5 rounded-xl bg-card p-3 ring-1 ring-border">
              <span className="text-xs text-sucesso">{selo}</span>
              <span className="text-sm font-medium">{titulo}</span>
              <span className="font-mono text-xs text-muted-foreground">{site}</span>
            </div>
          ))}
          <div className="flex flex-col gap-1.5 rounded-xl p-3 ring-1 ring-border">
            <span className="text-xs text-accent-foreground">Praticar</span>
            <span className="text-sm font-medium">10 exercícios · Básico</span>
            <span className="text-xs text-muted-foreground">Intermediário: 20 questões com 80% de acerto</span>
          </div>
        </div>
      </div>
    </figure>
  )
}
