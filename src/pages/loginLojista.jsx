import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { normalizarTelefone } from '../lib/telefone';

// Links que já são rotas do sistema (ou que causariam confusão) não podem virar loja.
// (A lista oficial fica no banco, em slug_disponivel; esta evita uma ida ao servidor.)
const SLUGS_RESERVADOS = [
  'admin', 'login', 'api', 'www', 'app', 'painel', 'cadastro', 'suporte', 'ajuda', 'termos', 'privacidade',
  'raizes', 'doceria-ana', 'conectalocal', 'contato', 'precos', 'planos', 'blog'
];

export default function LoginLojista() {
  const navigate = useNavigate();
  const [modoCadastro, setModoCadastro] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  // Campos de acesso
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  // Campos da loja (usados no cadastro)
  const [nomeLoja, setNomeLoja] = useState('');
  const [slug, setSlug] = useState('');
  const [telefone, setTelefone] = useState('');
  const [modoNegocio, setModoNegocio] = useState('catalogo');

  const formatarSlug = (texto) =>
    texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
      .slice(0, 40);

  const handleNomeChange = (valor) => {
    setNomeLoja(valor);
    setSlug(formatarSlug(valor));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setAviso('');
    setCarregando(true);

    try {
      if (!modoCadastro) {
        // LOGIN DE LOJISTA EXISTENTE
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        navigate('/admin');
      } else {
        // CADASTRO DE NOVO LOJISTA + CRIAÇÃO DA LOJA
        if (slug.length < 3) throw new Error('O link da loja precisa ter pelo menos 3 caracteres.');
        if (SLUGS_RESERVADOS.includes(slug)) throw new Error('Esse link é reservado pelo sistema. Escolha outro.');
        if (telefone.replace(/\D/g, '').length < 10) throw new Error('Informe o WhatsApp com DDD.');

        // Confere o link ANTES de criar a conta (evita conta sem loja).
        const { data: disponivel, error: slugError } = await supabase.rpc('slug_disponivel', { p_slug: slug });
        if (slugError) throw slugError;
        if (!disponivel) throw new Error('Esse link já está em uso ou é reservado. Escolha outro.');

        // Os dados da loja viajam junto com o cadastro; um trigger no banco cria a loja e a
        // categoria padrão na mesma transação da conta (funciona com ou sem confirmação de e-mail).
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password: senha,
          options: {
            data: {
              nome_loja: nomeLoja.trim(),
              slug,
              modo: modoNegocio,
              telefone: normalizarTelefone(telefone)
            }
          }
        });
        if (authError) throw authError;

        // E-mail já cadastrado: o Supabase não dá erro, devolve usuário sem identidades.
        if (authData.user && authData.user.identities?.length === 0) {
          throw new Error('Este e-mail já está cadastrado. Faça login.');
        }

        if (!authData.session) {
          setAviso('Conta criada e loja reservada! Confirme seu e-mail e depois faça login.');
          return;
        }

        navigate('/admin');
      }
    } catch (err) {
      const traducoes = {
        'Invalid login credentials': 'E-mail ou senha incorretos.',
        'User already registered': 'Este e-mail já está cadastrado. Faça login.',
        'Email not confirmed': 'Confirme seu e-mail antes de entrar.'
      };
      setErro(traducoes[err.message] || err.message || 'Ocorreu um erro. Verifique seus dados.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="auth">
      <aside className="auth-side">
        <Link to="/" className="lp-logo">
          <svg width="38" height="38" viewBox="0 0 38 38" fill="none" aria-hidden="true"><rect width="38" height="38" rx="10" fill="currentColor"/><path d="M11 19h16M19 11v16" stroke="white" stroke-width="3" stroke-linecap="round"/></svg>
          ConectaLocal
        </Link>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2>Sua vitrine com a cara do seu negócio.</h2>
          <ul className="auth-list">
            <li><i className="fa-solid fa-check" /> Link próprio para colocar no Instagram e no WhatsApp</li>
            <li><i className="fa-solid fa-check" /> Pedidos ou agendamentos direto no seu WhatsApp</li>
            <li><i className="fa-solid fa-check" /> Cores, fontes e estilo do jeito que você quiser</li>
            <li><i className="fa-solid fa-check" /> Painel simples, feito para o celular</li>
          </ul>
        </div>

        <small style={{ opacity: 0.75, position: 'relative', zIndex: 1 }}>© 2026 ConectaLocal</small>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <h1>{modoCadastro ? 'Crie sua vitrine' : 'Bem-vindo de volta'}</h1>
          <p>
            {modoCadastro
              ? 'Em poucos minutos seu negócio estará no ar.'
              : 'Entre com seu e-mail e senha para gerenciar seu negócio.'}
          </p>

          {erro && <div className="alert alert-error" role="alert">{erro}</div>}
          {aviso && <div className="alert alert-ok" role="status">{aviso}</div>}

          <form onSubmit={handleSubmit}>
            {modoCadastro && (
              <>
                <div className="choice-grid" role="group" aria-label="Tipo de negócio">
                  <button type="button" className="choice" aria-pressed={modoNegocio === 'catalogo'} onClick={() => setModoNegocio('catalogo')}>
                    <i className="fa-solid fa-utensils" />
                    <strong>Cardápio</strong>
                    <small>Restaurante, doceria, loja</small>
                  </button>
                  <button type="button" className="choice" aria-pressed={modoNegocio === 'agendamento'} onClick={() => setModoNegocio('agendamento')}>
                    <i className="fa-solid fa-calendar-check" />
                    <strong>Agendamento</strong>
                    <small>Barbearia, estética, clínica</small>
                  </button>
                </div>

                <label className="field">
                  <span>Nome do estabelecimento</span>
                  <input value={nomeLoja} onChange={(e) => handleNomeChange(e.target.value)} placeholder="Ex: Barbearia Don Leon" maxLength={80} required />
                </label>

                <label className="field">
                  <span>Link da sua loja</span>
                  <div className="input-prefix">
                    <span>conectalocal.com.br/</span>
                    <input value={slug} onChange={(e) => setSlug(formatarSlug(e.target.value))} placeholder="sua-loja" required />
                  </div>
                  <small>Só letras minúsculas, números e hífen.</small>
                </label>

                <label className="field">
                  <span>WhatsApp (com DDD)</span>
                  <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="43999999999" inputMode="tel" required />
                </label>
              </>
            )}

            <label className="field">
              <span>E-mail de acesso</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seuemail@exemplo.com" autoComplete="email" required />
            </label>

            <label className="field">
              <span>Senha</span>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder={modoCadastro ? 'Mínimo 8 caracteres' : 'Sua senha'}
                minLength={modoCadastro ? 8 : undefined}
                autoComplete={modoCadastro ? 'new-password' : 'current-password'}
                required
              />
            </label>

            <button type="submit" disabled={carregando} className="btn btn-primary btn-block btn-lg">
              {carregando ? 'Aguarde...' : modoCadastro ? 'Criar minha conta e loja' : 'Entrar no painel'}
            </button>
          </form>

          <div className="auth-switch">
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setModoCadastro(!modoCadastro);
                setErro('');
                setAviso('');
              }}
            >
              {modoCadastro ? 'Já tenho uma conta? Fazer login' : 'Ainda não tem vitrine? Cadastre-se'}
            </button>
          </div>
          <Link to="/" className="auth-back">← Voltar ao início</Link>
        </div>
      </main>
    </div>
  );
}
