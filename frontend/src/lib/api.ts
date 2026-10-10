// Único lugar do front que fala com a API (mesma ideia dos repositories no back-end).
import { definirLogado, estaLogado } from './sessao'
import type {
  Categoria, Correcao, Exercicio, Flashcard, FlashcardPendente, Hoje, Mensagem, Meta, Nivel, Painel,
  Proposta, Revisao, Simulado, StatusEtapa, Trilha, TrilhaResumo,
} from './tipos'

export type Conta = {
  email: string | null
  nome: string | null
  criada_em: string | null
  termos_versao: string | null
  termos_aceitos_em: string | null
  avatar_atualizado_em: string | null
}

const BASE = import.meta.env.VITE_API_URL ?? '/api'
const CABECALHO_CSRF = 'X-Requested-With'
const VALOR_CSRF = 'estudos-ia'
const CHAVE_EXPIROU = 'estudos-ia:sessao-expirou'

/** Erro vindo da API, no formato {erro, mensagem} que o back-end padroniza. */
export class ErroApi extends Error {
  readonly status: number
  readonly codigo: string
  constructor(status: number, codigo: string, mensagem: string) {
    super(mensagem)
    this.status = status
    this.codigo = codigo
  }
}

// ---------- sessão ----------
// O token mora em cookies HttpOnly que o JavaScript NÃO consegue ler (o back-end grava).
// Aqui só sabemos SE há sessão, nunca o token em si.

/** Aviso de que a sessão venceu, para a tela de login explicar o motivo. */
export function sessaoExpirou(): boolean {
  try {
    return sessionStorage.getItem(CHAVE_EXPIROU) === '1'
  } catch {
    return false
  }
}

export function limparAvisoExpirou() {
  try { sessionStorage.removeItem(CHAVE_EXPIROU) } catch { /* sem sessionStorage */ }
}

function sessaoAcabou() {
  if (estaLogado()) {
    try { sessionStorage.setItem(CHAVE_EXPIROU, '1') } catch { /* sem sessionStorage */ }
  }
  definirLogado(false)
}

// Várias chamadas podem tomar 401 juntas: todas esperam UMA renovação.
let renovando: Promise<boolean> | null = null
function renovarSessao(): Promise<boolean> {
  renovando ??= fetch(BASE + '/auth/renovar', { method: 'POST', headers: { [CABECALHO_CSRF]: VALOR_CSRF } })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => { setTimeout(() => { renovando = null }, 0) })
  return renovando
}

// ---------- transporte ----------
async function enviar(metodo: string, caminho: string, corpo?: unknown, tentouRenovar = false): Promise<Response> {
  // Cabeçalho anti-CSRF: outro site não consegue enviá-lo, então o back-end recusa escritas sem ele.
  const cabecalhos: Record<string, string> = { [CABECALHO_CSRF]: VALOR_CSRF }
  const arquivo = corpo instanceof FormData // o navegador monta o multipart sozinho
  if (corpo !== undefined && !arquivo) cabecalhos['Content-Type'] = 'application/json'

  let resposta: Response
  try {
    resposta = await fetch(BASE + caminho, {
      method: metodo,
      headers: cabecalhos,
      credentials: 'same-origin', // envia os cookies da sessão
      body: corpo === undefined ? undefined : arquivo ? corpo : JSON.stringify(corpo),
    })
  } catch {
    throw new ErroApi(0, 'sem_conexao', 'Não consegui falar com o servidor. A API está rodando?')
  }

  // Token de acesso venceu (dura ~1 h): renova pelo cookie de renovação e repete a chamada.
  if (resposta.status === 401 && !caminho.startsWith('/auth/') && !tentouRenovar) {
    if (await renovarSessao()) return enviar(metodo, caminho, corpo, true)
    sessaoAcabou()
  }

  if (!resposta.ok) {
    const dados = await resposta.json().catch(() => null)
    throw new ErroApi(
      resposta.status,
      dados?.erro ?? 'erro',
      dados?.mensagem ?? 'Algo deu errado. Tente novamente.',
    )
  }
  return resposta
}

async function pedir<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const resposta = await enviar(metodo, caminho, corpo)
  if (resposta.status === 204) return undefined as T
  return (await resposta.json().catch(() => null)) as T
}

