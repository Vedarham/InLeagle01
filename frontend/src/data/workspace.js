/**
 * Workspace data: Profiles, Collections, Live (Clean) vs Test (Demo) content.
 */

/* ── Live Default Profiles & Data (Clean State) ─────────────── */

export const PROFILE = {
  name: 'Legal Researcher',
  firstName: 'Researcher',
  role: 'Banking Law Workspace',
  initials: 'LR',
};

export const TEST_PROFILE = {
  name: 'Advocate Verma',
  firstName: 'Advocate',
  role: 'Test & Evaluation Workspace',
  initials: 'AV',
};

export const DEFAULT_COLLECTIONS = [
  { id: 'loan-recovery', name: 'Loan recovery' },
  { id: 'consumer-protection', name: 'Consumer protection' },
  { id: 'insolvency-ibc', name: 'Insolvency & IBC' },
];

export const EMPTY_ACTIVITY = [];
export const EMPTY_RESEARCH = [];

/* ── Test Mode (Demo Data for UI evaluation) ─────────────────── */

export const TEST_MOCK_ACTIVITY = [
  {
    id: 'test-act-1',
    kind: 'search',
    text: 'Searched for',
    emphasis: '“Section 13(2) SARFAESI 60-day notice remedies”',
    time: '5 mins ago',
    at: Date.now() - 300_000,
  },
  {
    id: 'test-act-2',
    kind: 'saved',
    text: 'Saved answer on',
    emphasis: 'Mardia Chemicals Ltd. v. Union of India',
    time: '2 hours ago',
    at: Date.now() - 7_200_000,
    caseId: 'mardia-chemicals',
  },
  {
    id: 'test-act-3',
    kind: 'opened',
    text: 'Viewed landmark holding in',
    emphasis: 'Transcore v. Union of India (2008)',
    time: 'Yesterday',
    at: Date.now() - 86_400_000,
    caseId: 'transcore',
  },
  {
    id: 'test-act-4',
    kind: 'search',
    text: 'Queried compliance for',
    emphasis: '“Section 138 NI Act 15-day cure period”',
    time: '2 days ago',
    at: Date.now() - 172_800_000,
  },
];

export const TEST_MOCK_RESEARCH = [
  {
    id: 'test-res-1',
    question: 'My bank sent me a 60-day notice to take possession under SARFAESI. What can I do immediately?',
    status: 'answered',
    mode: 'layman',
    answer: 'Under Section 13(2) of the SARFAESI Act, 2002, the bank must give you 60 days before taking any possession. Within this 60-day period, under Section 13(3A), you have the legal right to submit a written representation or objection to the bank. The bank is legally mandated to consider your objection and reply with reasons within 15 days. They cannot take possession until the 60-day window expires and your objection is formally decided.',
    citations: ['SARFAESI Act 2002, Section 13(2)', 'SARFAESI Act 2002, Section 13(3A)', 'Mardia Chemicals Ltd. v. Union of India (2004) 4 SCC 311'],
    collectionId: 'loan-recovery',
    createdAt: Date.now() - 7_200_000,
    updatedAt: Date.now() - 7_200_000,
  },
  {
    id: 'test-res-2',
    question: 'What is the minimum appellate deposit required under Section 148 of the Negotiable Instruments Act?',
    status: 'answered',
    mode: 'legal',
    answer: 'Under Section 148(1) of the Negotiable Instruments Act, 1881, the Appellate Court hearing an appeal against a Section 138 conviction may order the appellant to deposit a minimum of twenty percent (20%) of the fine or compensation awarded by the trial court. In Surinder Singh Deswal v. Virender Gandhi, the Supreme Court held that the deposit is ordinarily mandatory.',
    citations: ['Negotiable Instruments Act 1881, Section 148', 'Surinder Singh Deswal v. Virender Gandhi (2019) 11 SCC 341'],
    collectionId: 'loan-recovery',
    createdAt: Date.now() - 86_400_000,
    updatedAt: Date.now() - 86_400_000,
  },
  {
    id: 'test-res-3',
    question: 'Does the Section 14 moratorium under IBC stop proceedings against personal guarantors?',
    status: 'draft',
    mode: 'auto',
    answer: '',
    citations: [],
    collectionId: 'insolvency-ibc',
    createdAt: Date.now() - 172_800_000,
    updatedAt: Date.now() - 172_800_000,
  },
];

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
