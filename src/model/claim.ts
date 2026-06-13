// Provenance: the receipt — where an assertion came from
export interface Provenance {
  /** Relative path to the source file, e.g. "sources/kickoff-call.md" */
  sourceFile: string;
  /** Line range "L40-L52" or timestamp "00:14:30" */
  locator: string;
  /** Verbatim excerpt from the source — must not be paraphrased */
  quote: string;
}

// A single claim extracted from the source corpus
export interface Claim {
  /** Unique stable identifier, e.g. "claim-001" */
  id: string;
  /** Short summary of the claim */
  summary: string;
  /** One or more provenance entries backing this claim */
  provenance: Provenance[];
}
