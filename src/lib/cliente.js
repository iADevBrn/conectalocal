// Cliente API — camada fina sobre as RPCs do Supabase para o freguês (cliente final)
import { supabase } from './supabase';

const RPC = {
  // Perfil
  ensureProfile: 'ensure_cliente_profile',
  getPerfil: 'get_meu_perfil',
  atualizarPerfil: 'atualizar_meu_perfil',

  // Endereços
  addEndereco: 'adicionar_endereco',
  updateEndereco: 'atualizar_endereco',
  deleteEndereco: 'remover_endereco',

  // Favoritos
  toggleFavorito: 'toggle_favorito',
  listarFavoritos: 'listar_favoritos',

  // Pedidos
  registrarPedido: 'registrar_pedido',
  listarPedidos: 'listar_meus_pedidos',
  listarPedidosLoja: 'listar_pedidos_loja',

  // Fidelidade
  resgatarPontos: 'resgatar_pontos_fidelidade',
  listarMovimentacoes: 'listar_fidelidade_movimentacoes',
};

// Helper para chamar RPC com tratamento de erro padronizado
async function rpc(fn, params = {}) {
  const { data, error } = await supabase.rpc(fn, params);
  if (error) throw error;
  return data;
}

// ==================== AUTENTICAÇÃO ====================

// Envia magic link para o email do cliente
export async function enviarMagicLink(email, redirectTo) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true,
    },
  });
  if (error) throw error;
}

// Envia OTP via WhatsApp (usa phone sign-in do Supabase)
export async function enviarOtpWhatsApp(phone, _redirectTo) {
  const { error } = await supabase.auth.signInWithOtp({
    phone: phone.startsWith('+') ? phone : `+55${phone.replace(/\D/g, '')}`,
    options: {
      shouldCreateUser: true,
    },
  });
  if (error) throw error;
}

// Verifica se há sessão ativa e recupera o usuário
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// Recupera o usuário logado (se houver sessão)
export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Logout
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Escuta mudanças de autenticação
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

// ==================== PERFIL ====================

// Garante que o perfil exista (chamado após login, cria se não existir)
export async function ensureProfile(lojaSlug, nome, telefone) {
  return rpc(RPC.ensureProfile, { p_loja_slug: lojaSlug, p_nome: nome, p_telefone: telefone });
}

// Busca perfil completo do cliente logado
export async function getMeuPerfil(lojaSlug) {
  return rpc(RPC.getPerfil, { p_loja_slug: lojaSlug });
}

// Atualiza perfil
export async function atualizarMeuPerfil(lojaSlug, dados) {
  return rpc(RPC.atualizarPerfil, { p_loja_slug: lojaSlug, ...dados });
}

// ==================== ENDEREÇOS ====================

export async function adicionarEndereco(lojaSlug, endereco) {
  return rpc(RPC.addEndereco, { p_loja_slug: lojaSlug, ...endereco });
}

export async function atualizarEndereco(enderecoId, dados) {
  return rpc(RPC.updateEndereco, { p_endereco_id: enderecoId, ...dados });
}

export async function removerEndereco(enderecoId) {
  return rpc(RPC.deleteEndereco, { p_endereco_id: enderecoId });
}

// ==================== FAVORITOS ====================

export async function toggleFavorito(lojaSlug, itemId) {
  return rpc(RPC.toggleFavorito, { p_loja_slug: lojaSlug, p_item_id: itemId });
}

export async function listarFavoritos(lojaSlug) {
  return rpc(RPC.listarFavoritos, { p_loja_slug: lojaSlug });
}

// ==================== PEDIDOS ====================

export async function registrarPedido(lojaSlug, pedido) {
  return rpc(RPC.registrarPedido, { p_loja_slug: lojaSlug, ...pedido });
}

export async function listarMeusPedidos(lojaSlug, limite = 20, offset = 0) {
  return rpc(RPC.listarPedidos, { p_loja_slug: lojaSlug, p_limite: limite, p_offset: offset });
}

// Para lojista/admin: lista pedidos da loja
export async function listarPedidosLoja(lojaSlug, limite = 50, offset = 0, status = null) {
  return rpc(RPC.listarPedidosLoja, { p_loja_slug: lojaSlug, p_limite: limite, p_offset: offset, p_status: status });
}

// ==================== FIDELIDADE ====================

export async function resgatarPontosFidelidade(lojaSlug, pontos) {
  return rpc(RPC.resgatarPontos, { p_loja_slug: lojaSlug, p_pontos: pontos });
}

export async function listarFidelidadeMovimentacoes(lojaSlug, limite = 50) {
  return rpc(RPC.listarMovimentacoes, { p_loja_slug: lojaSlug, p_limite: limite });
}

// ==================== UTILITÁRIOS ====================

// Formata moeda: R$ XX,XX
export function formatarMoeda(valor) {
  return 'R$ ' + Number(valor).toFixed(2).replace('.', ',');
}

// Formata telefone para exibição: (DD) 9XXXX-XXXX
export function formatarTelefoneExibicao(tel) {
  const digits = String(tel || '').replace(/\D/g, '');
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return tel;
}

// Formata CEP: XXXXX-XXX
export function formatarCep(cep) {
  const digits = String(cep || '').replace(/\D/g, '');
  if (digits.length === 8) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return cep;
}

// Gera avatar inicial (fallback se não tiver foto)
export function gerarAvatarIniciais(nome) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() || '')
    .join('');
}

// Valida se o usuário é cliente da loja (tem perfil na loja)
export async function verificarClienteDaLoja(lojaSlug) {
  const user = await getUser();
  if (!user) return false;
  try {
    const perfil = await getMeuPerfil(lojaSlug);
    return !!perfil;
  } catch {
    return false;
  }
}