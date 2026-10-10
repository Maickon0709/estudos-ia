import { useMutation, useQuery } from '@tanstack/react-query'
import { ChartColumn, Download, GraduationCap, LogOut, ShieldCheck, Trash2, UserRound } from '@/lib/icones'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { EditarPerfil } from '@/components/EditarPerfil'
import { reverTutorial } from '@/components/Tutorial'
import { Carregando, Erro } from '@/components/Estados'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { api, type UsoDiario } from '@/lib/api'
import { definirLogado } from '@/lib/sessao'
import { useTitulo } from '@/lib/titulo'

function data(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Não informado'
}

export function PaginaConta() {
  useTitulo('Sua conta')
  const conta = useQuery({ queryKey: ['conta'], queryFn: api.conta })
  const baixar = useMutation({
    mutationFn: api.baixarMeusDados,
    onSuccess: () => toast.success('Arquivo com seus dados baixado.'),
  })

  if (conta.isPending) return <Carregando linhas={3} />
  if (conta.isError) return <Erro erro={conta.error} />
  const c = conta.data

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="mr-auto text-3xl font-semibold">Sua conta</h1>
        <Button variant="ghost" onClick={() => { reverTutorial(); toast.success('Tutorial reiniciado: as dicas voltam a aparecer.') }}>
          <GraduationCap /> Rever tutorial
        </Button>
        <Button variant="outline" onClick={() => void api.sair()}><LogOut /> Sair</Button>
      </div>

      <Card>
        <CardContent className="pt-2">
          <EditarPerfil conta={c} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-xl"><UserRound className="size-5 text-primary" /> Dados</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted-foreground">Conta criada em</dt><dd>{data(c.criada_em)}</dd>
            <dt className="text-muted-foreground">Termos aceitos</dt>
            <dd>
              {c.termos_aceitos_em ? `${data(c.termos_aceitos_em)} (versão ${c.termos_versao})` : 'Conta criada antes do registro de aceite'}
              {' · '}<Link to="/termos" className="text-primary underline underline-offset-2">Termos</Link>
              {' · '}<Link to="/privacidade" className="text-primary underline underline-offset-2">Privacidade</Link>
            </dd>
          </dl>
        </CardContent>
      </Card>

      <UsoDeHoje />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-xl"><ShieldCheck className="size-5 text-primary" /> Seus dados</CardTitle>
          <CardDescription>
            Baixe um arquivo com tudo o que está guardado na sua conta: categorias, conversas, trilhas, exercícios,
            respostas, flashcards, simulados e tempo de estudo (direito de acesso da LGPD).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => baixar.mutate()} disabled={baixar.isPending}>
            <Download /> {baixar.isPending ? 'Preparando…' : 'Baixar meus dados (.json)'}
          </Button>
          {baixar.isError && <p className="mt-2 text-sm text-destructive">{baixar.error.message}</p>}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-xl text-destructive"><Trash2 className="size-5" /> Excluir conta</CardTitle>
          <CardDescription>
            Apaga sua conta e <strong>todos</strong> os seus dados do banco, na hora. Não dá para desfazer.
            Se quiser guardar uma cópia, baixe seus dados antes.
          </CardDescription>
        </CardHeader>
        <CardContent><ExcluirConta /></CardContent>
      </Card>
    </div>
  )
}

const ROTULOS_USO: Record<keyof UsoDiario, string> = {
  chat: 'Mensagens para a tutora',
  ia: 'Exercícios, flashcards e correções com IA',
  pesquisa: 'Pesquisas de materiais e trilhas',
}

/** Quanto da cota diária já foi usado. Some em silêncio se a API não responder. */
function UsoDeHoje() {
  const uso = useQuery({ queryKey: ['uso'], queryFn: api.uso })
  if (!uso.data) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-xl"><ChartColumn className="size-5 text-primary" /> Uso de hoje</CardTitle>
        <CardDescription>
          A IA e a busca têm uma cota gratuita dividida entre todos. Cada pessoa tem um limite por dia,
          que volta a zero à meia-noite (horário de Brasília).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-4">
          {(Object.keys(ROTULOS_USO) as (keyof UsoDiario)[]).map((tipo) => {
            const { usado, limite } = uso.data[tipo]
            return (
              <li key={tipo} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{ROTULOS_USO[tipo]}</span>
                  <span className={'font-mono tabular-nums ' + (usado >= limite ? 'text-destructive' : 'text-muted-foreground')}>
                    {usado} de {limite}
                  </span>
                </div>
                <Progress value={Math.min(100, (usado / limite) * 100)} aria-label={`${ROTULOS_USO[tipo]}: ${usado} de ${limite}`} />
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

function ExcluirConta() {
  const [aberto, setAberto] = useState(false)
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const excluir = useMutation({
    mutationFn: () => api.excluirConta(senha, confirmacao),
    onSuccess: () => {
      toast.success('Sua conta e todos os seus dados foram excluídos.')
      definirLogado(false) // o back-end já apagou a conta; os cookies vencem sozinhos
    },
  })
  const pronto = senha.length > 0 && confirmacao === 'EXCLUIR'

  return (
    <Dialog open={aberto} onOpenChange={(v) => { setAberto(v); if (!v) { setSenha(''); setConfirmacao(''); excluir.reset() } }}>
      <DialogTrigger asChild><Button variant="destructive"><Trash2 /> Excluir minha conta</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir conta de vez?</DialogTitle>
          <DialogDescription>
            Todas as suas categorias, conversas, trilhas, exercícios, flashcards, simulados e histórico serão apagados.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (pronto) excluir.mutate() }}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="senha-exclusao">Sua senha</Label>
            <Input id="senha-exclusao" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirma-exclusao">Digite <strong>EXCLUIR</strong> para confirmar</Label>
            <Input id="confirma-exclusao" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="off" />
          </div>
          {excluir.isError && <p className="text-sm text-destructive" role="alert">{excluir.error.message}</p>}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
            <Button type="submit" variant="destructive" disabled={!pronto || excluir.isPending}>
              {excluir.isPending ? 'Excluindo…' : 'Excluir tudo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
