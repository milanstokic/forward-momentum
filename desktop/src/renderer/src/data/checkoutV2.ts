import type { Claim, Engagement, GapRecord, PipelineStage } from '@/model/types'

/**
 * Mock engagement: "checkout-v2". Mirrors the example-ui prototype's demo data,
 * but structured exactly as a real engagement's analysis/claims.json +
 * analysis/gaps.json would be — so loadEngagement() could later read those files
 * instead of this module with no change to the views.
 */

const claims: Claim[] = [
  {
    id: 'claim-001',
    summary: 'Checkout v2 exists to recover mobile revenue lost to a slow checkout.',
    provenance: [
      {
        sourceFile: 'sources/discovery-call.md',
        locator: '00:02:10',
        quote: "We're leaving money on the table on mobile checkout — it's just too slow."
      }
    ]
  },
  {
    id: 'claim-002',
    summary: 'Target: reduce checkout abandonment by 15% at launch.',
    provenance: [
      {
        sourceFile: 'sources/prd-draft.md',
        locator: '§1.1',
        quote: 'Cut checkout abandonment by 15% at launch.'
      }
    ]
  },
  {
    id: 'claim-007',
    summary: 'Digital wallets should be the most prominent payment option on mobile.',
    provenance: [
      {
        sourceFile: 'sources/discovery-call.md',
        locator: '00:19:30',
        quote: 'Lead with Apple Pay and Google Pay on mobile — wallets first, card second.'
      }
    ]
  },
  {
    id: 'claim-004',
    summary: 'Guest checkout is a launch requirement.',
    provenance: [
      {
        sourceFile: 'sources/discovery-call.md',
        locator: '00:12:04',
        quote: 'Guest checkout is non-negotiable for launch.'
      }
    ]
  },
  {
    id: 'claim-011',
    summary: 'The guest flow is deferred out of the v2 scope.',
    provenance: [
      {
        sourceFile: 'sources/eng-rfc-v2.md',
        locator: '§3.1',
        quote: 'Guest flow deferred — out of v2 scope.'
      }
    ]
  },
  {
    id: 'claim-018',
    summary: 'Refunds must be processed in a timely manner (no window given).',
    provenance: [
      {
        sourceFile: 'sources/prd-draft.md',
        locator: '§4.2',
        quote: 'Refunds processed in a timely manner.'
      }
    ]
  },
  {
    id: 'claim-027',
    summary: 'Apple Pay is assumed available across all launch markets.',
    provenance: [
      {
        sourceFile: 'sources/discovery-call.md',
        locator: '00:28:51',
        quote: '…and obviously Apple Pay everywhere.'
      }
    ]
  },
  {
    id: 'claim-033',
    summary: 'A declined-card error state is referenced but not specified.',
    provenance: [
      {
        sourceFile: 'sources/design-notes.md',
        locator: 'p.6',
        quote: 'Decline handling: TODO — needs a design.'
      }
    ]
  },
  {
    id: 'claim-041',
    summary: 'The express drawer needs an empty / zero-item state.',
    provenance: [
      {
        sourceFile: 'sources/design-notes.md',
        locator: 'p.9',
        quote: 'Express drawer — empty state not yet drawn.'
      }
    ]
  }
]

