// Dados de EXEMPLO para a vitrine da landing (componentes reais, conteúdo ilustrativo).
// Os links são materiais reais que a pesquisa do próprio sistema encontrou e verificou.
import type { DiaAtividade, Etapa, Recurso } from './tipos'

export const RECURSOS_EXEMPLO: Recurso[] = [
  {
    tipo: 'link',
    titulo: 'Crase: quando usar (com exemplos)',
    url: 'https://www.todamateria.com.br/crase',
    verificacao: 'verificado',
  },
  {
    tipo: 'video',
    titulo: 'Crase - Aula 01 ♫ Concerto da Crase ♫',
    url: 'https://www.youtube.com/watch?v=yUpRa62vcSI',
    canal: 'Professor Noslen',
    duracao_segundos: 900,
    verificacao: 'verificado',
  },
  {
    tipo: 'link',
    titulo: 'Crase: Manual de Comunicação do Senado',
    url: 'https://www12.senado.leg.br/manualdecomunicacao/estilos/crase',
    verificacao: 'verificado',
  },
]

export const ETAPAS_EXEMPLO: Pick<Etapa, 'id' | 'ordem' | 'titulo' | 'status'>[] = [
  { id: 'e1', ordem: 1, titulo: 'O que é crase', status: 'concluido' },
  { id: 'e2', ordem: 2, titulo: 'Regras obrigatórias', status: 'em_andamento' },
  { id: 'e3', ordem: 3, titulo: 'Casos especiais', status: 'nao_iniciado' },
  { id: 'e4', ordem: 4, titulo: 'Crase em concursos', status: 'nao_iniciado' },
]

/** Atividade fictícia, mas com cara de uso real: dias soltos no início, mais constância depois. */
export function atividadeExemplo(hoje: string): DiaAtividade[] {
  const fim = new Date(`${hoje}T12:00:00Z`)
  const dias: DiaAtividade[] = []
  for (let i = 0; i < 140; i++) {
    const d = new Date(fim)
    d.setUTCDate(fim.getUTCDate() - i)
    const semente = (i * 37 + 11) % 23
    const constancia = i < 30 ? 0.75 : i < 80 ? 0.45 : 0.2 // estuda mais nas últimas semanas
    if (semente / 23 > constancia) continue
    const total = 1 + ((i * 7) % 9)
    dias.push({ dia: d.toISOString().slice(0, 10), respostas: total, flashcards: 0, minutos: 0, simulados: 0, total })
  }
  return dias
}
