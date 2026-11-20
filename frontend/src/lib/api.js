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
 * Supports live backend query with fallback and test-mode simulation.
 */
export async function askLegal({ query, mode = 'auto', topK = 5, history = [], isTestMode = false }) {
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
      // If the backend actually answered with an HTTP error (4xx or 5xx), do not mask it as network disconnect
      if (err instanceof ApiError && err.status >= 400) {
        if (!isTestMode) throw err;
      }
    }
  }

  // If live query failed but Test Mode is ON, return a structured test scenario response
  if (isTestMode) {
    return generateTestModeResponse(query, mode);
  }

  // If the server answered with an error, throw that specific error message
  if (lastError instanceof ApiError) {
    throw lastError;
  }

  throw new ApiError(
    `Could not connect to the InLeagle backend at ${getApiBase() || 'localhost:7860'}. Ensure the FastAPI server is running with 'uvicorn app.main:app --port 7860'. You can also toggle 'Test UI Mode' in the top bar to preview without a live server.`,
    { status: 0 }
  );
}

/** Fallback simulated response when Test UI Mode is active. */
function generateTestModeResponse(query, mode) {
  const qLower = query.toLowerCase();
  const resolvedMode = mode === 'auto' ? (qLower.includes('section') || qLower.includes('act') ? 'legal' : 'layman') : mode;

  if (qLower.includes('sarfaesi') || qLower.includes('possession') || qLower.includes('property') || qLower.includes('notice')) {
    return {
      answer: resolvedMode === 'legal'
        ? "### Legal Position Under SARFAESI Act, 2002\n\nUnder **Section 13(2)** of the SARFAESI Act, 2002, the secured creditor must issue a 60-day demand notice detailing the exact amount in default. Upon receipt of such notice:\n\n1. **Representation under Section 13(3A)**: The borrower is legally entitled to submit an objection or representation. The secured creditor is statutorily mandated to consider it and communicate reasons for rejection within **15 days**.\n2. **Enforcement under Section 13(4)**: If the borrower fails to discharge liabilities and representation is rejected, the secured creditor may take symbolic or physical possession.\n3. **Remedy under Section 17**: As held in *Mardia Chemicals Ltd. v. Union of India*, the borrower cannot approach the DRT against a mere 13(2) notice; the right of appeal under Section 17 arises only upon measures initiated under Section 13(4)."
        : "### What You Can Do Immediately\n\nYour bank cannot simply seize your home overnight. Here is your step-by-step legal protection:\n\n* **60-Day Notice Period**: Under Section 13(2) of the SARFAESI Act, the bank must give you 60 days to respond.\n* **Submit Written Objection within 60 Days**: Under Section 13(3A), you have the right to write back explaining why you dispute the claim or need loan restructuring. The bank must reply to your objection within 15 days.\n* **No Seizure During Notice**: The bank cannot take physical possession until this 60-day period expires and they formally answer your letter.",
      mode: resolvedMode,
      citations: [
        'SARFAESI Act, 2002 — Sections 13(2) & 13(3A)',
        'Mardia Chemicals Ltd. v. Union of India (2004) 4 SCC 311',
      ],
      sources: [
        { document_name: 'SARFAESI Act 2002', source_type: 'act', year: 2002, score: 0.94 },
        { document_name: 'Mardia Chemicals Ltd. v. Union of India', source_type: 'case', year: 2004, score: 0.89 },
      ],
    };
  }

  return {
    answer: resolvedMode === 'legal'
      ? `### Statutory Analysis for: "${query}"\n\nUnder Indian banking legislation and applicable RBI Master Directions:\n\n1. **Statutory Framework**: Commercial banking operations in India are regulated by the **Banking Regulation Act, 1949** and binding circulars issued under Section 35A.\n2. **Adjudication**: Recovery disputes exceeding Rs 20 Lakhs fall within the exclusive jurisdiction of the **Debts Recovery Tribunal (DRT)** under the Recovery of Debts and Bankruptcy Act, 1993.\n3. **Borrower Protections**: All loan recovery procedures must adhere strictly to the RBI Fair Practices Code for Lenders.`
      : `### Simple Explanation for: "${query}"\n\n* **Your Rights**: Under Reserve Bank of India rules, you have the right to fair treatment and transparent terms from your bank.\n* **Dispute Redressal**: If your bank treats you unfairly, you can escalate the matter to the Bank's Principal Nodal Officer, and subsequently to the **Reserve Bank - Integrated Ombudsman**.\n* **Next Steps**: Keep written records of all bank communications, demand notices, and payment receipts.`,
    mode: resolvedMode,
    citations: [
      'Banking Regulation Act, 1949 — Section 35A',
      'Reserve Bank - Integrated Ombudsman Scheme, 2021',
    ],
    sources: [
      { document_name: 'Banking Regulation Act 1949', source_type: 'act', year: 1949, score: 0.87 },
      { document_name: 'RBI Integrated Ombudsman Scheme', source_type: 'rbi_circular', year: 2021, score: 0.82 },
    ],
  };
}
