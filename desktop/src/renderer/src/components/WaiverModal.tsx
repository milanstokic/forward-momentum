import { useState } from 'react'
import { color, fill, radius } from '@/styles/theme'
import { useFm } from '@/state/store'
import { mono } from './primitives'

const ACKS = [
  { key: 'communicatedToClient', label: 'Communicated to client', hint: 'The client knows this gap ships unresolved.' },
  { key: 'riskAccepted', label: 'Risk accepted', hint: 'The team explicitly accepts the downstream risk.' },
  { key: 'revisitScheduled', label: 'Revisit scheduled', hint: 'A follow-up / loopback is on the calendar.' }
] as const

type AckKey = (typeof ACKS)[number]['key']

/**
 * Structured-waiver modal — the only way to open the hard Resolution gate without
 * resolving a blocking gap. All three acknowledgements + a reason are required;
 * the Domain Host re-validates via validateWaiver before the gate can open.
 */
export function WaiverModal(): JSX.Element | null {
  const gapId = useFm((s) => s.waivingGapId)
  const gap = useFm((s) => s.engagement.gaps.find((g) => g.id === s.waivingGapId))
  const closeWaive = useFm((s) => s.closeWaive)
  const waiveGap = useFm((s) => s.waiveGap)

  const [reason, setReason] = useState('')
  const [acks, setAcks] = useState<Record<AckKey, boolean>>({
    communicatedToClient: false,
    riskAccepted: false,
    revisitScheduled: false
  })
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  if (!gapId || !gap) return null

  const allAcked = ACKS.every((a) => acks[a.key])
  const canSubmit = reason.trim() !== '' && allAcked && !busy

  async function submit(): Promise<void> {
    if (!gapId) return
    setBusy(true)
    setErrors([])
    const res = await waiveGap(gapId, { reason: reason.trim(), acknowledgements: acks })
    setBusy(false)
    if (!res.ok) {
      setErrors(res.validationErrors ?? [res.error ?? 'Waiver rejected.'])
      return
    }
    // success: the store closes the modal; reset local form for next time
    setReason('')
    setAcks({ communicatedToClient: false, riskAccepted: false, revisitScheduled: false })
  }

  return (
    <div
      onClick={closeWaive}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(8,8,8,.62)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fm-fadein"
        style={{
          width: 460,
          maxWidth: '92vw',
          background: color.bgPanel,
          border: `1px solid ${color.borderHard}`,
          borderTop: `2px solid ${color.orange}`,
          borderRadius: radius.xl,
          padding: '20px 22px',
          boxShadow: '0 24px 60px rgba(0,0,0,.5)'
        }}
      >
        <div style={{ ...mono, fontSize: 10, color: color.orange, letterSpacing: '.04em' }}>
          STRUCTURED WAIVER · {gap.id}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, margin: '7px 0 4px', letterSpacing: '-.01em' }}>
          Waive a blocking gap
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.5, color: color.textMute, marginBottom: 16 }}>
          {gap.view.title} — this opens the Resolution gate with the gap unresolved. All three
          acknowledgements are mandatory and recorded to <span style={mono}>decisions/</span>.
        </div>

        <label style={{ ...mono, fontSize: 10, color: color.textFaint }}>REASON</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is it acceptable to ship without resolving this?"
          rows={3}
          style={{
            width: '100%',
            marginTop: 5,
            marginBottom: 14,
            resize: 'vertical',
            background: color.bgInput,
            border: `1px solid ${color.borderSoft}`,
            borderRadius: radius.md,
            color: color.text,
            font: 'inherit',
            fontSize: 12.5,
            padding: '9px 11px',
            boxSizing: 'border-box'
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: errors.length ? 12 : 18 }}>
          {ACKS.map((a) => {
            const on = acks[a.key]
            return (
              <div
                key={a.key}
                data-clickable
                onClick={() => setAcks((s) => ({ ...s, [a.key]: !s[a.key] }))}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  padding: '9px 11px',
                  borderRadius: radius.md,
                  background: on ? fill.mint08 : color.bgInput,
                  border: `1px solid ${on ? color.greenLine : color.borderSoft}`
                }}
              >
                <span
                  style={{
                    flex: 'none',
                    width: 16,
                    height: 16,
                    marginTop: 1,
                    borderRadius: 4,
                    border: `1.5px solid ${on ? color.mint : color.borderHard}`,
                    background: on ? color.mint : 'transparent',
                    color: color.bgPanel,
                    fontSize: 11,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {on ? '✓' : ''}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: color.textDim }}>{a.label}</div>
                  <div style={{ fontSize: 11, color: color.textFaint, marginTop: 1 }}>{a.hint}</div>
                </div>
              </div>
            )
          })}
        </div>

        {errors.length > 0 && (
          <div
            style={{
              marginBottom: 16,
              padding: '9px 11px',
              borderRadius: radius.md,
              background: fill.orange07,
              border: `1px solid ${fill.orangeBorder}`,
              fontSize: 11.5,
              color: color.orangeSoft
            }}
          >
            {errors.map((e, i) => (
              <div key={i}>• {e}</div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <div
            data-clickable
            onClick={closeWaive}
            style={{
              padding: '9px 15px',
              borderRadius: radius.md,
              border: `1px solid ${color.borderHard}`,
              color: color.textDim,
              fontSize: 12.5
            }}
          >
            Cancel
          </div>
          <div
            data-clickable={canSubmit ? '' : undefined}
            onClick={canSubmit ? submit : undefined}
            style={{
              padding: '9px 17px',
              borderRadius: radius.md,
              background: canSubmit ? color.orange : color.bgCardRaised,
              color: canSubmit ? '#1a1206' : color.textFaint,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              opacity: busy ? 0.7 : 1
            }}
          >
            {busy ? 'Waiving…' : 'Waive gate'}
          </div>
        </div>
      </div>
    </div>
  )
}
