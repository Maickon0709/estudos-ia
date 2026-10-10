import { useMutation } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { BookOpenText, Lock } from '@/lib/icones'
import { definirLogado } from '@/lib/sessao'
import { useTitulo } from '@/lib/titulo'

/** Código de uso único que veio no link do e-mail (?token_hash=...). */
function lerCodigoDoLink(): string | null {
  return new URLSearchParams(window.location.search).get('token_hash')
}

export function PaginaRedefinirSenha() {
  useTitulo('Criar senha nova', 'Escolha uma senha nova para sua conta do Estudos IA.')
  const navegar = useNavigate()
  const [codigo] = useState(lerCodigoDoLink)
  // Tira o código da barra de endereço: não fica no histórico, em print de tela nem em link copiado.
  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname)
  }, [])
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [tentou, setTentou] = useState(false)

  const erroSenha = senha.length < 6 ? `A senha precisa ter pelo menos 6 caracteres${senha ? ` (faltam ${6 - senha.length})` : ''}.` : null
  const erroConfirmacao = confirmacao !== senha ? 'As duas senhas não são iguais.' : null

  const trocar = useMutation({
    mutationFn: () => api.redefinirSenha(codigo!, senha),
    onSuccess: () => {
      definirLogado(true) // a API já gravou a sessão no cookie HttpOnly
      toast.success('Senha nova salva. Você já está dentro.')
      navegar('/', { replace: true })
    },
  })

  function aoEnviar(e: FormEvent) {
    e.preventDefault()
    setTentou(true)
    if (erroSenha || erroConfirmacao) return
    trocar.mutate()
  }

  return (
    <div className="textura pontilhado flex min-h-svh flex-col items-center justify-center gap-8 px-4 py-12">
      <Link to="/" aria-label="Estudos IA: início" className="flex items-center gap-2 font-heading text-lg font-semibold">
        <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
          <BookOpenText className="size-4" />
        </span>
        Estudos IA
      </Link>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <span className="mb-2 grid size-10 place-items-center rounded-xl bg-accent text-destaque">
            <Lock className="size-5" weight="bold" />
          </span>
          <CardTitle className="font-heading text-2xl">Criar senha nova</CardTitle>
          <CardDescription>
            {codigo ? 'Escolha uma senha que você ainda não usou aqui.' : 'Este endereço não tem o código de recuperação.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!codigo ? (
            <div className="flex flex-col gap-4 text-sm text-muted-foreground">
              <p>Abra o link direto do e-mail que enviamos. Se ele expirou, peça outro: leva um minuto.</p>
              <Button asChild><Link to="/entrar?recuperar=1">Pedir um link novo</Link></Button>
            </div>
          ) : (
            <form onSubmit={aoEnviar} noValidate className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="senha-nova">Senha nova</Label>
                <Input id="senha-nova" type="password" autoComplete="new-password" value={senha} autoFocus
                  onChange={(e) => setSenha(e.target.value)} aria-invalid={tentou && !!erroSenha} aria-describedby="erro-senha-nova" />
                {tentou && erroSenha
                  ? <p id="erro-senha-nova" className="text-xs text-destructive" role="alert">{erroSenha}</p>
                  : <p className={senha.length >= 6 ? 'text-xs text-sucesso' : 'text-xs text-muted-foreground'}>
                      {senha.length >= 6 ? '✓ Tamanho da senha ok.' : 'Pelo menos 6 caracteres.'}
                    </p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="senha-confirmacao">Repita a senha nova</Label>
                <Input id="senha-confirmacao" type="password" autoComplete="new-password" value={confirmacao}
                  onChange={(e) => setConfirmacao(e.target.value)} aria-invalid={tentou && !!erroConfirmacao} aria-describedby="erro-confirmacao" />
                {tentou && erroConfirmacao && <p id="erro-confirmacao" className="text-xs text-destructive" role="alert">{erroConfirmacao}</p>}
              </div>
              {trocar.isError && (
                <div className="flex flex-col gap-2 text-sm" role="alert">
                  <p className="text-destructive">{trocar.error.message}</p>
                  {/expirou|já foi usado|inválido/i.test(trocar.error.message) && (
                    <Link to="/entrar?recuperar=1" className="font-medium text-foreground underline underline-offset-2">Pedir um link novo</Link>
                  )}
                </div>
              )}
              <Button type="submit" size="lg" disabled={trocar.isPending}>
                {trocar.isPending ? 'Salvando…' : 'Salvar senha nova'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
