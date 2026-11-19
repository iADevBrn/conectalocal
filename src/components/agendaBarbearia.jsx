import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { normalizarTelefone } from '../lib/telefone';
import { configAgenda, gerarHorarios, diaFunciona, horarioDisponivel, hojeSP, horaSP, horaAgoraSP, criarDataHorarioISO } from '../lib/agenda';

const formatarMoeda = (v) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
const iniciais = (nome = '') =>
  nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

export default function AgendaBarbearia({ loja }) {
  const [servicoSelecionado, setServicoSelecionado] = useState(null);
  const [profissionalSelecionado, setProfissionalSelecionado] = useState(null);
  const [dataEscolhida, setDataEscolhida] = useState(hojeSP);
  const [horarioEscolhido, setHorarioEscolhido] = useState('');
  const [horariosOcupados, setHorariosOcupados] = useState([]); // [{ inicio: 'HH:MM', duracao: min }]

  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [erroAgenda, setErroAgenda] = useState('');
  const [linkWhats, setLinkWhats] = useState('');
  const [versao, setVersao] = useState(0); // força recarregar horários ocupados

  // Busca horários já ocupados para o profissional na data escolhida
  useEffect(() => {
    if (!profissionalSelecionado || !dataEscolhida) return;

    const carregarOcupados = async () => {
      // A função devolve só os horários (sem nome/telefone de clientes), então a tabela
      // de agendamentos não precisa ser pública.
      const { data, error } = await supabase.rpc('horarios_ocupados', {
        p_profissional_id: profissionalSelecionado.id,
        p_dia: dataEscolhida
      });

      if (error) {
        console.error('Erro ao buscar horários ocupados:', error);
        return;
      }
      setHorariosOcupados(
        (data || []).map((ag) => ({ inicio: horaSP(ag.data_horario), duracao: ag.duracao_minutos || 30 }))
      );
    };

    carregarOcupados();
  }, [profissionalSelecionado, dataEscolhida, versao]);

  const confirmarAgendamento = async (e) => {
    e.preventDefault();
    if (!servicoSelecionado || !profissionalSelecionado || !horarioEscolhido) return;

    setErroAgenda('');
    if (clienteTelefone.replace(/\D/g, '').length < 10) {
      setErroAgenda('Informe seu WhatsApp com DDD.');
      return;
    }

    setEnviando(true);
    // Converte data/hora do fuso America/Sao_Paulo para ISO (UTC) corretamente,
    // considerando horário de verão se houver, sem depender do fuso do navegador.
    const dataHorarioISO = criarDataHorarioISO(dataEscolhida, horarioEscolhido);

    // A criação passa por uma função no banco que valida loja/profissional/serviço
    // e impede dois clientes no mesmo horário.
    const { error } = await supabase.rpc('criar_agendamento', {
      p_loja_id: loja.id,
      p_profissional_id: profissionalSelecionado.id,
      p_item_id: servicoSelecionado.id,
      p_nome: clienteNome.trim(),
      p_telefone: normalizarTelefone(clienteTelefone),
      p_data_horario: dataHorarioISO
    });

    setEnviando(false);

    if (error) {
      const ocupado = error.code === '23505' || /ocupado/i.test(error.message || '');
      const limite = /limite/i.test(error.message || '');
      setErroAgenda(
        ocupado
          ? 'Esse horário acabou de ser reservado por outra pessoa. Escolha outro.'
          : limite
            ? 'Este telefone já tem 3 horários marcados. Cancele um deles com o estabelecimento para marcar outro.'
            : 'Não foi possível agendar agora. Tente novamente em instantes.'
      );
      setHorarioEscolhido('');
      setVersao((v) => v + 1);
      return;
    }

    const msg =
      `Olá! Acabei de agendar um horário em *${loja.nome}*:\n\n` +
      `• *Serviço:* ${servicoSelecionado.nome}\n` +
      `• *Profissional:* ${profissionalSelecionado.nome}\n` +
      `• *Data:* ${dataEscolhida.split('-').reverse().join('/')} às ${horarioEscolhido}\n` +
      `• *Cliente:* ${clienteNome}`;
    // Link clicável (window.open depois de await costuma ser bloqueado no Safari/iPhone).
    setLinkWhats(`https://wa.me/${normalizarTelefone(loja.telefone)}?text=${encodeURIComponent(msg)}`);
    setConfirmado(true);
  };

  const cfg = useMemo(() => configAgenda(loja), [loja]);
  const horarios = useMemo(() => gerarHorarios(cfg), [cfg]);
  const diaAberto = diaFunciona(cfg, dataEscolhida);
  const duracaoServico = Number(servicoSelecionado?.duracao_minutos) || 30;

  if (confirmado) {
    return (
      <div className="ag-step ag-done">
        <div className="ag-done-icon"><i className="fa-solid fa-check" /></div>
        <h2>Horário agendado!</h2>
        <p>
          <strong>{servicoSelecionado.nome}</strong> com <strong>{profissionalSelecionado.nome}</strong> no dia{' '}
          <strong>{dataEscolhida.split('-').reverse().join('/')} às {horarioEscolhido}</strong> está reservado.
        </p>
        <div className="ag-done-actions">
          <a href={linkWhats} target="_blank" rel="noopener noreferrer" className="btn btn-whats btn-lg">
            <i className="fa-brands fa-whatsapp" /> Enviar confirmação no WhatsApp
          </a>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setConfirmado(false);
              setHorarioEscolhido('');
              setVersao((v) => v + 1);
            }}
          >
            Fazer novo agendamento
          </button>
        </div>
      </div>
    );
  }

  const profissionais = loja.profissionais || [];

  return (
    <div className="ag">
      {/* PASSO 1: SERVIÇO */}
      <div className="ag-step">
        <div className="ag-head"><span className="ag-num">1</span><h3>Escolha o serviço</h3></div>
        {(loja.produtos || []).length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>Este estabelecimento ainda não cadastrou serviços.</p>
        ) : (
          <div className="ag-options">
            {(loja.produtos || []).map((serv) => (
              <button
                key={serv.id}
                type="button"
                className="ag-option"
                aria-pressed={servicoSelecionado?.id === serv.id}
                onClick={() => {
                  setServicoSelecionado(serv);
                  setHorarioEscolhido('');
                }}
              >
                <strong>{serv.nome}</strong>
                {serv.descricao && <p>{serv.descricao}</p>}
                <span className="ag-price">{formatarMoeda(serv.preco)}</span>
                <span className="ag-dur"><i className="fa-regular fa-clock" /> {Number(serv.duracao_minutos) || 30} min</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* PASSO 2: PROFISSIONAL */}
      {servicoSelecionado && (
        <div className="ag-step">
          <div className="ag-head"><span className="ag-num">2</span><h3>Escolha o profissional</h3></div>
          {profissionais.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>Nenhum profissional disponível no momento.</p>
          ) : (
            <div className="ag-options">
              {profissionais.map((prof) => (
                <button
                  key={prof.id}
                  type="button"
                  className="ag-option ag-pro"
                  aria-pressed={profissionalSelecionado?.id === prof.id}
                  onClick={() => {
                    setProfissionalSelecionado(prof);
                    setHorarioEscolhido('');
                  }}
                >
                  <span className="ag-avatar">{iniciais(prof.nome)}</span>
                  <span>
                    <strong>{prof.nome}</strong>
                    {prof.especialidade && <p style={{ margin: 0 }}>{prof.especialidade}</p>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PASSO 3: DATA E HORÁRIO */}
      {profissionalSelecionado && (
        <div className="ag-step">
          <div className="ag-head"><span className="ag-num">3</span><h3>Escolha a data e o horário</h3></div>
          <label className="field" style={{ maxWidth: 240 }}>
            <span>Data</span>
            <input
              type="date"
              value={dataEscolhida}
              min={hojeSP()}
              onChange={(e) => {
                setDataEscolhida(e.target.value || hojeSP());
                setHorarioEscolhido('');
              }}
            />
          </label>

          {erroAgenda && <div className="alert alert-error">{erroAgenda}</div>}

          {!diaAberto ? (
            <p className="ag-closed">Não atendemos neste dia. Escolha outra data.</p>
          ) : (
            <div className="ag-times">
              {horarios.map((hora) => {
                const livre = horarioDisponivel({
                  cfg,
                  hora,
                  duracao: duracaoServico,
                  ocupados: horariosOcupados,
                  hoje: dataEscolhida === hojeSP(),
                  agora: horaAgoraSP()
                });
                return (
                  <button
                    key={hora}
                    type="button"
                    disabled={!livre}
                    className={`ag-time ${horarioEscolhido === hora ? 'sel' : ''}`}
                    onClick={() => setHorarioEscolhido(hora)}
                  >
                    {hora}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PASSO 4: DADOS DO CLIENTE */}
      {horarioEscolhido && (
        <form onSubmit={confirmarAgendamento} className="ag-step">
          <div className="ag-head"><span className="ag-num">4</span><h3>Seus dados</h3></div>
          <div className="field-row">
            <label className="field">
              <span>Seu nome</span>
              <input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} placeholder="Como devemos te chamar?" maxLength={80} required />
            </label>
            <label className="field">
              <span>Seu WhatsApp</span>
              <input value={clienteTelefone} onChange={(e) => setClienteTelefone(e.target.value)} placeholder="(43) 99999-9999" inputMode="tel" required />
            </label>
          </div>
          <button type="submit" disabled={enviando} className="btn btn-primary btn-block btn-lg">
            {enviando ? 'Reservando horário...' : `Confirmar agendamento às ${horarioEscolhido}`}
          </button>
        </form>
      )}
    </div>
  );
}
