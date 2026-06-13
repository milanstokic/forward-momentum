import type { PrdDoc } from '@/model/prd'

/**
 * The composed dual-view PRD for the checkout-v2 engagement, as the `fm-prd`
 * skill would emit it once the Resolution gate cleared. Every assertion's
 * citation maps to a real claim in checkoutV2.ts or a recorded decision.
 */

const DECISION_GUEST = {
  sourceFile: 'decisions/2026-06-13-resolution-gap-001.md',
  locator: 'resolution',
  isDecision: true,
  quote:
    'Resolved: guest checkout is deferred to a post-launch fast-follow. v2 ships account-required with a lightweight inline signup. (Maya + Dane, 2026-06-13)'
}

const DECISION_SLA = {
  sourceFile: 'decisions/2026-06-13-resolution-gap-002.md',
  locator: 'resolution',
  isDecision: true,
  quote: 'Resolved: express refund SLA fixed at 24 hours from issuance. (Ops + Eng, 2026-06-13)'
}

export const checkoutV2Prd: PrdDoc = {
  engagement: 'checkout-v2',
  human: [
    {
      title: 'Objective',
      assertions: [
        {
          id: 'h-obj-1',
          text: 'Checkout v2 exists to recover mobile revenue lost to a slow, high-friction checkout.',
          citations: [
            {
              claimIds: ['claim-001'],
              sourceFile: 'sources/discovery-call.md',
              locator: '00:02:10',
              quote: "We're leaving money on the table on mobile checkout — it's just too slow."
            }
          ]
        }
      ]
    },
    {
      title: 'Goals & Success Metrics',
      assertions: [
        {
          id: 'h-goal-1',
          text: 'Reduce checkout abandonment by 15% at launch.',
          citations: [
            {
              claimIds: ['claim-002'],
              sourceFile: 'sources/prd-draft.md',
              locator: '§1.1',
              quote: 'Cut checkout abandonment by 15% at launch.'
            }
          ]
        }
      ]
    },
    {
      title: 'Scope',
      assertions: [
        {
          id: 'h-scope-1',
          text: 'Digital wallets are the primary, most-prominent payment option on mobile.',
          citations: [
            {
              claimIds: ['claim-007'],
              sourceFile: 'sources/discovery-call.md',
              locator: '00:19:30',
              quote: 'Lead with Apple Pay and Google Pay on mobile — wallets first, card second.'
            }
          ]
        },
        {
          id: 'h-scope-2',
          text: 'Express refunds are supported from the order-detail screen.',
          citations: [
            {
              claimIds: ['claim-018'],
              sourceFile: 'sources/prd-draft.md',
              locator: '§4.2',
              quote: 'Refunds processed in a timely manner.'
            }
          ]
        }
      ]
    },
    {
      title: 'Key Decisions',
      variant: 'decisions',
      intro: 'Where sources disagreed, the team settled one direction. The PRD asserts only that direction.',
      assertions: [
        {
          id: 'h-dec-1',
          text: 'Guest checkout is deferred to a fast-follow; v2 ships account-required with lightweight inline signup.',
          citations: [{ claimIds: [], decisionId: 'gap-001', ...DECISION_GUEST }]
        },
        {
          id: 'h-dec-2',
          text: 'Express refund SLA is fixed at 24 hours from issuance.',
          citations: [{ claimIds: ['claim-018'], decisionId: 'gap-002', ...DECISION_SLA }]
        }
      ]
    },
    {
      title: 'Out of Scope / Parked',
      assertions: [
        {
          id: 'h-oos-1',
          text: 'Guest checkout without an account is parked for a post-launch fast-follow.',
          citations: [
            {
              claimIds: ['claim-011'],
              sourceFile: 'sources/eng-rfc-v2.md',
              locator: '§3.1',
              quote: 'Guest flow deferred — out of v2 scope.'
            }
          ]
        }
      ]
    },
    {
      title: 'Open Questions',
      variant: 'open-questions',
      intro: 'Non-blocking gaps still pending. Surfaced here rather than silently asserted as settled.',
      assertions: [
        {
          id: 'h-oq-1',
          text: 'Apple Pay availability across all launch markets is assumed but unconfirmed.',
          pending: true,
          citations: [
            {
              claimIds: ['claim-027'],
              decisionId: 'gap-003',
              sourceFile: 'sources/discovery-call.md',
              locator: '00:28:51',
              quote: '…and obviously Apple Pay everywhere.'
            }
          ]
        },
        {
          id: 'h-oq-2',
          text: 'Declined-card error state in the express drawer is routed to Design.',
          pending: true,
          citations: [
            {
              claimIds: ['claim-033'],
              decisionId: 'gap-004',
              sourceFile: 'sources/design-notes.md',
              locator: 'p.6',
              quote: 'Decline handling: TODO — needs a design.'
            }
          ]
        }
      ]
    }
  ],

  spec: [
    {
      title: 'Acceptance Criteria',
      numbered: true,
      assertions: [
        {
          id: 's-ac-1',
          text: 'GIVEN a shopper on mobile, WHEN they reach payment, THEN digital wallets appear above card entry.',
          citations: [
            {
              claimIds: ['claim-007'],
              sourceFile: 'sources/discovery-call.md',
              locator: '00:19:30',
              quote: 'Lead with Apple Pay and Google Pay on mobile — wallets first, card second.'
            }
          ]
        },
        {
          id: 's-ac-2',
          text: 'GIVEN checkout start with no account, WHEN the shopper proceeds, THEN lightweight inline signup is offered (no separate guest path).',
          citations: [{ claimIds: [], decisionId: 'gap-001', ...DECISION_GUEST }]
        },
        {
          id: 's-ac-3',
          text: 'GIVEN a settled charge, WHEN a refund is issued, THEN funds return to the original method within 24 hours.',
          citations: [{ claimIds: ['claim-018'], decisionId: 'gap-002', ...DECISION_SLA }]
        }
      ]
    },
    {
      title: 'Non-Goals',
      assertions: [
        {
          id: 's-ng-1',
          text: 'Guest checkout without an account is not in v2.',
          citations: [
            {
              claimIds: ['claim-011'],
              sourceFile: 'sources/eng-rfc-v2.md',
              locator: '§3.1',
              quote: 'Guest flow deferred — out of v2 scope.'
            }
          ]
        }
      ]
    },
    {
      title: 'Edge Cases',
      assertions: [
        {
          id: 's-ec-1',
          text: 'Declined card in the express drawer — inline error & recovery behavior pending Design.',
          pending: true,
          citations: [
            {
              claimIds: ['claim-033'],
              decisionId: 'gap-004',
              sourceFile: 'sources/design-notes.md',
              locator: 'p.6',
              quote: 'Decline handling: TODO — needs a design.'
            }
          ]
        },
        {
          id: 's-ec-2',
          text: 'Express drawer with zero items — empty state pending Design.',
          pending: true,
          citations: [
            {
              claimIds: ['claim-041'],
              decisionId: 'gap-005',
              sourceFile: 'sources/design-notes.md',
              locator: 'p.9',
              quote: 'Express drawer — empty state not yet drawn.'
            }
          ]
        }
      ]
    }
  ],

  contracts: [
    {
      name: 'Order',
      fields: [
        {
          id: 'c-order-1',
          field: 'order.accountId: string',
          note: 'every v2 order is tied to an account',
          citations: [{ claimIds: [], decisionId: 'gap-001', ...DECISION_GUEST }]
        }
      ]
    },
    {
      name: 'Refund',
      endpoint: 'POST /refunds',
      fields: [
        {
          id: 'c-refund-1',
          field: 'charge_id: string',
          note: 'the settled charge being refunded',
          citations: [
            {
              claimIds: ['claim-018'],
              sourceFile: 'sources/prd-draft.md',
              locator: '§4.2',
              quote: 'Refunds processed in a timely manner.'
            }
          ]
        },
        {
          id: 'c-refund-2',
          field: 'amount: int',
          note: 'refund amount in minor units',
          citations: [
            {
              claimIds: ['claim-018'],
              sourceFile: 'sources/prd-draft.md',
              locator: '§4.2',
              quote: 'Refunds processed in a timely manner.'
            }
          ]
        },
        {
          id: 'c-refund-3',
          field: 'sla_hours: int = 24',
          note: 'resolution window, fixed by decision',
          citations: [{ claimIds: ['claim-018'], decisionId: 'gap-002', ...DECISION_SLA }]
        }
      ]
    }
  ]
}
