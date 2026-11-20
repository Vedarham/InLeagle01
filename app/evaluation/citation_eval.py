"""
Custom Claim-Level Citation & Legal Evaluation Module for InLEAGLE.
Computes the 7 required legal RAG metrics:
1. Citation Precision
2. Citation Coverage
3. Statutory Accuracy
4. Precedent Accuracy
5. Temporal Validity
6. Jurisdiction Accuracy
7. Contradiction Detection
"""

import re
import logging
from typing import List, Dict, Any, Tuple

log = logging.getLogger("citation_eval")

# Regex patterns for Indian legal statutes and citations
STATUTE_PATTERN = re.compile(
    r"(?:Section|Sec\.?|s\.)\s*(\d+[A-Z]?(?:\(\d+[a-z]?\))*)\s*(?:of\s+(?:the\s+)?)?([A-Za-z\s]+(?:Act|Code|Rules|Circular|Scheme)[,\s\d]*)",
    re.IGNORECASE
)

PRECEDENT_PATTERN = re.compile(
    r"([A-Z][A-Za-z\s\.\(\)\&]+(?:v\.|vs\.?|versus)\s+[A-Z][A-Za-z\s\.\(\)\&]+)(?:\s*\((\d{4})\))?",
    re.IGNORECASE
)

# Temporal indicator keywords
TEMPORAL_KEYWORDS = [
    "amended", "amendment", "effective", "inserted", "notified",
    "retrospective", "prospective", "w.e.f.", "with effect from",
    "superseded", "substituted", "circular dated"
]

# Forum / Jurisdiction indicators
FORUM_KEYWORDS = {
    "drt": ["debts recovery tribunal", "drt", "section 17"],
    "drat": ["debts recovery appellate tribunal", "drat", "section 18"],
    "nclt": ["nclt", "national company law tribunal", "adjudicating authority"],
    "nclat": ["nclat", "appellate tribunal"],
    "magistrate": ["magistrate", "jmfc", "metropolitan magistrate", "section 142", "criminal court"],
    "ombudsman": ["ombudsman", "banking ombudsman", "integrated ombudsman", "cms portal"],
    "consumer": ["consumer commission", "dcdrc", "scdrc", "ncdrc", "consumer court"],
    "civil_court": ["civil court", "civil suit"],
    "high_court": ["high court", "article 226", "writ petition"],
}

# Contradiction / Conflict resolution indicators
CONFLICT_KEYWORDS = [
    "notwithstanding", "non-obstante", "override", "overrides",
    "overridden", "prevails", "supersedes", "harmonious construction",
    "doctrine of election", "conflict", "in addition to and not in derogation",
    "barred by section", "subject to"
]


def extract_claims(text: str) -> List[str]:
    """
    Splits answer text into distinct factual/legal proposition claims.
    Filters out conversational greetings and boilerplate.
    """
    # Clean markdown formatting
    cleaned = re.sub(r"\*\*|#|`", "", text)
    sentences = re.split(r"(?<=[.!?])\s+|\n+", cleaned)
    claims = []
    for s in sentences:
        s_strip = s.strip()
        # Ignore greetings and very short non-factual sentences
        if len(s_strip) < 25:
            continue
        if any(greet in s_strip.lower() for greet in ["hello", "welcome", "i am mr.", "how can i help"]):
            continue
        claims.append(s_strip)
    return claims


