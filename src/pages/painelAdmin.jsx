import { useState, useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useLojas } from '../context/lojaContextApi';
import { supabase } from '../lib/supabase';
import { normalizarTelefone } from '../lib/telefone';
import { escurecerCor } from '../lib/cores';
import { configAgenda, DIAS_SEMANA, horaSP } from '../lib/agenda';
import { atualizarStatusPedido as atualizarStatusPedidoApi, listarPedidosLoja } from '../lib/cliente';
import UploadImagem from '../components/UploadImagem';
import {
  FONTES, CANTOS, CAPAS, CABECALHOS, LISTAGENS,
  lerTema, normalizarTema, urlHttps, corValida
} from '../lib/tema';
import TemaLoja from '../components/TemaLoja';
import HeroLoja from '../components/HeroLoja';

const moeda = (v) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
const fmtData = (iso) =>
  new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit' });
const COR_FUNDO_PADRAO = { claro: '#fafafa', suave: '#fbf6ec', escuro: '#050505' };
const STATUS_PEDIDO = {
  enviado_whatsapp: 'Aguardando confirmação',
  confirmado: 'Confirmado',
  preparando: 'Em preparo',
  pronto: 'Pronto',
  entregue: 'Entregue',
  cancelado: 'Cancelado'
};
const ACOES_STATUS_PEDIDO = {
  enviado_whatsapp: [
    { status: 'confirmado', rotulo: 'Confirmar' },
    { status: 'cancelado', rotulo: 'Cancelar', perigo: true }
  ],
  confirmado: [
    { status: 'preparando', rotulo: 'Iniciar preparo' },
    { status: 'cancelado', rotulo: 'Cancelar', perigo: true }
  ],
  preparando: [
    { status: 'pronto', rotulo: 'Marcar pronto' },
    { status: 'cancelado', rotulo: 'Cancelar', perigo: true }
  ],
  pronto: [{ status: 'entregue', rotulo: 'Marcar entregue' }]
};

// Grupo de botões de escolha (tema, fonte, cantos...)
function Opcoes({ valor, opcoes, onChange, estiloFonte = false }) {
  return (
    <div className="opt-grid">
      {Object.entries(opcoes).map(([id, o]) => (
        <button
          key={id}
          type="button"
          className="opt"
          aria-pressed={valor === id}
          onClick={() => onChange(id)}
          style={estiloFonte ? { fontFamily: o.amostra } : undefined}
        >
          <strong>{o.nome}</strong>
          {o.desc && <small>{o.desc}</small>}
        </button>
      ))}
    </div>
  );
}

function SeletorCor({ label, cor, onChange, help }) {
  return (
    <div className="color-field">
      <span>{label}</span>
      <input
        className="color-picker"
        type="color"
        value={corValida(cor, '#000000')}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`Escolher visualmente ${label.toLowerCase()}`}
      />
      {help && <small>{help}</small>}
    </div>
  );
}

