import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function LoginLojista() {
  const navigate = useNavigate();
  const [modoCadastro, setModoCadastro] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  // Campos de acesso
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  // Campos da loja (usados no cadastro)
  const [nomeLoja, setNomeLoja] = useState('');
  const [slug, setSlug] = useState('');
  const [telefone, setTelefone] = useState('');
  const [modoNegocio, setModoNegocio] = useState('catalogo');

  const formatarSlug = (texto) => {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  };

  const handleNomeChange = (valor) => {
    setNomeLoja(valor);
    setSlug(formatarSlug(valor));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      if (!modoCadastro) {
        // LOGIN DE LOJISTA EXISTENTE
        const { error } = await supabase.auth.signInWithPassword({ email, senha });
        if (error) throw error;
        navigate('/admin');
      } else {
        // CADASTRO DE NOVO LOJISTA + CRIAÇÃO DA LOJA
        if (!slug) throw new Error('Defina um link válido para sua loja.');

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          senha
        });
        if (authError) throw authError;

        const userId = authData.user?.id;
        if (!userId) throw new Error('Erro ao identificar usuário criado.');

        // 1. Insere a loja na nuvem
        const { data: novaLoja, error: lojaError } = await supabase
          .from('lojas')
          .insert([
            {
              dono_id: userId,
              slug,
              nome: nomeLoja,
              subtitulo: modoNegocio === 'agendamento' ? 'AGENDAMENTO ONLINE' : 'PEDIDOS ONLINE',
              modo: modoNegocio,
              telefone: telefone.replace(/\D/g, '')
            }
          ])
          .select()
          .single();

        if (lojaError) {
          if (lojaError.code === '23505') {
            throw new Error('Esse link (slug) já está em uso. Escolha outro.');
          }
          throw lojaError;
        }

        // 2. Cria uma categoria padrão para a loja não começar vazia
        await supabase.from('categorias').insert([
          {
            loja_id: novaLoja.id,
            nome: modoNegocio === 'agendamento' ? 'Serviços Principais' : 'Destaques',
            ordem: 1
          }
        ]);

        navigate('/admin');
      }
    } catch (err) {
      setErro(err.message || 'Ocorreu um erro. Verifique seus dados.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f4', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="checkout-card" style={{ width: '100%', maxWidth: '460px', background: '#fff', padding: '2.25rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '2px', color: '#b45309', textTransform: 'uppercase' }}>
            ConectaLocal
          </span>
          <h2 style={{ marginTop: '0.35rem', fontSize: '1.75rem' }}>
            {modoCadastro ? 'Criar Minha Vitrine' : 'Painel do Lojista'}
          </h2>
          <p style={{ color: '#78716c', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            {modoCadastro
              ? 'Configure seu cardápio ou agenda em menos de 1 minuto.'
              : 'Entre com seu e-mail e senha para gerenciar seu negócio.'}
          </p>
        </div>

        {erro && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.75rem 1rem', borderRadius: '0.6rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {modoCadastro && (
            <>
              <label className="field">
                <span>Tipo de Negócio</span>
                <select
                  value={modoNegocio}
                  onChange={(e) => setModoNegocio(e.target.value)}
                  style={{ padding: '0.75rem', borderRadius: '0.6rem', border: '1px solid #d6d3d1', fontWeight: 600 }}
                >
                  <option value="catalogo">Cardápio / Catálogo (Restaurante, Doceria, Loja)</option>
                  <option value="agendamento">Agendamento de Horários (Barbearia, Estética, Clínica)</option>
                </select>
              </label>

              <label className="field">
                <span>Nome do Estabelecimento</span>
                <input
                  value={nomeLoja}
                  onChange={(e) => handleNomeChange(e.target.value)}
                  placeholder="Ex: Barbearia Don Leon"
                  required
                />
              </label>

              <label className="field">
                <span>Link Personalizado da sua Loja</span>
                <div style={{ display: 'flex', alignItems: 'center', background: '#fafaf9', border: '1px solid #d6d3d1', borderRadius: '0.6rem', padding: '0 0.75rem' }}>
                  <span style={{ color: '#78716c', fontSize: '0.85rem' }}>conectalocal.com.br/</span>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(formatarSlug(e.target.value))}
                    placeholder="sua-loja"
                    required
                    style={{ border: 'none', background: 'transparent', padding: '0.7rem 0.25rem', flex: 1, outline: 'none', fontWeight: 600 }}
                  />
                </div>
              </label>

              <label className="field">
                <span>WhatsApp (com DDD)</span>
                <input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="43999999999"
                  required
                />
              </label>
            </>
          )}

          <label className="field">
            <span>E-mail de Acesso</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@exemplo.com"
              required
            />
          </label>

          <label className="field">
            <span>Senha</span>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              minLength={6}
              required
            />
          </label>

          <button
            type="submit"
            disabled={carregando}
            className="btn-primary"
            style={{ width: '100%', border: 'none', cursor: 'pointer', marginTop: '0.5rem' }}
          >
            {carregando ? 'Aguarde...' : modoCadastro ? 'Criar Minha Conta e Loja' : 'Entrar no Painel'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid #e7e5e4' }}>
          <button
            type="button"
            onClick={() => {
              setModoCadastro(!modoCadastro);
              setErro('');
            }}
            style={{ background: 'none', border: 'none', color: '#b45309', fontWeight: 600, cursor: 'pointer' }}
          >
            {modoCadastro ? 'Já tenho uma conta? Fazer Login' : 'Ainda não tem vitrine? Cadastre-se grátis'}
          </button>
        </div>
      </div>
    </div>
  );
}