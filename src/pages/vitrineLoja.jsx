import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useLojas } from '../context/lojaContext';
import AgendaBarbearia from '../components/agendaBarbearia';

export default function VitrineLoja() {
  const { slug } = useParams();
  const { lojas, carregando } = useLojas();
  const loja = lojas[slug || 'raizes'];

  const [categoriaAtiva, setCategoriaAtiva] = useState('todos');
  const [sacola, setSacola] = useState([]);
  const [sacolaAberta, setSacolaAberta] = useState(false);
  const [cupomInput, setCupomInput] = useState('');
  const [cupomAplicado, setCupomAplicado] = useState(null);
  const [avisoToast, setAvisoToast] = useState('');

  useEffect(() => {
    if (!loja) return;
    document.documentElement.style.setProperty('--amber-600', loja.corPrimaria);
    document.documentElement.style.setProperty('--amber-700', loja.corSecundaria);
    document.title = `${loja.nome} | ConectaLocal`;
  }, [loja]);

  if (carregando) {
    return <div style={{ padding: '5rem', textAlign: 'center' }}>Carregando vitrine...</div>;
  }

  if (!loja) {
    return (
      <div style={{ padding: '5rem', textAlign: 'center' }}>
        <h2>Loja não encontrada</h2>
        <p>Verifique o link digitado.</p>
      </div>
    );
  }

  const isAgendamento = loja.modo === 'agendamento';

  const mostrarToast = (msg) => {
    setAvisoToast(msg);
    setTimeout(() => setAvisoToast(''), 2500);
  };

  const formatarMoeda = (valor) => {
    return 'R$ ' + Number(valor).toFixed(2).replace('.', ',');
  };

  const adicionarItem = (nome, preco, opcao = '') => {
    const id = `${nome}|${opcao}`.toLowerCase();
    setSacola((prev) => {
      const existente = prev.find((i) => i.id === id);
      if (existente) {
        return prev.map((i) =>
          i.id === id ? { ...i, quantidade: Math.min(i.quantidade + 1, 20) } : i
        );
      }
      return [...prev, { id, nome, opcao, preco, quantidade: 1 }];
    });
    mostrarToast(`${opcao ? `${nome} (${opcao})` : nome} adicionado à sacola.`);
  };

  const alterarQuantidade = (id, delta) => {
    setSacola((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, quantidade: item.quantidade + delta } : item))
        .filter((item) => item.quantidade > 0)
    );
  };

  const aplicarCupom = () => {
    const codigoLimpo = cupomInput.trim().toUpperCase();
    const encontrado = (loja.cupons || []).find((c) => c.codigo === codigoLimpo);
    if (encontrado) {
      const percentual = encontrado.desconto_percentual || encontrado.descontoPercentual;
      setCupomAplicado({ codigo: encontrado.codigo, descontoPercentual: percentual });
      mostrarToast(`Cupom ${encontrado.codigo} aplicado (${percentual}% OFF)!`);
    } else {
      setCupomAplicado(null);
      mostrarToast('Cupom inválido ou expirado.');
    }
  };

  const subtotal = sacola.reduce((acc, item) => acc + item.preco * item.quantidade, 0);
  const valorDesconto = cupomAplicado ? subtotal * (cupomAplicado.descontoPercentual / 100) : 0;
  const totalFinal = subtotal - valorDesconto;
  const totalItens = sacola.reduce((acc, item) => acc + item.quantidade, 0);

  const finalizarWhatsApp = () => {
    if (sacola.length === 0) return;
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
    window.open(`https://wa.me/${loja.telefone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const categoriasVisiveis =
    categoriaAtiva === 'todos'
      ? loja.categorias || []
      : (loja.categorias || []).filter((c) => c.id === categoriaAtiva);

  return (
    <div>
      {/* HEADER */}
      <header className="header">
        <div className="container nav-container">
          <div className="logo-wrapper">
            <img src={loja.logo} alt={loja.nome} className="brand-logo-img" />
            <div className="brand-text-container">
              <span className="logo-title">{loja.nome}</span>
              <span className="logo-subtitle">{loja.subtitulo}</span>
            </div>
          </div>

          {/* Só mostra o botão da sacola se NÃO for modo agendamento */}
          {!isAgendamento && (
            <div className="nav-action">
              <button onClick={() => setSacolaAberta(true)} className="cart-btn-nav" title="Sua Sacola">
                <i className="fa-solid fa-bag-shopping"></i>
                <span className="cart-count">{totalItens}</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* CORPO DA VITRINE */}
      <section className="menu-section">
        <div className="container">
          <div className="section-title">
            <h2>{isAgendamento ? 'Agendamento Online' : 'Cardápio Oficial Completo'}</h2>
            <p>
              {isAgendamento
                ? `Escolha o serviço, o profissional e o melhor horário em ${loja.nome}.`
                : `Selecione uma categoria abaixo para explorar os itens de ${loja.nome}.`}
            </p>
          </div>

          {/* AQUI ESTÁ A TROCA AUTOMÁTICA ENTRE BARBEARIA E RESTAURANTE */}
          {isAgendamento ? (
            <AgendaBarbearia loja={loja} />
          ) : (
            <>
              {/* FILTROS */}
              <div className="menu-filters">
                <button
                  className={`filter-btn ${categoriaAtiva === 'todos' ? 'active' : ''}`}
                  onClick={() => setCategoriaAtiva('todos')}
                >
                  Ver Tudo
                </button>
                {(loja.categorias || []).map((cat) => (
                  <button
                    key={cat.id}
                    className={`filter-btn ${categoriaAtiva === cat.id ? 'active' : ''}`}
                    onClick={() => setCategoriaAtiva(cat.id)}
                  >
                    {cat.nome}
                  </button>
                ))}
              </div>

              {/* LISTAGEM POR CATEGORIA */}
              {categoriasVisiveis.map((cat) => {
                const produtosDaCategoria = (loja.produtos || []).filter((p) => p.categoriaId === cat.id);
                if (produtosDaCategoria.length === 0) return null;

                return (
                  <div key={cat.id} className="menu-category-block active-category">
                    <h3 className="category-heading">{cat.nome}</h3>
                    <div className="menu-grid">
                      {produtosDaCategoria.map((prod) => (
                        <div key={prod.id} className="menu-card">
                          <div className="menu-card-body">
                            <span className="menu-category">{prod.tag}</span>
                            <h3>{prod.nome}</h3>
                            <p>{prod.descricao}</p>
                          </div>

                          {prod.opcoes ? (
                            <div className="menu-footer menu-footer-options">
                              {prod.opcoes.map((opt, idx) => (
                                <div key={idx} className="menu-option">
                                  <span className="opt-label">{opt.label}</span>
                                  <span className="price">{formatarMoeda(opt.preco)}</span>
                                  <button
                                    className="btn-add-cart"
                                    onClick={() => adicionarItem(prod.nome, opt.preco, opt.label)}
                                  >
                                    <i className="fa-solid fa-plus"></i>
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="menu-footer">
                              <span className="price">{formatarMoeda(prod.preco)}</span>
                              <button
                                className="btn-add-cart"
                                onClick={() => adicionarItem(prod.nome, prod.preco)}
                              >
                                <i className="fa-solid fa-plus"></i> Adicionar
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </section>

      {/* GAVETA DA SACOLA (Apenas para modo catálogo) */}
      {!isAgendamento && (
        <>
          <div className={`cart-drawer ${sacolaAberta ? 'open' : ''}`}>
            <div className="cart-header">
              <h3>Sua Sacola</h3>
              <button onClick={() => setSacolaAberta(false)} className="close-cart-btn">
                <i className="fa-solid fa-xmark"></i>
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
                      <button onClick={() => alterarQuantidade(item.id, -1)}>-</button>
                      <span>{item.quantidade}</span>
                      <button onClick={() => alterarQuantidade(item.id, 1)}>+</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="cart-footer">
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input
                  type="text"
                  placeholder="Cupom (ex: BEMVINDO10)"
                  value={cupomInput}
                  onChange={(e) => setCupomInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #d6d3d1'
                  }}
                />
                <button
                  onClick={aplicarCupom}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    background: '#1c1917',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Aplicar
                </button>
              </div>

              {cupomAplicado && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  <span>Desconto ({cupomAplicado.codigo}):</span>
                  <span>- {formatarMoeda(valorDesconto)}</span>
                </div>
              )}

              <div className="cart-total-line">
                <span>Total:</span>
                <strong>{formatarMoeda(totalFinal)}</strong>
              </div>

              <button onClick={finalizarWhatsApp} className="btn-checkout btn-checkout-wa">
                <i className="fa-brands fa-whatsapp"></i> Finalizar Pedido via WhatsApp
              </button>
            </div>
          </div>

          {sacolaAberta && <div className="cart-overlay open" onClick={() => setSacolaAberta(false)} />}
        </>
      )}

      {/* TOAST DE AVISO */}
      <div className={`toast ${avisoToast ? 'show' : ''}`}>{avisoToast}</div>

      {/* FOOTER */}
      <footer className="footer">
        <div className="container footer-flex">
          <p className="footer-logo">{loja.nome}</p>
          <p className="footer-copy">&copy; 2026 ConectaLocal. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}