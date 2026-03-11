/* ═══════════════════════════════════════════════════
   fetch.js — Fetch com timeout, retry e AbortController
   ═══════════════════════════════════════════════════ */

/**
 * Fetch com timeout via AbortController.
 * @param {string} url
 * @param {number} ms - Timeout em milissegundos
 * @param {AbortSignal} [externalSignal] - Signal externo para cancelamento
 * @returns {Promise<Response>}
 */
export function fetchTimeout(url, ms = 45000, externalSignal = null) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);

  // Se receber signal externo, propagar abort
  if (externalSignal) {
    externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  return fetch(url, { signal: controller.signal })
    .then((response) => {
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response;
    })
    .catch((err) => {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`Timeout: requisição excedeu ${ms}ms — ${url}`);
      }
      throw err;
    });
}

/**
 * Fetch com retry exponencial.
 * @param {string} url
 * @param {object} opts
 * @param {number} opts.retries - Tentativas extras (padrão: 2)
 * @param {number} opts.timeout - Timeout por tentativa (padrão: 45000)
 * @param {number} opts.baseDelay - Delay base entre tentativas (padrão: 1500)
 * @param {AbortSignal} [opts.signal] - Signal para cancelar
 * @returns {Promise<Response>}
 */
export function fetchRetry(url, opts = {}) {
  const { retries = 2, timeout = 45000, baseDelay = 1500, signal = null } = opts;
  let attempt = 0;

  function go() {
    return fetchTimeout(url, timeout, signal).catch((err) => {
      if (signal?.aborted) throw new Error('Requisição cancelada');
      if (attempt++ < retries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        return new Promise((resolve) => setTimeout(resolve, delay)).then(go);
      }
      throw err;
    });
  }

  return go();
}

/**
 * Fetch JSON com retry.
 * @param {string} url
 * @param {object} [opts] - Opções de fetchRetry
 * @returns {Promise<any>}
 */
export async function fetchJSON(url, opts = {}) {
  const response = await fetchRetry(url, opts);
  return response.json();
}
