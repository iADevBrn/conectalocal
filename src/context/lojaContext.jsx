import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { LOJAS_MOCK } from '../data/mockLojas';

const LojaContext = createContext();

// Toda escrita no Supabase passa por aqui: se der erro, lança para a tela mostrar.
const checar = ({ error }) => {
  if (error) throw error;
};

const SELECT_LOJA = '*, categorias(*), itens(*), profissionais(*)';

function mapearLoja(l) {
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

export function LojaProvider({ children }) {
  const [lojas, setLojas] = useState(LOJAS_MOCK);
  const [usuario, setUsuario] = useState(null);
  const [minhaLoja, setMinhaLoja] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const usuarioRef = useRef(null);

  // Vitrine pública: busca SÓ a loja do link (antes baixava todas as lojas de todos os clientes).
  const carregarLojaPorSlug = useCallback(async (slug) => {
    try {
      const { data, error } = await supabase
        .from('lojas')
        .select(SELECT_LOJA)
        .eq('slug', slug)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const loja = mapearLoja(data);
      setLojas((prev) => ({ ...prev, [loja.slug]: { ...loja, cupons: prev[loja.slug]?.cupons || [] } }));
      return loja;
    } catch (err) {
      console.error('Erro ao carregar loja:', err);
      return null;
    }
  }, []);

  // Painel: carrega a loja do usuário logado (e os cupons dela).
  const carregarDadosNuvem = useCallback(async (userAtual) => {
    try {
      if (!userAtual) {
        setMinhaLoja(null);
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
  }, []);

  useEffect(() => {
    let ativo = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!ativo) return;
      const user = session?.user ?? null;
      usuarioRef.current = user;
      setUsuario(user);
      carregarDadosNuvem(user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((evento, session) => {
      // INITIAL_SESSION já é tratado acima; TOKEN_REFRESHED não muda nada para a tela.
      if (evento === 'INITIAL_SESSION' || evento === 'TOKEN_REFRESHED') return;
      const user = session?.user ?? null;
      usuarioRef.current = user;
      setUsuario(user);
      setCarregando(true);
      carregarDadosNuvem(user);
    });

    return () => {
      ativo = false;
      listener.subscription.unsubscribe();
    };
  }, [carregarDadosNuvem]);

  const lojaEditavel = (slug) => {
    const loja = lojas[slug];
    if (!loja?.dono_id) throw new Error('Esta loja é apenas demonstração e não pode ser editada.');
    return loja;
  };

  const recarregar = () => carregarDadosNuvem(usuarioRef.current);

  const atualizarConfigLoja = async (slug, novosDados) => {
    const loja = lojaEditavel(slug);
    checar(
      await supabase
        .from('lojas')
        .update({
          nome: novosDados.nome,
          subtitulo: novosDados.subtitulo,
          telefone: novosDados.telefone,
          modo: novosDados.modo || loja.modo,
          cor_primaria: novosDados.corPrimaria,
          cor_secundaria: novosDados.corSecundaria,
          ...(novosDados.logoUrl ? { logo_url: novosDados.logoUrl } : {}),
          ...(novosDados.personalizacao ? { personalizacao: novosDados.personalizacao } : {})
        })
        .eq('id', loja.id)
    );
    await recarregar();
  };

  const atualizarConfigAgenda = async (slug, cfg) => {
    const loja = lojaEditavel(slug);
    checar(
      await supabase
        .from('lojas')
        .update({
          agenda_inicio: cfg.inicio,
          agenda_fim: cfg.fim,
          agenda_intervalo: cfg.intervalo,
          agenda_pausa_inicio: cfg.pausaInicio || null,
          agenda_pausa_fim: cfg.pausaFim || null,
          agenda_dias: cfg.dias
        })
        .eq('id', loja.id)
    );
    await recarregar();
  };

  const cancelarAgendamento = async (slug, agendamentoId) => {
    const loja = lojaEditavel(slug);
    checar(
      await supabase
        .from('agendamentos')
        .update({ status: 'cancelado' })
        .eq('id', agendamentoId)
        .eq('loja_id', loja.id)
    );
  };

  const salvarProduto = async (slug, produto) => {
    const loja = lojaEditavel(slug);
    const campos = {
      nome: produto.nome,
      descricao: produto.descricao,
      preco: produto.preco,
      duracao_minutos: produto.duracao_minutos || 30
    };

    if (produto.id && typeof produto.id === 'string') {
      checar(await supabase.from('itens').update(campos).eq('id', produto.id).eq('loja_id', loja.id));
    } else {
      checar(
        await supabase.from('itens').insert([
          {
            loja_id: loja.id,
            categoria_id: produto.categoriaId,
            tag: produto.tag || 'Destaque',
            ...campos
          }
        ])
      );
    }
    await recarregar();
  };

  const removerProduto = async (slug, produtoId) => {
    const loja = lojaEditavel(slug);
    checar(await supabase.from('itens').delete().eq('id', produtoId).eq('loja_id', loja.id));
    await recarregar();
  };

  const adicionarCupom = async (slug, codigo, descontoPercentual) => {
    const loja = lojaEditavel(slug);
    const desconto = Math.min(100, Math.max(1, Number(descontoPercentual)));
    if (!Number.isFinite(desconto)) throw new Error('Desconto inválido.');
    checar(
      await supabase.from('cupons').insert([
        {
          loja_id: loja.id,
          codigo: codigo.trim().toUpperCase(),
          desconto_percentual: desconto
        }
      ])
    );
    await recarregar();
  };

  const removerCupom = async (slug, codigo) => {
    const loja = lojaEditavel(slug);
    checar(await supabase.from('cupons').delete().eq('loja_id', loja.id).eq('codigo', codigo));
    await recarregar();
  };

  const adicionarProfissional = async (lojaId, nome, especialidade) => {
    checar(await supabase.from('profissionais').insert([{ loja_id: lojaId, nome, especialidade }]));
    await recarregar();
  };

  const removerProfissional = async (lojaId, profissionalId) => {
    checar(
      await supabase.from('profissionais').delete().eq('id', profissionalId).eq('loja_id', lojaId)
    );
    await recarregar();
  };

  const sair = async () => {
    await supabase.auth.signOut();
    setMinhaLoja(null);
  };

  return (
    <LojaContext.Provider
      value={{
        lojas,
        usuario,
        minhaLoja,
        carregando,
        carregarLojaPorSlug,
        atualizarConfigLoja,
        atualizarConfigAgenda,
        cancelarAgendamento,
        salvarProduto,
        removerProduto,
        adicionarCupom,
        removerCupom,
        adicionarProfissional,
        removerProfissional,
        sair
      }}
    >
      {children}
    </LojaContext.Provider>
  );
}

export const useLojas = () => useContext(LojaContext);