type EventoChat =
  | { tipo: 'delta'; texto: string }
  | { tipo: 'fim'; pergunta: Mensagem; resposta: Mensagem }
  | { tipo: 'erro'; erro: string; mensagem: string }

/**
 * Chat com o texto chegando aos pedaços (Server-Sent Events).
 * `aoEscrever` recebe cada pedaço; a promessa resolve com as mensagens já gravadas.
 */
async function conversarAoVivo(
  categoriaId: string,
  mensagem: string,
  aoEscrever: (pedaco: string) => void,
): Promise<{ pergunta: Mensagem; resposta: Mensagem }> {
  const resposta = await enviar('POST', `/categorias/${categoriaId}/chat/stream`, { mensagem })
  if (!resposta.body) throw new ErroApi(0, 'sem_stream', 'Seu navegador não recebeu a resposta ao vivo.')

  const leitor = resposta.body.getReader()
  const decodificador = new TextDecoder()
  let pendente = ''
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    pendente += decodificador.decode(value, { stream: true })
    const blocos = pendente.split('\n\n')
    pendente = blocos.pop() ?? ''
    for (const bloco of blocos) {
      if (!bloco.startsWith('data: ')) continue
      const evento = JSON.parse(bloco.slice(6)) as EventoChat
      if (evento.tipo === 'delta') aoEscrever(evento.texto)
      else if (evento.tipo === 'fim') return { pergunta: evento.pergunta, resposta: evento.resposta }
      else throw new ErroApi(502, evento.erro, evento.mensagem)
    }
  }
  throw new ErroApi(502, 'stream_incompleto', 'A resposta foi interrompida. Tente novamente.')
}

