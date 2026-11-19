import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useLojas } from '../context/lojaContext';
import { useCliente } from '../context/clienteContext';
import { lerTema } from '../lib/tema';
import { formatarMoeda, formatarTelefoneExibicao, formatarCep, gerarAvatarIniciais } from '../lib/cliente';
import TemaLoja from '../components/TemaLoja';

const TABS = [
  { id: 'perfil', icone: 'fa-user', label: 'Perfil' },
  { id: 'pedidos', icone: 'fa-bag-shopping', label: 'Pedidos' },
  { id: 'enderecos', icone: 'fa-location-dot', label: 'Endereços' },
  { id: 'favoritos', icone: 'fa-heart', label: 'Favoritos' },
  { id: 'fidelidade', icone: 'fa-medal', label: 'Fidelidade' },
];

const HOJE_ISO = new Date().toISOString().split('T')[0];

export default function MinhaConta() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { lojas, carregando: lojasCarregando } = useLojas();
  const {
    cliente,
    usuario,
    carregando: clienteCarregando,
    salvarPerfil,
    addEndereco,
    editEndereco,
    deleteEndereco,
    getFavoritos,
    getPedidos,
    resgatarPontos,
    getMovimentacoesFidelidade,
    recarregar,
  } = useCliente();

  const loja = lojas[slug];
  const tema = loja ? lerTema(loja) : { modo: 'claro', cantos: 'suave' };

  const [abaAtiva, setAbaAtiva] = useState(() => searchParams.get('tab') || 'perfil');
  const [aviso, setAviso] = useState(null); // { texto, erro }
  const [salvando, setSalvando] = useState(false);

  // Formulários - inicializa vazio, preenche quando cliente carrega
  const [formPerfil, setFormPerfil] = useState({
    nome: '',
    telefone: '',
    avatar_url: '',
    data_nascimento: '',
    preferencias: { notificacoes: true, tema: 'sistema' },
  });
  const [formEndereco, setFormEndereco] = useState({
    apelido: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    cep: '',
    referencia: '',
    padrao: false,
  });
  const [editandoEnderecoId, setEditandoEnderecoId] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [favoritos, setFavoritos] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [resgatando, setResgatando] = useState(false);
  const [pontosResgate, setPontosResgate] = useState('');

  // Sincroniza URL com aba (apenas escreve na URL, não lê)
  useEffect(() => {
    setSearchParams({ tab: abaAtiva }, { replace: true });
  }, [abaAtiva, setSearchParams]);

  // Carrega dados ao mudar de aba ou ao montar
  useEffect(() => {
    if (!cliente || !loja) return;
    const carregar = async () => {
      try {
        if (abaAtiva === 'pedidos') {
          const data = await getPedidos(20, 0);
          setPedidos(data || []);
        } else if (abaAtiva === 'favoritos') {
          const data = await getFavoritos();
          setFavoritos(data || []);
        } else if (abaAtiva === 'fidelidade') {
          const data = await getMovimentacoesFidelidade(50);
          setMovimentacoes(data || []);
        }
      } catch (err) {
        console.error('Erro ao carregar dados da conta:', err);
      }
    };
    carregar();
  }, [abaAtiva, cliente, loja, getPedidos, getFavoritos, getMovimentacoesFidelidade]);

  // Preenche formulário de perfil quando cliente carrega (usa ref para evitar setState repetido)
  const formPerfilRef = useRef(null);
  useEffect(() => {
    if (cliente) {
      const novoForm = {
        nome: cliente.nome || '',
        telefone: cliente.telefone || '',
        avatar_url: cliente.avatar_url || '',
        data_nascimento: cliente.data_nascimento || '',
        preferencias: cliente.preferencias || { notificacoes: true, tema: 'sistema' },
      };
      // Só atualiza se mudou algo relevante
      if (JSON.stringify(formPerfilRef.current) !== JSON.stringify(novoForm)) {
        formPerfilRef.current = novoForm;
        setFormPerfil(novoForm);
      }
    }
  }, [cliente]);

  const notificar = (texto, erro = false) => {
    setAviso({ texto, erro });
    setTimeout(() => setAviso(null), erro ? 5000 : 3000);
  };

  const executar = async (acao, msgOk) => {
    try {
      await acao();
      if (msgOk) notificar(msgOk);
      return true;
    } catch (err) {
      console.error(err);
      notificar(`Erro: ${err.message || 'tente novamente'}`, true);
      return false;
    }
  };

  // ---- PERFIL ----
  const handleSalvarPerfil = async (e) => {
    e.preventDefault();
    setSalvando(true);
    const _ok = await executar(
      () => salvarPerfil({
        p_nome: formPerfil.nome.trim(),
        p_telefone: formPerfil.telefone,
        p_avatar_url: formPerfil.avatar_url || null,
        p_data_nascimento: formPerfil.data_nascimento || null,
        p_preferencias: formPerfil.preferencias,
      }),
      'Perfil atualizado!'
    );
    setSalvando(false);
  };

  // ---- ENDEREÇOS ----
  const handleEnderecoSubmit = async (e) => {
    e.preventDefault();
    setSalvando(true);
    const dados = { ...formEndereco, cep: formEndereco.cep.replace(/\D/g, '') };
    if (editandoEnderecoId) {
      await executar(() => editEndereco(editandoEnderecoId, dados), 'Endereço atualizado!');
      setEditandoEnderecoId(null);
    } else {
      await executar(() => addEndereco(dados), 'Endereço salvo!');
    }
    setSalvando(false);
    resetFormEndereco();
    recarregar();
  };

  const handleEditarEndereco = (end) => {
    setFormEndereco({
      apelido: end.apelido,
      logradouro: end.logradouro,
      numero: end.numero,
      complemento: end.complemento || '',
      bairro: end.bairro,
      cidade: end.cidade,
      uf: end.uf,
      cep: formatarCep(end.cep),
      referencia: end.referencia || '',
      padrao: end.padrao,
    });
    setEditandoEnderecoId(end.id);
  };

  const handleRemoverEndereco = async (id) => {
    if (!window.confirm('Remover este endereço?')) return;
    await executar(() => deleteEndereco(id), 'Endereço removido!');
    recarregar();
  };

  const resetFormEndereco = () => {
    setFormEndereco({
      apelido: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      uf: '',
      cep: '',
      referencia: '',
      padrao: false,
    });
    setEditandoEnderecoId(null);
  };

  const cancelarEdicaoEndereco = () => {
    resetFormEndereco();
  };

  // ---- FIDELIDADE ----
  const handleResgatarPontos = async (e) => {
    e.preventDefault();
    const pontos = parseInt(pontosResgate, 10);
    if (!pontos || pontos <= 0) return notificar('Informe a quantidade de pontos', true);
    if (pontos > (cliente?.fidelidade?.pontos_atual || 0)) return notificar('Pontos insuficientes', true);

    setResgatando(true);
    const ok = await executar(
      () => resgatarPontos(pontos),
      `Cupom gerado com ${pontos} pontos! Verifique a aba Fidelidade.`
    );
    if (ok) {
      setPontosResgate('');
      recarregar();
    }
    setResgatando(false);
  };

  if (lojasCarregando || clienteCarregando) {
    return <div className="v-notfound">Carregando sua conta...</div>;
  }

  if (!loja) {
    return (
      <div className="v-notfound">
        <div>
          <h1>Loja não encontrada</h1>
          <Link to="/" className="btn btn-primary">Ir para o início</Link>
        </div>
      </div>
    );
  }

  if (!usuario) {
    return (
      <div className="v-notfound">
        <div style={{ textAlign: 'center', maxWidth: 400, margin: '0 auto' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔐</div>
          <h1>Faça login para acessar sua conta</h1>
          <p style={{ color: 'var(--muted)', margin: '1rem 0 2rem' }}>
            Entre com seu e-mail ou WhatsApp para ver seus pedidos, favoritos e pontos de fidelidade.
          </p>
          <Link to={`/${slug}`} className="btn btn-primary btn-lg">
            <i className="fa-solid fa-arrow-left" /> Voltar à loja
          </Link>
        </div>
      </div>
    );
  }

  const secao = TABS.find(t => t.id === abaAtiva) || TABS[0];
  const pontosAtual = cliente?.fidelidade?.pontos_atual || 0;
  const totalAcumulado = cliente?.fidelidade?.total_acumulado || 0;
  const totalResgatado = cliente?.fidelidade?.total_resgatado || 0;

  return (
    <TemaLoja tema={tema} corPrimaria={loja.corPrimaria} corSecundaria={loja.corSecundaria}>
      <header className="v-topbar">
        <div className="v-wrap v-topbar-in">
          <Link to={`/${slug}`} className="v-brand" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {loja.logo ? <img src={loja.logo} alt="" style={{ width: 34, height: 34, borderRadius: 9 }} /> : <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true"><rect width="34" height="34" rx="9" fill="currentColor"/><path d="M10 17h14M17 10v14" stroke="white" stroke-width="3" stroke-linecap="round"/></svg>}
            <span>{loja.nome}</span>
          </Link>
          <Link to={`/${slug}`} className="btn btn-ghost btn-sm">
            <i className="fa-solid fa-arrow-left" /> Voltar à loja
          </Link>
        </div>
      </header>

      <div className="conta-layout">
        <aside className="conta-sidebar">
          <div className="conta-perfil">
            <div className="conta-avatar">
              {cliente?.avatar_url ? (
                <img src={cliente.avatar_url} alt="" />
              ) : (
                <span>{gerarAvatarIniciais(cliente?.nome || 'Cliente')}</span>
              )}
            </div>
            <div className="conta-info">
              <strong>{cliente?.nome || 'Cliente'}</strong>
              <small>{formatarTelefoneExibicao(cliente?.telefone || '')}</small>
              {pontosAtual > 0 && (
                <span className="fidelidade-mini">
                  <i className="fa-solid fa-medal" /> {pontosAtual} pontos
                </span>
              )}
            </div>
          </div>

          <nav className="conta-nav" aria-label="Seções da conta">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={abaAtiva === tab.id ? 'active' : ''}
                onClick={() => setAbaAtiva(tab.id)}
              >
                <i className={`fa-solid ${tab.icone}`} /> {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="conta-main">
          <div className="conta-head">
            <h1>{secao.label}</h1>
            <p>{getTabDescription(secao.id)}</p>
          </div>

          {aviso && <div className={`toast-admin ${aviso.erro ? 'err' : 'ok'}`} role="status">{aviso.erro ? '⚠ ' : '✓ '}{aviso.texto}</div>}

          {/* PERFIL */}
          {abaAtiva === 'perfil' && (
            <form onSubmit={handleSalvarPerfil} className="conta-form">
              <section className="card">
                <h3>Foto do perfil</h3>
                <div className="avatar-upload">
                  <div className="avatar-preview">
                    {formPerfil.avatar_url ? (
                      <img src={formPerfil.avatar_url} alt="Pré-visualização" />
                    ) : (
                      <span>{gerarAvatarIniciais(formPerfil.nome || 'Cliente')}</span>
                    )}
                  </div>
                  <label className="field">
                    <span>URL da foto (opcional)</span>
                    <input
                      type="url"
                      value={formPerfil.avatar_url}
                      onChange={e => setFormPerfil(f => ({ ...f, avatar_url: e.target.value }))}
                      placeholder="https://... (use uma imagem quadrada)"
                    />
                    <small>Cole o link de uma imagem sua (ex: Google Fotos, Imgur, seu site).</small>
                  </label>
                </div>
              </section>

              <section className="card">
                <h3>Dados pessoais</h3>
                <label className="field">
                  <span>Nome completo</span>
                  <input
                    value={formPerfil.nome}
                    onChange={e => setFormPerfil(f => ({ ...f, nome: e.target.value }))}
                    maxLength={80}
                    required
                  />
                </label>
                <label className="field">
                  <span>WhatsApp (com DDD)</span>
                  <input
                    type="tel"
                    value={formPerfil.telefone}
                    onChange={e => setFormPerfil(f => ({ ...f, telefone: e.target.value }))}
                    placeholder="(43) 99999-9999"
                    inputMode="tel"
                    maxLength={15}
                    required
                  />
                </label>
                <label className="field">
                  <span>Data de nascimento (opcional)</span>
                  <input
                    type="date"
                    value={formPerfil.data_nascimento}
                    onChange={e => setFormPerfil(f => ({ ...f, data_nascimento: e.target.value }))}
                    max={HOJE_ISO}
                  />
                </label>
              </section>

              <section className="card">
                <h3>Preferências</h3>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={formPerfil.preferencias?.notificacoes}
                    onChange={e => setFormPerfil(f => ({ ...f, preferencias: { ...f.preferencias, notificacoes: e.target.checked } }))}
                  />
                  Receber notificações de status do pedido
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={formPerfil.preferencias?.tema === 'escuro'}
                    onChange={e => setFormPerfil(f => ({ ...f, preferencias: { ...f.preferencias, tema: e.target.checked ? 'escuro' : 'claro' } }))}
                  />
                  Tema escuro (a vitrine segue a preferência do sistema)
                </label>
              </section>

              <button type="submit" className="btn btn-primary btn-lg" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </form>
          )}

          {/* PEDIDOS */}
          {abaAtiva === 'pedidos' && (
            <div className="card">
              {pedidos.length === 0 ? (
                <div className="empty-state">
                  <i className="fa-solid fa-bag-shopping" style={{ fontSize: '3rem', color: 'var(--muted)', marginBottom: '1rem' }} />
                  <h3>Nenhum pedido ainda</h3>
                  <p style={{ color: 'var(--muted)' }}>Seus pedidos feitos pelo WhatsApp aparecerão aqui automaticamente.</p>
                  <Link to={`/${slug}`} className="btn btn-primary mt-2">Fazer um pedido</Link>
                </div>
              ) : (
                <div className="pedidos-lista">
                  {pedidos.map((pedido) => (
                    <article key={pedido.id} className="pedido-card">
                      <div className="pedido-head">
                        <div>
                          <strong>Pedido #{pedido.id.toString().slice(0, 8).toUpperCase()}</strong>
                          <small>{new Date(pedido.criado_em).toLocaleDateString('pt-BR', { dateStyle: 'full', timeStyle: 'short' })}</small>
                        </div>
                        <span className={`pedido-status ${pedido.status}`}>{getStatusLabel(pedido.status)}</span>
                      </div>
                      <div className="pedido-itens">
                        {(pedido.itens || []).slice(0, 3).map((item, i) => (
                          <div key={i} className="pedido-item-mini">
                            <span>{item.quantidade}x {item.nome}{item.opcao ? ` (${item.opcao})` : ''}</span>
                            <span>{formatarMoeda(item.preco * item.quantidade)}</span>
                          </div>
                        ))}
                        {(pedido.itens || []).length > 3 && (
                          <small style={{ color: 'var(--muted)' }}>+ mais {(pedido.itens || []).length - 3} item(s)</small>
                        )}
                      </div>
                      <div className="pedido-foot">
                        <strong>Total: {formatarMoeda(pedido.total)}</strong>
                        {pedido.cupom_codigo && (
                          <span className="cupom-tag">Cupom: {pedido.cupom_codigo} ({pedido.cupom_desconto_pct}% OFF)</span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ENDEREÇOS */}
          {abaAtiva === 'enderecos' && (
            <div className="split">
              <form onSubmit={handleEnderecoSubmit} className="card">
                <h3>{editandoEnderecoId ? 'Editar endereço' : 'Novo endereço'}</h3>
                <div className="field-row">
                  <label className="field">
                    <span>Apelido *</span>
                    <input value={formEndereco.apelido} onChange={e => setFormEndereco(f => ({ ...f, apelido: e.target.value }))} placeholder="Casa, Trabalho, Mãe..." required maxLength={30} />
                  </label>
                  <label className="field">
                    <span>CEP *</span>
                    <input value={formEndereco.cep} onChange={e => setFormEndereco(f => ({ ...f, cep: e.target.value.replace(/\D/g, '').slice(0, 8) }))} placeholder="00000-000" inputMode="numeric" maxLength={9} required />
                  </label>
                </div>
                <label className="field">
                  <span>Rua/Avenida *</span>
                  <input value={formEndereco.logradouro} onChange={e => setFormEndereco(f => ({ ...f, logradouro: e.target.value }))} placeholder="Rua das Flores" required maxLength={100} />
                </label>
                <div className="field-row">
                  <label className="field">
                    <span>Número *</span>
                    <input value={formEndereco.numero} onChange={e => setFormEndereco(f => ({ ...f, numero: e.target.value }))} placeholder="123" required maxLength={10} />
                  </label>
                  <label className="field">
                    <span>Complemento</span>
                    <input value={formEndereco.complemento} onChange={e => setFormEndereco(f => ({ ...f, complemento: e.target.value }))} placeholder="Apto 101, Bloco B" maxLength={50} />
                  </label>
                </div>
                <div className="field-row">
                  <label className="field">
                    <span>Bairro *</span>
                    <input value={formEndereco.bairro} onChange={e => setFormEndereco(f => ({ ...f, bairro: e.target.value }))} placeholder="Centro" required maxLength={60} />
                  </label>
                  <label className="field">
                    <span>Cidade *</span>
                    <input value={formEndereco.cidade} onChange={e => setFormEndereco(f => ({ ...f, cidade: e.target.value }))} placeholder="São Paulo" required maxLength={60} />
                  </label>
                  <label className="field">
                    <span>UF *</span>
                    <select value={formEndereco.uf} onChange={e => setFormEndereco(f => ({ ...f, uf: e.target.value }))} required>
                      <option value="">Selecione</option>
                      {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span>Referência</span>
                  <input value={formEndereco.referencia} onChange={e => setFormEndereco(f => ({ ...f, referencia: e.target.value }))} placeholder="Portão azul, prédio comercial" maxLength={100} />
                </label>
                <label className="check">
                  <input type="checkbox" checked={formEndereco.padrao} onChange={e => setFormEndereco(f => ({ ...f, padrao: e.target.checked }))} />
                  Definir como endereço padrão
                </label>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={salvando}>{salvando ? 'Salvando...' : (editandoEnderecoId ? 'Atualizar' : 'Salvar endereço')}</button>
                  {editandoEnderecoId && <button type="button" className="btn btn-ghost" onClick={cancelarEdicaoEndereco}>Cancelar</button>}
                </div>
              </form>

              <div className="card">
                <h3>Endereços salvos ({(cliente?.enderecos || []).length})</h3>
                {(cliente?.enderecos || []).length === 0 ? (
                  <p className="empty">Nenhum endereço cadastrado. Adicione ao lado para agilizar seus pedidos.</p>
                ) : (
                  <div className="enderecos-lista">
                    {(cliente?.enderecos || []).map((end) => (
                      <article key={end.id} className={`endereco-card ${end.padrao ? 'padrao' : ''}`}>
                        <div className="endereco-info">
                          {end.padrao && <span className="badge padrao">Padrão</span>}
                          <strong>{end.apelido}</strong>
                          <p>{end.logradouro}, {end.numero}{end.complemento ? `, ${end.complemento}` : ''}</p>
                          <p>{end.bairro} - {end.cidade}/{end.uf} - CEP {formatarCep(end.cep)}</p>
                          {end.referencia && <small>Ref: {end.referencia}</small>}
                        </div>
                        <div className="endereco-actions">
                          <button className="btn btn-soft btn-sm" onClick={() => handleEditarEndereco(end)}>
                            <i className="fa-solid fa-pen" /> Editar
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleRemoverEndereco(end.id)}>
                            <i className="fa-solid fa-trash" /> Excluir
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* FAVORITOS */}
          {abaAtiva === 'favoritos' && (
            <div className="card">
              {favoritos.length === 0 ? (
                <div className="empty-state">
                  <i className="fa-regular fa-heart" style={{ fontSize: '3rem', color: 'var(--muted)', marginBottom: '1rem' }} />
                  <h3>Nenhum favorito ainda</h3>
                  <p style={{ color: 'var(--muted)' }}>Toque no coração ❤️ nos produtos da loja para salvá-los aqui.</p>
                  <Link to={`/${slug}`} className="btn btn-primary mt-2">Ver cardápio</Link>
                </div>
              ) : (
                <div className="favoritos-grid">
                  {favoritos.map((item) => (
                    <article key={item.id} className="v-item">
                      <div className="v-item-body">
                        {item.tag && <span className="v-tag">{item.tag}</span>}
                        <h3>{item.nome}</h3>
                        {item.descricao && <p>{item.descricao}</p>}
                      </div>
                      <div className="v-item-foot">
                        <span className="v-price">{formatarMoeda(item.preco)}</span>
                        <div className="v-item-actions">
                          <button
                            className="v-fav-btn active"
                            onClick={() => { /* TODO: unfavorite */ }}
                            aria-label="Remover dos favoritos"
                          >
                            <i className="fa-solid fa-heart" />
                          </button>
                          <button className="v-add" onClick={() => { /* TODO: add to cart */ }}>
                            <i className="fa-solid fa-plus" /> Adicionar
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* FIDELIDADE */}
          {abaAtiva === 'fidelidade' && (
            <div className="fidelidade-layout">
              <div className="fidelidade-resumo">
                <div className="fidelidade-card principal">
                  <div className="fidelidade-pontos">
                    <span className="label">Seus pontos</span>
                    <strong className="valor">{pontosAtual.toLocaleString('pt-BR')}</strong>
                    <span className="sub">disponíveis para resgate</span>
                  </div>
                  <div className="fidelidade-barra">
                    <div className="barra-bg">
                      <div className="barra-fill" style={{ width: `${Math.min(100, (pontosAtual / 500) * 100)}%` }} />
                    </div>
                    <small>{pontosAtual >= 500 ? 'Pronto para resgatar!' : `${500 - pontosAtual} pontos para o próximo resgate`}</small>
                  </div>
                </div>
                <div className="fidelidade-card estatisticas">
                  <div className="stat">
                    <strong>{totalAcumulado.toLocaleString('pt-BR')}</strong>
                    <span>Acumulados no total</span>
                  </div>
                  <div className="stat">
                    <strong>{totalResgatado.toLocaleString('pt-BR')}</strong>
                    <span>Já resgatados</span>
                  </div>
                </div>
              </div>

              <div className="card">
                <h3>Resgatar pontos por cupom de desconto</h3>
                <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>
                  <strong>Regra:</strong> 100 pontos = 10% de desconto (máximo 50% por cupom).<br />
                  O cupom gerado é válido por 30 dias e pode ser usado uma única vez.
                </p>
                <form onSubmit={handleResgatarPontos} style={{ maxWidth: 400 }}>
                  <div className="field-row" style={{ alignItems: 'flex-end' }}>
                    <label className="field" style={{ flex: 1 }}>
                      <span>Quantos pontos quer usar?</span>
                      <input
                        type="number"
                        min="100"
                        max={pontosAtual}
                        step="100"
                        value={pontosResgate}
                        onChange={e => setPontosResgate(e.target.value)}
                        placeholder="Ex: 500"
                        required
                      />
                    </label>
                    <button type="submit" className="btn btn-primary" disabled={resgatando || !pontosResgate || parseInt(pontosResgate) < 100 || parseInt(pontosResgate) > pontosAtual}>
                      {resgatando ? 'Gerando cupom...' : 'Gerar cupom'}
                    </button>
                  </div>
                  {pontosResgate && parseInt(pontosResgate) >= 100 && (
                    <p className="resgate-preview">
                      <i className="fa-solid fa-ticket" /> Cupom estimado: <strong>{Math.min(50, Math.floor(parseInt(pontosResgate) / 100) * 10)}% OFF</strong> (usa {pontosResgate} pontos)
                    </p>
                  )}
                </form>
              </div>

              <div className="card">
                <h3>Histórico de movimentações</h3>
                {movimentacoes.length === 0 ? (
                  <p className="empty">Nenhuma movimentação de pontos ainda.</p>
                ) : (
                  <div className="movimentacoes-lista">
                    {movimentacoes.map((mov) => (
                      <div key={mov.id} className={`movimentacao ${mov.tipo}`}>
                        <div className="mov-info">
                          <strong>{getTipoLabel(mov.tipo)}</strong>
                          <small>{mov.descricao}</small>
                          <time>{new Date(mov.criado_em).toLocaleDateString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })}</time>
                        </div>
                        <span className={`mov-pontos ${mov.pontos > 0 ? 'ganho' : 'gasto'}`}>
                          {mov.pontos > 0 ? '+' : ''}{mov.pontos.toLocaleString('pt-BR')} pts
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </main>
      </div>

      <footer className="v-footer">
        <div className="v-wrap">
          <strong>{loja.nome}</strong> · Feito com <Link to="/" style={{ color: 'inherit' }}>ConectaLocal</Link>
        </div>
      </footer>
    </TemaLoja>
  );
}

function getTabDescription(tabId) {
  const desc = {
    perfil: 'Gerencie seus dados pessoais, foto e preferências.',
    pedidos: 'Veja o histórico de todos os pedidos que você fez.',
    enderecos: 'Cadastre endereços para agilizar seus próximos pedidos.',
    favoritos: 'Seus produtos salvos para pedir de novo rapidinho.',
    fidelidade: 'Acumule pontos a cada pedido e troque por descontos.',
  };
  return desc[tabId] || '';
}

function getStatusLabel(status) {
  const labels = {
    enviado_whatsapp: 'Enviado p/ WhatsApp',
    confirmado: 'Confirmado',
    preparando: 'Preparando',
    pronto: 'Pronto',
    entregue: 'Entregue',
    cancelado: 'Cancelado',
  };
  return labels[status] || status;
}

function getTipoLabel(tipo) {
  const labels = {
    ganho: 'Pontos ganhos',
    resgate: 'Resgate de cupom',
    expiracao: 'Pontos expirados',
    ajuste: 'Ajuste manual',
  };
  return labels[tipo] || tipo;
}