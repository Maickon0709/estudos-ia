# Estudos IA — front-end

Site da plataforma: React 19 + TypeScript + Vite, Tailwind CSS v4, componentes do
[shadcn/ui](https://ui.shadcn.com), animações do [React Bits](https://reactbits.dev)
(`BlurText` na entrada, `CountUp` no painel) e dados com TanStack Query.

## Rodar

Com a API rodando na porta 5000 (veja o README da raiz):

```bash
npm install
npm run dev       # http://localhost:5173  (o Vite repassa /api/* para o Flask)
npm run build     # checa tipos e gera dist/
npm run preview   # serve o build com os cabeçalhos de segurança de produção
npm run lint
```

## Estrutura

```
src/
  lib/api.ts          único ponto que fala com a API (tokens, erros {erro, mensagem})
  lib/tipos.ts        formatos devolvidos pela API
  lib/seguranca.ts    urlSegura(), atributos de link externo, limites de tamanho
  lib/sessao.ts       hook useLogado() (reage a login/logout, inclusive em outra aba)
  components/         Layout, estados (carregando/erro/vazio), RecursoItem, ExercicioCartao
  components/ui/      componentes do shadcn/ui
  paginas/            Entrar, Categorias, Categoria (abas Conversa/Trilha/Painel), Etapa, Revisões
```

Cada página é carregada sob demanda (`React.lazy`); o painel, que traz a biblioteca de
gráficos, só é baixado quando a aba é aberta.

## Segurança

| Risco | Defesa |
|---|---|
| XSS pelo texto da IA ou do usuário | Tudo renderizado como texto; `dangerouslySetInnerHTML` proibido (o CI barra) |
| Link malicioso (`javascript:`, `data:`) | `urlSegura()` só aceita http/https; o resto vira texto, não link |
| Aba aberta controlando a original | Links externos com `rel="noopener noreferrer"` |
| Script de terceiros / injeção | CSP `script-src 'self'` em `cabecalhos-seguranca.json` |
| Site embutido em outro (clickjacking) | `frame-ancestors 'none'` e `X-Frame-Options: DENY` |
| Segredo vazando no JS | Só `VITE_API_URL` (pública) no front; chaves ficam na API |
| Roubo de sessão por XSS | Token em cookie `HttpOnly`: invisível para o JavaScript |
| CSRF (outro site usando seu cookie) | Cabeçalho `X-Requested-With` obrigatório + `SameSite=Lax` |
| Dados do usuário anterior no PC | Ao sair ou o token vencer, o cache do TanStack Query é apagado |
| Gabarito antes da resposta | Garantido pela API: o front nunca recebe o gabarito antes de responder |

**Sessão:** o token fica em cookie `HttpOnly` gravado pela API: o JavaScript da página não consegue
lê-lo, então um eventual XSS não rouba a sessão. Toda escrita leva o cabeçalho `X-Requested-With`,
que outro site não consegue enviar (proteção contra CSRF), e o cookie é `SameSite=Lax`.
Por isso o site e a API precisam ficar no **mesmo domínio** (em desenvolvimento, o proxy `/api` do Vite faz isso).

**`npm audit`:** os alertas atuais vêm do CLI do `shadcn` (dependência `fast-glob`), usado só
no desenvolvimento para instalar componentes; nada disso vai para o JavaScript do site.
