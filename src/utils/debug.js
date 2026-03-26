// utils/debug.js -- logger visual ativado por Ctrl+Shift+D

let enabled = false;
const logEl = document.getElementById('debug-log');

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'D') {
    enabled = !enabled;
    logEl?.classList.toggle('visible', enabled);
  }
});

export function dbg(msg, level = 'info') {
  const prefix = `[${new Date().toLocaleTimeString('pt-BR')}]`;
  const full = `${prefix} ${msg}`;

  if (level === 'error') console.error(full);
  else if (level === 'warn') console.warn(full);
  else console.log(full);

  if (enabled && logEl) {
    const color = level === 'error' ? '#e74c3c' : level === 'warn' ? '#e67e22' : '#0f0';
    logEl.insertAdjacentHTML('beforeend', `<span style="color:${color}">${esc(full)}</span><br>`);
    logEl.scrollTop = logEl.scrollHeight;
  }
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
