// Regras de horário da agenda. Tudo no fuso de São Paulo (o do negócio),
// independente de onde o cliente esteja com o navegador.
const FUSO = 'America/Sao_Paulo';

export const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date());

export const horaSP = (valor) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(new Date(valor));

export const horaAgoraSP = () => horaSP(new Date());

const paraMin = (hhmm) => {
  const [h, m] = String(hhmm).slice(0, 5).split(':').map(Number);
  return h * 60 + m;
};
const paraHHMM = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

// Lê a configuração da loja; se as colunas ainda não existirem no banco, usa o padrão.
export function configAgenda(loja = {}) {
  const intervalo = Math.max(5, Number(loja.agenda_intervalo) || 30);
  return {
    inicio: String(loja.agenda_inicio || '09:00').slice(0, 5),
    fim: String(loja.agenda_fim || '18:00').slice(0, 5),
    intervalo,
    pausaInicio: loja.agenda_pausa_inicio ? String(loja.agenda_pausa_inicio).slice(0, 5) : '',
    pausaFim: loja.agenda_pausa_fim ? String(loja.agenda_pausa_fim).slice(0, 5) : '',
    dias: Array.isArray(loja.agenda_dias) && loja.agenda_dias.length ? loja.agenda_dias : [1, 2, 3, 4, 5, 6]
  };
}

export function gerarHorarios(cfg) {
  const lista = [];
  for (let t = paraMin(cfg.inicio); t + cfg.intervalo <= paraMin(cfg.fim); t += cfg.intervalo) {
    lista.push(paraHHMM(t));
  }
  return lista;
}

export function diaFunciona(cfg, dataStr) {
  const [a, m, d] = dataStr.split('-').map(Number);
  return cfg.dias.includes(new Date(a, m - 1, d).getDay());
}

// Um horário só está livre se o serviço INTEIRO cabe: antes do fechamento, fora da pausa
// e sem encostar em outro agendamento (que também tem duração).
export function horarioDisponivel({ cfg, hora, duracao, ocupados, hoje, agora }) {
  const ini = paraMin(hora);
  const fim = ini + duracao;
  if (fim > paraMin(cfg.fim)) return false;
  if (cfg.pausaInicio && cfg.pausaFim && ini < paraMin(cfg.pausaFim) && fim > paraMin(cfg.pausaInicio)) {
    return false;
  }
  if (hoje && ini <= paraMin(agora)) return false;
  return !ocupados.some((o) => ini < paraMin(o.inicio) + o.duracao && fim > paraMin(o.inicio));
}
