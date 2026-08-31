// Utilitários de rede e cache — timeout, retry e cache em memória.
//
// Vivem aqui, e não dentro de supabase.js, para poderem ser testados: o
// supabase.js instancia o client no carregamento (`supabase.createClient`),
// o que impede importá-lo fora do navegador. Antes desta separação os testes
// exercitavam uma reimplementação em tests/helpers.js — passavam verdes mesmo
// quando a versão de produção estava errada.
//
// Script clássico (supabase.js e src/api/*.js não são módulos ES): expõe no
// window ao final, como base.js. Os testes importam o arquivo e leem do window.

/** Rejeita se a promise não resolver dentro de `ms`. Evita UI congelada. */
async function withTimeout(promise, ms = 6000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Requisição expirou. Verifique sua conexão.')),
      ms
    );
  });
  try {
    const result = await Promise.race([promise, timeout]);
    clearTimeout(timer);
    return result;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/** Repete `fn` com backoff exponencial (1s, 2s, 4s…). Propaga o último erro. */
async function withRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isLast = attempt === maxRetries - 1;
      if (isLast) throw err;
      const delay = Math.pow(2, attempt) * 1000;
      console.warn(`[RH] Tentativa ${attempt + 1} falhou. Retentando em ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

/** Cache em memória com expiração por tempo. */
function makeCache(TTL = 5 * 60 * 1000) {
  return {
    _store: new Map(),
    TTL,

    get(key) {
      const entry = this._store.get(key);
      if (!entry) return null;
      if (Date.now() - entry.time > this.TTL) {
        this._store.delete(key);
        return null;
      }
      return entry.data;
    },

    set(key, data) {
      this._store.set(key, { data, time: Date.now() });
    },

    invalidate(key) {
      if (key) this._store.delete(key);
      else this._store.clear();
    },
  };
}

window.withTimeout = withTimeout;
window.withRetry   = withRetry;
window.makeCache   = makeCache;
