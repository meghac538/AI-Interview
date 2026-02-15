/**
 * Generate "messy document inventories" for Data Steward interview round (max 2 pages).
 *
 * Each PDF is a readable dump of document snippets with intentional issues
 * (inconsistent metadata, conflicting info, ambiguous categories, duplicate entries).
 * Candidates must scan, classify, and design a taxonomy from this snapshot.
 *
 * Run:  node scripts/generate-messy-docs.js
 */

const PDFDocument = require('pdfkit')
const fs = require('fs')
const path = require('path')

const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'docs')

// ─────────────────────────────────────────────────────────────────────────────
// L1: 6 document entries, simpler issues
// ─────────────────────────────────────────────────────────────────────────────

function generateL1() {
  const doc = new PDFDocument({ size: 'A4', margin: 36 })
  const out = fs.createWriteStream(path.join(OUTPUT_DIR, 'messy-doc-set-l1.pdf'))
  doc.pipe(out)

  // Title
  doc.fontSize(16).font('Helvetica-Bold').text('INTERNAL KNOWLEDGE BASE — Document Inventory Export', { align: 'center' })
  doc.moveDown(0.15)
  doc.fontSize(10).font('Helvetica-Oblique').text('Export: 2024-03-15 | Source: Confluence + Google Drive | WARNING: May contain duplicates', { align: 'center' })
  doc.moveDown(1)

  const entries = [
    {
      id: 'DOC-101',
      title: 'New Hire Onboarding Checklist',
      owner: 'People Ops',
      date: 'Jan 15, 2024',
      version: 'v3.1',
      status: 'Active',
      snippet: 'Pre-start: send welcome email, create Google Workspace + Slack + Jira accounts, order laptop (IT ticket 5 days before start), add to Rippling payroll, schedule orientation.',
      issue: 'DUPLICATE FOUND — older copy (v2.4) says "add to ADP payroll" and "order laptop 7 days before start." Both versions marked Active.'
    },
    {
      id: 'DOC-102',
      title: 'Data Handling & Privacy Policy',
      owner: 'Security & Compliance',
      date: 'November 2021',
      version: 'v2.0',
      status: 'Active',
      snippet: 'Classification levels: L1 Public, L2 Internal, L3 Confidential, L4 Restricted. Retention: customer PII 3 yrs after last interaction then anonymize; employee records 7 yrs; contracts duration + 5 yrs; internal memos 2 yrs.',
      issue: 'Last updated 2021 — references pre-GDPR practices. No review since.'
    },
    {
      id: 'DOC-103',
      title: 'Smart Notification Engine — Feature Spec',
      owner: 'Product — Growth Squad',
      date: 'Aug 8, 2023',
      version: 'v1.2',
      status: 'DRAFT — NOT APPROVED',
      snippet: 'Push + email notifications based on user behavior. Rate limit 3 push + 1 email/user/day. Notification logs retained 90 days. Open Q: Legal sign-off on push consent? (asked 08/2023, no response).',
      issue: 'Still says DRAFT. Retention of 90 days conflicts with DOC-102 (no notification log policy) and DOC-106 proposal of 30 days.'
    },
    {
      id: 'DOC-104',
      title: 'Incident Response Playbook',
      owner: 'Security Operations',
      date: '10 January 2024',
      version: 'v5.0',
      status: 'Active — Confidential',
      snippet: 'SEV-1 (breach/outage >50% users): 15 min response, war room, CEO notified. SEV-2: 1 hr. SEV-3: 4 hr. SEV-4: 24 hr. GDPR: 72-hr notification to authority. Post-mortem within 5 days.',
      issue: 'Note says "old process (pre-2023) used email chains — some teams still follow it." Mixed process.'
    },
    {
      id: 'DOC-105',
      title: 'Vendor Onboarding SOP',
      owner: 'Finance / Procurement',
      date: '2024-01-20',
      version: 'v4.2',
      status: 'Active',
      snippet: 'Vendors >$5K require: SOC 2 or ISO 27001, $2M insurance, 2 references. Steps: request form → procurement review (5 days) → security review if L3+ data → legal MSA/DPA → NetSuite setup. Under $5K: skip security + legal.',
      issue: 'Two primary contacts listed: Sarah Chen (Procurement Lead) and Mike Torres (Procurement Manager). TODO: "confirm owner after reorg."'
    },
    {
      id: 'DOC-106',
      title: 'Data Retention Policy Updates (MEMO)',
      owner: 'Compliance Team',
      date: '2024-02-28',
      version: 'DRAFT',
      status: 'DRAFT — Pending Legal Review',
      snippet: 'Proposed: customer PII 3→2 yrs then DELETE (not anonymize); notification logs 90→30 days; vendor contracts duration+5→duration+3 yrs; internal memos 2→1 yr. NEW: audit logs 5 yrs (SOX).',
      issue: 'Conflicts with DOC-102 (current retention policy) and DOC-103 (notification log retention). Memo says "NOT approved — do not implement."'
    }
  ]

  renderEntries(doc, entries)

  doc.end()
  return new Promise(resolve => out.on('finish', resolve))
}

