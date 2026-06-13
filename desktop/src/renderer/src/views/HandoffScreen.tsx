import { color, fill, radius } from '@/styles/theme'
import { useFm } from '@/state/store'
import type { GapRecord } from '@/model/types'
import {
  DISPATCH_LABELS,
  GITHUB_REPO,
  exclusionReason,
  isDesignGap,
  issueTitle,
  type DispatchEntry
} from '@/model/dispatch'
import { CategoryBadge, Label, ProvenanceChip, SeverityPill, mono } from '@/components/primitives'
import { Check, GitHub, Sparkle } from '@/components/Icon'

/* ── one design gap as a GitHub issue preview + dispatch status ─────────── */
function IssueCard({ g, entry }: { g: GapRecord; entry?: DispatchEntry }): JSX.Element {
  return (
    <div
      style={{
        background: color.bgCard,
        border: `1px solid ${entry ? color.greenLine : color.borderHard}`,
        borderRadius: radius.xl,
        padding: '15px 16px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <CategoryBadge category={g.view.category} />
        <SeverityPill severity={g.severity} />
        <span style={{ marginLeft: 'auto', ...mono, fontSize: 9, color: color.textGhost }}>{g.id}</span>
      </div>

      <div style={{ display: 'flex', gap: 9, alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', border: `2px solid ${color.mint}`, flex: 'none', marginTop: 4 }} />
        <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: '-.01em', lineHeight: 1.35 }}>
          {issueTitle(g.view.title)}
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <ProvenanceChip p={g.evidence[0]} tone="mute" />
      </div>

      {/* labels */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {DISPATCH_LABELS.map((l) => (
          <span
            key={l}
            style={{
              ...mono,
              fontSize: 9,
              color: color.mint,
              border: `1px solid ${color.greenLine}`,
              background: fill.mint06,
              padding: '2px 8px',
              borderRadius: 20
            }}
          >
            {l}
          </span>
        ))}
        {g.relatedClaims.length > 0 && (
          <span style={{ ...mono, fontSize: 9, color: color.textFaint, padding: '2px 0', marginLeft: 'auto' }}>
            {g.relatedClaims.join(', ')}
          </span>
        )}
      </div>

      {/* dispatch status footer */}
      <div
        style={{
          borderTop: `1px solid ${color.divider}`,
          paddingTop: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          ...mono,
          fontSize: 10.5
        }}
      >
        {!entry ? (
          <span style={{ color: color.textFaint }}>○ pending dispatch</span>
        ) : entry.status === 'skipped-already-dispatched' ? (
          <span style={{ color: color.textMute, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Check size={12} color={color.textMute} strokeWidth={2.6} />
            skipped · already dispatched
            {entry.issueNumber ? ` (#${entry.issueNumber})` : ''}
          </span>
        ) : entry.mode === 'live' ? (
          <span style={{ color: color.mint, display: 'flex', alignItems: 'center', gap: 7 }}>
            <GitHub size={12} color={color.mint} />
            dispatched · {GITHUB_REPO}#{entry.issueNumber}
          </span>
        ) : (
          <span style={{ color: color.orangeSoft, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Check size={12} color={color.orangeSoft} strokeWidth={2.6} />
            recorded · dry-run (no issue created)
          </span>
        )}
      </div>
    </div>
  )
}

/* ── right rail: destinations + run receipt ────────────────────────────── */
function DestinationsRail(): JSX.Element {
  const mode = useFm((s) => s.dispatchMode)
  const connect = useFm((s) => s.connectGitHub)
  const live = mode === 'live'

  return (
    <div style={{ width: 264, flex: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: color.bgRaised, border: `1px solid ${color.border}`, borderRadius: radius.xl, padding: 16 }}>
        <Label style={{ fontSize: 9, marginBottom: 12 }}>Destinations</Label>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '11px 12px',
            borderRadius: radius.lg,
            background: color.bgInput,
            border: `1px solid ${live ? color.greenLine : color.borderSoft}`,
            marginBottom: 10
          }}
        >
          <GitHub size={18} color={live ? color.mint : color.textMute} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>GitHub Project</div>
            <div style={{ ...mono, fontSize: 9.5, color: live ? color.mint : color.textFaint, marginTop: 2 }}>
              {live ? `live · ${GITHUB_REPO}` : 'dry-run · no credential'}
            </div>
          </div>
          {live && <Check size={14} color={color.mint} strokeWidth={2.6} />}
        </div>

        {!live && (
          <div
            data-clickable
            onClick={connect}
            style={{
              textAlign: 'center',
              padding: 9,
              borderRadius: radius.md,
              border: `1px solid ${color.borderHard}`,
              color: color.textDim,
              fontSize: 12,
              marginBottom: 12
            }}
          >
            Connect GitHub credential
          </div>
        )}

        {/* Linear stub — the skill ships this as "coming soon" */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '11px 12px',
            borderRadius: radius.lg,
            background: color.bg,
            border: `1px dashed ${color.borderSoft}`,
            opacity: 0.7
          }}
        >
          <span style={{ width: 18, height: 18, borderRadius: 5, background: '#5b5fc7', flex: 'none' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: color.textMute }}>Linear</div>
            <div style={{ ...mono, fontSize: 9.5, color: color.textGhost, marginTop: 2 }}>coming soon</div>
          </div>
        </div>
      </div>

      <div
        style={{
          background: color.bgRaised,
          border: `1px solid ${color.border}`,
          borderRadius: radius.xl,
          padding: 16,
          fontSize: 11.5,
          lineHeight: 1.55,
          color: color.textMute
        }}
      >
        Dispatch is idempotent — re-running skips tasks already sent. State is written to{' '}
        <code style={{ ...mono, color: color.textDim }}>tasks/dispatch.json</code>.
      </div>
    </div>
  )
}

/** Handoff — pipeline stage 5. Dispatch the design gaps to GitHub Issues. */
export function HandoffScreen(): JSX.Element {
  const gaps = useFm((s) => s.engagement.gaps)
  const dispatched = useFm((s) => s.dispatched)
  const mode = useFm((s) => s.dispatchMode)
  const dispatchTasks = useFm((s) => s.dispatchTasks)

  const designGaps = gaps.filter(isDesignGap)
  const excluded = gaps.filter((g) => !isDesignGap(g))
  const anyDispatched = Object.keys(dispatched).length > 0
  const pending = designGaps.filter((g) => !dispatched[g.id]).length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: color.bg }}>
      {/* header */}
      <div
        style={{
          height: 64,
          flex: 'none',
          borderBottom: `1px solid ${color.divider}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          gap: 14
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-.01em' }}>Handoff</div>
          <div style={{ ...mono, fontSize: 10.5, color: color.textFaint, marginTop: 2 }}>
            design gaps → GitHub Issues · tasks/dispatch.json
          </div>
        </div>
        <span
          style={{
            ...mono,
            fontSize: 10,
            letterSpacing: '.06em',
            color: mode === 'live' ? color.mint : color.orangeSoft,
            border: `1px solid ${mode === 'live' ? color.greenLine : '#4a4136'}`,
            padding: '4px 9px',
            borderRadius: 6
          }}
        >
          {mode === 'live' ? 'LIVE' : 'DRY-RUN'}
        </span>

        {pending > 0 ? (
          <div
            data-clickable
            onClick={dispatchTasks}
            style={{
              marginLeft: 'auto',
              padding: '10px 16px',
              borderRadius: radius.lg,
              background: color.mint,
              color: color.bgPanel,
              fontSize: 12.5,
              fontWeight: 600
            }}
          >
            Dispatch {pending} design {pending === 1 ? 'task' : 'tasks'} →
          </div>
        ) : (
          <div
            data-clickable
            onClick={dispatchTasks}
            style={{
              marginLeft: 'auto',
              padding: '10px 16px',
              borderRadius: radius.lg,
              border: `1px solid ${color.borderHard}`,
              color: color.textDim,
              fontSize: 12.5
            }}
          >
            Re-run dispatch
          </div>
        )}
      </div>

      {/* body */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '20px 24px', display: 'flex', gap: 20 }}>
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', paddingRight: 4 }}>
          {/* completion banner */}
          {anyDispatched && pending === 0 && (
            <div
              className="fm-fadein"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                borderRadius: radius.lg,
                background: fill.mint06,
                border: `1px solid ${color.greenLine}`,
                marginBottom: 18
              }}
            >
              <Sparkle size={20} color={color.mint} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: color.mint }}>Pipeline complete</div>
                <div style={{ fontSize: 11.5, color: color.textMute, marginTop: 2 }}>
                  checkout-v2 handed off — {designGaps.length} design{' '}
                  {designGaps.length === 1 ? 'task' : 'tasks'} dispatched{' '}
                  {mode === 'live' ? 'to GitHub' : '(dry-run)'}. Sources → claims → gaps → resolution → PRD → review → build.
                </div>
              </div>
            </div>
          )}

          <Label style={{ fontSize: 9.5, marginBottom: 12 }}>
            Design tasks · {designGaps.length} classified for dispatch
          </Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {designGaps.map((g) => (
              <IssueCard key={g.id} g={g} entry={dispatched[g.id]} />
            ))}
          </div>

          <Label style={{ fontSize: 9.5, marginBottom: 10 }}>
            Excluded from design dispatch · {excluded.length}
          </Label>
          <div style={{ border: `1px solid ${color.border}`, borderRadius: radius.lg, overflow: 'hidden' }}>
            {excluded.map((g, i) => (
              <div
                key={g.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 14px',
                  borderBottom: i < excluded.length - 1 ? `1px solid ${color.divider}` : 'none'
                }}
              >
                <span style={{ ...mono, fontSize: 9.5, color: color.textGhost, flex: 'none', width: 52 }}>{g.id}</span>
                <span
                  style={{
                    fontSize: 12,
                    color: color.textMute,
                    flex: 1,
                    minWidth: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {g.view.title}
                </span>
                <span style={{ ...mono, fontSize: 9.5, color: color.textFaint, flex: 'none' }}>
                  {exclusionReason(g)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <DestinationsRail />
      </div>

      {/* footer */}
      <div
        style={{
          flex: 'none',
          height: 38,
          borderTop: `1px solid ${color.divider}`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 24px',
          ...mono,
          fontSize: 10.5,
          color: color.textGhost
        }}
      >
        <GitHub size={11} color={color.textGhost} />
        Only design gaps dispatch — conflicts and pure requirement gaps are excluded by the documented heuristic.
      </div>
    </div>
  )
}
