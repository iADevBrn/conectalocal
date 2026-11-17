import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { LOJAS_MOCK } from '../data/mockLojas';

const LojaContext = createContext();

export function LojaProvider({ children }) {
  const [lojas, setLojas] = useState(LOJAS_MOCK);
  const [usuario, setUsuario] = useState(null);
  const [minhaLoja, setMinhaLoja] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const carregarDadosNuvem = async (userAtual) => {
    try {
      const { data: listaLojas } = await supabase
        .from('lojas')
        .select('*, categorias(*), itens(*), cupons(*), profissionais(*)');

      if (listaLojas && listaLojas.length > 0) {
        const mapa = { ...LOJAS_MOCK };
        listaLojas.forEach((l) => {
          mapa[l.slug] = {
            ...l,
            corPrimaria: l.cor_primaria,
            corSecundaria: l.cor_secundaria,
            logo: l.logo_url || '/img/logotipo.png',
            produtos: (l.itens || []).map((item) => ({
              ...item,
              categoriaId: item.categoria_id
            }))
          };
        });
        setLojas(mapa);

        if (userAtual) {
          const lojaDoDono = listaLojas.find((l) => l.dono_id === userAtual.id);
          if (lojaDoDono) setMinhaLoja(mapa[lojaDoDono.slug]);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar do Supabase:', err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;
      setUsuario(user);
      carregarDadosNuvem(user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setUsuario(user);
      carregarDadosNuvem(user);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const atualizarConfigLoja = async (slug, novosDados) => {
    const lojaAlvo = lojas[slug];
    if (!lojaAlvo) return;

    if (lojaAlvo.dono_id) {
      await supabase
        .from('lojas')
        .update({
          nome: novosDados.nome,
          subtitulo: novosDados.subtitulo,
          telefone: novosDados.telefone,
          modo: novosDados.modo || lojaAlvo.modo,
          cor_primaria: novosDados.corPrimaria,
          cor_secundaria: novosDados.corSecundaria
        })
        .eq('id', lojaAlvo.id);
      await carregarDadosNuvem(usuario);
    } else {
      setLojas((prev) => ({
        ...prev,
        [slug]: { ...prev[slug], ...novosDados }
      }));
    }
  };

  const salvarProduto = async (slug, produto) => {
    const lojaAlvo = lojas[slug];
    if (!lojaAlvo) return;

    if (lojaAlvo.dono_id) {
      if (produto.id && typeof produto.id === 'string') {
        await supabase
          .from('itens')
          .update({
            nome: produto.nome,
            descricao: produto.descricao,
            preco: produto.preco,
            duracao_minutos: produto.duracao_minutos || 30
          })
          .eq('id', produto.id);
      } else {
        await supabase.from('itens').insert([
          {
            loja_id: lojaAlvo.id,
            categoria_id: produto.categoriaId,
            tag: produto.tag || 'Destaque',
            nome: produto.nome,
            descricao: produto.descricao,
            preco: produto.preco,
            duracao_minutos: produto.duracao_minutos || 30
          }
        ]);
      }
      await carregarDadosNuvem(usuario);
    } else {
      setLojas((prev) => {
        const atual = prev[slug];
        const existe = atual.produtos.some((p) => p.id === produto.id);
        const novos = existe
          ? atual.produtos.map((p) => (p.id === produto.id ? produto : p))
          : [...atual.produtos, { ...produto, id: Date.now() }];
        return { ...prev, [slug]: { ...atual, produtos: novos } };
      });
    }
  };

  const removerProduto = async (slug, produtoId) => {
    const lojaAlvo = lojas[slug];
    if (!lojaAlvo) return;

    if (lojaAlvo.dono_id) {
      await supabase.from('itens').delete().eq('id', produtoId);
      await carregarDadosNuvem(usuario);
    } else {
      setLojas((prev) => ({
        ...prev,
        [slug]: {
          ...prev[slug],
          produtos: prev[slug].produtos.filter((p) => p.id !== produtoId)
        }
      }));
    }
  };

  const adicionarCupom = async (slug, codigo, descontoPercentual) => {
    const lojaAlvo = lojas[slug];
    if (!lojaAlvo) return;

    if (lojaAlvo.dono_id) {
      await supabase.from('cupons').insert([
        {
          loja_id: lojaAlvo.id,
          codigo: codigo.toUpperCase(),
          desconto_percentual: Number(descontoPercentual)
        }
      ]);
      await carregarDadosNuvem(usuario);
    }
  };

  const removerCupom = async (slug, codigoOuId) => {
    const lojaAlvo = lojas[slug];
    if (!lojaAlvo) return;

    if (lojaAlvo.dono_id) {
      await supabase.from('cupons').delete().eq('loja_id', lojaAlvo.id).eq('codigo', codigoOuId);
      await carregarDadosNuvem(usuario);
    }
  };

  const adicionarProfissional = async (lojaId, nome, especialidade) => {
    await supabase.from('profissionais').insert([{ loja_id: lojaId, nome, especialidade }]);
    await carregarDadosNuvem(usuario);
  };

  const removerProfissional = async (profissionalId) => {
    await supabase.from('profissionais').delete().eq('id', profissionalId);
    await carregarDadosNuvem(usuario);
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
        atualizarConfigLoja,
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