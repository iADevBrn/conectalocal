import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLojas } from '../context/lojaContext';
import { supabase } from '../lib/supabase';
import { normalizarTelefone } from '../lib/telefone';
import { lerTema } from '../lib/tema';
import AgendaBarbearia from '../components/agendaBarbearia';
import TemaLoja from '../components/TemaLoja';
import HeroLoja from '../components/HeroLoja';

const formatarMoeda = (valor) => 'R$ ' + Number(valor).toFixed(2).replace('.', ',');

export default function VitrineLoja() {
  const { slug } = useParams();
  const { lojas, carregando, carregarLojaPorSlug } = useLojas();
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

  // Carrega só a loja do link (antes o app baixava todas as lojas de todos os clientes).
  useEffect(() => {
    let ativo = true;
    setBuscando(true);
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
      // Lojas reais: o cupom é validado no servidor (a lista de cupons não é pública).
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
    window.open(`https://wa.me/${normalizarTelefone(loja.telefone)}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
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
            <img src={loja.logo} alt="" />
            <span>{loja.nome}</span>
          </div>

          {!isAgendamento && (
            <button onClick={() => setSacolaAberta(true)} className="v-cart-btn" aria-label="Abrir sacola">
              <i className="fa-solid fa-bag-shopping" />
              Sacola
              <span className="v-cart-count">{totalItens}</span>
            </button>
          )}
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
                      {produtosDaCategoria.map((prod) => (
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
                              <button className="v-add" onClick={() => adicionarItem(prod.nome, prod.preco)}>
                                <i className="fa-solid fa-plus" /> Adicionar
                              </button>
                            </div>
                          )}
                        </article>
                      ))}
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
    </TemaLoja>
  );
}
