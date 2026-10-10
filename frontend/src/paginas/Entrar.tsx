import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, BadgeCheck, BookOpenText, Route, Sparkles } from '@/lib/icones'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import BlurText from '@/components/BlurText'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api, limparAvisoExpirou, sessaoExpirou } from '@/lib/api'
import { definirLogado } from '@/lib/sessao'
import { useTitulo } from '@/lib/titulo'

const DIFERENCIAIS = [
  { icone: BadgeCheck, texto: 'Só links e vídeos verificados, nada inventado pela IA' },
  { icone: Route, texto: 'Trilha que se adapta aos seus acertos e erros' },
  { icone: Sparkles, texto: 'Exercícios por nível e revisão no momento certo' },
]

type Campo = 'nome' | 'email' | 'senha'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Mesmas regras da API, avisadas campo a campo antes do envio. */
function validar(modo: 'entrar' | 'cadastrar', nome: string, email: string, senha: string): Partial<Record<Campo, string>> {
  const erros: Partial<Record<Campo, string>> = {}
  if (!email.trim()) erros.email = 'Informe seu e-mail.'
  else if (!EMAIL.test(email.trim())) erros.email = 'Esse e-mail parece incompleto (ex.: nome@gmail.com).'
  if (!senha) erros.senha = 'Informe sua senha.'
  else if (senha.length < 6) erros.senha = `A senha precisa ter pelo menos 6 caracteres (faltam ${6 - senha.length}).`
  if (modo === 'cadastrar' && nome.length > 80) erros.nome = 'O nome pode ter no máximo 80 caracteres.'
  return erros
}

function ErroCampo({ id, texto }: { id: string; texto?: string }) {
  return texto ? <p id={id} className="text-xs text-destructive" role="alert">{texto}</p> : null
}

