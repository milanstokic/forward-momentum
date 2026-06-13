import { computeVerdict, type Finding, type ReviewReport } from '@/model/review'

/**
 * The reviewer pass over the checkout-v2 PRD, as `fm-reviewer` would emit it to
 * decisions/prd-review.md. The PRD is fully traceable and internally consistent,
 * so the verdict is PASS — with two warnings noting the deliberately-deferred items.
 */

const findings: Finding[] = [
  {
    severity: 'warning',
    axis: 'leakage',
    location: 'prd/PRD.md:Open Questions',
    finding: 'Apple Pay market availability still unconfirmed (gap-003) — correctly surfaced as an Open Question, not asserted as settled.'
  },
  {
    severity: 'warning',
    axis: 'consistency',
    location: 'spec/SPEC.md:Edge Cases',
    finding: 'Declined-card behavior deferred to Design (gap-004); the AC is intentionally incomplete and flagged PENDING.'
  }
]

export const checkoutV2Review: ReviewReport = {
  engagement: 'checkout-v2',
  verdict: computeVerdict(findings),
  reviewedAt: '2026-06-13T13:40:00Z',
  reviewer: 'fm-reviewer',
  summary:
    'Reviewed the dual-view PRD (prd/PRD.md + spec/SPEC.md) against the resolved claims, gaps, and decision records. All assertions are cited and resolve to real claims or decisions; the guest-checkout conflict is asserted in a single direction per gap-001. No blocking gap leaked into a settled requirement. Two non-blocking items remain deliberately deferred. Verdict: PASS.',
  axes: [
    {
      axis: 'traceability',
      pass: true,
      note: 'Every assertion line ends in a citation; all cited claim ids and decision files resolve. No dangling or missing citations.'
    },
    {
      axis: 'consistency',
      pass: true,
      note: 'The guest-checkout conflict is asserted one way (deferred) per the gap-001 decision. Human and machine views agree; no non-goal appears as in-scope.'
    },
    {
      axis: 'leakage',
      pass: true,
      note: 'No open blocking gap is asserted as settled. The two open non-blocking gaps appear only as Open Questions / pending edge cases.'
    }
  ],
  findings
}
