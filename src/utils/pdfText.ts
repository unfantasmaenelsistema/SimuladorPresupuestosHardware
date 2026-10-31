// Las fuentes estándar de jsPDF (Helvetica) solo cubren WinAnsi (cp1252): tildes, ñ, €, «» y —
// salen bien, pero símbolos como ≤ ≥ → ≈ × se imprimen como basura (« 1 4 2 W ("d …»).
const PDF_SYMBOL_REPLACEMENTS: [RegExp, string][] = [
  [/≤/g, '<='],
  [/≥/g, '>='],
  [/[→⟶]/g, '->'],
  [/←/g, '<-'],
  [/≈/g, '~'],
  [/×/g, 'x'],
  [/−/g, '-'],
  [/✓/g, 'OK'],
  [/[✕✗]/g, 'X'],
  [/[  ]/g, ' '],
];

// Caracteres de cp1252 que están fuera del rango Latin-1 (0xA0-0xFF)
const CP1252_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
const NOT_WIN_ANSI = new RegExp(`[^\\n\\r\\t\\u0020-\\u007e\\u00a0-\\u00ff${CP1252_EXTRA}]`, 'g');

export function toWinAnsi(text: string): string {
  let out = text;
  for (const [re, rep] of PDF_SYMBOL_REPLACEMENTS) out = out.replace(re, rep);
  // Cualquier otro carácter fuera de cp1252 se sustituye por «?» en lugar de corromper la línea
  return out.replace(NOT_WIN_ANSI, '?');
}