// ─────────────────────────────────────────────────────────────────────────────
// L2: 8 document entries, moderate issues + cross-references
// ─────────────────────────────────────────────────────────────────────────────

function generateL2() {
  const doc = new PDFDocument({ size: 'A4', margin: 36 })
  const out = fs.createWriteStream(path.join(OUTPUT_DIR, 'messy-doc-set-l2.pdf'))
  doc.pipe(out)

  doc.fontSize(16).font('Helvetica-Bold').text('CROSS-TEAM KNOWLEDGE BASE — Document Inventory Export', { align: 'center' })
  doc.moveDown(0.15)
  doc.fontSize(10).font('Helvetica-Oblique').text('Export: 2024-03-15 | Source: Confluence + Google Drive + Notion | WARNING: Contains duplicates and outdated pages', { align: 'center' })
  doc.moveDown(1)

  const entries = [
    {
      id: 'DOC-201',
      title: 'Vendor Onboarding & Procurement SOP',
      owner: 'Finance / Procurement',
      date: '2024-01-20',
      version: 'v4.2',
      status: 'Active',
      snippet: 'All vendors >$5K: SOC 2/ISO 27001, $2M insurance, 2 refs, Net 30. Steps: vendor form (link BROKEN) → procurement review 5d → security review if L3+ data → legal MSA → NetSuite setup. Under $5K skip security + legal.',
      issue: 'Dual owners: Sarah Chen (Lead) vs Mike Torres (Manager). TODO: "confirm after reorg." Broken form link.'
    },
    {
      id: 'DOC-202',
      title: 'Access Control & Identity Management Policy',
      owner: 'IT Security',
      date: '09/15/2023',
      version: 'v2.8',
      status: 'Active (review overdue — was due Mar 2024)',
      snippet: 'SSO via Okta. MFA for ALL users. Passwords: min 12 chars (NIST 800-63B). Vendor access expires with contract. Dormant accounts: annual audit if inactive >60 days.',
      issue: 'DUPLICATE: Archived v2.3 section found in same doc — says "SSO via Azure AD, MFA admin-only, min 8 chars." Both sections present in document.'
    },
    {
      id: 'DOC-203',
      title: 'Incident Response Playbook',
      owner: 'Security Operations',
      date: 'January 10th, 2024',
      version: 'v5.0',
      status: 'Active — Confidential',
      snippet: 'SEV-1: 15 min, war room, CEO. SEV-2: 1 hr, incident commander. SEV-3: 4 hr. SEV-4: 24 hr, log only. Blameless post-mortem in 5 days. GDPR 72-hr notification.',
      issue: 'Note: "pre-2023 process used email chains — some teams still follow old process." Date format differs from all other docs.'
    },
    {
      id: 'DOC-204',
      title: 'Data Retention Policy — Proposed Updates',
      owner: 'Compliance Team',
      date: '2024-02-28',
      version: 'DRAFT',
      status: 'DRAFT — Pending Legal Review',
      snippet: 'Proposed: customer PII 3→2 yrs, DELETE not anonymize; notification logs 90→30 days; vendor contracts +5→+3 yrs; memos 2→1 yr. NEW: audit logs 5 yrs (SOX).',
      issue: 'NOT APPROVED. Conflicts with DOC-206 (current retention) and DOC-205 (notification spec says 90 days). Memo says "do not implement."'
    },
    {
      id: 'DOC-205',
      title: 'Smart Notification Engine — Feature Spec',
      owner: 'Product — Growth Squad',
      date: 'Aug 8, 2023',
      version: 'v1.2',
      status: 'DRAFT — NOT APPROVED',
      snippet: 'Contextual push + email. Rate limit: 3 push + 1 email/user/day. Logs retained 90 days. A/B via LaunchDarkly. Open: legal sign-off on push consent (no response since Aug 2023).',
      issue: 'Still DRAFT after 7 months. Retention 90 days conflicts with DOC-204 proposal (30 days). Budget approval link broken.'
    },
    {
      id: 'DOC-206',
      title: 'Data Handling & Privacy Policy',
      owner: 'Security & Compliance',
      date: 'November 2021',
      version: 'v2.0',
      status: 'Active',
      snippet: 'L1 Public → L4 Restricted. Customer PII: 3 yrs then anonymize. Employee records: 7 yrs. Contracts: duration + 5 yrs. Memos: 2 yrs. Breach → security@company.com within 24 hrs.',
      issue: 'Last updated Nov 2021 — 3+ years old. DOC-204 proposes replacing Section 3 (retention). Still references pre-GDPR language.'
    },
    {
      id: 'DOC-207',
      title: 'New Employee Onboarding Checklist',
      owner: 'People Ops',
      date: 'Jan 15, 2024',
      version: 'v3.1',
      status: 'Active',
      snippet: 'Pre-start: welcome email, create accounts (Google, Slack, Jira, GitHub), order laptop 5 days early, add to Rippling. Day 1: badge, IT setup, HR orientation, NDA, security training.',
      issue: 'DUPLICATE v2.4 found — says "add to ADP" (not Rippling), "order laptop 7 days early." Both copies in system with "Active" status.'
    },
    {
      id: 'DOC-208',
      title: 'Q3 2023 Engineering OKRs (Archived)',
      owner: 'VP Engineering',
      date: 'Jul 1, 2023',
      version: 'n/a',
      status: 'Archived',
      snippet: 'KR1: Ship notification engine (see DOC-205). KR2: Reduce P95 latency <200ms. KR3: SOC 2 Type II audit pass. Cross-ref: DOC-205 still DRAFT despite Q3 KR.',
      issue: 'Archived but still referenced by DOC-205. Contains stale cross-references. Should this even be in the knowledge base?'
    }
  ]

  renderEntries(doc, entries)

  doc.end()
  return new Promise(resolve => out.on('finish', resolve))
}

