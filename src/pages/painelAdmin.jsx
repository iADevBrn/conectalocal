import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLojas } from '../context/lojaContext';
import { supabase } from '../lib/supabase';

export default function PainelAdmin() {
  const navigate = useNavigate();
  const {
    lojas,
    usuario,
    minhaLoja,
    carregando,
    atualizarConfigLoja,
    salvarProduto,
    removerProduto,
    adicionarCupom,
    removerCupom,
    adicionarProfissional,
    removerProfissional,
    sair
  } = useLojas();

  // Se houver loja vinculada ao usuário logado, usa ela; caso contrário, usa 'raizes' para testes
  const slugAtivo = minhaLoja ? minhaLoja.slug : 'raizes';
  const loja = lojas[slugAtivo];

  const [abaAtiva, setAbaAtiva] = useState('aparencia');
  const [mensagemSalvo, setMensagemSalvo] = useState('');

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

  if (!loja) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center' }}>
        <h2>Nenhuma loja encontrada</h2>
        <Link to="/login">Fazer login ou criar loja</Link>
      </div>
    );
  }

  const notificar = (texto) => {
    setMensagemSalvo(texto);
    setTimeout(() => setMensagemSalvo(''), 2500);
  };

  const handleSalvarAparencia = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    await atualizarConfigLoja(slugAtivo, {
      nome: form.get('nome'),
      subtitulo: form.get('subtitulo'),
      telefone: form.get('telefone'),
      modo: form.get('modo'),
      corPrimaria: form.get('corPrimaria'),
      corSecundaria: form.get('corPrimaria')
    });
    notificar('Configurações salvas na nuvem!');
  };

  const handleCriarItem = async (e) => {
    e.preventDefault();
    if (!novoNome || !novoPreco) return;
    await salvarProduto(slugAtivo, {
      categoriaId: novaCategoria || loja.categorias[0]?.id,
      tag: loja.modo === 'agendamento' ? `${novaDuracao} min` : 'Destaque',
      nome: novoNome,
      descricao: novaDescricao,
      preco: parseFloat(novoPreco.replace(',', '.')),
      duracao_minutos: Number(novaDuracao)
    });
    setNovoNome('');
    setNovaDescricao('');
    setNovoPreco('');
    notificar(loja.modo === 'agendamento' ? 'Serviço cadastrado!' : 'Produto adicionado!');
  };

  const handleCriarProfissional = async (e) => {
    e.preventDefault();
    if (!nomeProfissional || !loja.id) return;
    await adicionarProfissional(loja.id, nomeProfissional, especialidadeProf);
    setNomeProfissional('');
    setEspecialidadeProf('');
    notificar('Profissional adicionado à equipe!');
  };

  const handleCriarCupom = async (e) => {
    e.preventDefault();
    if (!codigoCupom || !descontoCupom) return;
    await adicionarCupom(slugAtivo, codigoCupom, descontoCupom);
    setCodigoCupom('');
    setDescontoCupom('');
    notificar('Cupom ativado!');
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
              {usuario ? `Logado como ${usuario.email}` : 'Modo Demonstração'} · Link: /{loja.slug}
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
          <div style={{ background: '#16a34a', color: '#fff', padding: '0.85rem 1.25rem', borderRadius: '0.75rem', marginBottom: '1.5rem', fontWeight: 600 }}>
            ✓ {mensagemSalvo}
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
                4. Agenda ({agendamentos.length})
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
              <span>WhatsApp (55 + DDD + Número)</span>
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
                        onClick={() => removerProduto(slugAtivo, prod.id)}
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
                        onClick={() => removerProfissional(prof.id)}
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
                    <span style={{ background: '#dcfce7', color: '#15803d', padding: '0.3rem 0.75rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 700 }}>
                      Confirmado
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
                  <button onClick={() => removerCupom(slugAtivo, c.codigo)} style={{ color: '#b91c1c', background: 'none', border: 'none', cursor: 'pointer' }}>Remover</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}