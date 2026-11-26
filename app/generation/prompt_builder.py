""" Builds the prompt that goes to the LLM (llama-3.1, in this case).
Two modes:
  legal : formal, cite exact sections and acts, professional tone
  layman : plain English, practical steps, no jargon

The mode is either chosen by the user explicitly
or auto-detected from the query.
"""

import re
import logging

log = logging.getLogger("prompt_builder")

# ─────────────────────────────────────────────────────────────
# INTENT DETECTION
# ─────────────────────────────────────────────────────────────

# Keywords that strongly signal layman mode
_LAYMAN_SIGNALS = [
    "explain", "what does", "what is", "what are", "in simple",
    "simple words", "layman", "easy", "i don't understand",
    "i dont understand", "what happens", "what should i do",
    "help me understand", "please explain", "can you explain",
    "what can i do", "what do i do", "i am confused",
    "scared", "worried", "help", "my bank", "they are threatening",
    "they called", "they came", "recovery agent", "they took",
]

# Keywords that strongly signal legal/formal mode
_LEGAL_SIGNALS = [
    "section", "act", "provision", "statute", "jurisdiction",
    "adjudicate", "tribunal", "precedent", "judgment", "citation",
    "legal position", "under law", "legal remedy", "relief",
    "petition", "writ", "pleading", "constitute", "liability",
    "pursuant", "thereof", "herein", "aforesaid",
]


def detect_mode(query: str) -> str:
    q = query.lower()
    layman_score = sum(1 for kw in _LAYMAN_SIGNALS if kw in q)
    legal_score  = sum(1 for kw in _LEGAL_SIGNALS  if kw in q)

    mode = "legal" if legal_score > layman_score else "layman"
    log.info(f"Mode detected: {mode}  (layman={layman_score}, legal={legal_score})")
    return mode


# ─────────────────────────────────────────────────────────────
# CONTEXT BUILDER
# Formats retrieved chunks into a readable numbered context block
# Eg: Each chunk is labelled with its source so the LLM can cite it.
    # Example output:
    # [1] SOURCE: SARFAESI Act 2002 (Act, 2002)
    #     TEXT: Section 13(2) — Where the borrower fails to discharge...

    # [2] SOURCE: Mardia Chemicals v Union of India 2004 (Supreme Court, 2004)
    #     TEXT: The Supreme Court held that while the Act is constitutional...
# ─────────────────────────────────────────────────────────────

def build_context(chunks: list[dict], max_context_chars: int = 5500) -> str:
    """
    Formats retrieved chunks into a numbered context block with strict token & length scrutiny.
    - Caps individual chunk length at sentence boundaries.
    - Deduplicates identical or heavily overlapping chunks.
    - Caps total context character length to avoid exceeding Groq TPM / token limits.
    """
    if not chunks:
        return "No relevant legal text found."

    lines = []
    seen_fingerprints = set()
    current_chars = 0

    for chunk in chunks:
        source = chunk.get("document_name", "Unknown")
        year   = chunk.get("year", "")
        stype  = chunk.get("source_type", "")
        court  = chunk.get("court", "")
        raw_text = (chunk.get("text") or "").strip()

        if not raw_text:
            continue

        # Length scrutiny: deduplicate near-identical snippets
        fingerprint = " ".join(raw_text.lower().split()[:15])
        if fingerprint in seen_fingerprints:
            continue
        seen_fingerprints.add(fingerprint)

        # Length scrutiny: cap long single chunks at clean sentence boundary
        text = raw_text
        if len(text) > 850:
            last_period = text.rfind(".", 0, 850)
            if last_period > 400:
                text = text[:last_period + 1]
            else:
                text = text[:850].rstrip() + "..."

        # Clean source label
        if stype == "case" and court:
            label = f"{source} ({court}, {year})"
        elif year:
            label = f"{source} ({year})"
        else:
            label = source

        chunk_entry_len = len(label) + len(text) + 30
        if current_chars + chunk_entry_len > max_context_chars and len(lines) > 0:
            # Reached context token budget limit
            break

        idx = len(lines) // 3 + 1
        lines.append(f"[{idx}] SOURCE: {label}")
        lines.append(f"TEXT: {text}")
        lines.append("")
        current_chars += chunk_entry_len

    return "\n".join(lines) if lines else "No relevant legal text found."


# ─────────────────────────────────────────────────────────────
# PROMPT TEMPLATES
# ─────────────────────────────────────────────────────────────

