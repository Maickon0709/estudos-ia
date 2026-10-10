import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErroApi, api } from '@/lib/api'
import { aplicarTema, useTema } from '@/lib/tema'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import App from './App'
import './index.css'

// Antes de montar: evita a página "piscar" no tema errado.
aplicarTema()
// Confere com o servidor se o cookie de sessão ainda vale.
void api.verificarSessao()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Erros 4xx não melhoram tentando de novo; só falha de rede/servidor merece retry.
      retry: (tentativas, erro) =>
        tentativas < 2 && !(erro instanceof ErroApi && erro.status >= 400 && erro.status < 500),
    },
  },
})

function Avisos() {
  return <Toaster position="top-center" richColors theme={useTema() === 'escuro' ? 'dark' : 'light'} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <App />
        <Avisos />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
)
