/**
 * Workspace data: Profiles, Collections, Live (Clean) content.
 * Strictly zero dummy or mock data.
 */

/* ── Live Default Profiles & Data (Clean State) ─────────────── */

export const PROFILE = {
  name: 'Legal Researcher',
  firstName: 'Researcher',
  role: 'Banking Law Workspace',
  initials: 'LR',
};

export const DEFAULT_COLLECTIONS = [
  { id: 'loan-recovery', name: 'Loan recovery' },
  { id: 'consumer-protection', name: 'Consumer protection' },
  { id: 'insolvency-ibc', name: 'Insolvency & IBC' },
];

export const EMPTY_ACTIVITY = [];
export const EMPTY_RESEARCH = [];

/* ── Editorial Content & Suggestions ─────────────────────────── */

export const SUGGESTED_QUESTIONS = [
  'Can a bank take possession without a 60-day notice?',
  'What is the limitation period for filing a cheque bounce case?',
  'Does an IBC moratorium stop SARFAESI proceedings?',
  'Can a digital loan app call my family members?',
];

export const HERO_EXAMPLE = 'e.g. Can a bank initiate SARFAESI recovery on agricultural land?';

export const LEGAL_UPDATE = {
  label: 'Legal update',
  title: 'RBI Fair Lending Practice — Penal Charges in Loan Accounts',
  body: 'Penal charges cannot be compounded or capitalised as penal interest. Effective for all regulated lenders.',
  cta: 'Read the regulatory circular',
  href: 'https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx',
};

export const RESEARCH_TIP = {
  title: 'Research tip',
  quote: '“Verify statutory amendments before relying on pre-2016 precedents.”',
  body: 'Key amendments to SARFAESI (2016) and the NI Act (2018) substantially modified redemption and appellate deposit rules.',
};

export const MODES = [
  { id: 'auto', label: 'Auto detect', hint: 'InLeagle chooses the best register' },
  { id: 'layman', label: 'Simple English', hint: 'Plain, practical language without jargon' },
  { id: 'legal', label: 'Legal / formal', hint: 'Provision-level statutory analysis' },
];

export const MODE_LABELS = Object.fromEntries(MODES.map((m) => [m.id, m.label]));