// ─────────────────────────────────────────────────────────────────────────────
// L3: 10 document entries, complex cross-references + regulatory mix
// ─────────────────────────────────────────────────────────────────────────────

function generateL3() {
  const doc = new PDFDocument({ size: 'A4', margin: 36 })
  const out = fs.createWriteStream(path.join(OUTPUT_DIR, 'messy-doc-set-l3.pdf'))
  doc.pipe(out)

  doc.fontSize(16).font('Helvetica-Bold').text('REGULATORY & INTERNAL POLICY ARCHIVE — Inventory Export', { align: 'center' })
  doc.moveDown(0.15)
  doc.fontSize(10).font('Helvetica-Oblique').text('Export: 2024-03-01 | Docs from 2021-2024 | CONFIDENTIAL | NOTICE: Contains multiple versions — conflicts under review', { align: 'center' })
  doc.moveDown(1)

  const entries = [
    {
      id: 'GOV-001',
      title: 'AI Governance Framework — NIST AI RMF Mapping',
      owner: 'AI Ethics Committee / Legal',
      date: '2024-01-15',
      version: 'v1.3',
      status: 'Active',
      snippet: 'Maps internal controls to NIST AI RMF 1.0 (Govern/Map/Measure/Manage). Model inventory: ML-001 Pi Screening (High risk, audited Nov 2023), ML-005 Chatbot (Limited risk, NEVER audited).',
      issue: 'ML-005 never audited — violates own policy. ML-004 audit 9 months overdue. References "EU AI Act draft Dec 2023" which may be outdated.'
    },
    {
      id: 'GOV-002',
      title: 'Employment Classification & Overtime Guidelines',
      owner: 'Legal / People Ops',
      date: '2023-08-01',
      version: 'v3.1',
      status: 'Active (pending 2024 DOL update)',
      snippet: 'FLSA exemption: salary basis + level + duties test. 2020 rule (CURRENT): $684/wk ($35,568/yr). 2024 PROPOSED: $1,128/wk ($58,656/yr). Titles do NOT determine exemption.',
      issue: 'Contains 3 salary thresholds (2019/2020/2024 proposed). Internal payroll uses 2020 thresholds. 2024 rule status unknown — doc says "check DOL website."'
    },
    {
      id: 'GOV-003',
      title: 'Vendor Security Assessment Standard',
      owner: 'Security & Compliance',
      date: 'February 2024',
      version: 'v2.1',
      status: 'Active',
      snippet: 'Tier 1 (critical, handles PII): full questionnaire + SOC 2 + pen test. Tier 2 (internal tools): abbreviated questionnaire. Tier 3 (<$5K, no data): self-attestation only.',
      issue: 'Tier 3 "self-attestation only" conflicts with GOV-010 amendment requiring all vendors to complete abbreviated questionnaire. Tracked in Google Sheet — migrating to Vanta Q2 2024.'
    },
    {
      id: 'GOV-004',
      title: 'Access Control Policy',
      owner: 'IT Security',
      date: '09/15/2023',
      version: 'v2.8',
      status: 'Active',
      snippet: 'MFA all users, SSO Okta, min 12 chars. Vendor access expires with contract. Dormant accounts: annual audit >60 days inactive.',
      issue: 'Archived v2.3 still in doc: "Azure AD, MFA admin-only, 8 chars." GOV-010 supersedes Sections 2 and 4. Three conflicting versions in circulation.'
    },
    {
      id: 'GOV-005',
      title: 'Vendor Onboarding SOP',
      owner: 'Finance / Procurement',
      date: '2024-01-20',
      version: 'v4.2',
      status: 'Active',
      snippet: 'Vendors >$5K: SOC 2/ISO 27001, $2M insurance, security review for L3+ data. Under $5K: skip security + legal review.',
      issue: '"Under $5K skip security" conflicts with GOV-003 Tier 3 self-attestation AND GOV-010 new minimum requirement. Three docs disagree on low-spend vendor process.'
    },
    {
      id: 'GOV-006',
      title: 'Data Handling & Privacy Policy',
      owner: 'Security & Compliance',
      date: 'November 2021',
      version: 'v2.0',
      status: 'Active',
      snippet: 'L1-L4 classification. Customer PII: 3 yrs then anonymize. Employee records: 7 yrs. Contracts: duration + 5 yrs. Breach: report within 24 hrs.',
      issue: '3+ years old. GOV-008 proposes replacing retention schedule. Still uses pre-GDPR "anonymize" language — GOV-008 says "delete."'
    },
    {
      id: 'GOV-007',
      title: 'Incident Response Playbook',
      owner: 'Security Operations',
      date: 'January 10th, 2024',
      version: 'v5.0',
      status: 'Active — Confidential',
      snippet: 'SEV-1: 15 min war room. GDPR 72-hr notification. Blameless post-mortem in 5 days. Escalation: Security → CTO → CEO → Board.',
      issue: 'Date format inconsistent with all other docs. References "old email chain process" some teams still use.'
    },
    {
      id: 'GOV-008',
      title: 'Data Retention Policy — Proposed Updates',
      owner: 'Compliance Team',
      date: '2024-02-28',
      version: 'DRAFT',
      status: 'DRAFT — Pending Legal',
      snippet: 'Customer PII 3→2 yrs DELETE not anonymize. Notification logs 90→30 days. Audit logs NEW 5 yrs (SOX). Vendor contracts +5→+3 yrs.',
      issue: 'NOT APPROVED. Contradicts GOV-006. Also conflicts with Product spec GOV-009 (90-day logs).'
    },
    {
      id: 'GOV-009',
      title: 'Smart Notification Engine Spec',
      owner: 'Product — Growth Squad',
      date: 'Aug 8, 2023',
      version: 'v1.2 DRAFT',
      status: 'DRAFT — 7 months stale',
      snippet: 'Push + email notifications. Logs retained 90 days. Legal sign-off on consent: asked Aug 2023, no response.',
      issue: 'Multi-category: part product spec, part compliance (retention, consent). DRAFT 7 months with no owner action. Budget link broken.'
    },
    {
      id: 'GOV-010',
      title: 'Policy Amendment — Access Control & Vendor Mgmt',
      owner: 'CISO Office',
      date: 'Feb 20, 2024',
      version: 'FINAL',
      status: 'APPROVED — Effective Mar 1, 2024',
      snippet: 'MFA ALL accounts (was admin-only in v2.3). Passwords min 14 chars (was 12 in v2.8). Vendor access re-cert every 90 days. ALL vendors must complete abbreviated questionnaire (was self-attestation for Tier 3). Dormant accounts auto-disable >45 days (was 60).',
      issue: 'Supersedes GOV-004 Sections 2+4 and GOV-003 Tier 3 rule, but those docs NOT YET UPDATED. This memo governs until docs are revised.'
    }
  ]

  renderEntries(doc, entries)

  doc.end()
  return new Promise(resolve => out.on('finish', resolve))
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared renderer — compact table-like layout
// ─────────────────────────────────────────────────────────────────────────────

function renderEntries(doc, entries) {
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]

    // ID + Title line
    doc.fontSize(13).font('Helvetica-Bold').text(`${e.id}  ${e.title}`, { continued: false })
    doc.moveDown(0.15)

    // Metadata line
    doc.fontSize(9.5).font('Helvetica-Oblique')
      .text(`Owner: ${e.owner}  |  Updated: ${e.date}  |  ${e.version}  |  Status: ${e.status}`)
    doc.moveDown(0.2)

    // Snippet
    doc.fontSize(10.5).font('Helvetica')
      .text(e.snippet, { lineGap: 3 })
    doc.moveDown(0.15)

    // Issue flag
    doc.fontSize(10).font('Helvetica-Bold')
      .fillColor('#cc0000')
      .text(`FLAG: ${e.issue}`, { lineGap: 3 })
      .fillColor('#000000')

    // Separator between entries (not after last)
    if (i < entries.length - 1) {
      doc.moveDown(0.5)
      doc.fontSize(6).font('Helvetica').fillColor('#aaaaaa').text('~'.repeat(95))
      doc.fillColor('#000000')
      doc.moveDown(0.5)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  console.log('Generating L1 (6 entries, simpler)...')
  await generateL1()
  console.log('  → public/docs/messy-doc-set-l1.pdf')

  console.log('Generating L2 (8 entries, moderate)...')
  await generateL2()
  console.log('  → public/docs/messy-doc-set-l2.pdf')

  console.log('Generating L3 (10 entries, complex)...')
  await generateL3()
  console.log('  → public/docs/messy-doc-set-l3.pdf')

  console.log('Done!')
}

main().catch(console.error)
