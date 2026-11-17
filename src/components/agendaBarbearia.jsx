import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { normalizarTelefone } from '../lib/telefone';
import { configAgenda, gerarHorarios, diaFunciona, horarioDisponivel, hojeSP, horaSP, horaAgoraSP } from '../lib/agenda';

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

  // Busca horários já ocupados para aquele barbeiro na data escolhida
  useEffect(() => {
    if (!profissionalSelecionado || !dataEscolhida) return;

    const carregarOcupados = async () => {
      // RPC devolve só os horários (sem nome/telefone de clientes), então a tabela
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
    // Horário de Brasília (UTC-3, sem horário de verão): não depende do fuso do aparelho do cliente.
    const dataHorarioISO = new Date(`${dataEscolhida}T${horarioEscolhido}:00-03:00`).toISOString();

    // A criação passa por uma função no banco que valida loja/profissional/serviço
    // e impede dois clientes no mesmo horário (índice único).
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
      setErroAgenda(
        ocupado
          ? 'Esse horário acabou de ser reservado por outra pessoa. Escolha outro.'
          : 'Não foi possível agendar agora. Tente novamente em instantes.'
      );
      setHorarioEscolhido('');
      setVersao((v) => v + 1);
      return;
    }

    const msg = `Olá! Acabei de agendar um horário em *${loja.nome}*:\n\n` +
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
      <div className="checkout-card" style={{ maxWidth: '550px', margin: '3rem auto', textAlign: 'center', background: '#fff' }}>
        <div style={{ fontSize: '3rem', color: '#16a34a' }}>✓</div>
        <h2>Horário Agendado!</h2>
        <p style={{ color: '#57534e', margin: '0.75rem 0 1.5rem' }}>
          Seu horário para <strong>{servicoSelecionado.nome}</strong> com <strong>{profissionalSelecionado.nome}</strong> no dia{' '}
          <strong>{dataEscolhida.split('-').reverse().join('/')} às {horarioEscolhido}</strong> está reservado.
        </p>
        <a
          href={linkWhats}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
          style={{ display: 'inline-block', textDecoration: 'none', marginBottom: '0.75rem' }}
        >
          Enviar confirmação no WhatsApp
        </a>
        <br />
        <button
          onClick={() => {
            setConfirmado(false);
            setHorarioEscolhido('');
            setVersao((v) => v + 1);
          }}
          style={{ background: 'none', border: 'none', color: '#78716c', cursor: 'pointer', fontWeight: 600 }}
        >
          Fazer novo agendamento
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* PASSO 1: SERVIÇO */}
      <div className="checkout-card" style={{ background: '#fff' }}>
        <h3>1. Escolha o Serviço</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          {(loja.produtos || []).map((serv) => {
            const ativo = servicoSelecionado?.id === serv.id;
            return (
              <div
                key={serv.id}
                onClick={() => {
                  setServicoSelecionado(serv);
                  setHorarioEscolhido('');
                }}
                style={{
                  padding: '1rem',
                  borderRadius: '0.75rem',
                  border: ativo ? `2px solid ${loja.corPrimaria}` : '1px solid #e7e5e4',
                  background: ativo ? '#fffbeb' : '#fff',
                  cursor: 'pointer'
                }}
              >
                <strong>{serv.nome}</strong>
                <p style={{ fontSize: '0.85rem', color: '#78716c', margin: '0.25rem 0' }}>{serv.descricao}</p>
                <span style={{ fontWeight: 700, color: loja.corPrimaria }}>
                  R$ {Number(serv.preco).toFixed(2).replace('.', ',')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* PASSO 2: PROFISSIONAL */}
      {servicoSelecionado && (
        <div className="checkout-card" style={{ background: '#fff' }}>
          <h3>2. Escolha o Profissional</h3>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            {(loja.profissionais || []).map((prof) => {
              const ativo = profissionalSelecionado?.id === prof.id;
              return (
                <button
                  key={prof.id}
                  type="button"
                  onClick={() => {
                    setProfissionalSelecionado(prof);
                    setHorarioEscolhido('');
                  }}
                  style={{
                    padding: '0.9rem 1.4rem',
                    borderRadius: '0.75rem',
                    border: ativo ? `2px solid ${loja.corPrimaria}` : '1px solid #d6d3d1',
                    background: ativo ? loja.corPrimaria : '#fff',
                    color: ativo ? '#fff' : '#1c1917',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {prof.nome}
                  {prof.especialidade && <small style={{ display: 'block', fontWeight: 400 }}>{prof.especialidade}</small>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* PASSO 3: DATA E HORÁRIO */}
      {profissionalSelecionado && (
        <div className="checkout-card" style={{ background: '#fff' }}>
          <h3>3. Escolha a Data e o Horário</h3>
          <label className="field" style={{ maxWidth: '240px', marginTop: '1rem' }}>
            <span>Data</span>
            <input
              type="date"
              value={dataEscolhida}
              min={hojeSP()}
              onChange={(e) => {
                setDataEscolhida(e.target.value);
                setHorarioEscolhido('');
              }}
            />
          </label>

          {erroAgenda && (
            <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.7rem 1rem', borderRadius: '0.6rem', marginTop: '1rem', fontSize: '0.9rem' }}>
              {erroAgenda}
            </div>
          )}

          {!diaAberto ? (
            <p style={{ marginTop: '1rem', color: '#b91c1c', fontWeight: 600 }}>
              Não atendemos neste dia. Escolha outra data.
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(85px, 1fr))', gap: '0.6rem', marginTop: '1rem' }}>
              {horarios.map((hora) => {
                const livre = horarioDisponivel({
                  cfg,
                  hora,
                  duracao: duracaoServico,
                  ocupados: horariosOcupados,
                  hoje: dataEscolhida === hojeSP(),
                  agora: horaAgoraSP()
                });
                const ocupado = !livre;
                const selecionado = horarioEscolhido === hora;
                return (
                  <button
                    key={hora}
                    type="button"
                    disabled={ocupado}
                    onClick={() => setHorarioEscolhido(hora)}
                    style={{
                      padding: '0.65rem',
                      borderRadius: '0.5rem',
                      border: selecionado ? `2px solid ${loja.corPrimaria}` : '1px solid #d6d3d1',
                      background: ocupado ? '#f5f5f4' : selecionado ? loja.corPrimaria : '#fff',
                      color: ocupado ? '#a8a29e' : selecionado ? '#fff' : '#1c1917',
                      textDecoration: ocupado ? 'line-through' : 'none',
                      cursor: ocupado ? 'not-allowed' : 'pointer',
                      fontWeight: 600
                    }}
                  >
                    {hora}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PASSO 4: DADOS DO CLIENTE E CONFIRMAÇÃO */}
      {horarioEscolhido && (
        <form onSubmit={confirmarAgendamento} className="checkout-card" style={{ background: '#fff' }}>
          <h3>4. Seus Dados para Confirmar</h3>
          <label className="field">
            <span>Seu Nome</span>
            <input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} placeholder="Como devemos te chamar?" required />
          </label>
          <label className="field">
            <span>Seu WhatsApp</span>
            <input value={clienteTelefone} onChange={(e) => setClienteTelefone(e.target.value)} placeholder="(43) 99999-9999" required />
          </label>
          <button type="submit" disabled={enviando} className="btn-primary" style={{ width: '100%', border: 'none', cursor: 'pointer', marginTop: '0.5rem' }}>
            {enviando ? 'Reservando horário...' : `Confirmar Agendamento (${horarioEscolhido})`}
          </button>
        </form>
      )}
    </div>
  );
}