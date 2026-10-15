import { useState } from 'react'
import { Check } from '@/lib/icones'
import { cn } from '@/lib/utils'

// Tela de exemplo do hero da landing ("produto no centro", mockup A1), interativa: trocar de categoria
// mostra outra trilha e clicar numa etapa mostra os materiais dela. Dados fictícios, mas fiéis ao app.
// Link descartado não aparece aqui de propósito: na trilha real ele nunca chega ao aluno
// (a conferência aparece no bento "Fontes"). No celular as categorias viram botões acima da trilha.

type Estado = 'feita' | 'atual' | 'futura'
type Etapa = { titulo: string; nivel: 'Básico' | 'Intermediário' | 'Avançado'; estado: Estado }
type Categoria = { nome: string; trilha: string; site: string; etapas: Etapa[] }

const CATEGORIAS: Categoria[] = [
  {
    nome: 'Python para dados',
    trilha: 'do print ao pandas',
    site: 'pandas.pydata.org',
    etapas: [
      { titulo: 'Variáveis, tipos e print', nivel: 'Básico', estado: 'feita' },
      { titulo: 'Listas, dicionários e laços', nivel: 'Básico', estado: 'feita' },
      { titulo: 'Funções e arquivos CSV', nivel: 'Intermediário', estado: 'feita' },
      { titulo: 'Primeiros passos com pandas', nivel: 'Intermediário', estado: 'atual' },
      { titulo: 'Limpeza e agrupamento', nivel: 'Avançado', estado: 'futura' },
      { titulo: 'Gráficos e primeira análise', nivel: 'Avançado', estado: 'futura' },
    ],
  },
  {
    nome: 'Inglês para entrevista',
    trilha: 'da apresentação à negociação',
    site: 'dictionary.cambridge.org',
    etapas: [
      { titulo: 'Apresentação pessoal', nivel: 'Básico', estado: 'feita' },
      { titulo: 'Falar da sua experiência', nivel: 'Básico', estado: 'feita' },
      { titulo: 'Perguntas comportamentais', nivel: 'Intermediário', estado: 'atual' },
      { titulo: 'Vocabulário da sua área', nivel: 'Intermediário', estado: 'futura' },
      { titulo: 'Salário e perguntas finais', nivel: 'Avançado', estado: 'futura' },
    ],
  },
  {
    nome: 'Crase e vírgula',
    trilha: 'pontuação sem medo',
    site: 'pt.khanacademy.org',
    etapas: [
      { titulo: 'O que é a crase', nivel: 'Básico', estado: 'feita' },
      { titulo: 'Quando a crase é obrigatória', nivel: 'Básico', estado: 'atual' },
      { titulo: 'Casos em que é proibida', nivel: 'Intermediário', estado: 'futura' },
      { titulo: 'Vírgula entre termos', nivel: 'Intermediário', estado: 'futura' },
      { titulo: 'Vírgula entre orações', nivel: 'Avançado', estado: 'futura' },
    ],
  },
  {
    nome: 'Cinemática',
    trilha: 'do MU ao lançamento',
    site: 'pt.khanacademy.org',
    etapas: [
      { titulo: 'Grandezas e unidades', nivel: 'Básico', estado: 'feita' },
      { titulo: 'Movimento uniforme', nivel: 'Básico', estado: 'feita' },
      { titulo: 'Movimento variado', nivel: 'Intermediário', estado: 'feita' },
      { titulo: 'Queda livre', nivel: 'Intermediário', estado: 'feita' },
      { titulo: 'Lançamento oblíquo', nivel: 'Avançado', estado: 'atual' },
      { titulo: 'Leitura de gráficos', nivel: 'Avançado', estado: 'futura' },
    ],
  },
]

const indiceAtual = (c: Categoria) => Math.max(0, c.etapas.findIndex((e) => e.estado === 'atual'))

