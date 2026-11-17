// wa.me exige o número com código do país. Aceita "43999999999", "(43) 99999-9999" ou "5543999999999".
export function normalizarTelefone(valor = '') {
  const digitos = String(valor).replace(/\D/g, '');
  if (!digitos) return '';
  if (digitos.startsWith('55') && digitos.length >= 12) return digitos;
  return `55${digitos}`;
}
