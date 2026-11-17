// Prévia de link por loja (WhatsApp, Instagram, Telegram, Google...).
// O app é uma SPA: sem isso, todo link /loja-x mostraria a mesma prévia genérica.
// Só intercepta robôs de prévia; pessoas continuam recebendo o app normalmente.
const ROBOS = /whatsapp|facebookexternalhit|facebot|twitterbot|telegrambot|slackbot|linkedinbot|discordbot|skypeuripreview|googlebot|bingbot/i;
const RESERVADOS = new Set(['admin', 'login']);

export const config = {
  // Ignora arquivos (qualquer caminho com ponto) e /api
  matcher: '/((?!api|.*\\..*).*)'
};

const seguir = () => new Response(null, { headers: { 'x-middleware-next': '1' } });

const esc = (t) =>
  String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default async function middleware(request) {
  const ua = request.headers.get('user-agent') || '';
  const url = new URL(request.url);
  const slug = url.pathname.replace(/^\/+|\/+$/g, '');

  if (!ROBOS.test(ua) || RESERVADOS.has(slug) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return seguir();
  }

  const base = process.env.VITE_SUPABASE_URL;
  const chave = process.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !chave) return seguir();

  try {
    const resp = await fetch(
      `${base}/rest/v1/lojas?slug=eq.${slug}&select=nome,subtitulo,logo_url&limit=1`,
      { headers: { apikey: chave, Authorization: `Bearer ${chave}` } }
    );
    const lista = resp.ok ? await resp.json() : [];
    const loja = lista[0];
    if (!loja) return seguir();

    const titulo = `${loja.nome} | ConectaLocal`;
    const descricao = loja.subtitulo
      ? `${loja.subtitulo} — faça seu pedido ou agende online.`
      : 'Faça seu pedido ou agende online.';
    // A prévia exige URL absoluta; o banco guarda caminhos como "/logotipo.png".
    const logo = loja.logo_url || '/logotipo.png';
    const imagem = /^https?:\/\//.test(logo) ? logo : `${url.origin}${logo.startsWith('/') ? '' : '/'}${logo}`;

    const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descricao)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descricao)}">
<meta property="og:image" content="${esc(imagem)}">
<meta property="og:url" content="${esc(url.origin + '/' + slug)}">
<meta name="twitter:card" content="summary">
</head><body></body></html>`;

    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        // Nunca cachear: o mesmo endereço serve HTML diferente para robôs e para pessoas.
        'cache-control': 'no-store',
        vary: 'User-Agent'
      }
    });
  } catch {
    return seguir();
  }
}