// ---------- Aba "Aparência": personalização com pré-visualização ao vivo ----------
function AbaAparencia({ loja, onSalvar, salvando }) {
  const [uploadsAtivos, setUploadsAtivos] = useState({ logo: false, capa: false });
  const [form, setForm] = useState(() => ({
    modo: loja.modo || 'catalogo',
    nome: loja.nome || '',
    subtitulo: loja.subtitulo || '',
    telefone: loja.telefone || '',
    logoUrl: /^https:\/\//.test(loja.logo || '') ? loja.logo : '',
    cor: corValida(loja.corPrimaria, '#b45309'),
    tema: lerTema(loja)
  }));

  const campo = (chave) => (e) => setForm((f) => ({ ...f, [chave]: e.target.value }));
  const setTema = (chave, valor) => setForm((f) => ({ ...f, tema: { ...f.tema, [chave]: valor } }));
  const temaTxt = (chave) => (e) => setTema(chave, e.target.value);

  const tema = normalizarTema(form.tema);
  const uploadAtivo = Object.values(uploadsAtivos).some(Boolean);
  const secundaria = escurecerCor(form.cor);
  const catalogo = form.modo !== 'agendamento';
  const lojaPreview = {
    ...loja,
    nome: form.nome || 'Nome do seu negócio',
    subtitulo: form.subtitulo,
    telefone: form.telefone,
    logo: urlHttps(form.logoUrl) || null
  };
  const amostras = (loja.produtos || []).slice(0, 2).length
    ? (loja.produtos || []).slice(0, 2)
    : [
        { id: 'a', tag: catalogo ? 'Destaque' : '30 min', nome: catalogo ? 'Item de exemplo' : 'Corte de exemplo', descricao: 'Descrição curta do que você oferece.', preco: 25 },
        { id: 'b', tag: catalogo ? 'Novo' : '45 min', nome: catalogo ? 'Outro item' : 'Barba completa', descricao: 'Mais um exemplo para ver o estilo.', preco: 32 }
      ];

  const salvar = (e) => {
    e.preventDefault();
    onSalvar({
      nome: form.nome.trim(),
      subtitulo: form.subtitulo.trim(),
      telefone: normalizarTelefone(form.telefone),
      modo: form.modo,
      corPrimaria: corValida(form.cor, '#b45309'),
      corSecundaria: secundaria,
      logoUrl: urlHttps(form.logoUrl) || '',
      personalizacao: normalizarTema(form.tema)
    });
  };

  return (
    <form onSubmit={salvar} className="studio">
      <div className="studio-form">
        <section className="card">
          <h3>Identidade</h3>
          <label className="field">
            <span>Tipo de funcionamento</span>
            <select value={form.modo} onChange={campo('modo')}>
              <option value="catalogo">Cardápio / catálogo (pedidos com sacola)</option>
              <option value="agendamento">Agendamento (profissional + horário)</option>
            </select>
          </label>
          <div className="field-row">
            <label className="field">
              <span>Nome do estabelecimento</span>
              <input value={form.nome} onChange={campo('nome')} maxLength={80} required />
            </label>
            <label className="field">
              <span>Slogan</span>
              <input value={form.subtitulo} onChange={campo('subtitulo')} maxLength={60} placeholder="Ex: Cozinha artesanal" />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>WhatsApp (com DDD)</span>
              <input value={form.telefone} onChange={campo('telefone')} inputMode="tel" required />
            </label>
            <UploadImagem
              label="Logo (opcional)"
              value={form.logoUrl}
              onChange={(logoUrl) => setForm((f) => ({ ...f, logoUrl }))}
              onUploadingChange={(ativo) => setUploadsAtivos((u) => ({ ...u, logo: ativo }))}
              aspectRatio={1}
              help="Selecione uma imagem do seu computador ou celular (até 5 MB)."
            />
          </div>
        </section>

        <section className="card">
          <h3>Cores</h3>
          <SeletorCor
            label="Cor da sua marca"
            cor={form.cor}
            onChange={(cor) => setForm((f) => ({ ...f, cor }))}
          />
          <SeletorCor
            label="Fundo da vitrine"
            cor={tema.corFundo || COR_FUNDO_PADRAO[tema.modo]}
            onChange={(corFundo) => setTema('corFundo', corFundo)}
            help="A cor do texto se ajusta automaticamente para manter o contraste."
          />
          {tema.corFundo && (
            <button type="button" className="link-btn" onClick={() => setTema('corFundo', '')}>
              Restaurar fundo padrão
            </button>
          )}
        </section>

        <section className="card">
          <h3>Estilo</h3>
          <p className="group-title">Fonte</p>
          <Opcoes valor={tema.fonte} opcoes={FONTES} onChange={(v) => setTema('fonte', v)} estiloFonte />

          <p className="group-title">Cantos dos botões e cartões</p>
          <Opcoes valor={tema.cantos} opcoes={CANTOS} onChange={(v) => setTema('cantos', v)} />

          <p className="group-title">Topo da vitrine</p>
          <Opcoes valor={tema.cabecalho} opcoes={CABECALHOS} onChange={(v) => setTema('cabecalho', v)} />

          {tema.cabecalho === 'capa' && (
            <>
              <p className="group-title">Estilo da capa</p>
              <Opcoes valor={tema.capa} opcoes={CAPAS} onChange={(v) => setTema('capa', v)} />
              <UploadImagem
                label="Foto de capa (opcional)"
                value={form.tema.capaUrl}
                onChange={(capaUrl) => setTema('capaUrl', capaUrl)}
                onUploadingChange={(ativo) => setUploadsAtivos((u) => ({ ...u, capa: ativo }))}
                aspectRatio={null}
                help="Se preencher, a foto substitui o estilo acima. Selecione uma imagem (até 5 MB)."
              />
            </>
          )}

          {catalogo && (
            <>
              <p className="group-title">Como listar os itens</p>
              <Opcoes valor={tema.listagem} opcoes={LISTAGENS} onChange={(v) => setTema('listagem', v)} />
            </>
          )}

          <label className="check">
            <input type="checkbox" checked={tema.animacoes} onChange={(e) => setTema('animacoes', e.target.checked)} />
            Animações suaves ao passar o mouse
          </label>
        </section>

        <section className="card">
          <h3>Apresentação</h3>
          <label className="field">
            <span>Sobre o negócio</span>
            <textarea value={form.tema.sobre} onChange={temaTxt('sobre')} maxLength={300} placeholder="Conte em poucas palavras o que torna seu negócio especial." />
            <small>{form.tema.sobre.length}/300</small>
          </label>
          <div className="field-row">
            <label className="field">
              <span>Horário de funcionamento</span>
              <input value={form.tema.horarioTexto} onChange={temaTxt('horarioTexto')} maxLength={80} placeholder="Seg a Sáb, 9h às 19h" />
            </label>
            <label className="field">
              <span>Instagram</span>
              <input value={form.tema.instagram} onChange={temaTxt('instagram')} maxLength={40} placeholder="@seunegocio" />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Endereço</span>
              <input value={form.tema.endereco} onChange={temaTxt('endereco')} maxLength={120} placeholder="Rua, número, bairro" />
            </label>
            <label className="field">
              <span>Link do mapa (opcional)</span>
              <input value={form.tema.mapaLink} onChange={temaTxt('mapaLink')} placeholder="https://maps.google.com/..." inputMode="url" />
            </label>
          </div>
        </section>

        <div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={salvando || uploadAtivo}>
            {salvando ? 'Salvando...' : uploadAtivo ? 'Enviando imagem...' : 'Salvar aparência'}
          </button>
        </div>
      </div>

      <aside className="studio-preview" aria-label="Pré-visualização">
        <div className="preview-label">Pré-visualização <span>atualiza ao vivo</span></div>
        <div className="preview-frame">
          <TemaLoja tema={tema} corPrimaria={form.cor} corSecundaria={secundaria} corFundo={tema.corFundo}>
            <div className="v-topbar">
              <div className="v-wrap v-topbar-in">
                <div className="v-brand">{lojaPreview.logo ? <img src={lojaPreview.logo} alt="" /> : <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true"><rect width="34" height="34" rx="9" fill="var(--brand)"/><path d="M10 17h14M17 10v14" stroke="var(--brand-ink)" strokeWidth="3" strokeLinecap="round"/></svg>}<span>{lojaPreview.nome}</span></div>
                {catalogo && <span className="v-cart-btn"><i className="fa-solid fa-bag-shopping" /> Sacola <span className="v-cart-count">0</span></span>}
              </div>
            </div>
            <HeroLoja loja={lojaPreview} tema={tema} demo />
            <div className="v-wrap" style={{ paddingBottom: '1rem' }}>
              <div className="v-chips" style={{ margin: '0 0 0.25rem', padding: '0.6rem 0' }}>
                <span className="v-chip active">Tudo</span>
                <span className="v-chip">Categoria</span>
              </div>
              <div className={`v-grid ${tema.listagem === 'lista' && catalogo ? 'is-lista' : ''}`}>
                {amostras.map((a) => (
                  <article key={a.id} className="v-item">
                    <div className="v-item-body">
                      {a.tag && <span className="v-tag">{a.tag}</span>}
                      <h3>{a.nome}</h3>
                      {a.descricao && <p>{a.descricao}</p>}
                    </div>
                    <div className="v-item-foot">
                      <span className="v-price">{moeda(a.preco)}</span>
                      <span className="v-add">{catalogo ? <><i className="fa-solid fa-plus" /> Adicionar</> : 'Agendar'}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <div className="v-footer"><div className="v-wrap"><strong>{lojaPreview.nome}</strong> · Feito com ConectaLocal</div></div>
          </TemaLoja>
        </div>
      </aside>
    </form>
  );
}

// ---------- Painel ----------
export default function PainelAdmin() {
  const navigate = useNavigate();
  const {
    lojas, usuario, minhaLoja, carregando,
    atualizarConfigLoja, atualizarConfigAgenda, cancelarAgendamento,
    salvarProduto, removerProduto, adicionarCupom, removerCupom,
    adicionarProfissional, removerProfissional, sair
  } = useLojas();

  // O painel só edita a loja do usuário logado (sem fallback para loja de demonstração).
  const slugAtivo = minhaLoja?.slug;
  const loja = slugAtivo ? lojas[slugAtivo] : null;

  const [abaAtiva, setAbaAtiva] = useState('aparencia');
  const [aviso, setAviso] = useState(null); // { texto, erro }
  const [salvando, setSalvando] = useState(false);

  // Produtos/Serviços
  const [novoNome, setNovoNome] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoPreco, setNovoPreco] = useState('');
  const [novaDuracao, setNovaDuracao] = useState('30');
  const [novaCategoria, setNovaCategoria] = useState('');

  // Derivado: primeira categoria disponível se não houver seleção manual
  const categoriaDefault = novaCategoria || loja?.categorias?.[0]?.id || '';

  // Profissionais (modo agendamento)
  const [nomeProfissional, setNomeProfissional] = useState('');
  const [especialidadeProf, setEspecialidadeProf] = useState('');
  const [agendamentos, setAgendamentos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [carregandoPedidos, setCarregandoPedidos] = useState(true);
  const [erroPedidos, setErroPedidos] = useState('');
  const [pedidoAtualizando, setPedidoAtualizando] = useState(null);
  const [tentativaPedidos, setTentativaPedidos] = useState(0);
  const [codigoCupom, setCodigoCupom] = useState('');
  const [descontoCupom, setDescontoCupom] = useState('');

  useEffect(() => {
    if (!loja?.id) {
      return;
    }

    let ativo = true;
    supabase
      .from('agendamentos')
      .select('*')
      .eq('loja_id', loja.id)
      .order('data_horario', { ascending: true })
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) {
          console.error(error);
          setAgendamentos([]);
          return;
        }
        setAgendamentos(data || []);
      });

    return () => {
      ativo = false;
    };
  }, [loja?.id]);

  useEffect(() => {
    if (!slugAtivo || loja?.modo === 'agendamento') return undefined;

    let ativo = true;
    listarPedidosLoja(slugAtivo)
      .then((data) => {
        if (ativo) setPedidos(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('Erro ao carregar pedidos da loja:', err);
        if (ativo) setErroPedidos(err.message || 'Não foi possível carregar os pedidos.');
      })
      .finally(() => {
        if (ativo) setCarregandoPedidos(false);
      });

    return () => {
      ativo = false;
    };
  }, [slugAtivo, loja?.modo, tentativaPedidos]);

  if (carregando) {
    return <div className="v-notfound">Carregando painel...</div>;
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  if (!loja) {
    return (
      <div className="v-notfound">
        <div>
          <h1>Nenhuma loja encontrada para esta conta</h1>
          <p style={{ color: 'var(--muted)', margin: '0.5rem 0 1.25rem' }}>Se você acabou de se cadastrar, confirme seu e-mail e entre novamente.</p>
          <Link to="/login" className="btn btn-primary">Voltar ao login</Link>
        </div>
      </div>
    );
  }

  const notificar = (texto, erro = false) => {
    setAviso({ texto, erro });
    setTimeout(() => setAviso(null), erro ? 5000 : 2500);
  };

  // Executa a ação e mostra sucesso OU erro (o aviso de sucesso nunca aparece se o banco recusar).
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

  const salvarAparencia = async (dados) => {
    setSalvando(true);
    await executar(() => atualizarConfigLoja(slugAtivo, dados), 'Aparência salva! Sua vitrine já está atualizada.');
    setSalvando(false);
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
          categoriaId: categoriaDefault,
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

  const handleAtualizarStatusPedido = async (pedido, status) => {
    const confirmacao = status === 'cancelado'
      ? 'Cancelar este pedido?'
      : status === 'entregue'
        ? 'Confirmar que este pedido foi entregue? Os pontos de fidelidade serão creditados.'
        : `${ACOES_STATUS_PEDIDO[pedido.status]?.find((acao) => acao.status === status)?.rotulo || 'Atualizar'} este pedido?`;
    if (!window.confirm(confirmacao)) return;

    setPedidoAtualizando(pedido.id);
    try {
      await atualizarStatusPedidoApi(pedido.id, status);
      setPedidos((lista) => lista.map((item) => (item.id === pedido.id ? { ...item, status } : item)));
      notificar(status === 'entregue'
        ? 'Pedido entregue. Os pontos de fidelidade foram creditados.'
        : 'Status do pedido atualizado.');
    } catch (err) {
      console.error('Erro ao atualizar pedido:', err);
      notificar(`Não foi possível atualizar o pedido: ${err.message || 'erro desconhecido'}`, true);
    } finally {
      setPedidoAtualizando(null);
    }
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

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${loja.slug}`);
      notificar('Link da sua vitrine copiado!');
    } catch {
      notificar('Não foi possível copiar. Selecione o link manualmente.', true);
    }
  };

  const handleLogout = async () => {
    await sair();
    navigate('/login');
  };

  const isAgendamento = loja.modo === 'agendamento';
  const futuros = agendamentos.filter((a) => a.status === 'confirmado' && new Date(a.data_horario) > new Date()).length;
  const pedidosPendentes = pedidos.filter((pedido) => pedido.status === 'enviado_whatsapp').length;

  const secoes = [
    { id: 'aparencia', icone: 'fa-palette', rotulo: 'Aparência', titulo: 'Aparência da vitrine', sub: 'Personalize cores, fonte, capa e informações. Veja o resultado ao vivo.' },
    { id: 'produtos', icone: isAgendamento ? 'fa-scissors' : 'fa-utensils', rotulo: isAgendamento ? 'Serviços' : 'Cardápio', titulo: isAgendamento ? 'Serviços e preços' : 'Cardápio e preços', sub: 'Cadastre o que você oferece.' },
    ...(!isAgendamento
      ? [{ id: 'pedidos', icone: 'fa-bag-shopping', rotulo: 'Pedidos', count: pedidosPendentes, titulo: 'Pedidos recebidos', sub: 'Acompanhe os pedidos enviados pelo WhatsApp.' }]
      : []),
    ...(isAgendamento
      ? [
          { id: 'equipe', icone: 'fa-users', rotulo: 'Equipe', titulo: 'Equipe', sub: 'Profissionais que aparecem na hora do agendamento.' },
          { id: 'agenda', icone: 'fa-calendar-check', rotulo: 'Agenda', count: futuros, titulo: 'Agenda', sub: 'Horários marcados pelos seus clientes.' },
          { id: 'horarios', icone: 'fa-clock', rotulo: 'Horários', titulo: 'Horários de atendimento', sub: 'Dias, expediente e pausas da sua agenda.' }
        ]
      : []),
    { id: 'cupons', icone: 'fa-ticket', rotulo: 'Cupons', titulo: 'Cupons de desconto', sub: 'Códigos promocionais para seus clientes.' }
  ];
  const secao = secoes.find((s) => s.id === abaAtiva) || secoes[0];

  const stats = isAgendamento
    ? [
        { r: 'Horários futuros', v: futuros },
        { r: 'Serviços', v: (loja.produtos || []).length },
        { r: 'Profissionais', v: (loja.profissionais || []).length }
      ]
    : abaAtiva === 'pedidos'
    ? [
        { r: 'Pedidos registrados', v: pedidos.length },
        { r: 'Aguardando confirmação', v: pedidosPendentes },
        { r: 'Entregues', v: pedidos.filter((pedido) => pedido.status === 'entregue').length }
      ]
    : [
        { r: 'Itens no cardápio', v: (loja.produtos || []).length },
        { r: 'Categorias', v: (loja.categorias || []).length },
        { r: 'Cupons ativos', v: (loja.cupons || []).length }
      ];

  return (
    <div className="adm">
      <aside className="adm-side">
        <Link to="/" className="adm-brand">
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true"><rect width="34" height="34" rx="9" fill="white"/><path d="M10 17h14M17 10v14" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round"/></svg> ConectaLocal
        </Link>

        <div className="adm-store">
          <strong>{loja.nome}</strong>
          <span>/{loja.slug}</span>
        </div>

        <nav className="adm-nav" aria-label="Seções do painel">
          {secoes.map((s) => (
            <button key={s.id} className={abaAtiva === s.id ? 'active' : ''} onClick={() => setAbaAtiva(s.id)}>
              <i className={`fa-solid ${s.icone}`} /> {s.rotulo}
              {s.count > 0 && <span className="count">{s.count}</span>}
            </button>
          ))}
        </nav>

        <div className="adm-side-foot">
          <button className="btn btn-sm btn-primary" onClick={copiarLink}><i className="fa-solid fa-link" /> Copiar link</button>
          <Link to={`/${loja.slug}`} target="_blank" className="btn btn-sm btn-ghost" style={{ color: '#e7e5e4', borderColor: '#44403c' }}>
            <i className="fa-solid fa-arrow-up-right-from-square" /> Ver vitrine
          </Link>
          <button className="btn btn-sm btn-ghost" style={{ color: '#a8a29e', borderColor: '#44403c' }} onClick={handleLogout}>
            <i className="fa-solid fa-right-from-bracket" /> Sair
          </button>
        </div>
      </aside>

      <main className="adm-main">
        <div className="adm-head">
          <div>
            <h1>{secao.titulo}</h1>
            <p>{secao.sub}</p>
          </div>
        </div>

        {abaAtiva !== 'aparencia' && (
          <div className="stat-grid">
            {stats.map((s) => (
              <div key={s.r} className="stat"><small>{s.r}</small><strong>{s.v}</strong></div>
            ))}
          </div>
        )}

        {/* APARÊNCIA */}
        {abaAtiva === 'aparencia' && <AbaAparencia key={loja.id} loja={loja} onSalvar={salvarAparencia} salvando={salvando} />}

        {/* PEDIDOS */}
        {abaAtiva === 'pedidos' && !isAgendamento && (
          <div className="card">
            <h3>Pedidos recentes</h3>
            {carregandoPedidos ? (
              <p className="empty" role="status">Carregando pedidos...</p>
            ) : erroPedidos ? (
              <div>
                <p className="alert alert-error" role="alert">{erroPedidos}</p>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setErroPedidos('');
                    setCarregandoPedidos(true);
                    setTentativaPedidos((tentativa) => tentativa + 1);
                  }}
                >
                  Tentar novamente
                </button>
              </div>
            ) : pedidos.length === 0 ? (
              <p className="empty">Nenhum pedido registrado ainda. Os pedidos de clientes conectados aparecerão aqui.</p>
            ) : (
              <div className="admin-pedidos-list">
                {pedidos.map((pedido) => {
                  const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
                  const acoes = ACOES_STATUS_PEDIDO[pedido.status] || [];
                  const statusClass = pedido.status === 'cancelado' ? 'pill-off' : 'pill-ok';
                  const mensagemWhatsApp = `Olá${pedido.cliente_nome ? ` ${pedido.cliente_nome}` : ''}, sobre seu pedido #${String(pedido.id).slice(0, 8)}.`;

                  return (
                    <article key={pedido.id} className="admin-pedido-card">
                      <div>
                        <div className="admin-pedido-head">
                          <strong>Pedido #{String(pedido.id).slice(0, 8)} · {pedido.cliente_nome || 'Cliente'}</strong>
                          <span className={`pill ${statusClass}`}>{STATUS_PEDIDO[pedido.status] || pedido.status}</span>
                        </div>
                        <small>{new Date(pedido.criado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</small>
                        <p className="admin-pedido-items">
                          {itens.map((item) => (
                            `${item.quantidade}x ${item.nome}${item.opcao ? ` (${item.opcao})` : ''}`
                          )).join(' · ') || 'Itens do pedido não disponíveis'}
                        </p>
                        <small>
                          Subtotal: {moeda(pedido.subtotal)} · Desconto: {moeda(pedido.desconto)} · Total: <strong>{moeda(pedido.total)}</strong>
                        </small>
                        {pedido.cupom_codigo && <small>Cupom: {pedido.cupom_codigo} ({pedido.cupom_desconto_pct}% OFF)</small>}
                      </div>
                      <div className="admin-pedido-actions">
                        {pedido.cliente_telefone && (
                          <a
                            className="btn btn-soft btn-sm"
                            href={`https://wa.me/${normalizarTelefone(pedido.cliente_telefone)}?text=${encodeURIComponent(mensagemWhatsApp)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <i className="fa-brands fa-whatsapp" /> WhatsApp
                          </a>
                        )}
                        {acoes.map((acao) => (
                          <button
                            key={acao.status}
                            type="button"
                            className={`btn ${acao.perigo ? 'btn-danger' : 'btn-primary'} btn-sm`}
                            onClick={() => handleAtualizarStatusPedido(pedido, acao.status)}
                            disabled={pedidoAtualizando === pedido.id}
                          >
                            {pedidoAtualizando === pedido.id ? 'Atualizando...' : acao.rotulo}
                          </button>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            <p className="admin-pedido-note">Os pontos de fidelidade são creditados somente quando o pedido é marcado como entregue.</p>
          </div>
        )}

        {/* PRODUTOS OU SERVIÇOS */}
        {abaAtiva === 'produtos' && (
          <div className="split">
            <form onSubmit={handleCriarItem} className="card">
              <h3>{isAgendamento ? 'Novo serviço' : 'Novo produto'}</h3>
              <label className="field">
                <span>Categoria</span>
                <select value={novaCategoria} onChange={(e) => setNovaCategoria(e.target.value)}>
                  {(loja.categorias || []).map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{isAgendamento ? 'Nome do serviço' : 'Nome do produto'}</span>
                <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder={isAgendamento ? 'Ex: Corte degradê + barba' : 'Ex: Combo especial'} maxLength={80} required />
              </label>
              <label className="field">
                <span>Descrição</span>
                <input value={novaDescricao} onChange={(e) => setNovaDescricao(e.target.value)} placeholder="Detalhes opcionais" maxLength={200} />
              </label>
              <label className="field">
                <span>Preço (R$)</span>
                <input type="number" step="0.01" min="0" value={novoPreco} onChange={(e) => setNovoPreco(e.target.value)} placeholder="45.00" required />
              </label>
              {isAgendamento && (
                <label className="field">
                  <span>Duração estimada</span>
                  <select value={novaDuracao} onChange={(e) => setNovaDuracao(e.target.value)}>
                    <option value="30">30 minutos</option>
                    <option value="45">45 minutos</option>
                    <option value="60">1 hora</option>
                    <option value="90">1 hora e 30 minutos</option>
                    <option value="120">2 horas</option>
                  </select>
                </label>
              )}
              <button type="submit" className="btn btn-primary btn-block">+ Cadastrar</button>
            </form>

            <div className="card">
              <h3>Cadastrados ({(loja.produtos || []).length})</h3>
              {(loja.produtos || []).length === 0 ? (
                <p className="empty">Nada por aqui ainda. Cadastre o primeiro item ao lado.</p>
              ) : (
                <div className="list">
                  {(loja.produtos || []).map((prod) => (
                    <div key={prod.id} className="row">
                      <div>
                        <strong>{prod.nome}</strong>
                        {prod.descricao && <small>{prod.descricao}</small>}
                      </div>
                      <div className="row-actions">
                        <strong>{moeda(prod.preco)}</strong>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => confirmarRemocao(`Excluir "${prod.nome}"?`, () => removerProduto(slugAtivo, prod.id), 'Item excluído.')}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* EQUIPE */}
        {abaAtiva === 'equipe' && isAgendamento && (
          <div className="split">
            <form onSubmit={handleCriarProfissional} className="card">
              <h3>Cadastrar profissional</h3>
              <label className="field">
                <span>Nome</span>
                <input value={nomeProfissional} onChange={(e) => setNomeProfissional(e.target.value)} placeholder="Ex: Lucas Silva" maxLength={60} required />
              </label>
              <label className="field">
                <span>Especialidade</span>
                <input value={especialidadeProf} onChange={(e) => setEspecialidadeProf(e.target.value)} placeholder="Ex: Barba e degradê" maxLength={60} />
              </label>
              <button type="submit" className="btn btn-primary btn-block">+ Adicionar à equipe</button>
            </form>

            <div className="card">
              <h3>Equipe ({(loja.profissionais || []).length})</h3>
              {(loja.profissionais || []).length === 0 ? (
                <p className="empty">Cadastre pelo menos 1 profissional para liberar a agenda na vitrine.</p>
              ) : (
                <div className="list">
                  {loja.profissionais.map((prof) => (
                    <div key={prof.id} className="row">
                      <div>
                        <strong>{prof.nome}</strong>
                        <small>{prof.especialidade}</small>
                      </div>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => confirmarRemocao(`Remover ${prof.nome} da equipe?`, () => removerProfissional(loja.id, prof.id), 'Profissional removido.')}
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

        {/* AGENDA DO LOJISTA */}
        {abaAtiva === 'agenda' && isAgendamento && (
          <div className="card">
            <h3>Horários agendados</h3>
            {agendamentos.length === 0 ? (
              <p className="empty">Nenhum cliente agendou horário ainda. Compartilhe o link da sua vitrine!</p>
            ) : (
              <div className="list">
                {agendamentos.map((ag) => (
                  <div key={ag.id} className="row">
                    <div>
                      <strong>{fmtData(ag.data_horario)} às {horaSP(ag.data_horario)} · {ag.cliente_nome}</strong>
                      <small>
                        {ag.itens?.nome || 'Serviço'} com {ag.profissionais?.nome || 'profissional'} · {ag.cliente_telefone}
                      </small>
                    </div>
                    <div className="row-actions">
                      <span className={`pill ${ag.status === 'confirmado' ? 'pill-ok' : 'pill-off'}`}>{ag.status || 'confirmado'}</span>
                      <a
                        className="btn btn-soft btn-sm"
                        href={`https://wa.me/${normalizarTelefone(ag.cliente_telefone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <i className="fa-brands fa-whatsapp" /> WhatsApp
                      </a>
                      {ag.status === 'confirmado' && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleCancelarAgendamento(ag)}>Cancelar</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* HORÁRIOS DE ATENDIMENTO */}
        {abaAtiva === 'horarios' && isAgendamento && (() => {
          const cfg = configAgenda(loja);
          return (
            <form onSubmit={handleSalvarHorarios} className="card" style={{ maxWidth: 640 }}>
              <h3>Quando você atende</h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.1rem' }}>
                É o que seus clientes enxergam na hora de agendar. A duração de cada serviço é respeitada automaticamente.
              </p>

              <div className="field">
                <span>Dias de atendimento</span>
                <div className="days">
                  {DIAS_SEMANA.map((nome, i) => (
                    <label key={nome} className="day">
                      <input type="checkbox" name="dias" value={i} defaultChecked={cfg.dias.includes(i)} />
                      {nome}
                    </label>
                  ))}
                </div>
              </div>

              <div className="field-row">
                <label className="field"><span>Abre às</span><input type="time" name="inicio" defaultValue={cfg.inicio} required /></label>
                <label className="field"><span>Fecha às</span><input type="time" name="fim" defaultValue={cfg.fim} required /></label>
                <label className="field"><span>Pausa (almoço) das</span><input type="time" name="pausaInicio" defaultValue={cfg.pausaInicio} /></label>
                <label className="field"><span>até</span><input type="time" name="pausaFim" defaultValue={cfg.pausaFim} /></label>
              </div>

              <label className="field">
                <span>Intervalo entre horários</span>
                <select name="intervalo" defaultValue={cfg.intervalo}>
                  <option value="15">15 minutos</option>
                  <option value="30">30 minutos</option>
                  <option value="45">45 minutos</option>
                  <option value="60">1 hora</option>
                </select>
              </label>

              <button type="submit" className="btn btn-primary">Salvar horários</button>
            </form>
          );
        })()}

        {/* CUPONS */}
        {abaAtiva === 'cupons' && (
          <div className="split">
            <form onSubmit={handleCriarCupom} className="card">
              <h3>Novo cupom</h3>
              <label className="field">
                <span>Código</span>
                <input value={codigoCupom} onChange={(e) => setCodigoCupom(e.target.value.toUpperCase())} placeholder="Ex: PRIMEIRA10" maxLength={30} required />
              </label>
              <label className="field">
                <span>Desconto (%)</span>
                <input type="number" min="1" max="100" value={descontoCupom} onChange={(e) => setDescontoCupom(e.target.value)} placeholder="10" required />
              </label>
              <button type="submit" className="btn btn-primary btn-block">Ativar cupom</button>
            </form>

            <div className="card">
              <h3>Cupons ativos ({(loja.cupons || []).length})</h3>
              {(loja.cupons || []).length === 0 ? (
                <p className="empty">Nenhum cupom criado ainda.</p>
              ) : (
                <div className="list">
                  {(loja.cupons || []).map((c) => (
                    <div key={c.codigo} className="row">
                      <div>
                        <strong>{c.codigo}</strong>
                        <small>{c.desconto_percentual ?? c.descontoPercentual}% de desconto</small>
                      </div>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => confirmarRemocao(`Remover o cupom ${c.codigo}?`, () => removerCupom(slugAtivo, c.codigo), 'Cupom removido.')}
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
      </main>

      {aviso && <div className={`toast-admin ${aviso.erro ? 'err' : 'ok'}`} role="status">{aviso.erro ? '⚠ ' : '✓ '}{aviso.texto}</div>}
    </div>
  );
}