// ---------- endpoints ----------
export const api = {
  cadastrar: (nome: string, email: string, senha: string, aceiteTermos: boolean) =>
    pedir<{ logado: true } | { mensagem: string }>('POST', '/auth/cadastro', { nome, email, senha, aceite_termos: aceiteTermos }),
  entrar: (email: string, senha: string) => pedir<{ logado: true }>('POST', '/auth/login', { email, senha }),
  sair: async () => {
    await pedir('POST', '/auth/sair').catch(() => undefined) // mesmo offline, a tela sai
    definirLogado(false)
  },
  /** Confere com o servidor se o cookie de sessão ainda vale (renova se preciso). */
  verificarSessao: async () => {
    try {
      await pedir('GET', '/auth/sessao')
      definirLogado(true)
    } catch (erro) {
      if (!(erro instanceof ErroApi) || erro.status !== 401) return // sem rede: mantém o que sabia
      // Voltou depois de 1 h: o acesso venceu, mas o cookie de renovação (30 dias) pode valer.
      definirLogado(await renovarSessao())
    }
  },

  categorias: () => pedir<Categoria[]>('GET', '/categorias'),
  categoria: (id: string) => pedir<Categoria>('GET', `/categorias/${id}`),
  criarCategoria: (nome: string) => pedir<Categoria>('POST', '/categorias', { nome }),
  renomearCategoria: (id: string, nome: string) => pedir<Categoria>('PATCH', `/categorias/${id}`, { nome }),
  removerCategoria: (id: string) => pedir<void>('DELETE', `/categorias/${id}`),

  mensagens: (categoriaId: string) => pedir<Mensagem[]>('GET', `/categorias/${categoriaId}/mensagens`),
  enviarMensagem: (categoriaId: string, mensagem: string) =>
    pedir<{ pergunta: Mensagem; resposta: Mensagem }>('POST', `/categorias/${categoriaId}/chat`, { mensagem }),

  propostasPendentes: (categoriaId: string) =>
    pedir<Proposta[]>('GET', `/categorias/${categoriaId}/propostas?status=pendente`),
  gerarProposta: (categoriaId: string, objetivo: string) =>
    pedir<Proposta>('POST', `/categorias/${categoriaId}/propostas`, { objetivo }),
  confirmarProposta: (id: string) =>
    pedir<{ trilha_id: string; proposta: Proposta }>('POST', `/propostas/${id}/confirmar`),
  rejeitarProposta: (id: string) => pedir<Proposta>('POST', `/propostas/${id}/rejeitar`),

  trilhas: (categoriaId: string) => pedir<TrilhaResumo[]>('GET', `/categorias/${categoriaId}/trilhas`),
  trilha: (id: string) => pedir<Trilha>('GET', `/trilhas/${id}`),
  atualizarEtapa: (id: string, campos: { status?: StatusEtapa; ja_sabia?: boolean }) =>
    pedir<{ niveis_liberados: Nivel[] }>('PATCH', `/etapas/${id}`, campos),

  exercicios: (etapaId: string, nivel: Nivel) =>
    pedir<Exercicio[]>('GET', `/etapas/${etapaId}/exercicios?nivel=${nivel}`),
  gerarExercicios: (etapaId: string, nivel: Nivel, quantidade = 3) =>
    pedir<Exercicio[]>('POST', `/etapas/${etapaId}/exercicios`, { nivel, quantidade }),
  responder: (exercicioId: string, resposta: string) =>
    pedir<Correcao>('POST', `/exercicios/${exercicioId}/responder`, { resposta }),

  painel: (categoriaId: string) => pedir<Painel>('GET', `/categorias/${categoriaId}/painel`),
  revisoesHoje: () => pedir<Revisao[]>('GET', '/revisoes/hoje'),

  conversarAoVivo,
  explicar: (exercicioId: string) => pedir<{ explicacao: string }>('POST', `/exercicios/${exercicioId}/explicar`),

  flashcards: (etapaId: string) => pedir<Flashcard[]>('GET', `/etapas/${etapaId}/flashcards`),
  gerarFlashcards: (etapaId: string, quantidade = 6) =>
    pedir<Flashcard[]>('POST', `/etapas/${etapaId}/flashcards`, { quantidade }),
  flashcardsHoje: () => pedir<FlashcardPendente[]>('GET', '/flashcards/hoje'),
  revisarFlashcard: (id: string, lembrei: boolean) =>
    pedir<Flashcard>('POST', `/flashcards/${id}/revisar`, { lembrei }),

  simulados: (categoriaId: string) => pedir<Simulado[]>('GET', `/categorias/${categoriaId}/simulados`),
  criarSimulado: (categoriaId: string, quantidade: number, minutos: number) =>
    pedir<Simulado>('POST', `/categorias/${categoriaId}/simulados`, { quantidade, minutos }),
  simulado: (id: string) => pedir<Simulado>('GET', `/simulados/${id}`),
  finalizarSimulado: (id: string, respostas: Record<number, string>) =>
    pedir<Simulado>('POST', `/simulados/${id}/finalizar`, { respostas }),

  registrarSessao: (sessao: { categoria_id: string | null; tipo: 'foco' | 'livre'; duracao_segundos: number; iniciada_em: string }) =>
    pedir<unknown>('POST', '/sessoes-estudo', sessao),
  meta: () => pedir<Meta>('GET', '/metas'),
  salvarMeta: (meta: { dias_por_semana: number; minutos_por_semana: number | null }) =>
    pedir<Meta>('PUT', '/metas', meta),
  hoje: () => pedir<Hoje>('GET', '/hoje'),

  conta: () => pedir<Conta>('GET', '/conta'),
  renomear: (nome: string) => pedir<Conta>('PATCH', '/conta', { nome }),
  enviarAvatar: (foto: File) => {
    const formulario = new FormData()
    formulario.append('foto', foto)
    return pedir<Conta>('PUT', '/conta/avatar', formulario)
  },
  removerAvatar: () => pedir<void>('DELETE', '/conta/avatar'),
  /** Bucket privado: a foto passa pela API, que confere o cookie da sessão. `v` evita cache velho. */
  urlAvatar: (versao: string) => `${BASE}/conta/avatar?v=${encodeURIComponent(versao)}`,
  baixarMeusDados,
  excluirConta: (senha: string, confirmacao: string) => pedir<void>('DELETE', '/conta', { senha, confirmacao }),
}

/** Baixa o arquivo JSON com todos os dados do usuário (direito de acesso da LGPD). */
async function baixarMeusDados() {
  const resposta = await enviar('GET', '/conta/dados')
  const url = URL.createObjectURL(await resposta.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = 'meus-dados-estudos-ia.json'
  link.click()
  URL.revokeObjectURL(url)
}
