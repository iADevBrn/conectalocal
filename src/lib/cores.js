// Escurece uma cor #rrggbb em ~20% (usada para derivar a cor secundária da principal).
export function escurecerCor(hex, fator = 0.8) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#92400e';
  const n = parseInt(m[1], 16);
  const canal = (v) => Math.max(0, Math.min(255, Math.round(v * fator)));
  const r = canal((n >> 16) & 255);
  const g = canal((n >> 8) & 255);
  const b = canal(n & 255);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}
