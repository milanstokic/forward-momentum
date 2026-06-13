/**
 * PRD/SPEC markdown → WirePrdDoc.
 *
 * Parses prd/PRD.md (human narrative) and spec/SPEC.md (testable AC, non-goals,
 * edge cases, data/API contracts). Every assertion line ends with one or more
 * provenance brackets `[claim-id(, …) · sourceFile:locator]`; we extract them as
 * citations and join claim ids back to claims.json for the verbatim quote that
 * powers the click-to-reveal receipt and the traceability meter.
 */

import * as fs from 'fs'
import * as path from 'path'

import type { Claim } from '@core/model/claim'

import type {
  WireAssertion,
  WireContractGroup,
  WirePrdCitation,
  WirePrdDoc,
  WirePrdSection
} from '../shared/contract'

function readFileOr(file: string, fallback: string): string {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : fallback
}

/** Resolve a verbatim quote for a citation by joining claim ids to claims.json. */
function resolveQuote(
  claimIds: string[],
  sourceFile: string,
  locator: string,
  claimsById: Map<string, Claim>
): string {
  for (const id of claimIds) {
    const claim = claimsById.get(id)
    if (!claim) continue
    // Prefer a provenance entry matching the cited file (+ locator when present).
    const exact = claim.provenance.find(
      (p) => p.sourceFile === sourceFile && (!locator || p.locator === locator)
    )
    if (exact) return exact.quote
    const sameFile = claim.provenance.find((p) => p.sourceFile === sourceFile)
    if (sameFile) return sameFile.quote
    if (claim.provenance[0]) return claim.provenance[0].quote
    return claim.summary
  }
  return ''
}

/** Parse one bracket body: "claim-001, claim-004 · sources/x.md:L9". */
function parseCitation(body: string, claimsById: Map<string, Claim>): WirePrdCitation {
  const [idsPart, locPart = ''] = body.split('·').map((s) => s.trim())
  const ids = idsPart
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const claimIds = ids.filter((id) => id.startsWith('claim'))
  const decisionId = ids.find((id) => id.startsWith('conflict') || id.startsWith('gap'))

  // file path ends in .md; an optional ":locator" follows.
  const m = locPart.match(/^(.*?\.md)(?::(.*))?$/)
  const sourceFile = m ? m[1] : locPart
  const locator = m && m[2] ? m[2] : ''
  const isDecision = sourceFile.startsWith('decisions/')

  return {
    claimIds,
    decisionId: decisionId ?? undefined,
    sourceFile,
    locator,
    quote: isDecision ? 'Recorded decision — see decisions/.' : resolveQuote(claimIds, sourceFile, locator, claimsById),
    isDecision: isDecision || undefined
  }
}

/** Strip a leading "- " or "N. " list marker. */
function stripMarker(line: string): string {
  return line.replace(/^\s*(?:[-*]|\d+\.)\s+/, '')
}

/** Pull all `[...]` brackets out of a line; return (textWithoutBrackets, citations). */
function extractCitations(
  line: string,
  claimsById: Map<string, Claim>
): { text: string; citations: WirePrdCitation[] } {
  const citations: WirePrdCitation[] = []
  const text = line
    .replace(/\[([^\]]+)\]/g, (_full, body: string) => {
      // Only treat as a citation when it contains the " · " provenance separator.
      if (body.includes('·')) {
        citations.push(parseCitation(body, claimsById))
        return ''
      }
      return _full
    })
    .replace(/\s+$/, '')
    .trim()
  return { text, citations }
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

interface RawSection {
  title: string
  lines: string[]
}

/** Split markdown into `##` sections (drops the H1 title + any blockquote). */
function splitSections(md: string): RawSection[] {
  const sections: RawSection[] = []
  let cur: RawSection | null = null
  for (const line of md.split('\n')) {
    const h2 = line.match(/^##\s+(.*)$/)
    if (h2) {
      cur = { title: h2[1].trim(), lines: [] }
      sections.push(cur)
    } else if (cur) {
      cur.lines.push(line)
    }
  }
  return sections
}

function variantFor(title: string): WirePrdSection['variant'] {
  const t = title.toLowerCase()
  if (t.includes('decision')) return 'decisions'
  if (t.includes('open question') || t.includes('parked') || t.includes('out of scope'))
    return 'open-questions'
  return 'normal'
}

/** Build a PrdSection from a raw section's bullet/numbered lines. */
function toSection(raw: RawSection, claimsById: Map<string, Claim>): WirePrdSection {
  const variant = variantFor(raw.title)
  const pending = raw.title.toLowerCase().includes('open question')
  const numbered = /^\s*\d+\.\s+/.test(raw.lines.find((l) => l.trim()) ?? '')
  const intro: string[] = []
  const assertions: WireAssertion[] = []
  const base = slug(raw.title)

  for (const line of raw.lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const isItem = /^\s*(?:[-*]|\d+\.)\s+/.test(line)
    if (!isItem) {
      if (!trimmed.startsWith('>')) intro.push(trimmed)
      continue
    }
    const { text, citations } = extractCitations(stripMarker(line), claimsById)
    if (!text) continue
    assertions.push({
      id: `${base}-${assertions.length + 1}`,
      text,
      citations,
      pending: pending || undefined
    })
  }

  return {
    title: raw.title,
    intro: intro.length ? intro.join(' ') : undefined,
    numbered: numbered || undefined,
    variant,
    assertions
  }
}

/** Parse the "Data / API Contracts" section: `### Group` then `- \`field\` — note [cit]`. */
function parseContracts(raw: RawSection, claimsById: Map<string, Claim>): WireContractGroup[] {
  const groups: WireContractGroup[] = []
  let cur: WireContractGroup | null = null
  for (const line of raw.lines) {
    const h3 = line.match(/^###\s+(.*)$/)
    if (h3) {
      cur = { name: h3[1].trim(), fields: [] }
      groups.push(cur)
      continue
    }
    if (!cur) continue
    if (!/^\s*[-*]\s+/.test(line)) continue
    const { text, citations } = extractCitations(stripMarker(line), claimsById)
    // `field` — note   (field is the first backtick span)
    const fieldMatch = text.match(/^`([^`]+)`\s*(?:[—-]\s*)?(.*)$/)
    const field = fieldMatch ? fieldMatch[1].trim() : text
    const note = fieldMatch ? fieldMatch[2].trim() : ''
    const gated = citations.some((c) => c.decisionId?.startsWith('gap')) || /UNRESOLVED|UNSPECIFIED|UNDEFINED/i.test(note)
    cur.fields.push({
      id: `${slug(cur.name)}-${cur.fields.length + 1}`,
      field,
      note,
      citations,
      gated: gated || undefined
    })
  }
  return groups
}

export function parsePrd(root: string, claims: Claim[], slugName: string): WirePrdDoc | null {
  const prdPath = path.join(root, 'prd', 'PRD.md')
  if (!fs.existsSync(prdPath)) return null

  const claimsById = new Map(claims.map((c) => [c.id, c]))
  const prdMd = readFileOr(prdPath, '')
  const specMd = readFileOr(path.join(root, 'spec', 'SPEC.md'), '')

  const human = splitSections(prdMd).map((s) => toSection(s, claimsById))

  const spec: WirePrdSection[] = []
  let contracts: WireContractGroup[] = []
  for (const raw of splitSections(specMd)) {
    if (/contract/i.test(raw.title)) {
      contracts = parseContracts(raw, claimsById)
    } else {
      spec.push(toSection(raw, claimsById))
    }
  }

  return { engagement: slugName, human, spec, contracts }
}
