import { useState, useEffect, useCallback, useRef } from 'react';
import { ClienteContext } from './clienteContextApi';
import { supabase } from '../lib/supabase';
import { normalizarTelefone } from '../lib/telefone';
import {
  getSession,
  signOut as doSignOut,
  onAuthStateChange,
  ensureProfile,
  getMeuPerfil,
  atualizarMeuPerfil,
  adicionarEndereco,
  atualizarEndereco,
  removerEndereco,
  toggleFavorito,
  listarFavoritos,
  registrarPedido,
  listarMeusPedidos,
  resgatarPontosFidelidade,
  listarFidelidadeMovimentacoes,
  verificarClienteDaLoja,
} from '../lib/cliente';

export function ClienteProvider({ children }) {
  const [cliente, setCliente] = useState(null);        // perfil completo (inclui endereços, fidelidade)
  const [usuario, setUsuario] = useState(null);        // auth.user (do Supabase Auth)
  const [carregando, setCarregando] = useState(true);
  const [carregandoPerfil, setCarregandoPerfil] = useState(false);
  const [lojaSlugAtual, setLojaSlugAtual] = useState(null);
  const usuarioRef = useRef(null);
  const clienteRef = useRef(null);

  // Carrega o perfil do cliente logado para a loja atual
  const carregarPerfil = useCallback(async (slug) => {
    if (!slug || !usuarioRef.current) {
      setCliente(null);
      clienteRef.current = null;
      setCarregandoPerfil(false);
      return;
    }
    setCarregandoPerfil(true);
    try {
      const perfil = await getMeuPerfil(slug);
      setCliente(perfil);
      clienteRef.current = perfil;
    } catch (err) {
      console.error('Erro ao carregar perfil do cliente:', err);
      setCliente(null);
      clienteRef.current = null;
    } finally {
      setCarregandoPerfil(false);
    }
  }, []);

  // Sincroniza auth.state → perfil
  useEffect(() => {
    let ativo = true;

    const init = async () => {
      const session = await getSession();
      const user = session?.user ?? null;
      usuarioRef.current = user;
      setUsuario(user);
      if (user && lojaSlugAtual) {
        await carregarPerfil(lojaSlugAtual);
      }
      if (ativo) setCarregando(false);
    };

    init();

    const { data: listener } = onAuthStateChange((evento, session) => {
      if (evento === 'INITIAL_SESSION' || evento === 'TOKEN_REFRESHED') return;
      const user = session?.user ?? null;
      usuarioRef.current = user;
      setUsuario(user);
      if (user && lojaSlugAtual) {
        carregarPerfil(lojaSlugAtual);
      } else {
        setCliente(null);
        clienteRef.current = null;
        setCarregandoPerfil(false);
      }
    });

    return () => {
      ativo = false;
      listener.subscription.unsubscribe();
    };
  }, [lojaSlugAtual, carregarPerfil]);

  // Define a loja atual (chamado pela VitrineLoja)
  const definirLojaAtual = useCallback((slug) => {
    setLojaSlugAtual(slug);
    if (usuarioRef.current && slug) {
      carregarPerfil(slug);
    }
  }, [carregarPerfil]);

  // Login via Magic Link (email)
  const loginComEmail = async (email, redirectTo) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });
    if (error) throw error;
  };

  // Login via WhatsApp (OTP SMS)
  const loginComWhatsApp = async (telefone) => {
    const numero = normalizarTelefone(telefone);
    if (![12, 13].includes(numero.length)) throw new Error('Informe um número de WhatsApp válido com DDD.');
    const { error } = await supabase.auth.signInWithOtp({
      phone: `+${numero}`,
      options: { shouldCreateUser: true },
    });
    if (error) throw error;
  };

  const verificarCodigoWhatsApp = async (telefone, codigo) => {
    const numero = normalizarTelefone(telefone);
    if (![12, 13].includes(numero.length)) throw new Error('Informe um número de WhatsApp válido com DDD.');
    const { error } = await supabase.auth.verifyOtp({
      phone: `+${numero}`,
      token: codigo.trim(),
      type: 'sms',
    });
    if (error) throw error;
  };

  // Completa o cadastro do cliente (chamado após o magic link/OTP redirecionar de volta)
  const completarCadastro = async (slug, nome, telefone) => {
    if (!usuarioRef.current) throw new Error('Usuário não autenticado');
    await ensureProfile(slug, nome, telefone);
    await carregarPerfil(slug);
  };

  // Logout
  const sair = async () => {
    await doSignOut();
    setUsuario(null);
    setCliente(null);
    usuarioRef.current = null;
    clienteRef.current = null;
    setCarregandoPerfil(false);
  };

  // Atualiza perfil
  const salvarPerfil = async (dados) => {
    if (!lojaSlugAtual) throw new Error('Loja não definida');
    const perfil = await atualizarMeuPerfil(lojaSlugAtual, dados);
    setCliente(perfil);
    clienteRef.current = perfil;
    return perfil;
  };

  // Endereços
  const addEndereco = async (endereco) => {
    if (!lojaSlugAtual) throw new Error('Loja não definida');
    const id = await adicionarEndereco(lojaSlugAtual, endereco);
    await carregarPerfil(lojaSlugAtual);
    return id;
  };

  const editEndereco = async (id, dados) => {
    await atualizarEndereco(id, dados);
    await carregarPerfil(lojaSlugAtual);
  };

  const deleteEndereco = async (id) => {
    await removerEndereco(id);
    await carregarPerfil(lojaSlugAtual);
  };

  // Favoritos
  const toggleFav = async (itemId) => {
    if (!lojaSlugAtual) throw new Error('Loja não definida');
    const adicionado = await toggleFavorito(lojaSlugAtual, itemId);
    await carregarPerfil(lojaSlugAtual);
    return adicionado;
  };

  const getFavoritos = async () => {
    if (!lojaSlugAtual) return [];
    return listarFavoritos(lojaSlugAtual);
  };

  const isFavorito = (itemId) => {
    return cliente?.favoritos?.some?.(f => f.id === itemId) ?? false;
  };

  // Pedidos
  const criarPedido = async (pedido) => {
    if (!lojaSlugAtual) throw new Error('Loja não definida');
    return registrarPedido(lojaSlugAtual, pedido);
  };

  const getPedidos = async (limite = 20, offset = 0) => {
    if (!lojaSlugAtual) return [];
    return listarMeusPedidos(lojaSlugAtual, limite, offset);
  };

  // Fidelidade
  const resgatarPontos = async (pontos) => {
    if (!lojaSlugAtual) throw new Error('Loja não definida');
    const resultado = await resgatarPontosFidelidade(lojaSlugAtual, pontos);
    await carregarPerfil(lojaSlugAtual);
    return resultado;
  };

  const getMovimentacoesFidelidade = async (limite = 50) => {
    if (!lojaSlugAtual) return [];
    return listarFidelidadeMovimentacoes(lojaSlugAtual, limite);
  };

  // Verifica se o usuário logado é cliente desta loja
  const ehClienteDaLoja = async (slug) => {
    return verificarClienteDaLoja(slug);
  };

  return (
    <ClienteContext.Provider
      value={{
        // Estado
        cliente,
        usuario,
        carregando,
        carregandoPerfil,
        lojaSlugAtual,

        // Auth
        loginComEmail,
        loginComWhatsApp,
        verificarCodigoWhatsApp,
        completarCadastro,
        sair,

        // Loja atual
        definirLojaAtual,

        // Perfil
        salvarPerfil,

        // Endereços
        addEndereco,
        editEndereco,
        deleteEndereco,

        // Favoritos
        toggleFav,
        getFavoritos,
        isFavorito,

        // Pedidos
        criarPedido,
        getPedidos,

        // Fidelidade
        resgatarPontos,
        getMovimentacoesFidelidade,

        // Utilitários
        ehClienteDaLoja,
        recarregar: () => lojaSlugAtual && carregarPerfil(lojaSlugAtual),
      }}
    >
      {children}
    </ClienteContext.Provider>
  );
}
