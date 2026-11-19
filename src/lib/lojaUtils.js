// Arquivo: src/lib/lojaUtils.js

// Toda escrita no Supabase passa por aqui: se der erro, lança para a tela mostrar.
export const checar = ({ error }) => {
  if (error) throw error;
};

const SELECT_LOJA = '*, categorias(*), itens(*), profissionais(*)';

export function mapearLoja(l) {
  return {
    ...l,
    corPrimaria: l.cor_primaria || '#b45309',
    corSecundaria: l.cor_secundaria || '#92400e',
    logo: l.logo_url || null,
    categorias: [...(l.categorias || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
    profissionais: l.profissionais || [],
    cupons: [], // cupons NÃO são públicos: só o dono os carrega (veja carregarDadosNuvem)
    produtos: (l.itens || []).map((item) => ({ ...item, categoriaId: item.categoria_id }))
  };
}

// Funções de RPC e CRUD
export async function carregarLojaPorSlug(slug) {
  try {
    const { data, error } = await supabase
      .from('lojas')
      .select(SELECT_LOJA)
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const loja = mapearLoja(data);
    return loja;
  } catch (err) {
    console.error('Erro ao carregar loja:', err);
    return null;
  }
}

export async function carregarDadosNuvem(userAtual, setLojas, setMinhaLoja, setCarregando) {
  try {
    if (!userAtual) {
      setMinhaLoja(null);
      setCarregando(false);
      return;
    }
    const { data, error } = await supabase
      .from('lojas')
      .select(SELECT_LOJA)
      .eq('dono_id', userAtual.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      setMinhaLoja(null);
      setCarregando(false);
      return;
    }
    const loja = mapearLoja(data);
    const { data: cupons } = await supabase.from('cupons').select('*').eq('loja_id', loja.id);
    loja.cupons = cupons || [];

    setLojas((prev) => ({ ...prev, [loja.slug]: loja }));
    setMinhaLoja(loja);
  } catch (err) {
    console.error('Erro ao carregar do Supabase:', err);
  } finally {
    setCarregando(false);
  }
}
