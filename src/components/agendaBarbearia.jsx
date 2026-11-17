import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const HORARIOS_PADRAO = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00'
];

export default function AgendaBarbearia({ loja }) {
  const [servicoSelecionado, setServicoSelecionado] = useState(null);
  const [profissionalSelecionado, setProfissionalSelecionado] = useState(null);
  const [dataEscolhida, setDataEscolhida] = useState(() => new Date().toISOString().split('T')[0]);
  const [horarioEscolhido, setHorarioEscolhido] = useState('');
  const [horariosOcupados, setHorariosOcupados] = useState([]);

  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);

  // Busca horários já ocupados para aquele barbeiro na data escolhida
  useEffect(() => {
    if (!profissionalSelecionado || !dataEscolhida) return;

    const carregarOcupados = async () => {
      const inicioDia = `${dataEscolhida}T00:00:00`;
      const fimDia = `${dataEscolhida}T23:59:59`;

      const { data } = await supabase
        .from('agendamentos')
        .select('data_horario')
        .eq('profissional_id', profissionalSelecionado.id)
        .eq('status', 'confirmado')
        .gte('data_horario', inicioDia)
        .lte('data_horario', fimDia);

      if (data) {
        const horas = data.map((ag) => {
          const d = new Date(ag.data_horario);
          return d.toTimeString().slice(0, 5);
        });
        setHorariosOcupados(horas);
      }
    };

    carregarOcupados();
  }, [profissionalSelecionado, dataEscolhida]);

  const confirmarAgendamento = async (e) => {
    e.preventDefault();
    if (!servicoSelecionado || !profissionalSelecionado || !horarioEscolhido) return;

    setEnviando(true);
    const dataHorarioISO = new Date(`${dataEscolhida}T${horarioEscolhido}:00`).toISOString();

    const { error } = await supabase.from('agendamentos').insert([
      {
        loja_id: loja.id,
        profissional_id: profissionalSelecionado.id,
        item_id: servicoSelecionado.id,
        cliente_nome: clienteNome,
        cliente_telefone: clienteTelefone,
        data_horario: dataHorarioISO,
        status: 'confirmado'
      }
    ]);

    setEnviando(false);

    if (!error) {
      setConfirmado(true);
      const msg = `Olá! Acabei de agendar um horário em *${loja.nome}*:\n\n` +
        `• *Serviço:* ${servicoSelecionado.nome}\n` +
        `• *Profissional:* ${profissionalSelecionado.nome}\n` +
        `• *Data:* ${dataEscolhida.split('-').reverse().join('/')} às ${horarioEscolhido}\n` +
        `• *Cliente:* ${clienteNome}`;
      window.open(`https://wa.me/${loja.telefone}?text=${encodeURIComponent(msg)}`, '_blank');
    }
  };

  if (confirmado) {
    return (
      <div className="checkout-card" style={{ maxWidth: '550px', margin: '3rem auto', textAlign: 'center', background: '#fff' }}>
        <div style={{ fontSize: '3rem', color: '#16a34a' }}>✓</div>
        <h2>Horário Agendado!</h2>
        <p style={{ color: '#57534e', margin: '0.75rem 0 1.5rem' }}>
          Seu horário para <strong>{servicoSelecionado.nome}</strong> com <strong>{profissionalSelecionado.nome}</strong> no dia{' '}
          <strong>{dataEscolhida.split('-').reverse().join('/')} às {horarioEscolhido}</strong> está reservado.
        </p>
        <button
          onClick={() => {
            setConfirmado(false);
            setHorarioEscolhido('');
          }}
          className="btn-primary"
          style={{ border: 'none', cursor: 'pointer' }}
        >
          Fazer Novo Agendamento
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
                onClick={() => setServicoSelecionado(serv)}
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
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => {
                setDataEscolhida(e.target.value);
                setHorarioEscolhido('');
              }}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(85px, 1fr))', gap: '0.6rem', marginTop: '1rem' }}>
            {HORARIOS_PADRAO.map((hora) => {
              const ocupado = horariosOcupados.includes(hora);
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