_LEGAL_SYSTEM_PROMPT = """You are an expert Indian banking law assistant with deep knowledge of all Indian banking legislation, RBI regulations, and landmark court judgments.

Your answers must follow these rules:
1. Base your answer STRICTLY and SOLELY on the legal text provided in the context below. If the context does not contain sufficient legal authorities or facts to answer the question, explicitly state that the provided authorities do not cover the query. Under NO circumstances speculate, fabricate, or extrapolate statutes, section numbers, or legal precedents not supported by the context.
2. If the user greets you (e.g. "Hello", "Hi", "Who are you?"), respond professionally and explain what banking legislation you can help them analyze (SARFAESI, Section 138 NI Act, Banking Regulation Act, IBC, CIC, RBI circulars, etc.). Do not refuse to answer.
3. For every legal point derived from the context, cite the EXACT source — state the Act name, Section number, or Case name.
4. Use precise legal language.
5. Structure your answer clearly: legal position first, then relevant sections, then applicable cases if any.
6. Competent Forum & Jurisdiction: ALWAYS explicitly state the competent legal forum or adjudicating authority where the remedy or dispute lies (e.g., Authorised Officer under Section 13(3A), Debts Recovery Tribunal (DRT) under Section 17, DRAT under Section 18, NCLT under Section 7/9/95 IBC, Judicial Magistrate / JMFC under Section 142 NI Act, Banking Ombudsman, or Consumer Commission). Also explicitly state if civil court jurisdiction is barred (e.g. Section 34 SARFAESI).
7. Strict Context Faithfulness: Ground all factual assertions, figures, and timeframes (e.g. 60-day notice, 15-day objection reply, 30-day CIBIL resolution) directly in the law without hallucination.
8. Brevity & Conciseness: Keep your answer direct, sharp, and concise (under 250-300 words). Avoid generic introductory filler, repetitive boilerplate, or verbose disclaimers. Structure the legal position into 3-4 crisp bullet points."""

_LAYMAN_SYSTEM_PROMPT = """You are a friendly and knowledgeable Indian banking law guide named "Mr. InLeagle Singh", helping ordinary people understand their legal rights.

Your answers must follow these rules:
1. Base your answer STRICTLY on the legal text provided in the context below. If the context does not contain the answer, tell the user honestly that no relevant banking authority or rule is present in the database for this specific question. Never guess, invent, or assume legal provisions.
2. If the user greets you or asks who you are, respond warmly and introduce yourself as "Mr. InLeagle Singh", explaining how you can help them navigate their banking and loan recovery problems.
3. Explain everything in plain, simple English — no legal jargon unless you immediately explain it.
4. Always mention which law or rule protects the person — but say it naturally (e.g. "Under the SARFAESI Act...").
5. Practical Next Steps & Proper Forum: Always tell the person EXACTLY WHICH FORUM OR AUTHORITY to approach (e.g. submit representation to the Bank's Authorised Officer within 60 days, complain to the Banking Ombudsman, approach the Debts Recovery Tribunal (DRT), file in Consumer Court, or approach the Magistrate).
6. Be empathetic — the person asking may be stressed or scared about their situation.
7. Keep your answers truthful to the legal context. Never guess or fabricate legal provisions.
8. Brevity & Direct Guidance: Keep your answer concise and actionable (under 250-300 words). Give the user their key rights and exact next steps in 3-4 structured bullet points without unnecessary rambling."""

_LEGAL_USER_TEMPLATE = """LEGAL CONTEXT:
{context}

QUESTION: {query}

Provide a concise, precise legal answer (under 300 words) citing the exact sections, acts, and cases from the context above."""

_LAYMAN_USER_TEMPLATE = """LEGAL CONTEXT:
{context}

QUESTION: {query}

Explain this concisely in simple language (under 300 words) a non-lawyer can understand, and tell me what concrete steps I can take."""


# ─────────────────────────────────────────────────────────────
# MAIN BUILDER
# ─────────────────────────────────────────────────────────────

def build_prompt(
    query:  str,
    chunks: list[dict],
    mode:   str = "auto",  # "auto" | "legal" | "layman"
) -> tuple[str, str, str]:
    """
    Build the full prompt for the LLM.
    Returns:
        system_prompt  : the system instruction
        user_prompt    : the user message with context + query
        resolved_mode  : the mode that was actually used
    """
    # Resolve mode
    if mode == "auto":
        resolved_mode = detect_mode(query)
    else:
        resolved_mode = mode

    # Build context block from retrieved chunks
    context = build_context(chunks)

    # Select template
    if resolved_mode == "legal":
        system_prompt = _LEGAL_SYSTEM_PROMPT
        user_prompt   = _LEGAL_USER_TEMPLATE.format(
            context=context,
            query=query,
        )
    else:
        system_prompt = _LAYMAN_SYSTEM_PROMPT
        user_prompt   = _LAYMAN_USER_TEMPLATE.format(
            context=context,
            query=query,
        )

    return system_prompt, user_prompt, resolved_mode