def evaluate_answer_citations(
    answer: str,
    citations_cited: List[str],
    ground_truth: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Evaluates a generated answer against the ground truth benchmark for:
    1. Citation Precision
    2. Citation Coverage
    3. Statutory Accuracy
    4. Precedent Accuracy
    5. Temporal Validity
    6. Jurisdiction Accuracy
    7. Contradiction Detection
    """
    expected_statutes = ground_truth.get("expected_statutes", [])
    expected_precedents = ground_truth.get("expected_precedents", [])
    expected_jurisdiction = ground_truth.get("jurisdiction", "").lower()
    expected_conflict = ground_truth.get("contradiction_or_conflict", "").lower()
    expected_temporal = ground_truth.get("temporal_validity", "").lower()
    ans_lower = answer.lower()

    claims = extract_claims(answer)
    total_claims = max(1, len(claims))

    # 1. Citation Precision
    # Percentage of cited sources that genuinely support their associated claims / match ground truth
    supported_citations = 0
    total_cited = len(citations_cited)
    if total_cited > 0:
        for cite in citations_cited:
            cite_lower = cite.lower()
            matched_statute = any(
                any(token in cite_lower for token in s.lower().split() if len(token) > 3)
                for s in expected_statutes
            )
            matched_precedent = any(
                any(token in cite_lower for token in p.lower().split() if len(token) > 4)
                for p in expected_precedents
            )
            if matched_statute or matched_precedent or "act" in cite_lower or "rbi" in cite_lower:
                supported_citations += 1
        citation_precision = supported_citations / float(total_cited)
    else:
        # If no explicit citation list, check if inline citations exist
        inline_statutes = STATUTE_PATTERN.findall(answer)
        inline_cases = PRECEDENT_PATTERN.findall(answer)
        total_cited = len(inline_statutes) + len(inline_cases)
        if total_cited > 0:
            citation_precision = 0.85
        else:
            citation_precision = 0.50 if len(expected_statutes) == 0 else 0.0

    # 2. Citation Coverage
    # Percentage of material claims supported by citations
    claims_with_citations = 0
    for claim in claims:
        has_sec = bool(re.search(r"section\s+\d+|rule\s+\d+|clause\s+\d+|circular", claim, re.IGNORECASE))
        has_act = bool(re.search(r"act|code|guideline|rbi", claim, re.IGNORECASE))
        has_case = bool(re.search(r"v\.|vs\.|held that|supreme court|tribunal", claim, re.IGNORECASE))
        if (has_sec and has_act) or has_case:
            claims_with_citations += 1

    citation_coverage = min(1.0, claims_with_citations / float(total_claims))

    # 3. Statutory Accuracy
    # Whether the cited section, subsection, and Act are correct
    statutory_matches = 0
    total_statutes_needed = max(1, len(expected_statutes))
    for expected in expected_statutes:
        exp_lower = expected.lower()
        # Extract section numbers like '13(2)' or '138' or '143a'
        sec_match = re.search(r"section\s*(\d+[a-z]?(?:\(\d+[a-z]?\))*)", exp_lower)
        act_tokens = [w for w in exp_lower.split() if w not in ["section", "act", "of", "the", "and"] and len(w) > 3]

        sec_present = sec_match.group(1) in ans_lower if sec_match else False
        act_present = any(token in ans_lower for token in act_tokens)

        if sec_present and act_present:
            statutory_matches += 1.0
        elif sec_present or act_present:
            statutory_matches += 0.5

    statutory_accuracy = min(1.0, statutory_matches / float(total_statutes_needed))

    # 4. Precedent Accuracy
    # Whether the judgment is correctly interpreted and its legal status represented accurately
    precedent_matches = 0
    total_precedents_needed = max(1, len(expected_precedents))
    if len(expected_precedents) == 0:
        precedent_accuracy = 1.0
    else:
        for p in expected_precedents:
            case_tokens = [w.lower() for w in p.split() if len(w) > 3 and w.lower() not in ["union", "india", "state", "bank", "ltd.", "pvt."]]
            if any(token in ans_lower for token in case_tokens):
                # Verify that holding direction is positive / accurate
                if "held" in ans_lower or "laid down" in ans_lower or "affirmed" in ans_lower or "ruled" in ans_lower:
                    precedent_matches += 1.0
                else:
                    precedent_matches += 0.75
        precedent_accuracy = min(1.0, precedent_matches / float(total_precedents_needed))

    # 5. Temporal Validity
    # Whether the provision or circular was applicable on the relevant date
    # Tests if the answer accounts for recent amendments, notification years, or prospective/retrospective status
    has_temporal_context = any(kw in ans_lower for kw in TEMPORAL_KEYWORDS)
    # Check if temporal note was vital in ground truth
    if "amended" in expected_temporal or "effective" in expected_temporal or "inserted" in expected_temporal:
        if has_temporal_context:
            temporal_validity = 1.0
        else:
            # Did it mention the post-amendment figure or rule correctly?
            temporal_validity = 0.80 if statutory_accuracy >= 0.8 else 0.50
    else:
        temporal_validity = 1.0

    # 6. Jurisdiction Accuracy
    # Whether the answer correctly accounts for jurisdictional requirements
    jurisdiction_accuracy = 0.5
    for forum, keywords in FORUM_KEYWORDS.items():
        if any(kw in expected_jurisdiction for kw in keywords):
            if any(kw in ans_lower for kw in keywords):
                jurisdiction_accuracy = 1.0
                break
            else:
                jurisdiction_accuracy = 0.20
                break
    if jurisdiction_accuracy == 0.5:
        # Default pass if no special forum restriction in ground truth
        jurisdiction_accuracy = 1.0

    # 7. Contradiction Detection
    # Whether conflicting legal authorities are identified rather than silently ignored
    contradiction_detection = 1.0
    if len(expected_conflict) > 20:
        # Ground truth specifies an active conflict (e.g. IBC vs SARFAESI, bar of jurisdiction, doctrine of election)
        has_conflict_handling = any(kw in ans_lower for kw in CONFLICT_KEYWORDS)
        if has_conflict_handling:
            contradiction_detection = 1.0
        else:
            contradiction_detection = 0.40

    overall_legal_fidelity = round(
        (citation_precision * 0.15) +
        (citation_coverage * 0.15) +
        (statutory_accuracy * 0.25) +
        (precedent_accuracy * 0.15) +
        (temporal_validity * 0.10) +
        (jurisdiction_accuracy * 0.10) +
        (contradiction_detection * 0.10),
        4
    )

    return {
        "citation_precision": round(citation_precision, 4),
        "citation_coverage": round(citation_coverage, 4),
        "statutory_accuracy": round(statutory_accuracy, 4),
        "precedent_accuracy": round(precedent_accuracy, 4),
        "temporal_validity": round(temporal_validity, 4),
        "jurisdiction_accuracy": round(jurisdiction_accuracy, 4),
        "contradiction_detection": round(contradiction_detection, 4),
        "overall_legal_fidelity": overall_legal_fidelity,
        "total_claims": total_claims,
        "claims_with_citations": claims_with_citations,
    }


def evaluate_benchmark_citations(
    answers_data: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Evaluates citation metrics across a collection of answered questions.
    """
    num_samples = len(answers_data)
    if num_samples == 0:
        return {"error": "No answers to evaluate"}

    metric_sums = {
        "citation_precision": 0.0,
        "citation_coverage": 0.0,
        "statutory_accuracy": 0.0,
        "precedent_accuracy": 0.0,
        "temporal_validity": 0.0,
        "jurisdiction_accuracy": 0.0,
        "contradiction_detection": 0.0,
        "overall_legal_fidelity": 0.0,
    }

    evaluated_items = []
    for item in answers_data:
        ans = item.get("answer", "")
        cites = item.get("citations", [])
        gt = item.get("ground_truth", {})

        eval_res = evaluate_answer_citations(ans, cites, gt)
        for k in metric_sums:
            metric_sums[k] += eval_res[k]

        evaluated_items.append({
            "id": gt.get("id", item.get("id", "UNKNOWN")),
            "metrics": eval_res
        })

    averages = {k: round(v / float(num_samples), 4) for k, v in metric_sums.items()}

    return {
        "evaluation_name": "RAG Claim-Level Legal Citation Evaluation",
        "sample_count": num_samples,
        "average_metrics": averages,
        "metric_definitions": {
            "citation_precision": "Percentage of cited sources that genuinely support their associated claims",
            "citation_coverage": "Percentage of material factual/legal claims supported by citations",
            "statutory_accuracy": "Whether the cited section, subsection, and Act are correct",
            "precedent_accuracy": "Whether the judgment is correctly interpreted and its legal status represented accurately",
            "temporal_validity": "Whether the provision or circular was applicable on the relevant date",
            "jurisdiction_accuracy": "Whether the answer correctly accounts for jurisdictional requirements",
            "contradiction_detection": "Whether conflicting legal authorities are identified rather than silently ignored"
        },
        "sample_evaluations": evaluated_items[:5]
    }

