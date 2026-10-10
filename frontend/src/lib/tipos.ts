// Formatos devolvidos pela API Flask. Espelham os services do back-end.

export type Categoria = { id: string; nome: string; created_at: string }

export type Mensagem = {
  id: string
  categoria_id: string
  papel: 'user' | 'assistant'
  conteudo: string
  created_at: string
}

/** Material do aluno (PDF, Word, PowerPoint, texto). Só o texto fica guardado, nunca o arquivo. */
export type Documento = {
  id: string
  categoria_id: string
  nome: string
  tipo: 'pdf' | 'docx' | 'pptx' | 'txt' | 'md'
  paginas: number | null
  caracteres: number
  trechos: number
  truncado: boolean
  created_at: string
}

/** De onde veio um trecho que a tutora usou para responder. */
export type Fonte = { documento_id: string; nome: string; pagina: number | null }
/** O que o pedido do aluno precisa e só a plataforma faz (a tutora não cria trilha nem exercícios). */
export type AcaoChat = 'trilha' | 'praticar' | null

export type Verificacao = 'verificado' | 'nao_verificado'
export type TipoRecurso = 'link' | 'video' | 'playlist'

export type Recurso = {
  id?: string
  tipo: TipoRecurso
  titulo: string
  url: string
  trecho?: string | null
  canal?: string | null
  duracao_segundos?: number | null
  total_videos?: number | null
  verificacao?: Verificacao
}

export type Proposta = {
  id: string
  categoria_id: string
  status: 'pendente' | 'confirmada' | 'rejeitada'
  created_at: string
  payload: {
    titulo: string
    objetivo: string
    youtube_verificado?: boolean
    etapas: { titulo: string; descricao: string | null; recursos: Recurso[] }[]
  }
}

export type StatusEtapa = 'nao_iniciado' | 'em_andamento' | 'concluido'
export type Nivel = 'basico' | 'intermediario' | 'avancado'

export type Etapa = {
  id: string
  trilha_id: string
  ordem: number
  titulo: string
  descricao: string | null
  status: StatusEtapa
  ja_sabia: boolean
  recursos: Recurso[]
}

export type TrilhaResumo = { id: string; titulo: string; created_at: string }

export type Trilha = TrilhaResumo & {
  categoria_id: string
  progresso: { concluidas: number; total: number; pct: number }
  etapas: Etapa[]
}

export type Exercicio = {
  id: string
  etapa_id: string
  nivel: Nivel
  tipo: 'multipla_escolha' | 'discursiva'
  enunciado: string
  opcoes: string[] | null
}

export type Correcao = {
  correta: boolean
  feedback: string
  gabarito: string
  explicacao: string | null
  dominado: boolean
  revisao: { proxima_revisao: string; intervalo_dias: number } | null
  etapa: {
    status: StatusEtapa
    niveis_liberados: Nivel[]
    recomendacao: 'reforco' | 'pode_concluir' | null
    nivel_reforco: Nivel | null
  } | null
}

export type Revisao = Omit<Exercicio, 'id' | 'etapa_id'> & {
  exercicio_id: string
  proxima_revisao: string
  etapa_id: string
  etapa: string
  categoria_id: string
  categoria: string
}

export type Painel = {
  categoria: { id: string; nome: string }
  progresso: { total_etapas: number; etapas_concluidas: number; pct_concluido: number }
  acerto_por_nivel: { nivel: Nivel; total_respostas: number; taxa_acerto: number }[]
  pontos_fracos: { etapa_id: string; etapa: string; tentativas: number; taxa_acerto: number }[]
  revisoes_pendentes: number
  sequencia_dias: number
  estudou_hoje: boolean
  minutos_por_semana: { semana: string; minutos: number }[]
}

export type Flashcard = {
  id: string
  etapa_id: string
  frente: string
  verso: string
  proxima_revisao: string
  intervalo_dias: number
  acertos_seguidos: number
  dominado: boolean
}

export type FlashcardPendente = Omit<Flashcard, 'dominado'> & {
  etapa: string
  categoria_id: string
  categoria: string
}

export type ExercicioCorrigido = Exercicio & { gabarito?: string; explicacao?: string | null }

export type Simulado = {
  id: string
  categoria_id: string
  limite_segundos: number
  total: number
  acertos: number | null
  dentro_do_prazo: boolean | null
  iniciado_em: string
  finalizado_em: string | null
  prazo_em: string
  questoes?: { ordem: number; exercicio: ExercicioCorrigido; resposta?: string | null; correta?: boolean | null }[]
}

export type Meta = { dias_por_semana: number | null; minutos_por_semana: number | null }

export type DiaAtividade = {
  dia: string
  respostas: number
  flashcards: number
  minutos: number
  simulados: number
  total: number
}

export type Hoje = {
  hoje: string
  revisoes_pendentes: number
  flashcards_pendentes: number
  categorias: { id: string; nome: string; total_etapas: number; etapas_concluidas: number; pct_concluido: number }[]
  atividade: DiaAtividade[]
  sequencia_dias: number
  estudou_hoje: boolean
  semana: { inicio: string; dias_estudados: number; minutos: number }
  meta: Meta | null
}
