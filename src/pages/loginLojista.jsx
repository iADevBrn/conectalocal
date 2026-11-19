import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { normalizarTelefone } from '../lib/telefone';

// Links que já são rotas do sistema (ou que causariam confusão) não podem virar loja.
const SLUGS_RESERVADOS = [
  'admin', 'login', 'api', 'www', 'app', 'painel', 'cadastro', 'suporte', 'ajuda', 'termos', 'privacidade',
  'raizes', 'doceria-ana', 'conectalocal', 'contato', 'precos', 'planos', 'blog'
];

const normalizarTelefoneCliente = (valor) => {
  const digitos = valor.replace(/\D/g, '');
  const numeroNacional = digitos.startsWith('55') && [12, 13].includes(digitos.length)
    ? digitos.slice(2)
    : digitos;
  if (numeroNacional.length < 10 || numeroNacional.length > 11) {
    throw new Error('Informe um número de WhatsApp válido com DDD.');
  }
  return `+55${numeroNacional}`;
};

export default function LoginLojista() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tipo = searchParams.get('tipo') || 'lojista'; // 'lojista' | 'cliente'

  const [modoCadastro, setModoCadastro] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  // Campos de acesso
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [metodoCliente, setMetodoCliente] = useState('email');
  const [codigoCliente, setCodigoCliente] = useState('');
  const [codigoClienteEnviado, setCodigoClienteEnviado] = useState(false);

  // Campos da loja (usados no cadastro de lojista)
  const [nomeLoja, setNomeLoja] = useState('');
  const [slug, setSlug] = useState('');
  const [telefone, setTelefone] = useState('');
  const [modoNegocio, setModoNegocio] = useState('catalogo');

  const formatarSlug = (texto) =>
    texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
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
      if (tipo === 'cliente') {
        if (metodoCliente === 'email') {
          const { error } = await supabase.auth.signInWithOtp({
            email: email.trim(),
            options: {
              emailRedirectTo: `${window.location.origin}/`,
              shouldCreateUser: true,
            },
          });
          if (error) throw error;
          setAviso('Verifique seu e-mail e clique no link para entrar.');
        } else if (codigoClienteEnviado) {
          const tel = normalizarTelefoneCliente(telefone);
          const { error } = await supabase.auth.verifyOtp({
            phone: tel,
            token: codigoCliente.trim(),
            type: 'sms',
          });
          if (error) throw error;
          navigate('/');
        } else {
          const tel = normalizarTelefoneCliente(telefone);
          const { error } = await supabase.auth.signInWithOtp({
            phone: tel,
            options: { shouldCreateUser: true },
          });
          if (error) throw error;
          setCodigoClienteEnviado(true);
          setAviso('Código enviado. Digite-o abaixo para concluir o acesso.');
        }
        return;
      }

      // --- FLUXO LOJISTA ---
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

        const { data: disponivel, error: slugError } = await supabase.rpc('slug_disponivel', { p_slug: slug });
        if (slugError) throw slugError;
        if (!disponivel) throw new Error('Esse link já está em uso ou é reservado. Escolha outro.');

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

  // Detecta se veio de magic link/OTP (session na URL)
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && tipo !== 'cliente') {
        navigate('/admin');
      }
    };
    checkSession();
  }, [navigate, tipo]);

  const isCliente = tipo === 'cliente';
  const selecionarMetodoCliente = (metodo) => {
    setMetodoCliente(metodo);
    setEmail('');
    setTelefone('');
    setCodigoCliente('');
    setCodigoClienteEnviado(false);
    setErro('');
    setAviso('');
  };

  return (
    <div className="auth">
      <aside className="auth-side">
        <Link to="/" className="lp-logo">
          <svg width="38" height="38" viewBox="0 0 38 38" fill="none" aria-hidden="true"><rect width="38" height="38" rx="10" fill="#0a0a0a"/><path d="M11 19h16M19 11v16" stroke="white" strokeWidth="3" strokeLinecap="round"/></svg>
          ConectaLocal
        </Link>

        <div style={{ position: 'relative', zIndex: 1 }}>
          {isCliente ? (
            <>
              <h2>Acesse sua conta de cliente</h2>
              <ul className="auth-list">
                <li><i className="fa-solid fa-check" /> Veja seu histórico de pedidos</li>
                <li><i className="fa-solid fa-check" /> Gerencie seus endereços de entrega</li>
                <li><i className="fa-solid fa-check" /> Acompanhe seus pontos de fidelidade</li>
                <li><i className="fa-solid fa-check" /> Seus favoritos salvos</li>
              </ul>
            </>
          ) : (
            <>
              <h2>Sua vitrine com a cara do seu negócio.</h2>
              <ul className="auth-list">
                <li><i className="fa-solid fa-check" /> Link próprio para colocar no Instagram e no WhatsApp</li>
                <li><i className="fa-solid fa-check" /> Pedidos ou agendamentos direto no seu WhatsApp</li>
                <li><i className="fa-solid fa-check" /> Cores, fontes e estilo do jeito que você quiser</li>
                <li><i className="fa-solid fa-check" /> Painel simples, feito para o celular</li>
              </ul>
            </>
          )}
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {isCliente ? (
            <Link to="/login" className="btn btn-ghost btn-sm" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}>
              <i className="fa-solid fa-store" /> Sou lojista
            </Link>
          ) : (
            <Link to="/login?tipo=cliente" className="btn btn-ghost btn-sm" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}>
              <i className="fa-solid fa-user" /> Sou cliente
            </Link>
          )}
        </div>

        <small style={{ opacity: 0.75, position: 'relative', zIndex: 1 }}>© 2026 ConectaLocal</small>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          {isCliente ? (
            <>
              <h1>Entre na sua conta</h1>
              <p>Receba um código mágico por e-mail ou WhatsApp. Sem senha, sem complicação.</p>

              {erro && <div className="alert alert-error" role="alert">{erro}</div>}
              {aviso && <div className="alert alert-ok" role="status">{aviso}</div>}

              <form onSubmit={handleSubmit}>
                <div className="choice-grid" role="group" aria-label="Método de acesso">
                  <button type="button" className="choice" aria-pressed={metodoCliente === 'email'} onClick={() => selecionarMetodoCliente('email')}>
                    <i className="fa-solid fa-envelope" />
                    <strong>E-mail</strong>
                    <small>Link mágico na sua caixa de entrada</small>
                  </button>
                  <button type="button" className="choice" aria-pressed={metodoCliente === 'whatsapp'} onClick={() => selecionarMetodoCliente('whatsapp')}>
                    <i className="fa-brands fa-whatsapp" />
                    <strong>WhatsApp</strong>
                    <small>Código via SMS/WhatsApp</small>
                  </button>
                </div>

                {metodoCliente === 'whatsapp' && codigoClienteEnviado ? (
                  <>
                    <label className="field">
                      <span>Código de verificação</span>
                      <input
                        type="text"
                        value={codigoCliente}
                        onChange={(e) => setCodigoCliente(e.target.value)}
                        placeholder="Digite o código recebido"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={8}
                        required
                      />
                      <small>Enviamos um código para o WhatsApp informado.</small>
                    </label>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => {
                        setCodigoCliente('');
                        setCodigoClienteEnviado(false);
                        setAviso('');
                        setErro('');
                      }}
                    >
                      Alterar número
                    </button>
                  </>
                ) : (
                  <label className="field">
                    <span>{metodoCliente === 'whatsapp' ? 'WhatsApp (com DDD)' : 'E-mail de acesso'}</span>
                    <input
                      type={metodoCliente === 'whatsapp' ? 'tel' : 'email'}
                      value={metodoCliente === 'whatsapp' ? telefone : email}
                      onChange={(e) => metodoCliente === 'whatsapp' ? setTelefone(e.target.value) : setEmail(e.target.value)}
                      placeholder={metodoCliente === 'whatsapp' ? '(43) 99999-9999' : 'seu@email.com'}
                      inputMode={metodoCliente === 'whatsapp' ? 'tel' : 'email'}
                      autoComplete={metodoCliente === 'whatsapp' ? 'tel' : 'email'}
                      required
                    />
                  </label>
                )}

                <button type="submit" disabled={carregando} className="btn btn-primary btn-block btn-lg">
                  {carregando
                    ? (codigoClienteEnviado ? 'Verificando...' : 'Enviando...')
                    : codigoClienteEnviado
                      ? 'Confirmar código'
                      : `Enviar código por ${metodoCliente === 'whatsapp' ? 'WhatsApp' : 'e-mail'}`}
                </button>
              </form>

              <p className="login-hint">
                Ao continuar, você concorda com nossos <a href="/termos" target="_blank">Termos de Uso</a> e <a href="/privacidade" target="_blank">Política de Privacidade</a>.
              </p>
            </>
          ) : (
            <>
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
            </>
          )}
          <Link to="/" className="auth-back">← Voltar ao início</Link>
        </div>
      </main>
    </div>
  );
}