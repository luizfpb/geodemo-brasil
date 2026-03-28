// ui/theme-toggle.js -- toggle claro/escuro
//
// alterna data-theme no <html>, persiste em localStorage,
// respeita prefers-color-scheme se nao ha preferencia salva

const STORAGE_KEY = 'geodemo-theme';

let $btn = null;

export function init() {
  $btn = document.getElementById('theme-toggle-btn');
  if (!$btn) return;

  // aplicar tema salvo ou detectar preferencia do sistema
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') {
    applyTheme(saved);
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }

  $btn.addEventListener('click', toggle);
}

function toggle() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(STORAGE_KEY, next);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if ($btn) {
    $btn.textContent = theme === 'dark' ? '\u2600' : '\u263E';
    $btn.title = theme === 'dark' ? 'Modo claro' : 'Modo escuro';
  }
}
