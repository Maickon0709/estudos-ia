import { Button } from '@/components/ui/button'
import { MessageCircle, Route } from '@/lib/icones'

// Os 3 passos para a trilha existir de verdade. Aparece onde a falta dela confunde (abas Trilha e Praticar):
// pedir "faça uma trilha" no chat não cria nada; quem cria é o botão "Montar trilha de estudo".
const PASSOS = [
  { titulo: 'Clique em "Montar trilha de estudo"', texto: 'O botão fica logo abaixo do chat, na aba Conversa.' },
  { titulo: 'Escreva o objetivo e escolha a fonte', texto: 'Ex.: "do básico ao avançado, para a prova". "Tudo junto" usa seus PDFs e slides e completa com vídeos e sites verificados; dá também para usar só um dos dois.' },
  { titulo: 'Revise e confirme a proposta', texto: 'Nada é salvo antes do seu ok. Confirmada, a trilha aparece aqui e libera os exercícios.' },
]

export function ComoCriarTrilha({ montarTrilha, irParaConversa }: { montarTrilha: () => void; irParaConversa: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 text-left">
      <ol className="grid w-full max-w-2xl gap-3 sm:grid-cols-3">
        {PASSOS.map(({ titulo, texto }, i) => (
          <li key={titulo} className="flex flex-col gap-2 rounded-2xl bg-card p-4 ring-1 ring-border">
            <span className="grid size-7 place-items-center rounded-full bg-accent font-mono text-xs font-semibold text-destaque">{i + 1}</span>
            <p className="text-sm font-medium">{titulo}</p>
            <p className="text-xs text-muted-foreground">{texto}</p>
          </li>
        ))}
      </ol>
      <p className="max-w-xl text-center text-xs text-muted-foreground">
        Pedir a trilha na conversa não cria nada: a tutora só conversa. Com a trilha montada pelos seus arquivos, os
        exercícios de cada etapa são gerados com o texto deles.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={montarTrilha}><Route /> Montar trilha agora</Button>
        <Button variant="outline" onClick={irParaConversa}><MessageCircle /> Ir para a conversa</Button>
      </div>
    </div>
  )
}