export function PaginaEntrar() {
  const [params] = useSearchParams()
  const [modo, setModo] = useState<'entrar' | 'cadastrar'>(params.get('modo') === 'cadastrar' ? 'cadastrar' : 'entrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [recuperando, setRecuperando] = useState(params.get('recuperar') === '1')
  const [aceite, setAceite] = useState(false)
  const [tocados, setTocados] = useState<Partial<Record<Campo, boolean>>>({})
  const erros = validar(modo, nome, email, senha)
  const mostrar = (campo: Campo) => (tocados[campo] ? erros[campo] : undefined)
  const tocar = (campo: Campo) => () => setTocados((t) => ({ ...t, [campo]: true }))
  const [expirou] = useState(sessaoExpirou)
  useEffect(limparAvisoExpirou, []) // mostra uma vez só
  useTitulo(modo === 'entrar' ? 'Entrar' : 'Criar conta', 'Entre ou crie sua conta grátis no Estudos IA e comece a estudar com uma IA tutora que pesquisa materiais verificados por você.')

  const enviar = useMutation({
    mutationFn: async () => {
      if (modo === 'entrar') return api.entrar(email, senha)
      return api.cadastrar(nome, email, senha, aceite)
    },
    onSuccess: (resposta) => {
      if ('logado' in resposta) definirLogado(true) // o token ficou no cookie HttpOnly
      else setAviso(resposta.mensagem) // projeto com confirmação de e-mail ligada
    },
  })

  function aoEnviar(e: FormEvent) {
    e.preventDefault()
    setAviso(null)
    if (Object.keys(erros).length) {
      setTocados({ nome: true, email: true, senha: true }) // mostra tudo de uma vez
      return
    }
    enviar.mutate()
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <section className="textura pontilhado flex flex-col justify-center gap-8 bg-secondary/70 px-8 py-12 lg:px-16">
        <Link to="/" aria-label="Estudos IA: início" className="flex w-fit items-center gap-2 font-heading text-lg font-semibold">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <BookOpenText className="size-4" />
          </span>
          Estudos IA
        </Link>
        <BlurText
          text="Estude qualquer assunto com uma tutora que pesquisa por você."
          animateBy="words"
          delay={90}
          className="font-heading text-4xl leading-tight font-semibold tracking-tight lg:text-5xl"
        />
        <ul className="flex flex-col gap-3">
          {DIFERENCIAIS.map(({ icone: Icone, texto }) => (
            <li key={texto} className="flex items-center gap-3 text-muted-foreground">
              <Icone className="size-5 shrink-0 text-primary" />
              {texto}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-sm">
          {recuperando ? (
            <RecuperarSenha emailInicial={email} voltar={() => setRecuperando(false)} />
          ) : (<>
          <CardHeader>
            <CardTitle className="font-heading text-2xl">
              {modo === 'entrar' ? 'Bem-vindo de volta' : 'Crie sua conta'}
            </CardTitle>
            <CardDescription>
              {modo === 'entrar' ? 'Entre para continuar seus estudos.' : 'Leva menos de um minuto.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <Tabs value={modo} onValueChange={(v) => { setModo(v as typeof modo); enviar.reset(); setAviso(null); setTocados({}) }}>
              <TabsList className="w-full">
                <TabsTrigger value="entrar">Entrar</TabsTrigger>
                <TabsTrigger value="cadastrar">Criar conta</TabsTrigger>
              </TabsList>
            </Tabs>

            {expirou && !enviar.isError && (
              <p className="rounded-xl bg-accent/60 px-3 py-2 text-sm text-accent-foreground" role="status">
                Sua sessão expirou. Entre de novo para continuar.
              </p>
            )}
            <form onSubmit={aoEnviar} noValidate className="flex flex-col gap-4">
              {modo === 'cadastrar' && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} onBlur={tocar('nome')}
                    autoComplete="name" aria-invalid={!!mostrar('nome')} aria-describedby="erro-nome" />
                  <ErroCampo id="erro-nome" texto={mostrar('nome')} />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  onBlur={tocar('email')} autoComplete="email" aria-invalid={!!mostrar('email')} aria-describedby="erro-email" />
                <ErroCampo id="erro-email" texto={mostrar('email')} />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="senha">Senha</Label>
                  {modo === 'entrar' && (
                    <button type="button" onClick={() => setRecuperando(true)}
                      className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                      Esqueci minha senha
                    </button>
                  )}
                </div>
                <Input
                  id="senha"
                  type="password"
                  required
                  minLength={6}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  onBlur={tocar('senha')}
                  autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
                  aria-invalid={!!mostrar('senha')}
                  aria-describedby="erro-senha"
                />
                {mostrar('senha')
                  ? <ErroCampo id="erro-senha" texto={mostrar('senha')} />
                  : modo === 'cadastrar' && (
                    <p className={senha.length >= 6 ? 'text-xs text-sucesso' : 'text-xs text-muted-foreground'}>
                      {senha.length >= 6 ? '✓ Tamanho da senha ok.' : 'Pelo menos 6 caracteres.'}
                    </p>
                  )}
              </div>
              {modo === 'cadastrar' && (
                <div className="flex items-start gap-2">
                  <Checkbox id="aceite" checked={aceite} onCheckedChange={(v) => setAceite(v === true)} className="mt-0.5" />
                  <Label htmlFor="aceite" className="text-sm leading-snug font-normal text-muted-foreground">
                    <span>
                      Li e aceito os{' '}
                      <Link to="/termos" target="_blank" className="text-primary underline underline-offset-2">Termos de Uso</Link>
                      {' '}e a{' '}
                      <Link to="/privacidade" target="_blank" className="text-primary underline underline-offset-2">Política de Privacidade</Link>.
                    </span>
                  </Label>
                </div>
              )}
              {enviar.isError && <p className="text-sm text-destructive" role="alert">{enviar.error.message}</p>}
              {aviso && <p className="text-sm text-sucesso" role="status">{aviso}</p>}
              <Button type="submit" size="lg" disabled={enviar.isPending || (modo === 'cadastrar' && !aceite)}>
                {enviar.isPending ? 'Um instante…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
              </Button>
            </form>
          </CardContent>
          </>)}
        </Card>
      </section>
    </div>
  )
}

/** "Esqueci minha senha": pede o link por e-mail. A resposta é a mesma exista a conta ou não. */
function RecuperarSenha({ emailInicial, voltar }: { emailInicial: string; voltar: () => void }) {
  const [email, setEmail] = useState(emailInicial)
  const [tocado, setTocado] = useState(false)
  const erro = !email.trim() ? 'Informe seu e-mail.' : !EMAIL.test(email.trim()) ? 'Esse e-mail parece incompleto (ex.: nome@gmail.com).' : undefined
  const pedir = useMutation({ mutationFn: () => api.esqueciSenha(email.trim()) })

  function aoEnviar(e: FormEvent) {
    e.preventDefault()
    setTocado(true)
    if (!erro) pedir.mutate()
  }

  return (
    <>
      <CardHeader>
        <CardTitle className="font-heading text-2xl">Esqueceu a senha?</CardTitle>
        <CardDescription>Digite o e-mail da sua conta. Enviamos um link para você criar uma senha nova.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {pedir.isSuccess ? (
          <div className="flex flex-col gap-3 rounded-xl bg-sucesso-suave px-4 py-3 text-sm" role="status">
            <p className="font-medium text-sucesso">Pronto, confira seu e-mail.</p>
            <p className="text-muted-foreground">{pedir.data.mensagem} O link vale por 1 hora.</p>
          </div>
        ) : (
          <form onSubmit={aoEnviar} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email-recuperar">E-mail</Label>
              <Input id="email-recuperar" type="email" autoComplete="email" autoFocus value={email}
                onChange={(e) => setEmail(e.target.value)} onBlur={() => setTocado(true)}
                aria-invalid={tocado && !!erro} aria-describedby="erro-email-recuperar" />
              <ErroCampo id="erro-email-recuperar" texto={tocado ? erro : undefined} />
            </div>
            {pedir.isError && <p className="text-sm text-destructive" role="alert">{pedir.error.message}</p>}
            <Button type="submit" size="lg" disabled={pedir.isPending}>
              {pedir.isPending ? 'Enviando…' : 'Enviar link'}
            </Button>
          </form>
        )}
        <button type="button" onClick={voltar}
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Voltar para entrar
        </button>
      </CardContent>
    </>
  )
}
