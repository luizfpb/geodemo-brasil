// utils/fetch.js -- fetch com timeout, retry e AbortController

export function fetchTimeout(url, ms = 45000, externalSignal = null) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);

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

export async function fetchJSON(url, opts = {}) {
  const response = await fetchRetry(url, opts);
  return response.json();
}
