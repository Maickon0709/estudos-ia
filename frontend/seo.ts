// Plugin do Vite para SEO: robots.txt, sitemap.xml e URLs absolutas de compartilhamento.
//
// Sitemap e og:image precisam do endereço completo do site (regra dos buscadores e das
// redes sociais). Ele vem de VITE_SITE_URL; sem ele, o build gera só o robots.txt e não
// inventa endereço nenhum.
import type { Plugin } from 'vite'

// Só as páginas públicas: o resto exige login e não deve aparecer no Google.
const PUBLICAS = ['/', '/como-usar', '/termos', '/privacidade', '/entrar']
const PRIVADAS = ['/categorias', '/revisoes', '/conta', '/simulados']

export function seo(siteUrl: string | undefined): Plugin {
  const base = siteUrl?.replace(/\/+$/, '')
  return {
    name: 'estudos-ia-seo',
    apply: 'build',
    transformIndexHtml(html) {
      if (!base) return html
      return html
        .replace('<meta property="og:image" content="/og.jpg" />', `<meta property="og:image" content="${base}/og.jpg" />`)
        .replace('</head>', `    <meta property="og:url" content="${base}/" />\n    <link rel="canonical" href="${base}/" />\n  </head>`)
    },
    generateBundle() {
      const robots = ['User-agent: *', 'Allow: /', ...PRIVADAS.map((p) => `Disallow: ${p}`)]
      if (base) robots.push('', `Sitemap: ${base}/sitemap.xml`)
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots.join('\n') + '\n' })

      if (!base) {
        this.warn('VITE_SITE_URL não definido: sitemap.xml e URLs absolutas de compartilhamento não foram gerados.')
        return
      }
      const hoje = new Date().toISOString().slice(0, 10)
      const urls = PUBLICAS.map((p) => `  <url><loc>${base}${p}</loc><lastmod>${hoje}</lastmod></url>`)
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
      })
    },
  }
}
