/**
 * Thin API Client for InLEAGLE FastAPI Backend.
 * Handles connection, timeouts, automatic local fallbacks, and test mode simulations.
 */

const LOCAL_BACKEND = 'http://localhost:7860';

export function getApiBase() {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('inleagle_api_base');
    if (custom) return custom.replace(/\/+$/, '');
  }
  const envBase = import.meta.env.VITE_API_BASE ?? '';
  return String(envBase).replace(/\/+$/, '');
}

export function setApiBase(url) {
  if (typeof window !== 'undefined') {
    if (url) {
      localStorage.setItem('inleagle_api_base', url.replace(/\/+$/, ''));
    } else {
      localStorage.removeItem('inleagle_api_base');
    }
  }
}

export const API_BASE = getApiBase();

const QUERY_TIMEOUT_MS = 60_000;

export class ApiError extends Error {
  constructor(message, { status, detail } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

function buildUrl(path, base = null) {
  const b = base !== null ? base : getApiBase();
  return `${b}${path}`;
}

/** Health probe — used for connection status in TopBar. */
export async function checkHealth({ timeout = 4000 } = {}) {
  const basesToTry = [getApiBase()];
  // If base is empty and running on dev port (e.g. 5173 or 3000), also try direct backend
  if (!getApiBase() && typeof window !== 'undefined' && window.location.port && !['7860', '80', ''].includes(window.location.port)) {
    basesToTry.push(LOCAL_BACKEND);
  }

  for (const base of basesToTry) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(buildUrl('/health', base), {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: true, status: res.status, qdrant: data?.qdrant ?? 'unknown', baseUsed: base };
      }
    } catch {
      clearTimeout(timer);
    }
  }

  return { ok: false, error: 'unreachable' };
}

/**
 * Ask the legal RAG pipeline a question.
 * Strictly live backend query — zero mock data.
 */
export async function askLegal({ query, mode = 'auto', topK = 5, history = [] }) {
  const basesToTry = [getApiBase()];
  if (!getApiBase() && typeof window !== 'undefined' && window.location.port && !['7860', '80', ''].includes(window.location.port)) {
    basesToTry.push(LOCAL_BACKEND);
  }

  let lastError = null;

  for (const base of basesToTry) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);

    try {
      const res = await fetch(buildUrl('/query', base), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          query,
          mode,
          top_k: topK,
          history: history.map(({ role, content }) => ({ role, content })),
        }),
      });
      clearTimeout(timer);

      if (!res.ok) {
        let detail = `The server responded with status ${res.status}.`;
        try {
          const body = await res.json();
          if (body?.detail) {
            detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
          }
        } catch {
          /* keep default */
        }
        throw new ApiError(detail, { status: res.status, detail });
      }

      const data = await res.json();
      return {
        answer: data?.answer ?? '',
        mode: data?.mode ?? mode,
        citations: Array.isArray(data?.citations) ? data.citations : [],
        sources: Array.isArray(data?.sources) ? data.sources : [],
      };
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (err instanceof ApiError && err.status >= 400) {
        throw err;
      }
    }
  }

  // If the server answered with an error, throw that specific error message
  if (lastError instanceof ApiError) {
    throw lastError;
  }

  throw new ApiError(
    `Could not connect to the InLeagle backend at ${getApiBase() || 'localhost:7860'}. Ensure the FastAPI server is running with 'python run.py'.`,
    { status: 0 }
  );
}
