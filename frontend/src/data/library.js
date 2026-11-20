/**
 * Curated case library.
 *
 * Every entry is drawn from Knowledge_Corpus.md and is deliberately limited to
 * well-established, citable decisions. Summaries are plain-language paraphrases
 * of the holding, not quotes. Always verify the current text of a judgment
 * before relying on it in a filing.
 */
export const CASE_CATEGORIES = [
  'All',
  'SARFAESI & recovery',
  'Cheque dishonour',
  'Insolvency',
  'Banking practice',
];

export const CASES = [
  {
    id: 'mardia-chemicals',
    title: 'Mardia Chemicals Ltd. v. Union of India',
    court: 'Supreme Court of India',
    year: 2004,
    citation: '(2004) 4 SCC 311',
    category: 'SARFAESI & recovery',
    issue: 'Validity of SARFAESI enforcement and the borrower’s remedy',
    summary:
      'Upheld the constitutional validity of the SARFAESI Act while reading in safeguards for borrowers, including a reasoned demand notice and access to the Debts Recovery Tribunal.',
    holdings: [
      'A notice under section 13(2) must disclose the reasons for classifying the account as a non-performing asset.',
      'The borrower’s remedy lies before the Debts Recovery Tribunal under section 17 after measures under section 13(4) are taken.',
      'The requirement of a pre-deposit for an appeal was upheld, with liberty for the tribunal to reduce it in appropriate cases.',
    ],
    provisions: ['SARFAESI Act, 2002 — ss. 13 and 17', 'Security Interest (Enforcement) Rules, 2002'],
    source: 'https://main.sci.gov.in/',
  },
  {
    id: 'transcore',
    title: 'Transcore v. Union of India',
    court: 'Supreme Court of India',
    year: 2008,
    citation: '(2008) 1 SCC 125',
    category: 'SARFAESI & recovery',
    issue: 'Interaction between SARFAESI and the Recovery of Debts Act',
    summary:
      'Held that the SARFAESI demand notice and proceedings before the Debts Recovery Tribunal are complementary routes, and that a bank need not exhaust one before using the other.',
    holdings: [
      'Section 13(2) does not require the bank to first obtain a recovery certificate under the Recovery of Debts Act.',
      'A borrower’s reply to the notice does not suspend the bank’s right to proceed under section 13(4).',
      'The expression “default” means non-payment of a secured debt that has become due.',
    ],
    provisions: ['SARFAESI Act, 2002 — s. 13', 'Recovery of Debts and Bankruptcy Act, 1993'],
    source: 'https://main.sci.gov.in/',
  },
  {
    id: 'satyawati-tondon',
    title: 'United Bank of India v. Satyawati Tondon',
    court: 'Supreme Court of India',
    year: 2010,
    citation: '(2010) 8 SCC 110',
    category: 'SARFAESI & recovery',
    issue: 'When High Courts should entertain writ petitions in recovery matters',
    summary:
      'Cautioned High Courts against interfering with SARFAESI and debt-recovery proceedings when an effective statutory remedy is available, reserving writ jurisdiction for exceptional cases.',
    holdings: [
      'A borrower should ordinarily exhaust the statutory remedy before the Debts Recovery Tribunal.',
      'High Courts may still intervene where the action is wholly without jurisdiction or violates natural justice.',
      'Interim protection should not be granted mechanically in recovery matters.',
    ],
    provisions: ['SARFAESI Act, 2002 — s. 17', 'Constitution of India — Art. 226'],
    source: 'https://main.sci.gov.in/',
  },
  {
    id: 'mathew-varghese',
    title: 'Mathew Varghese v. M. Amritha Kumar',
    court: 'Supreme Court of India',
    year: 2014,
    citation: '(2014) 5 SCC 610',
    category: 'SARFAESI & recovery',
    issue: 'Procedure for sale of a secured asset',
    summary:
      'Required strict compliance with the Security Interest (Enforcement) Rules when selling a secured asset, including valuation, notice to the borrower, and publication of the sale notice.',
    holdings: [
      'Rules 8 and 9 of the Security Interest (Enforcement) Rules prescribe a mandatory procedure for sale.',
      'Failure to serve the sale notice on the borrower vitiates the sale.',
      'The authorised officer must act fairly and cannot bypass the borrower’s right to redeem.',
    ],
    provisions: ['Security Interest (Enforcement) Rules, 2002 — rr. 8 and 9', 'SARFAESI Act, 2002 — s. 13(8)'],
    source: 'https://main.sci.gov.in/',
  },
  {
    id: 'ashok-saw-mill',
    title: 'Authorised Officer, Indian Overseas Bank v. Ashok Saw Mill',
    court: 'Supreme Court of India',
    year: 2009,
    citation: '(2009) 8 SCC 366',
    category: 'SARFAESI & recovery',
    issue: 'Powers of the tribunal over a completed sale',
    summary:
      'Clarified that the Debts Recovery Tribunal can examine the legality of a sale in an appeal, while the authorised officer cannot unilaterally set aside a sale already conducted.',
    holdings: [
      'The tribunal’s jurisdiction under section 17 extends to the legality of the sale process.',
      'The authorised officer has no power to cancel a concluded sale.',
      'A borrower may challenge the sale in appeal even after it is confirmed.',
    ],
    provisions: ['SARFAESI Act, 2002 — ss. 13 and 17'],
    source: 'https://main.sci.gov.in/',
  },
  {
    id: 'central-bank-ravindra',
    title: 'Central Bank of India v. Ravindra',
    court: 'Supreme Court of India',
    year: 2002,
    citation: '(2002) 1 SCC 367',
    category: 'Banking practice',
    issue: 'Interest, compounding, and penal charges in loan accounts',
    summary:
      'Discussed when a bank may capitalise interest and when it may levy penal interest, holding that compounding is permissible only where the contract or a statute allows it.',
    holdings: [
      'Interest can be capitalised where the agreement or applicable law permits it.',
      'Penal interest is compensatory and must be supported by the contract and RBI directions.',
      'Courts can examine whether interest charged is consistent with the contract.',
    ],
    provisions: ['Indian Contract Act, 1872', 'Banking Regulation Act, 1949'],
    source: 'https://main.sci.gov.in/',
  },
  {
    id: 'prakash-kaur',
    title: 'ICICI Bank Ltd. v. Prakash Kaur',
    court: 'Supreme Court of India',
    year: 2007,
    citation: '(2007) 2 SCC 711',
    category: 'Banking practice',
    issue: 'Conduct of recovery agents',
    summary:
      'Held that banks may recover dues but cannot employ criminal force, threats, or public humiliation, and that recovery practices must remain within lawful limits.',
    holdings: [
      'Recovery through agents is permissible, but only through lawful means.',
      'Threatening or humiliating a borrower is not a lawful recovery method.',
      'Banks remain responsible for the conduct of agents they engage.',
    ],
    provisions: ['RBI Fair Practices Code for Lenders', 'Indian Penal Code, 1860'],
    source: 'https://main.sci.gov.in/',
  },
  {
    id: 'lalit-kumar-jain',
    title: 'Lalit Kumar Jain v. Union of India',
    court: 'Supreme Court of India',
    year: 2021,
    citation: '(2021) 9 SCC 321',
    category: 'Insolvency',
    issue: 'Personal guarantors and corporate insolvency',
    summary:
      'Held that approval of a resolution plan for a corporate debtor does not by itself discharge the personal guarantor’s liability under the guarantee.',
    holdings: [
      'The guarantor’s liability is independent of the corporate debtor’s resolution plan.',
      'Sanction of a plan does not extinguish a guarantee unless the plan expressly provides for it.',
      'Insolvency proceedings against a personal guarantor can continue alongside corporate resolution.',
    ],
    provisions: ['Insolvency and Bankruptcy Code, 2016 — s. 60 and Part III', 'Indian Contract Act, 1872 — s. 128'],
    source: 'https://main.sci.gov.in/',
  },
  {
    id: 'rangappa',
    title: 'Rangappa v. Sri Mohan',
    court: 'Supreme Court of India',
    year: 2010,
    citation: '(2010) 11 SCC 441',
    category: 'Cheque dishonour',
    issue: 'Presumption of a legally enforceable debt under section 139',
    summary:
      'Held that once the drawer’s signature on a cheque is admitted, a presumption arises that the cheque was issued for a legally enforceable debt, which the accused must rebut.',
    holdings: [
      'Section 139 raises a presumption in favour of the holder of the cheque.',
      'The presumption is rebuttable and does not relieve the complainant of proving the basic facts.',
      'The accused may rely on evidence led by the complainant to rebut the presumption.',
    ],
    provisions: ['Negotiable Instruments Act, 1881 — ss. 118, 138 and 139'],
    source: 'https://main.sci.gov.in/',
  },
  {
    id: 'dashrath-rathod',
    title: 'Dashrath Rupsingh Rathod v. State of Maharashtra',
    court: 'Supreme Court of India',
    year: 2014,
    citation: '(2014) 9 SCC 129',
    category: 'Cheque dishonour',
    issue: 'Territorial jurisdiction in cheque-dishonour complaints',
    summary:
      'Held that jurisdiction for a section 138 complaint ordinarily lay where the drawee bank’s branch is situated — a position later changed by the 2015 amendment to the Act.',
    holdings: [
      'The offence under section 138 was treated as complete at the drawee bank’s branch.',
      'The 2015 amendment now allows a complaint where the payee presents the cheque, among other places.',
      'Always check the post-amendment position before filing.',
    ],
    provisions: ['Negotiable Instruments Act, 1881 — ss. 138 and 142', 'Negotiable Instruments (Amendment) Act, 2015'],
    source: 'https://main.sci.gov.in/',
  },
  {
    id: 'meters-instruments',
    title: 'Meters and Instruments Pvt. Ltd. v. Kanchan Mehta',
    court: 'Supreme Court of India',
    year: 2018,
    citation: '(2018) 1 SCC 560',
    category: 'Cheque dishonour',
    issue: 'Compounding and trial of cheque-dishonour cases',
    summary:
      'Encouraged compounding of section 138 offences and permitted summary disposal, so that dishonour complaints are not delayed by lengthy trials.',
    holdings: [
      'A complaint under section 138 may be compounded at any stage.',
      'Courts should adopt a summary procedure where the facts permit.',
      'Compensation to the complainant is a relevant consideration while compounding.',
    ],
    provisions: ['Negotiable Instruments Act, 1881 — ss. 138, 143 and 147'],
    source: 'https://main.sci.gov.in/',
  },
  {
    id: 'innoventive',
    title: 'Innoventive Industries Ltd. v. ICICI Bank',
    court: 'Supreme Court of India',
    year: 2018,
    citation: '(2018) 1 SCC 407',
    category: 'Insolvency',
    issue: 'Admission into corporate insolvency resolution',
    summary:
      'Explained the trigger for corporate insolvency resolution and held that the Code overrides inconsistent state legislation once the moratorium applies.',
    holdings: [
      'The adjudicating authority must admit the application once a default is shown and no pre-existing dispute is established.',
      'A state law granting relief from recovery cannot override the Insolvency and Bankruptcy Code.',
      'The moratorium protects the corporate debtor from recovery actions during resolution.',
    ],
    provisions: ['Insolvency and Bankruptcy Code, 2016 — ss. 7, 14 and 238'],
    source: 'https://main.sci.gov.in/',
  },
  {
    id: 'mobilox',
    title: 'Mobilox Innovations Pvt. Ltd. v. Kirusa Software Pvt. Ltd.',
    court: 'Supreme Court of India',
    year: 2018,
    citation: '(2018) 1 SCC 353',
    category: 'Insolvency',
    issue: 'Pre-existing dispute in operational debt claims',
    summary:
      'Held that an operational creditor’s application must be rejected where a genuine, pre-existing dispute is shown — the dispute need only be plausible, not proven.',
    holdings: [
      'The dispute must exist before the demand notice, not be invented afterwards.',
      'The adjudicating authority does not conduct a mini-trial at the admission stage.',
      'A plausible defence is enough to defeat an operational creditor’s application.',
    ],
    provisions: ['Insolvency and Bankruptcy Code, 2016 — s. 9 and s. 5(6)'],
    source: 'https://main.sci.gov.in/',
  },
  {
    id: 'swiss-ribbons',
    title: 'Swiss Ribbons Pvt. Ltd. v. Union of India',
    court: 'Supreme Court of India',
    year: 2019,
    citation: '(2019) 4 SCC 17',
    category: 'Insolvency',
    issue: 'Constitutional validity of the Insolvency and Bankruptcy Code',
    summary:
      'Upheld the Code’s validity and explained why financial and operational creditors are treated differently in the resolution process.',
    holdings: [
      'The classification between financial and operational creditors has a rational basis.',
      'The committee of creditors’ commercial decision is not ordinarily open to judicial review.',
      'The resolution process must respect the Code’s timelines.',
    ],
    provisions: ['Insolvency and Bankruptcy Code, 2016 — ss. 5, 21 and 30'],
    source: 'https://main.sci.gov.in/',
  },
];

export const CASE_BY_ID = Object.fromEntries(CASES.map((c) => [c.id, c]));

export function searchCases(query) {
  const q = query.trim().toLowerCase();
  if (!q) return CASES;
  return CASES.filter((c) =>
    [c.title, c.court, c.citation, c.category, c.issue, c.summary]
      .join(' ')
      .toLowerCase()
      .includes(q),
  );
}