export function JanelaProduto() {
  const [cat, setCat] = useState(0)
  const categoria = CATEGORIAS[cat]
  const [sel, setSel] = useState(() => indiceAtual(CATEGORIAS[0]))
  const etapa = categoria.etapas[sel]
  const feitas = categoria.etapas.filter((e) => e.estado === 'feita').length
  const total = categoria.etapas.length

  function trocarCategoria(i: number) {
    setCat(i)
    setSel(indiceAtual(CATEGORIAS[i]))
  }

  return (
    <figure className="w-full overflow-hidden rounded-[20px] bg-card text-left shadow-[0_0_0_1px_var(--border),0_30px_80px_-30px_rgb(0_0_0/0.3)]">
      <figcaption className="sr-only">Exemplo interativo da tela de uma trilha de estudo, com dados fictícios</figcaption>
      <div aria-hidden className="flex h-10 items-center gap-1.5 border-b px-4">
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="ml-4 truncate font-mono text-xs text-muted-foreground">estudos-ia / {categoria.nome}</span>
      </div>

      <div className="grid min-h-[440px] lg:grid-cols-[220px_1fr_300px]">
        {/* esquerda: categorias e o dia */}
        <div className="hidden flex-col gap-1 border-r bg-muted p-5 text-sm lg:flex">
          <span className="mb-1.5 text-xs text-muted-foreground">Categorias</span>
          {CATEGORIAS.map((c, i) => (
            <button
              key={c.nome}
              type="button"
              aria-pressed={i === cat}
              onClick={() => trocarCategoria(i)}
              className={cn(
                'rounded-lg px-2.5 py-2 text-left transition-colors',
                i === cat ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:bg-card hover:text-foreground',
              )}
            >
              {c.nome}
            </button>
          ))}
          <span className="mt-4 mb-1.5 text-xs text-muted-foreground">Hoje</span>
          <span className="flex justify-between px-2.5 py-2">Revisões <b className="font-mono font-medium text-destaque">4</b></span>
          <span className="flex justify-between px-2.5 py-2">Sequência <b className="font-mono font-medium">12 dias</b></span>
        </div>

        {/* centro: a trilha */}
        <div className="flex min-w-0 flex-col gap-4 p-5 sm:p-7">
          {/* no celular a coluna de categorias some: viram botões aqui */}
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
            {CATEGORIAS.map((c, i) => (
              <button
                key={c.nome}
                type="button"
                aria-pressed={i === cat}
                onClick={() => trocarCategoria(i)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1.5 text-xs ring-1 transition-colors',
                  i === cat ? 'bg-accent font-medium text-accent-foreground ring-transparent' : 'text-muted-foreground ring-border',
                )}
              >
                {c.nome}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="text-[21px]">Trilha · {categoria.trilha}</h3>
            <span className="font-mono text-[13px] text-muted-foreground">{feitas} de {total} etapas</span>
          </div>
          <div className="h-1.5 rounded-full bg-border">
            <div className="h-full rounded-full bg-destaque transition-[width] duration-500" style={{ width: `${(feitas / total) * 100}%` }} />
          </div>
          <ol className="mt-2 flex flex-col gap-0.5">
            {categoria.etapas.map(({ titulo, nivel, estado }, i) => (
              <li key={titulo}>
                <button
                  type="button"
                  aria-pressed={i === sel}
                  onClick={() => setSel(i)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-[10px] p-3 text-left transition-colors',
                    i === sel ? 'bg-accent' : 'hover:bg-muted',
                    estado === 'futura' && i !== sel && 'text-muted-foreground',
                  )}
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
                  <span className={cn('flex-1', i === sel && 'font-medium')}>{titulo}</span>
                  <span className={cn('text-xs', estado === 'atual' ? 'font-medium text-accent-foreground' : 'text-muted-foreground')}>
                    {estado === 'atual' ? 'Você está aqui' : nivel}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        {/* direita: materiais da etapa escolhida, conferidos antes de aparecer */}
        <div className="flex flex-col gap-3 border-t bg-muted p-5 lg:border-t-0 lg:border-l" aria-live="polite">
          <span className="text-xs text-muted-foreground">Materiais · {etapa.titulo}</span>
          <div className="flex flex-col gap-1.5 rounded-xl bg-card p-3 ring-1 ring-border">
            <span className="text-xs text-sucesso">Vídeo conferido</span>
            <span className="text-sm font-medium">Aula: {etapa.titulo.toLowerCase()}</span>
            <span className="font-mono text-xs text-muted-foreground">youtube.com</span>
          </div>
          <div className="flex flex-col gap-1.5 rounded-xl bg-card p-3 ring-1 ring-border">
            <span className="text-xs text-sucesso">Site conferido</span>
            <span className="text-sm font-medium">{etapa.titulo}</span>
            <span className="font-mono text-xs text-muted-foreground">{categoria.site}</span>
          </div>
          <div className="flex flex-col gap-1.5 rounded-xl p-3 ring-1 ring-border">
            <span className="text-xs text-accent-foreground">Praticar</span>
            {etapa.estado === 'feita' ? (
              <>
                <span className="text-sm font-medium">Etapa concluída</span>
                <span className="text-xs text-muted-foreground">Os exercícios voltam nas revisões</span>
              </>
            ) : (
              <>
                <span className="text-sm font-medium">10 exercícios · {etapa.nivel}</span>
                <span className="text-xs text-muted-foreground">O próximo nível libera com 20 questões e 80% de acerto</span>
              </>
            )}
          </div>
        </div>
      </div>
    </figure>
  )
}