const gaps: GapRecord[] = [
  {
    id: 'gap-001',
    kind: 'conflict',
    severity: 'blocking',
    summary:
      'Discovery call states guest checkout is a launch requirement; the Eng scoping RFC lists it as removed from v2.',
    relatedClaims: ['claim-004', 'claim-011'],
    evidence: [
      {
        sourceFile: 'sources/discovery-call.md',
        locator: '00:12:04',
        quote: 'Guest checkout is non-negotiable for launch.'
      },
      {
        sourceFile: 'sources/eng-rfc-v2.md',
        locator: '§3.1',
        quote: 'Guest flow deferred — out of v2 scope.'
      }
    ],
    status: 'open',
    view: {
      category: 'conflict',
      title: 'Guest checkout: required, or cut?',
      body: 'Discovery call states guest checkout is a launch requirement. The Eng scoping RFC lists it as removed from v2.',
      owner: { name: 'Maya', initials: 'MK', role: 'PM' },
      waitingOn: 'PM decision',
      ageDays: 2,
      scopeImpact: 'Touches the checkout API surface — Eng cannot estimate until resolved.'
    }
  },
  {
    id: 'gap-002',
    kind: 'gap',
    severity: 'blocking',
    summary:
      'Acceptance criteria reference "timely refunds" but no SLA window is specified in any source.',
    relatedClaims: ['claim-018'],
    evidence: [
      {
        sourceFile: 'sources/prd-draft.md',
        locator: '§4.2',
        quote: 'Refunds processed in a timely manner.'
      }
    ],
    status: 'open',
    view: {
      category: 'missing',
      title: 'Express refund SLA is undefined',
      body: 'Acceptance criteria reference "timely refunds" but no SLA window is specified in any source.',
      owner: { name: 'Dane', initials: 'DR', role: 'Eng' },
      waitingOn: 'Eng + Ops',
      ageDays: 1,
      scopeImpact: 'Refund endpoint contract has an unfilled sla_hours field.'
    }
  },
  {
    id: 'gap-003',
    kind: 'gap',
    severity: 'non-blocking',
    summary:
      'Extraction inferred Apple Pay availability across every launch market — unverified against source.',
    relatedClaims: ['claim-027'],
    evidence: [
      {
        sourceFile: 'sources/discovery-call.md',
        locator: '00:28:51',
        quote: '…and obviously Apple Pay everywhere.'
      }
    ],
    status: 'open',
    view: {
      category: 'assumption',
      title: 'Assumes Apple Pay in all launch markets',
      body: 'Extraction inferred Apple Pay availability across every launch market — unverified against source.',
      owner: { name: 'Priya', initials: 'PV', role: 'PM' },
      waitingOn: 'Payments confirmation',
      ageDays: 3
    }
  },
  {
    id: 'gap-004',
    kind: 'gap',
    severity: 'non-blocking',
    summary: 'No copy or behavior is defined for a declined card in the express drawer.',
    relatedClaims: ['claim-033'],
    evidence: [
      {
        sourceFile: 'sources/design-notes.md',
        locator: 'p.6',
        quote: 'Decline handling: TODO — needs a design.'
      }
    ],
    status: 'open',
    view: {
      category: 'under-spec',
      title: 'Declined-card error state not specified',
      body: 'No copy or behavior is defined for a declined card in the express drawer.',
      owner: { name: 'Sam', initials: 'SL', role: 'Design' },
      waitingOn: 'Design',
      ageDays: 1,
      canRouteToDesign: true
    }
  },
  {
    id: 'gap-005',
    kind: 'gap',
    severity: 'non-blocking',
    summary: 'The empty / zero-item state for the express drawer is missing.',
    relatedClaims: ['claim-041'],
    evidence: [
      {
        sourceFile: 'sources/design-notes.md',
        locator: 'p.9',
        quote: 'Express drawer — empty state not yet drawn.'
      }
    ],
    status: 'open',
    view: {
      category: 'design-gap',
      title: 'Express drawer has no zero-item state',
      body: 'The empty / zero-item state for the express drawer is missing — a candidate to route to Design.',
      owner: { name: 'Sam', initials: 'SL', role: 'Design' },
      waitingOn: 'Design',
      ageDays: 4,
      canRouteToDesign: true
    }
  }
]

const stages: PipelineStage[] = [
  { key: 'intake', name: 'Intake', status: 'done', note: 'sources loaded' },
  { key: 'extraction', name: 'Extraction', status: 'done', note: `${claims.length} claims` },
  { key: 'gap-analysis', name: 'Gap analysis', status: 'current', note: '5 surfaced' },
  { key: 'resolution', name: 'Resolution', status: 'locked', note: 'gate closed' },
  { key: 'prd-draft', name: 'PRD draft', status: 'todo', note: 'waiting' },
  { key: 'review', name: 'Review', status: 'todo', note: 'waiting' },
  { key: 'handoff', name: 'Handoff', status: 'todo', note: 'waiting' }
]

export const checkoutV2: Engagement = {
  slug: 'checkout-v2',
  branch: 'main',
  claims,
  gaps,
  stages
}
