import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useLojas } from '../context/lojaContext';
import { useCliente } from '../context/clienteContext';
import { supabase } from '../lib/supabase';
import { normalizarTelefone } from '../lib/telefone';
import { lerTema } from '../lib/tema';
import { formatarTelefoneExibicao, gerarAvatarIniciais } from '../lib/cliente';
import AgendaBarbearia from '../components/agendaBarbearia';
import TemaLoja from '../components/TemaLoja';
import HeroLoja from '../components/HeroLoja';

const formatarMoeda = (valor) => 'R$ ' + Number(valor).toFixed(2).replace('.', ',');

export default function VitrineLoja() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { lojas, carregando, carregarLojaPorSlug } = useLojas();
  const {
    cliente,
    usuario,
    definirLojaAtual,
    loginComEmail,
    loginComWhatsApp,
    completarCadastro,
    sair,
    toggleFav,
    isFavorito,
    criarPedido,
  } = useCliente();
  const chave = slug || 'raizes';
  // Object.hasOwn evita que /constructor ou /toString resolvam para propriedades do Object.
  const loja = Object.hasOwn(lojas, chave) ? lojas[chave] : undefined;

  const [categoriaAtiva, setCategoriaAtiva] = useState('todos');
  const [sacola, setSacola] = useState([]);
  const [sacolaAberta, setSacolaAberta] = useState(false);
  const [cupomInput, setCupomInput] = useState('');
  const [cupomAplicado, setCupomAplicado] = useState(null);
  const [avisoToast, setAvisoToast] = useState('');
  const [buscando, setBuscando] = useState(true);
  const [mostrarLogin, setMostrarLogin] = useState(false);
  const [loginMetodo, setLoginMetodo] = useState('email'); // 'email' | 'whatsapp'
  const [loginValor, setLoginValor] = useState('');
  const [loginCarregando, setLoginCarregando] = useState(false);
  const [loginErro, setLoginErro] = useState('');
  const [completandoCadastro, setCompletandoCadastro] = useState(false);

  // Define a loja atual no contexto do cliente (para RPCs funcionarem)
  useEffect(() => {
    if (chave) definirLojaAtual(chave);
  }, [chave, definirLojaAtual]);

  // Carrega só a loja do link (antes o app baixava todas as lojas de todos os clientes).
  useEffect(() => {
    let ativo = true;
    carregarLojaPorSlug(chave).finally(() => {
      if (ativo) setBuscando(false);
    });
    return () => {
      ativo = false;
    };
  }, [chave, carregarLojaPorSlug]);

  useEffect(() => {
    if (!loja) return;
    document.title = `${loja.nome} | ConectaLocal`;
    return () => {
      document.title = 'ConectaLocal';
    };
  }, [loja]);

  // Após o magic link/OTP, o Supabase redireciona de volta com session.
  // O onAuthStateChange no ClienteContext já detecta e carrega o perfil.
  // Se for um novo usuário, precisamos completar o cadastro (nome + telefone).
  useEffect(() => {
    if (usuario && !cliente && loja) {
      setCompletandoCadastro(true);
    }
  }, [usuario, cliente, loja]);

  if (carregando || (buscando && !loja)) {
    return <div className="v-notfound">Carregando vitrine...</div>;
  }

  if (!loja) {
    return (
      <div className="v-notfound">
        <div>
          <h1>Loja não encontrada</h1>
          <p style={{ color: 'var(--muted)', margin: '0.5rem 0 1.25rem' }}>Verifique o link digitado.</p>
          <Link to="/" className="btn btn-primary">Ir para o início</Link>
        </div>
      </div>
    );
  }

  const tema = lerTema(loja);
  const isAgendamento = loja.modo === 'agendamento';

  const mostrarToast = (msg) => {
    setAvisoToast(msg);
    setTimeout(() => setAvisoToast(''), 2500);
  };

  const adicionarItem = (nome, preco, opcao = '') => {
    const id = `${nome}|${opcao}`.toLowerCase();
    setSacola((prev) => {
      const existente = prev.find((i) => i.id === id);
      if (existente) {
        return prev.map((i) => (i.id === id ? { ...i, quantidade: Math.min(i.quantidade + 1, 20) } : i));
      }
      return [...prev, { id, nome, opcao, preco, quantidade: 1 }];
    });
    mostrarToast(`${opcao ? `${nome} (${opcao})` : nome} adicionado à sacola.`);
  };

  const alterarQuantidade = (id, delta) => {
    setSacola((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, quantidade: Math.min(item.quantidade + delta, 20) } : item))
        .filter((item) => item.quantidade > 0)
    );
  };

  const aplicarCupom = async () => {
    const codigoLimpo = cupomInput.trim().toUpperCase();
    if (!codigoLimpo) return;

    let percentual = null;
    if (loja.dono_id) {
      const { data, error } = await supabase.rpc('validar_cupom', {
        p_loja_id: loja.id,
        p_codigo: codigoLimpo
      });
      if (!error && data) percentual = Number(data);
    } else {
      const encontrado = (loja.cupons || []).find((c) => c.codigo === codigoLimpo);
      if (encontrado) percentual = Number(encontrado.desconto_percentual ?? encontrado.descontoPercentual);
    }

    if (percentual && percentual > 0 && percentual <= 100) {
      setCupomAplicado({ codigo: codigoLimpo, descontoPercentual: percentual });
      mostrarToast(`Cupom ${codigoLimpo} aplicado (${percentual}% OFF)!`);
    } else {
      setCupomAplicado(null);
      mostrarToast('Cupom inválido ou expirado.');
    }
  };

  const subtotal = sacola.reduce((acc, item) => acc + item.preco * item.quantidade, 0);
  const valorDesconto = cupomAplicado ? subtotal * (cupomAplicado.descontoPercentual / 100) : 0;
  const totalFinal = subtotal - valorDesconto;
  const totalItens = sacola.reduce((acc, item) => acc + item.quantidade, 0);

  // Registra o pedido no banco (para histórico e fidelidade) e abre WhatsApp
  const finalizarWhatsApp = async () => {
    if (sacola.length === 0) return;

    // Se o cliente está logado, registra o pedido para histórico/fidelidade
    if (cliente) {
      try {
        const itensParaRegistro = sacola.map(item => {
          const prod = loja.produtos?.find(p => p.id === item.id.split('|')[0]) || {};
          return {
            item_id: prod.id || null,
            nome: item.nome,
            opcao: item.opcao || null,
            preco: item.preco,
            quantidade: item.quantidade,
            duracao_minutos: prod.duracao_minutos || 30,
          };
        });

        await criarPedido({
          p_itens: itensParaRegistro,
          p_subtotal: subtotal,
          p_desconto: valorDesconto,
          p_total: totalFinal,
          p_cupom_codigo: cupomAplicado?.codigo || null,
          p_cupom_desconto_pct: cupomAplicado?.descontoPercentual || null,
          p_taxa_entrega: 0,
          p_observacoes: null,
        });
      } catch (err) {
        console.warn('Falha ao registrar pedido (continua no WhatsApp):', err);
      }
    }

    let msg = `Olá! Gostaria de fazer o seguinte pedido em *${loja.nome}*:\n\n`;
    sacola.forEach((item) => {
      const label = item.nome + (item.opcao ? ` (${item.opcao})` : '');
      msg += `• ${item.quantidade}x ${label} - ${formatarMoeda(item.preco * item.quantidade)}\n`;
    });
    msg += `\nSubtotal: ${formatarMoeda(subtotal)}`;
    if (cupomAplicado) {
      msg += `\nCupom (${cupomAplicado.codigo}): -${formatarMoeda(valorDesconto)}`;
    }
    msg += `\n*Total: ${formatarMoeda(totalFinal)}*`;

    // Se logado e tem endereço padrão, adiciona na mensagem
    if (cliente?.enderecos?.length) {
      const endPadrao = cliente.enderecos.find(e => e.padrao) || cliente.enderecos[0];
      if (endPadrao) {
        msg += `\n\n📍 Entregar em: ${endPadrao.logradouro}, ${endPadrao.numero}${endPadrao.complemento ? `, ${endPadrao.complemento}` : ''} - ${endPadrao.bairro}, ${endPadrao.cidade}/${endPadrao.uf}`;
        if (endPadrao.referencia) msg += ` (${endPadrao.referencia})`;
      }
    }

    window.open(`https://wa.me/${normalizarTelefone(loja.telefone)}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  };

  // ---- AUTH HANDLERS ----
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginErro('');
    setLoginCarregando(true);
    try {
      const redirectTo = `${window.location.origin}/${loja.slug}`;
      if (loginMetodo === 'email') {
        await loginComEmail(loginValor, redirectTo);
        mostrarToast('Verifique seu e-mail e clique no link para entrar.');
      } else {
        await loginComWhatsApp(loginValor, redirectTo);
        mostrarToast('Código enviado por SMS/WhatsApp. Verifique suas mensagens.');
      }
      setMostrarLogin(false);
      setLoginValor('');
    } catch (err) {
      setLoginErro(err.message || 'Erro ao enviar código. Tente novamente.');
    } finally {
      setLoginCarregando(false);
    }
  };

  const handleTrocarMetodo = () => {
    setLoginMetodo(m => m === 'email' ? 'whatsapp' : 'email');
    setLoginValor('');
    setLoginErro('');
  };

  const handleCompletarCadastro = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const nome = form.get('nome')?.toString().trim();
    const telefone = form.get('telefone')?.toString().trim();
    if (!nome || !telefone) return;
    try {
      await completarCadastro(loja.slug, nome, telefone);
      mostrarToast('Cadastro completo! Bem-vindo.');
      setCompletandoCadastro(false);
    } catch (err) {
      setLoginErro(err.message || 'Erro ao completar cadastro.');
    }
  };

  const handleToggleFavorito = async (itemId) => {
    if (!usuario) {
      setMostrarLogin(true);
      return;
    }
    try {
      const adicionado = await toggleFav(itemId);
      mostrarToast(adicionado ? 'Adicionado aos favoritos ❤️' : 'Removido dos favoritos');
    } catch {
      mostrarToast('Erro ao atualizar favoritos');
    }
  };

  const handleSair = async () => {
    await sair();
    mostrarToast('Você saiu da sua conta');
  };

  const categoriasVisiveis =
    categoriaAtiva === 'todos'
      ? loja.categorias || []
      : (loja.categorias || []).filter((c) => c.id === categoriaAtiva);

  return (
    <TemaLoja tema={tema} corPrimaria={loja.corPrimaria} corSecundaria={loja.corSecundaria}>
      {/* TOPO FIXO */}
      <header className="v-topbar">
        <div className="v-wrap v-topbar-in">
          <div className="v-brand">
            {loja.logo ? <img src={loja.logo} alt="" /> : <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true"><rect width="34" height="34" rx="9" fill="currentColor"/><path d="M10 17h14M17 10v14" stroke="white" stroke-width="3" stroke-linecap="round"/></svg>}
            <span>{loja.nome}</span>
          </div>

          <div className="v-topbar-actions">
            {!isAgendamento && (
              <button onClick={() => setSacolaAberta(true)} className="v-cart-btn" aria-label="Abrir sacola">
                <i className="fa-solid fa-bag-shopping" />
                Sacola
                <span className="v-cart-count">{totalItens}</span>
              </button>
            )}

            {/* Área do cliente */}
            <div className="cliente-menu">
              {usuario && cliente ? (
                <div className="cliente-logado">
                  <button className="cliente-avatar-btn" onClick={() => navigate(`/${loja.slug}/conta`)} aria-label="Minha conta">
                    {cliente.avatar_url ? (
                      <img src={cliente.avatar_url} alt="" className="cliente-avatar" />
                    ) : (
                      <span className="cliente-avatar-iniciais">{gerarAvatarIniciais(cliente.nome)}</span>
                    )}
                  </button>
                  <div className="cliente-dropdown">
                    <div className="cliente-info">
                      <strong>{cliente.nome}</strong>
                      <small>{formatarTelefoneExibicao(cliente.telefone)}</small>
                      {cliente.fidelidade && cliente.fidelidade.pontos_atual > 0 && (
                        <span className="fidelidade-badge">
                          <i className="fa-solid fa-medal" /> {cliente.fidelidade.pontos_atual} pts
                        </span>
                      )}
                    </div>
                    <Link to={`/${loja.slug}/conta`} className="dropdown-item" onClick={() => setSacolaAberta(false)}>
                      <i className="fa-solid fa-user" /> Minha conta
                    </Link>
                    <Link to={`/${loja.slug}/conta?tab=pedidos`} className="dropdown-item" onClick={() => setSacolaAberta(false)}>
                      <i className="fa-solid fa-bag-shopping" /> Meus pedidos
                    </Link>
                    <Link to={`/${loja.slug}/conta?tab=favoritos`} className="dropdown-item" onClick={() => setSacolaAberta(false)}>
                      <i className="fa-solid fa-heart" /> Favoritos
                    </Link>
                    <Link to={`/${loja.slug}/conta?tab=fidelidade`} className="dropdown-item" onClick={() => setSacolaAberta(false)}>
                      <i className="fa-solid fa-medal" /> Fidelidade
                    </Link>
                    <button className="dropdown-item danger" onClick={handleSair}>
                      <i className="fa-solid fa-right-from-bracket" /> Sair
                    </button>
                  </div>
                </div>
              ) : (
                <button className="btn btn-ghost btn-sm" onClick={() => setMostrarLogin(true)}>
                  <i className="fa-solid fa-user" /> Entrar
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <HeroLoja loja={loja} tema={tema} />

      <main className="v-main">
        <div className="v-wrap">
          {isAgendamento ? (
            <>
              <div className="v-section-head" style={{ textAlign: 'center' }}>
                <h2>Agende seu horário</h2>
                <p>Escolha o serviço, o profissional e o melhor horário.</p>
              </div>
              <AgendaBarbearia loja={loja} />
            </>
          ) : (
            <>
              <div className="v-section-head">
                <h2>Cardápio</h2>
                <p>Toque em adicionar para montar seu pedido e finalize pelo WhatsApp.</p>
              </div>

              {(loja.categorias || []).length > 1 && (
                <div className="v-chips" role="tablist">
                  <button className={`v-chip ${categoriaAtiva === 'todos' ? 'active' : ''}`} onClick={() => setCategoriaAtiva('todos')}>
                    Tudo
                  </button>
                  {(loja.categorias || []).map((cat) => (
                    <button
                      key={cat.id}
                      className={`v-chip ${categoriaAtiva === cat.id ? 'active' : ''}`}
                      onClick={() => setCategoriaAtiva(cat.id)}
                    >
                      {cat.nome}
                    </button>
                  ))}
                </div>
              )}

              {categoriasVisiveis.map((cat) => {
                const produtosDaCategoria = (loja.produtos || []).filter((p) => p.categoriaId === cat.id);
                if (produtosDaCategoria.length === 0) return null;

                return (
                  <section key={cat.id}>
                    <h3 className="v-cat-title">{cat.nome}</h3>
                    <div className={`v-grid ${tema.listagem === 'lista' ? 'is-lista' : ''}`}>
                      {produtosDaCategoria.map((prod) => {
                        const favorito = isFavorito(prod.id);
                        return (
                          <article key={prod.id} className="v-item">
                            <div className="v-item-body">
                              {prod.tag && <span className="v-tag">{prod.tag}</span>}
                              <h3>{prod.nome}</h3>
                              {prod.descricao && <p>{prod.descricao}</p>}
                            </div>

                            {prod.opcoes ? (
                              <div className="v-options">
                                {prod.opcoes.map((opt, idx) => (
                                  <div key={idx} className="v-opt">
                                    <span className="v-opt-label">{opt.label}</span>
                                    <span className="v-price">{formatarMoeda(opt.preco)}</span>
                                    <button className="v-add" onClick={() => adicionarItem(prod.nome, opt.preco, opt.label)} aria-label={`Adicionar ${opt.label}`}>
                                      <i className="fa-solid fa-plus" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="v-item-foot">
                                <span className="v-price">{formatarMoeda(prod.preco)}</span>
                                <div className="v-item-actions">
                                  <button
                                    className={`v-fav-btn ${favorito ? 'active' : ''}`}
                                    onClick={() => handleToggleFavorito(prod.id)}
                                    aria-label={favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                                    title={favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                                  >
                                    <i className={favorito ? 'fa-solid fa-heart' : 'fa-regular fa-heart'} />
                                  </button>
                                  <button className="v-add" onClick={() => adicionarItem(prod.nome, prod.preco)}>
                                    <i className="fa-solid fa-plus" /> Adicionar
                                  </button>
                                </div>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </>
          )}
        </div>
      </main>

      {/* SACOLA (modo catálogo) */}
      {!isAgendamento && (
        <>
          <aside className={`cart-drawer ${sacolaAberta ? 'open' : ''}`} aria-hidden={!sacolaAberta}>
            <div className="cart-header">
              <h3>Sua sacola</h3>
              <button onClick={() => setSacolaAberta(false)} className="close-cart-btn" aria-label="Fechar sacola">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="cart-items-list">
              {sacola.length === 0 ? (
                <p className="empty-cart-text">Sua sacola está vazia.</p>
              ) : (
                sacola.map((item) => (
                  <div key={item.id} className="cart-item">
                    <div className="cart-item-info">
                      <h4>
                        {item.nome}
                        {item.opcao && <small>{item.opcao}</small>}
                      </h4>
                      <span>{formatarMoeda(item.preco * item.quantidade)}</span>
                    </div>
                    <div className="cart-item-controls">
                      <button onClick={() => alterarQuantidade(item.id, -1)} aria-label="Diminuir">-</button>
                      <span>{item.quantidade}</span>
                      <button onClick={() => alterarQuantidade(item.id, 1)} aria-label="Aumentar">+</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="cart-footer">
              <div className="coupon-row">
                <input type="text" placeholder="Cupom de desconto" value={cupomInput} onChange={(e) => setCupomInput(e.target.value)} />
                <button onClick={aplicarCupom} className="btn btn-soft btn-sm">Aplicar</button>
              </div>

              {cupomAplicado && (
                <div className="coupon-discount">
                  <span>Desconto ({cupomAplicado.codigo})</span>
                  <span>- {formatarMoeda(valorDesconto)}</span>
                </div>
              )}

              <div className="cart-total-line">
                <span>Total</span>
                <strong>{formatarMoeda(totalFinal)}</strong>
              </div>

              <button onClick={finalizarWhatsApp} disabled={sacola.length === 0} className="btn btn-whats btn-block btn-lg">
                <i className="fa-brands fa-whatsapp" /> Finalizar pedido no WhatsApp
              </button>
            </div>
          </aside>

          {sacolaAberta && <div className="cart-overlay" onClick={() => setSacolaAberta(false)} />}
        </>
      )}

      <div className={`toast ${avisoToast ? 'show' : ''}`} role="status">{avisoToast}</div>

      <footer className="v-footer">
        <div className="v-wrap">
          <strong>{loja.nome}</strong> · Feito com <Link to="/" style={{ color: 'inherit' }}>ConectaLocal</Link>
        </div>
      </footer>

      {/* MODAL DE LOGIN / CADASTRO */}
      {mostrarLogin && (
        <div className="modal-overlay" onClick={() => setMostrarLogin(false)} role="dialog" aria-modal="true" aria-labelledby="login-title">
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setMostrarLogin(false)} aria-label="Fechar">
              <i className="fa-solid fa-xmark" />
            </button>

            {completandoCadastro ? (
              <form onSubmit={handleCompletarCadastro}>
                <h2 id="login-title">Complete seu cadastro</h2>
                <p>Você entrou com sucesso! Falta só seu nome e WhatsApp para finalizar.</p>

                {loginErro && <div className="alert alert-error">{loginErro}</div>}

                <label className="field">
                  <span>Seu nome</span>
                  <input name="nome" placeholder="Como devemos te chamar?" maxLength={80} required autoFocus />
                </label>
                <label className="field">
                  <span>WhatsApp (com DDD)</span>
                  <input name="telefone" type="tel" placeholder="(43) 99999-9999" inputMode="tel" maxLength={15} required />
                </label>

                <button type="submit" disabled={loginCarregando} className="btn btn-primary btn-block btn-lg">
                  {loginCarregando ? 'Salvando...' : 'Finalizar cadastro'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin}>
                <h2 id="login-title">Entre na sua conta</h2>
                <p>Receba um código para acessar seu histórico, favoritos e fidelidade.</p>

                <div className="login-method-toggle" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={loginMetodo === 'email'}
                    className={loginMetodo === 'email' ? 'active' : ''}
                    onClick={handleTrocarMetodo}
                  >
                    <i className="fa-solid fa-envelope" /> E-mail
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={loginMetodo === 'whatsapp'}
                    className={loginMetodo === 'whatsapp' ? 'active' : ''}
                    onClick={handleTrocarMetodo}
                  >
                    <i className="fa-brands fa-whatsapp" /> WhatsApp
                  </button>
                </div>

                {loginErro && <div className="alert alert-error">{loginErro}</div>}

                <label className="field">
                  <span>{loginMetodo === 'email' ? 'Seu e-mail' : 'WhatsApp (com DDD)'}</span>
                  <input
                    type={loginMetodo === 'email' ? 'email' : 'tel'}
                    value={loginValor}
                    onChange={e => setLoginValor(e.target.value)}
                    placeholder={loginMetodo === 'email' ? 'seu@email.com' : '(43) 99999-9999'}
                    inputMode={loginMetodo === 'email' ? 'email' : 'tel'}
                    autoComplete={loginMetodo === 'email' ? 'email' : 'tel'}
                    required
                    autoFocus
                  />
                </label>

                <button type="submit" disabled={loginCarregando} className="btn btn-primary btn-block btn-lg">
                  {loginCarregando ? 'Enviando...' : `Enviar código por ${loginMetodo === 'email' ? 'e-mail' : 'WhatsApp'}`}
                </button>

                <p className="login-hint">
                  Ao continuar, você concorda com nossos <a href="/termos" target="_blank">Termos de Uso</a> e <a href="/privacidade" target="_blank">Política de Privacidade</a>.
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </TemaLoja>
  );
}
