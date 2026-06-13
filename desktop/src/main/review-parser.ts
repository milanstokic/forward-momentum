/**
 * Review markdown → WireReviewReport.
 *
 * Parses decisions/prd-review.md: the `Verdict:` / `Reviewed-at:` / `Reviewer:`
 * header, the Summary prose, the Findings table, and the Axis-results bullets.
 * This is the reviewer-pass half of the dual-key Review gate; the human sign-off
 * is recorded separately by the controller (the signOffReview mutation).
 */

import * as fs from 'fs'
import * as path from 'path'

import type {
  WireAxisResult,
  WireFinding,
  WireReviewAxis,
  WireReviewReport,
  WireVerdict
} from '../shared/contract'

/** Map a human axis label / table token to the canonical axis key. */
function toAxis(raw: string): WireReviewAxis {
  const t = raw.toLowerCase()
  if (t.includes('trace')) return 'traceability'
  if (t.includes('leak')) return 'leakage'
  return 'consistency'
}

function headerValue(md: string, key: string): string {
  const m = md.match(new RegExp(`^${key}:\\s*(.+)$`, 'im'))
  return m ? m[1].trim() : ''
}

/** Extract the prose under a `## <name>` heading up to the next `##` heading. */
function sectionBody(md: string, name: string): string {
  const heading = new RegExp(`^##\\s+${name}\\s*$`, 'i')
  const out: string[] = []
  let collecting = false
  for (const line of md.split('\n')) {
    if (/^##\s+/.test(line)) {
      if (collecting) break
      collecting = heading.test(line)
      continue
    }
    if (collecting) out.push(line)
  }
  return out.join('\n').trim()
}

/** Parse the Findings markdown table into structured findings. */
function parseFindings(body: string): WireFinding[] {
  const findings: WireFinding[] = []
  for (const line of body.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('|')) continue
    const cells = trimmed
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim())
    if (cells.length < 4) continue
    const [severity, axis, location, finding] = cells
    // skip header + separator rows
    if (/^severity$/i.test(severity) || /^-+$/.test(severity)) continue
    if (severity !== 'blocker' && severity !== 'warning') continue
    findings.push({ severity, axis: toAxis(axis), location, finding })
  }
  return findings
}

/** Parse `- **Traceability:** PASS — note` bullets into axis results. */
function parseAxes(body: string): WireAxisResult[] {
  const axes: WireAxisResult[] = []
  // join wrapped bullet continuation lines, then split on bullet starts
  const normalized = body.replace(/\n\s+(?=\S)/g, ' ')
  for (const line of normalized.split('\n')) {
    const m = line.match(/^\s*[-*]\s+\*\*(.+?):\*\*\s*(PASS|FAIL)\b[\s—-]*(.*)$/i)
    if (!m) continue
    axes.push({
      axis: toAxis(m[1]),
      pass: m[2].toUpperCase() === 'PASS',
      note: m[3].trim()
    })
  }
  return axes
}

export function parseReview(root: string, slugName: string): WireReviewReport | null {
  const reviewPath = path.join(root, 'decisions', 'prd-review.md')
  if (!fs.existsSync(reviewPath)) return null
  const md = fs.readFileSync(reviewPath, 'utf-8')

  const verdictRaw = headerValue(md, 'Verdict').toUpperCase()
  const verdict: WireVerdict = verdictRaw === 'FAIL' ? 'FAIL' : 'PASS'

  return {
    engagement: slugName,
    verdict,
    reviewedAt: headerValue(md, 'Reviewed-at'),
    reviewer: headerValue(md, 'Reviewer') || 'fm-reviewer',
    summary: sectionBody(md, 'Summary').replace(/\s*\n\s*/g, ' ').trim(),
    axes: parseAxes(sectionBody(md, 'Axis results')),
    findings: parseFindings(sectionBody(md, 'Findings'))
  }
}
