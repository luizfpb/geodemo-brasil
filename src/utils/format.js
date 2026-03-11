/* ═══════════════════════════════════════════════════
   format.js — Formatação de números, moeda, percentual
   ═══════════════════════════════════════════════════ */

const locale = 'pt-BR';

const intFormatter = new Intl.NumberFormat(locale, {
  maximumFractionDigits: 0,
});

const decFormatter = new Intl.NumberFormat(locale, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const dec2Formatter = new Intl.NumberFormat(locale, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const currencyFormatter = new Intl.NumberFormat(locale, {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

/**
 * Formata número inteiro com separador de milhar.
 * @param {number|null|undefined} n
 * @returns {string}
 */
export function fmtInt(n) {
  if (n == null || isNaN(n)) return '\u2014';
  return intFormatter.format(n);
}

/**
 * Alias para população.
 */
export const fmtPop = fmtInt;

/**
 * Formata decimal com 1 casa.
 * @param {number|null|undefined} n
 * @returns {string}
 */
export function fmtDec(n) {
  if (n == null || isNaN(n)) return '\u2014';
  return decFormatter.format(n);
}

/**
 * Formata decimal com 2 casas.
 * @param {number|null|undefined} n
 * @returns {string}
 */
export function fmtDec2(n) {
  if (n == null || isNaN(n)) return '\u2014';
  return dec2Formatter.format(n);
}

/**
 * Formata percentual.
 * @param {number|null|undefined} n - Valor entre 0 e 100
 * @param {number} decimals
 * @returns {string}
 */
export function fmtPercent(n, decimals = 1) {
  if (n == null || isNaN(n)) return '\u2014';
  return n.toFixed(decimals).replace('.', ',') + '%';
}

/**
 * Formata moeda BRL.
 * @param {number|null|undefined} n
 * @returns {string}
 */
export function fmtCurrency(n) {
  if (n == null || isNaN(n)) return '\u2014';
  return currencyFormatter.format(n);
}

/**
 * Formata número grande com sufixo (mil, mi, bi).
 * @param {number|null|undefined} n
 * @returns {string}
 */
export function fmtCompact(n) {
  if (n == null || isNaN(n)) return '\u2014';
  if (n >= 1e9) return fmtDec(n / 1e9) + ' bi';
  if (n >= 1e6) return fmtDec(n / 1e6) + ' mi';
  if (n >= 1e3) return fmtDec(n / 1e3) + ' mil';
  return intFormatter.format(n);
}

/**
 * Escape seguro para inserção em HTML.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}
