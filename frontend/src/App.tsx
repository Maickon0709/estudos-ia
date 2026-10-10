import { useQueryClient } from '@tanstack/react-query'
import { Suspense, lazy, useEffect, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { Carregando } from '@/components/Estados'
import { Layout } from '@/components/Layout'
import { useLogado } from '@/lib/sessao'

// Cada página vira um arquivo JS separado, baixado só quando a rota é aberta.
const PaginaInicio = lazy(() => import('@/paginas/Inicio').then((m) => ({ default: m.PaginaInicio })))
const PaginaEntrar = lazy(() => import('@/paginas/Entrar').then((m) => ({ default: m.PaginaEntrar })))
const PaginaHoje = lazy(() => import('@/paginas/Hoje').then((m) => ({ default: m.PaginaHoje })))
const PaginaCategorias = lazy(() => import('@/paginas/Categorias').then((m) => ({ default: m.PaginaCategorias })))
const PaginaCategoria = lazy(() => import('@/paginas/Categoria').then((m) => ({ default: m.PaginaCategoria })))
const PaginaEtapa = lazy(() => import('@/paginas/Etapa').then((m) => ({ default: m.PaginaEtapa })))
const PaginaRevisoes = lazy(() => import('@/paginas/Revisoes').then((m) => ({ default: m.PaginaRevisoes })))
const PaginaSimulado = lazy(() => import('@/paginas/Simulado').then((m) => ({ default: m.PaginaSimulado })))
const PaginaConta = lazy(() => import('@/paginas/Conta').then((m) => ({ default: m.PaginaConta })))
const PaginaComoUsar = lazy(() => import('@/paginas/ComoUsar').then((m) => ({ default: m.PaginaComoUsar })))
const PaginaTermos = lazy(() => import('@/paginas/Legal').then((m) => ({ default: m.PaginaTermos })))
const PaginaPrivacidade = lazy(() => import('@/paginas/Legal').then((m) => ({ default: m.PaginaPrivacidade })))
const PaginaNaoEncontrada = lazy(() => import('@/paginas/NaoEncontrada').then((m) => ({ default: m.PaginaNaoEncontrada })))

function ComMenu({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return (
    <Layout>
      <Suspense fallback={<Carregando />}>
        <div key={pathname} className="surgir">{children}</div>
      </Suspense>
    </Layout>
  )
}

function SoLogado() {
  const logado = useLogado()
  const queryClient = useQueryClient()
  useEffect(() => {
    // Saiu (ou o token venceu): apaga da memória os dados do usuário anterior.
    if (!logado) queryClient.clear()
  }, [logado, queryClient])
  return logado ? <ComMenu><Outlet /></ComMenu> : <Navigate to="/entrar" replace />
}

function SoVisitante() {
  return useLogado() ? <Navigate to="/" replace /> : <Suspense><Outlet /></Suspense>
}

/** "/": a vitrine do produto para visitantes; o painel do dia para quem está logado. */
function Raiz() {
  const logado = useLogado()
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!logado) queryClient.clear()
  }, [logado, queryClient])
  return logado
    ? <ComMenu><PaginaHoje /></ComMenu>
    : <Suspense><PaginaInicio /></Suspense>
}

/** 404 para todos: com o menu para quem está logado, sozinha para visitante. */
function NaoEncontrada() {
  const pagina = <Suspense><PaginaNaoEncontrada /></Suspense>
  return useLogado() ? <Layout>{pagina}</Layout> : pagina
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Raiz />} />
        {/* Abertas a todos: guia e documentos legais (com menu se estiver logado). */}
        <Route path="/como-usar" element={<Suspense><PaginaComoUsar /></Suspense>} />
        <Route path="/termos" element={<Suspense><PaginaTermos /></Suspense>} />
        <Route path="/privacidade" element={<Suspense><PaginaPrivacidade /></Suspense>} />
        <Route element={<SoVisitante />}>
          <Route path="/entrar" element={<PaginaEntrar />} />
        </Route>
        <Route element={<SoLogado />}>
          <Route path="/categorias" element={<PaginaCategorias />} />
          <Route path="/categorias/:categoriaId" element={<PaginaCategoria />} />
          <Route path="/categorias/:categoriaId/trilhas/:trilhaId/etapas/:etapaId" element={<PaginaEtapa />} />
          <Route path="/simulados/:simuladoId" element={<PaginaSimulado />} />
          <Route path="/revisoes" element={<PaginaRevisoes />} />
          <Route path="/conta" element={<PaginaConta />} />
        </Route>
        <Route path="*" element={<NaoEncontrada />} />
      </Routes>
    </BrowserRouter>
  )
}
