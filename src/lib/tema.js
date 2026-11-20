// Personalização visual da vitrine. Tudo o que o lojista escolhe passa por aqui e é
// "higienizado": só valores de listas permitidas, cores #rrggbb e links https chegam ao CSS/HTML.

export const PALETAS = [
  { id: 'ambar', nome: 'Âmbar', primaria: '#b45309' },
  { id: 'laranja', nome: 'Laranja', primaria: '#ea580c' },
  { id: 'vinho', nome: 'Vinho', primaria: '#9f1239' },
  { id: 'rosa', nome: 'Rosa', primaria: '#be185d' },
  { id: 'violeta', nome: 'Violeta', primaria: '#6d28d9' },
  { id: 'oceano', nome: 'Oceano', primaria: '#0369a1' },
  { id: 'esmeralda', nome: 'Esmeralda', primaria: '#047857' },
  { id: 'grafite', nome: 'Grafite', primaria: '#27272a' },
  { id: 'preto', nome: 'Preto', primaria: '#0a0a0a' }
];

export const MODOS = {
  claro: { nome: 'Claro', desc: 'Fundo branco, limpo' },
  suave: { nome: 'Creme', desc: 'Fundo quente, acolhedor' },
  escuro: { nome: 'Escuro', desc: 'Fundo preto, sofisticado' }
};

export const FONTES = {
  moderna: { nome: 'Moderna', desc: 'Inter', amostra: "'Inter', sans-serif" },
  elegante: { nome: 'Elegante', desc: 'Playfair Display', amostra: "'Playfair Display', serif" },
  amigavel: { nome: 'Amigável', desc: 'Poppins', amostra: "'Poppins', sans-serif" },
  classica: { nome: 'Clássica', desc: 'Lora', amostra: "'Lora', serif" },
  ousada: { nome: 'Ousada', desc: 'Oswald', amostra: "'Oswald', sans-serif" }
};

export const CANTOS = {
  reto: { nome: 'Retos', desc: 'Visual firme' },
  suave: { nome: 'Suaves', desc: 'Equilibrado' },
  redondo: { nome: 'Redondos', desc: 'Visual amigável' }
};

export const CAPAS = {
  gradiente: { nome: 'Degradê' },
  solido: { nome: 'Cor sólida' },
  pontos: { nome: 'Pontilhado' },
  listras: { nome: 'Listras' }
};

export const CABECALHOS = {
  capa: { nome: 'Capa grande', desc: 'Destaque no topo' },
  simples: { nome: 'Compacto', desc: 'Direto ao conteúdo' }
};

export const LISTAGENS = {
  grade: { nome: 'Grade', desc: 'Cartões lado a lado' },
  lista: { nome: 'Lista', desc: 'Uma linha por item' }
};

export const TEMA_PADRAO = {
  modo: 'claro',
  corFundo: '',
  fonte: 'moderna',
  cantos: 'suave',
  capa: 'gradiente',
  capaUrl: '',
  cabecalho: 'capa',
  listagem: 'grade',
  animacoes: true,
  sobre: '',
  endereco: '',
  mapaLink: '',
  instagram: '',
  horarioTexto: ''
};

const escolha = (valor, opcoes, padrao) => (typeof valor === 'string' && Object.hasOwn(opcoes, valor) ? valor : padrao);
const texto = (valor, max) =>
  String(valor ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, max);

export const urlHttps = (valor) => {
  try {
    const u = new URL(String(valor ?? '').trim());
    return u.protocol === 'https:' ? u.href.slice(0, 500) : '';
  } catch {
    return '';
  }
};

export const limparInstagram = (valor) =>
  String(valor ?? '')
    .replace(/^.*instagram\.com\//i, '')
    .replace(/[/?#].*$/, '')
    .replace(/[^a-zA-Z0-9._]/g, '')
    .slice(0, 30);

export const corValida = (valor, padrao) => (/^#[0-9a-f]{6}$/i.test(String(valor ?? '')) ? valor : padrao);

// Aceita qualquer objeto vindo do banco/formulário e devolve um tema 100% seguro.
export function normalizarTema(bruto = {}) {
  const p = bruto && typeof bruto === 'object' ? bruto : {};
  return {
    modo: escolha(p.modo, MODOS, TEMA_PADRAO.modo),
    corFundo: corValida(p.corFundo, ''),
    fonte: escolha(p.fonte, FONTES, TEMA_PADRAO.fonte),
    cantos: escolha(p.cantos, CANTOS, TEMA_PADRAO.cantos),
    capa: escolha(p.capa, CAPAS, TEMA_PADRAO.capa),
    capaUrl: urlHttps(p.capaUrl),
    cabecalho: escolha(p.cabecalho, CABECALHOS, TEMA_PADRAO.cabecalho),
    listagem: escolha(p.listagem, LISTAGENS, TEMA_PADRAO.listagem),
    animacoes: p.animacoes === undefined ? TEMA_PADRAO.animacoes : p.animacoes === true,
    sobre: texto(p.sobre, 300),
    endereco: texto(p.endereco, 120),
    mapaLink: urlHttps(p.mapaLink),
    instagram: limparInstagram(p.instagram),
    horarioTexto: texto(p.horarioTexto, 80)
  };
}

export const lerTema = (loja) => normalizarTema(loja?.personalizacao);

const luminancia = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const linearizar = (canal) => {
    const valor = canal / 255;
    return valor <= 0.04045 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * linearizar((n >> 16) & 255)
    + 0.7152 * linearizar((n >> 8) & 255)
    + 0.0722 * linearizar(n & 255)
  );
};

const contraste = (a, b) => {
  const [clara, escura] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (clara + 0.05) / (escura + 0.05);
};

// Escolhe preto ou branco para manter contraste em cores personalizadas.
export function corDoTexto(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return '#ffffff';
  return luminancia(hex) > 0.179 ? '#000000' : '#ffffff';
}

export function variaveisTema(corPrimaria, corSecundaria, corFundo) {
  const marca = corValida(corPrimaria, '#b45309');
  const variaveis = {
    '--brand': marca,
    '--brand-dark': corValida(corSecundaria, marca),
    '--brand-ink': corDoTexto(marca)
  };
  const fundo = corValida(corFundo, '');
  if (!fundo) return variaveis;

  const tinta = corDoTexto(fundo);
  const tomSuperficie = tinta === '#000000' ? '#ffffff' : '#000000';
  return {
    ...variaveis,
    '--bg': fundo,
    '--surface': `color-mix(in srgb, ${fundo} 96%, ${tomSuperficie})`,
    '--surface-2': `color-mix(in srgb, ${fundo} 90%, ${tomSuperficie})`,
    '--border': `color-mix(in srgb, ${fundo} 78%, ${tinta})`,
    '--text': tinta,
    '--muted': tinta,
    '--brand-accent': contraste(marca, fundo) >= 4.5 ? marca : tinta
  };
}

export const atributosTema = (tema) => ({
  'data-modo': tema.modo,
  'data-fonte': tema.fonte,
  'data-cantos': tema.cantos,
  'data-anim': tema.animacoes ? 'on' : 'off'
});

export const nomeFonteCapa = (tema) => (tema.capaUrl ? 'imagem' : tema.capa);
