import { useState, useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useLojas } from '../context/lojaContext';
import { supabase } from '../lib/supabase';
import { normalizarTelefone } from '../lib/telefone';
import { escurecerCor } from '../lib/cores';
import { configAgenda, DIAS_SEMANA } from '../lib/agenda';

export default function PainelAdmin() {
  const navigate = useNavigate();
  const {
    lojas,
    usuario,
    minhaLoja,
    carregando,
    atualizarConfigLoja,
    atualizarConfigAgenda,
    cancelarAgendamento,
    salvarProduto,
    removerProduto,
    adicionarCupom,
    removerCupom,
    adicionarProfissional,
    removerProfissional,
    sair
  } = useLojas();

  // O painel só edita a loja do usuário logado (sem fallback para loja de demonstração).
  const slugAtivo = minhaLoja?.slug;
  const loja = slugAtivo ? lojas[slugAtivo] : null;

  const [abaAtiva, setAbaAtiva] = useState('aparencia');
  const [mensagemSalvo, setMensagemSalvo] = useState('');
  const [mensagemErro, setMensagemErro] = useState(false);

  // Estados de Produtos/Serviços
  const [novoNome, setNovoNome] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoPreco, setNovoPreco] = useState('');
  const [novaDuracao, setNovaDuracao] = useState('30');
  const [novaCategoria, setNovaCategoria] = useState('');

  // Estados de Profissionais (Modo Agendamento)
  const [nomeProfissional, setNomeProfissional] = useState('');
  const [especialidadeProf, setEspecialidadeProf] = useState('');
  const [agendamentos, setAgendamentos] = useState([]);

  // Estados de Cupom
  const [codigoCupom, setCodigoCupom] = useState('');
  const [descontoCupom, setDescontoCupom] = useState('');

  useEffect(() => {
    if (loja?.categorias?.length > 0 && !novaCategoria) {
      setNovaCategoria(loja.categorias[0].id);
    }
  }, [loja, novaCategoria]);

  // Busca agendamentos reais do Supabase se a loja for modo 'agendamento'
  useEffect(() => {
    if (!loja?.id || loja.modo !== 'agendamento') return;

    const buscarAgendamentos = async () => {
      const { data } = await supabase
        .from('agendamentos')
        .select('*, profissionais(nome), itens(nome, preco)')
        .eq('loja_id', loja.id)
        .order('data_horario', { ascending: true });

      if (data) setAgendamentos(data);
    };

    buscarAgendamentos();
  }, [loja]);

  if (carregando) {
    return <div style={{ padding: '4rem', textAlign: 'center' }}>Carregando painel...</div>;
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  if (!loja) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center' }}>
        <h2>Nenhuma loja encontrada para esta conta</h2>
        <Link to="/login">Voltar ao login</Link>
      </div>
    );
  }

  const notificar = (texto, erro = false) => {
    setMensagemErro(erro);
    setMensagemSalvo(texto);
    setTimeout(() => setMensagemSalvo(''), erro ? 5000 : 2500);
  };

  // Executa a ação e mostra sucesso OU erro (antes, o aviso de sucesso aparecia mesmo se o banco recusasse).
  const executar = async (acao, msgOk) => {
    try {
      await acao();
      if (msgOk) notificar(msgOk);
      return true;
    } catch (err) {
      console.error(err);
      notificar(`Não foi possível salvar: ${err.message || 'erro desconhecido'}`, true);
      return false;
    }
  };

  const handleSalvarAparencia = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const corPrimaria = form.get('corPrimaria');
    await executar(
      () =>
        atualizarConfigLoja(slugAtivo, {
          nome: form.get('nome'),
          subtitulo: form.get('subtitulo'),
          telefone: normalizarTelefone(form.get('telefone')),
          modo: form.get('modo'),
          corPrimaria,
          corSecundaria: escurecerCor(corPrimaria)
        }),
      'Configurações salvas!'
    );
  };

  const handleCriarItem = async (e) => {
    e.preventDefault();
    if (!novoNome || !novoPreco) return;
    const preco = parseFloat(String(novoPreco).replace(',', '.'));
    if (!Number.isFinite(preco) || preco < 0) {
      notificar('Informe um preço válido.', true);
      return;
    }
    const ok = await executar(
      () =>
        salvarProduto(slugAtivo, {
          categoriaId: novaCategoria || loja.categorias[0]?.id,
          tag: loja.modo === 'agendamento' ? `${novaDuracao} min` : 'Destaque',
          nome: novoNome,
          descricao: novaDescricao,
          preco,
          duracao_minutos: Number(novaDuracao)
        }),
      loja.modo === 'agendamento' ? 'Serviço cadastrado!' : 'Produto adicionado!'
    );
    if (ok) {
      setNovoNome('');
      setNovaDescricao('');
      setNovoPreco('');
    }
  };

  const handleSalvarHorarios = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const cfg = {
      inicio: form.get('inicio'),
      fim: form.get('fim'),
      intervalo: Number(form.get('intervalo')),
      pausaInicio: form.get('pausaInicio') || '',
      pausaFim: form.get('pausaFim') || '',
      dias: form.getAll('dias').map(Number)
    };
    if (cfg.dias.length === 0) return notificar('Marque pelo menos um dia de atendimento.', true);
    if (cfg.fim <= cfg.inicio) return notificar('O horário de fechamento deve ser depois da abertura.', true);
    if (!!cfg.pausaInicio !== !!cfg.pausaFim) return notificar('Preencha o início e o fim da pausa (ou deixe os dois vazios).', true);
    if (cfg.pausaInicio && cfg.pausaFim <= cfg.pausaInicio) return notificar('O fim da pausa deve ser depois do início.', true);
    await executar(() => atualizarConfigAgenda(slugAtivo, cfg), 'Horários de atendimento salvos!');
  };

  const handleCancelarAgendamento = (ag) => {
    if (!window.confirm(`Cancelar o horário de ${ag.cliente_nome}?`)) return;
    executar(async () => {
      await cancelarAgendamento(slugAtivo, ag.id);
      setAgendamentos((lista) => lista.map((a) => (a.id === ag.id ? { ...a, status: 'cancelado' } : a)));
    }, 'Agendamento cancelado.');
  };

  const handleCriarProfissional = async (e) => {
    e.preventDefault();
    if (!nomeProfissional || !loja.id) return;
    const ok = await executar(
      () => adicionarProfissional(loja.id, nomeProfissional.trim(), especialidadeProf.trim()),
      'Profissional adicionado à equipe!'
    );
    if (ok) {
      setNomeProfissional('');
      setEspecialidadeProf('');
    }
  };

  const handleCriarCupom = async (e) => {
    e.preventDefault();
    if (!codigoCupom || !descontoCupom) return;
    const ok = await executar(() => adicionarCupom(slugAtivo, codigoCupom, descontoCupom), 'Cupom ativado!');
    if (ok) {
      setCodigoCupom('');
      setDescontoCupom('');
    }
  };

  const confirmarRemocao = (texto, acao, msgOk) => {
    if (window.confirm(texto)) executar(acao, msgOk);
  };

  const handleLogout = async () => {
    await sair();
    navigate('/login');
  };

  const isAgendamento = loja.modo === 'agendamento';

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f4', color: '#1c1917' }}>
      {/* TOPO DO PAINEL */}
      <header style={{ background: '#1c1917', color: '#fff', padding: '1rem 2rem' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <strong style={{ fontSize: '1.2rem' }}>ConectaLocal · {loja.nome}</strong>
            <span style={{ display: 'block', fontSize: '0.8rem', color: '#a8a29e' }}>
              {usuario ? `Logado como ${usuario.email}` : 'Sem sessão'} · Link: /{loja.slug}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Link
              to={`/${loja.slug}`}
              target="_blank"
              style={{
                background: loja.corPrimaria,
                color: '#fff',
                padding: '0.55rem 1.2rem',
                borderRadius: '9999px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.9rem'
              }}
            >
              Ver Vitrine Ao Vivo ↗
            </Link>

            {usuario && (
              <button
                onClick={handleLogout}
                style={{ background: '#292524', color: '#d6d3d1', border: '1px solid #44403c', padding: '0.55rem 1rem', borderRadius: '9999px', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Sair
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="container" style={{ padding: '2.5rem 2rem' }}>
        {mensagemSalvo && (
          <div style={{ background: mensagemErro ? '#b91c1c' : '#16a34a', color: '#fff', padding: '0.85rem 1.25rem', borderRadius: '0.75rem', marginBottom: '1.5rem', fontWeight: 600 }}>
            {mensagemErro ? '⚠' : '✓'} {mensagemSalvo}
          </div>
        )}

        {/* ABAS */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setAbaAtiva('aparencia')}
            style={{
              padding: '0.75rem 1.4rem',
              borderRadius: '9999px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              background: abaAtiva === 'aparencia' ? '#1c1917' : '#e7e5e4',
              color: abaAtiva === 'aparencia' ? '#fff' : '#44403c'
            }}
          >
            1. Identidade & Modo
          </button>

          <button
            onClick={() => setAbaAtiva('produtos')}
            style={{
              padding: '0.75rem 1.4rem',
              borderRadius: '9999px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              background: abaAtiva === 'produtos' ? '#1c1917' : '#e7e5e4',
              color: abaAtiva === 'produtos' ? '#fff' : '#44403c'
            }}
          >
            {isAgendamento ? '2. Serviços & Preços' : '2. Cardápio & Preços'}
          </button>

          {isAgendamento && (
            <>
              <button
                onClick={() => setAbaAtiva('equipe')}
                style={{
                  padding: '0.75rem 1.4rem',
                  borderRadius: '9999px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  background: abaAtiva === 'equipe' ? '#1c1917' : '#e7e5e4',
                  color: abaAtiva === 'equipe' ? '#fff' : '#44403c'
                }}
              >
                3. Barbeiros / Equipe
              </button>

              <button
                onClick={() => setAbaAtiva('agenda')}
                style={{
                  padding: '0.75rem 1.4rem',
                  borderRadius: '9999px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  background: abaAtiva === 'agenda' ? '#1c1917' : '#e7e5e4',
                  color: abaAtiva === 'agenda' ? '#fff' : '#44403c'
                }}
              >
                4. Agenda ({agendamentos.filter((a) => a.status === 'confirmado').length})
              </button>

              <button
                onClick={() => setAbaAtiva('horarios')}
                style={{
                  padding: '0.75rem 1.4rem',
                  borderRadius: '9999px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  background: abaAtiva === 'horarios' ? '#1c1917' : '#e7e5e4',
                  color: abaAtiva === 'horarios' ? '#fff' : '#44403c'
                }}
              >
                5. Horários de Atendimento
              </button>
            </>
          )}

          <button
            onClick={() => setAbaAtiva('cupons')}
            style={{
              padding: '0.75rem 1.4rem',
              borderRadius: '9999px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              background: abaAtiva === 'cupons' ? '#1c1917' : '#e7e5e4',
              color: abaAtiva === 'cupons' ? '#fff' : '#44403c'
            }}
          >
            Cupons
          </button>
        </div>

        {/* ABA 1: APARÊNCIA */}
        {abaAtiva === 'aparencia' && (
          <form onSubmit={handleSalvarAparencia} className="checkout-card" style={{ maxWidth: '600px', background: '#fff' }}>
            <h3>Configurações do Estabelecimento</h3>
            <label className="field">
              <span>Modo de Funcionamento</span>
              <select
                name="modo"
                defaultValue={loja.modo || 'catalogo'}
                style={{ padding: '0.75rem', borderRadius: '0.6rem', border: '1px solid #d6d3d1', fontWeight: 600 }}
              >
                <option value="catalogo">Cardápio / Catálogo (Pedidos com Sacola)</option>
                <option value="agendamento">Agendamento (Escolha de Profissional + Horário)</option>
              </select>
            </label>
            <label className="field">
              <span>Nome do Estabelecimento</span>
              <input name="nome" defaultValue={loja.nome} required />
            </label>
            <label className="field">
              <span>Subtítulo / Slogan</span>
              <input name="subtitulo" defaultValue={loja.subtitulo} />
            </label>
            <label className="field">
              <span>WhatsApp (com DDD)</span>
              <input name="telefone" defaultValue={loja.telefone} required />
            </label>
            <label className="field">
              <span>Cor Principal</span>
              <input type="color" name="corPrimaria" defaultValue={loja.corPrimaria} style={{ width: '60px', height: '42px', cursor: 'pointer' }} />
            </label>
            <button type="submit" className="btn-primary" style={{ border: 'none', cursor: 'pointer', marginTop: '1rem' }}>
              Salvar Alterações
            </button>
          </form>
        )}

        {/* ABA 2: PRODUTOS OU SERVIÇOS */}
        {abaAtiva === 'produtos' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem', alignItems: 'start' }}>
            <form onSubmit={handleCriarItem} className="checkout-card" style={{ background: '#fff' }}>
              <h3>{isAgendamento ? 'Novo Serviço' : 'Novo Produto'}</h3>
              <label className="field">
                <span>Categoria</span>
                <select
                  value={novaCategoria}
                  onChange={(e) => setNovaCategoria(e.target.value)}
                  style={{ padding: '0.7rem', borderRadius: '0.6rem', border: '1px solid #d6d3d1' }}
                >
                  {(loja.categorias || []).map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{isAgendamento ? 'Nome do Corte / Serviço' : 'Nome do Produto'}</span>
                <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder={isAgendamento ? 'Ex: Corte Degradê + Barba' : 'Ex: Combo Especial'} required />
              </label>
              <label className="field">
                <span>Descrição</span>
                <input value={novaDescricao} onChange={(e) => setNovaDescricao(e.target.value)} placeholder="Detalhes opcionais" />
              </label>
              <label className="field">
                <span>Preço (R$)</span>
                <input type="number" step="0.01" value={novoPreco} onChange={(e) => setNovoPreco(e.target.value)} placeholder="45.00" required />
              </label>
              {isAgendamento && (
                <label className="field">
                  <span>Duração Estimada (minutos)</span>
                  <select value={novaDuracao} onChange={(e) => setNovaDuracao(e.target.value)} style={{ padding: '0.7rem', borderRadius: '0.6rem', border: '1px solid #d6d3d1' }}>
                    <option value="30">30 minutos</option>
                    <option value="45">45 minutos</option>
                    <option value="60">1 hora</option>
                  </select>
                </label>
              )}
              <button type="submit" className="btn-primary" style={{ border: 'none', cursor: 'pointer', width: '100%' }}>
                + Cadastrar
              </button>
            </form>

            <div className="checkout-card" style={{ background: '#fff' }}>
              <h3>Cadastrados ({(loja.produtos || []).length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {(loja.produtos || []).map((prod) => (
                  <div key={prod.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid #e7e5e4', borderRadius: '0.75rem' }}>
                    <div>
                      <strong>{prod.nome}</strong>
                      <p style={{ fontSize: '0.85rem', color: '#78716c', margin: 0 }}>{prod.descricao}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <strong>R$ {Number(prod.preco).toFixed(2).replace('.', ',')}</strong>
                      <button
                        onClick={() => confirmarRemocao(`Excluir "${prod.nome}"?`, () => removerProduto(slugAtivo, prod.id), 'Item excluído.')}
                        style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', padding: '0.45rem 0.75rem', borderRadius: '0.4rem', cursor: 'pointer' }}
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ABA 3: EQUIPE / PROFISSIONAIS */}
        {abaAtiva === 'equipe' && isAgendamento && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '2rem', alignItems: 'start', maxWidth: '900px' }}>
            <form onSubmit={handleCriarProfissional} className="checkout-card" style={{ background: '#fff' }}>
              <h3>Cadastrar Profissional</h3>
              <label className="field">
                <span>Nome do Barbeiro / Profissional</span>
                <input value={nomeProfissional} onChange={(e) => setNomeProfissional(e.target.value)} placeholder="Ex: Lucas Silva" required />
              </label>
              <label className="field">
                <span>Especialidade</span>
                <input value={especialidadeProf} onChange={(e) => setEspecialidadeProf(e.target.value)} placeholder="Ex: Barba & Degradê" />
              </label>
              <button type="submit" className="btn-primary" style={{ border: 'none', cursor: 'pointer', width: '100%' }}>
                + Adicionar à Equipe
              </button>
            </form>

            <div className="checkout-card" style={{ background: '#fff' }}>
              <h3>Equipe Ativa ({(loja.profissionais || []).length})</h3>
              {(loja.profissionais || []).length === 0 ? (
                <p style={{ color: '#78716c' }}>Cadastre pelo menos 1 profissional para liberar a agenda na vitrine.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {loja.profissionais.map((prof) => (
                    <div key={prof.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem', border: '1px solid #e7e5e4', borderRadius: '0.6rem' }}>
                      <div>
                        <strong>{prof.nome}</strong>
                        <span style={{ display: 'block', fontSize: '0.85rem', color: '#78716c' }}>{prof.especialidade}</span>
                      </div>
                      <button
                        onClick={() => confirmarRemocao(`Remover ${prof.nome} da equipe?`, () => removerProfissional(loja.id, prof.id), 'Profissional removido.')}
                        style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', padding: '0.4rem 0.7rem', borderRadius: '0.4rem', cursor: 'pointer' }}
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABA 4: AGENDA DO LOJISTA */}
        {abaAtiva === 'agenda' && isAgendamento && (
          <div className="checkout-card" style={{ background: '#fff', maxWidth: '850px' }}>
            <h3>Horários Agendados</h3>
            {agendamentos.length === 0 ? (
              <p style={{ color: '#78716c' }}>Nenhum cliente agendou horário ainda.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {agendamentos.map((ag) => (
                  <div key={ag.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid #e7e5e4', borderRadius: '0.75rem' }}>
                    <div>
                      <strong>{new Date(ag.data_horario).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</strong>
                      <span style={{ marginLeft: '0.75rem', fontWeight: 600 }}>{ag.cliente_nome}</span>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#57534e' }}>
                        Serviço: {ag.itens?.nome} · Profissional: {ag.profissionais?.nome} · Tel: {ag.cliente_telefone}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <span
                        style={{
                          background: ag.status === 'confirmado' ? '#dcfce7' : '#f5f5f4',
                          color: ag.status === 'confirmado' ? '#15803d' : '#78716c',
                          padding: '0.3rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          textTransform: 'capitalize'
                        }}
                      >
                        {ag.status || 'confirmado'}
                      </span>
                      <a
                        href={`https://wa.me/${normalizarTelefone(ag.cliente_telefone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '0.8rem', fontWeight: 600, color: '#15803d' }}
                      >
                        WhatsApp
                      </a>
                      {ag.status === 'confirmado' && (
                        <button
                          onClick={() => handleCancelarAgendamento(ag)}
                          style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', padding: '0.35rem 0.7rem', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.8rem' }}
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA HORÁRIOS DE ATENDIMENTO */}
        {abaAtiva === 'horarios' && isAgendamento && (() => {
          const cfg = configAgenda(loja);
          return (
            <form onSubmit={handleSalvarHorarios} className="checkout-card" style={{ maxWidth: '600px', background: '#fff' }}>
              <h3>Horários de Atendimento</h3>
              <p style={{ color: '#78716c', fontSize: '0.9rem', margin: '0 0 1rem' }}>
                É o que seus clientes enxergam na hora de agendar. A duração de cada serviço é respeitada automaticamente.
              </p>

              <div className="field">
                <span>Dias de atendimento</span>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {DIAS_SEMANA.map((nome, i) => (
                    <label key={nome} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                      <input type="checkbox" name="dias" value={i} defaultChecked={cfg.dias.includes(i)} />
                      {nome}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <label className="field">
                  <span>Abre às</span>
                  <input type="time" name="inicio" defaultValue={cfg.inicio} required />
                </label>
                <label className="field">
                  <span>Fecha às</span>
                  <input type="time" name="fim" defaultValue={cfg.fim} required />
                </label>
                <label className="field">
                  <span>Pausa (almoço) das</span>
                  <input type="time" name="pausaInicio" defaultValue={cfg.pausaInicio} />
                </label>
                <label className="field">
                  <span>até</span>
                  <input type="time" name="pausaFim" defaultValue={cfg.pausaFim} />
                </label>
              </div>

              <label className="field">
                <span>Intervalo entre horários</span>
                <select
                  name="intervalo"
                  defaultValue={cfg.intervalo}
                  style={{ padding: '0.7rem', borderRadius: '0.6rem', border: '1px solid #d6d3d1' }}
                >
                  <option value="15">15 minutos</option>
                  <option value="30">30 minutos</option>
                  <option value="45">45 minutos</option>
                  <option value="60">1 hora</option>
                </select>
              </label>

              <button type="submit" className="btn-primary" style={{ border: 'none', cursor: 'pointer', marginTop: '1rem' }}>
                Salvar Horários
              </button>
            </form>
          );
        })()}

        {/* ABA CUPONS */}
        {abaAtiva === 'cupons' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start', maxWidth: '900px' }}>
            <form onSubmit={handleCriarCupom} className="checkout-card" style={{ background: '#fff' }}>
              <h3>Criar Novo Cupom</h3>
              <label className="field">
                <span>Código do Cupom</span>
                <input value={codigoCupom} onChange={(e) => setCodigoCupom(e.target.value.toUpperCase())} placeholder="Ex: CORTE10" required />
              </label>
              <label className="field">
                <span>Desconto (%)</span>
                <input type="number" min="1" max="100" value={descontoCupom} onChange={(e) => setDescontoCupom(e.target.value)} placeholder="10" required />
              </label>
              <button type="submit" className="btn-primary" style={{ border: 'none', cursor: 'pointer', width: '100%' }}>
                Criar Cupom
              </button>
            </form>

            <div className="checkout-card" style={{ background: '#fff' }}>
              <h3>Cupons Ativos</h3>
              {(loja.cupons || []).map((c) => (
                <div key={c.codigo} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', border: '1px dashed #a8a29e', borderRadius: '0.5rem', marginBottom: '0.5rem' }}>
                  <span><strong>{c.codigo}</strong> — {c.desconto_percentual || c.descontoPercentual}% OFF</span>
                  <button onClick={() => confirmarRemocao(`Remover o cupom ${c.codigo}?`, () => removerCupom(slugAtivo, c.codigo), 'Cupom removido.')} style={{ color: '#b91c1c', background: 'none', border: 'none', cursor: 'pointer' }}>Remover</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}