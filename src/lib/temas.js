// Temas predefinidos para o lojista escolher na criação/edição da loja.
// Cada tema define: corPrimaria, corSecundaria (derivada), e variáveis de apoio para UI.
export const TEMAS = [
  {
    id: 'ambar',
    nome: 'Âmbar',
    descricao: 'Quente e acolhedor — ideal para restaurantes, cafés, barbearias',
    corPrimaria: '#b45309',
    corSecundaria: '#92400e',
    corHover: '#c2410c',
    corFundoClaro: '#fff7ed',
    corFundoEscuro: '#7c2d12',
    icone: '🟠'
  },
  {
    id: 'esmeralda',
    nome: 'Esmeralda',
    descricao: 'Natural e saudável — ideal para orgânicos, saladas, wellness, spas',
    corPrimaria: '#059669',
    corSecundaria: '#047857',
    corHover: '#047857',
    corFundoClaro: '#ecfdf5',
    corFundoEscuro: '#064e3b',
    icone: '🟢'
  },
  {
    id: 'indigo',
    nome: 'Índigo',
    descricao: 'Moderno e tech — ideal para apps, serviços digitais, startups',
    corPrimaria: '#4f46e5',
    corSecundaria: '#4338ca',
    corHover: '#4338ca',
    corFundoClaro: '#eef2ff',
    corFundoEscuro: '#312e81',
    icone: '🔵'
  },
  {
    id: 'rosa',
    nome: 'Rosa',
    descricao: 'Doce e feminino — ideal para docerias, boutiques, salões de beleza',
    corPrimaria: '#be185d',
    corSecundaria: '#9d174d',
    corHover: '#9d174d',
    corFundoClaro: '#fdf2f8',
    corFundoEscuro: '#831843',
    icone: '🩷'
  },
  {
    id: 'ardosia',
    nome: 'Ardósia',
    descricao: 'Elegante e sóbrio — ideal para escritórios, advogados, contabilidade, B2B',
    corPrimaria: '#334155',
    corSecundaria: '#1e293b',
    corHover: '#1e293b',
    corFundoClaro: '#f1f5f9',
    corFundoEscuro: '#0f172a',
    icone: '⚫'
  },
  {
    id: 'terracota',
    nome: 'Terracota',
    descricao: 'Artesanal e rústico — ideal para cerâmica, artesanato, móveis, decoração',
    corPrimaria: '#c2410c',
    corSecundaria: '#9a3412',
    corHover: '#9a3412',
    corFundoClaro: '#fff7ed',
    corFundoEscuro: '#7c2d12',
    icone: '🟤'
  },
  {
    id: 'preto-verde',
    nome: 'Preto & Verde',
    descricao: 'Sóbrio e natural — ideal para marcas modernas, tech, wellness, barbearias',
    corPrimaria: '#0a0a0a',
    corSecundaria: '#047857',
    corHover: '#065f46',
    corFundoClaro: '#f0fdf4',
    corFundoEscuro: '#052e16',
    icone: '⚫'
  }
];

// Retorna um tema pelo ID
export function getTema(id) {
  return TEMAS.find(t => t.id === id) || TEMAS[0];
}

// Retorna o tema mais próximo baseado na cor primária atual (para migração)
export function getTemaPorCor(corPrimaria) {
  if (!corPrimaria) return TEMAS[0];
  const normalizada = corPrimaria.toLowerCase();
  const tema = TEMAS.find(t => t.corPrimaria.toLowerCase() === normalizada);
  return tema || TEMAS[0];
}

// Gera CSS custom properties para um tema (para aplicar na vitrine)
export function gerarCSSDoTema(tema) {
  return {
    '--cor-primaria': tema.corPrimaria,
    '--cor-secundaria': tema.corSecundaria,
    '--cor-hover': tema.corHover,
    '--cor-fundo-claro': tema.corFundoClaro,
    '--cor-fundo-escuro': tema.corFundoEscuro
  };
}