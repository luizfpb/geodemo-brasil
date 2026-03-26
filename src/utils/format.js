// utils/format.js -- formatacao de numeros pro padrao brasileiro

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

export function fmtInt(n) {
  if (n == null || isNaN(n)) return '\u2014';
  return intFormatter.format(n);
}

export const fmtPop = fmtInt;

export function fmtDec(n) {
  if (n == null || isNaN(n)) return '\u2014';
  return decFormatter.format(n);
}

export function fmtDec2(n) {
  if (n == null || isNaN(n)) return '\u2014';
  return dec2Formatter.format(n);
}

export function fmtPercent(n, decimals = 1) {
  if (n == null || isNaN(n)) return '\u2014';
  return n.toFixed(decimals).replace('.', ',') + '%';
}

export function fmtCurrency(n) {
  if (n == null || isNaN(n)) return '\u2014';
  return currencyFormatter.format(n);
}

export function fmtCompact(n) {
  if (n == null || isNaN(n)) return '\u2014';
  if (n >= 1e9) return fmtDec(n / 1e9) + ' bi';
  if (n >= 1e6) return fmtDec(n / 1e6) + ' mi';
  if (n >= 1e3) return fmtDec(n / 1e3) + ' mil';
  return intFormatter.format(n);
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}
