import type { RawRow } from "./normalize";

// Stand-in for a parsed spreadsheet while the import UI is built.
// Real file parsing (SheetJS) replaces this; everything after parsing stays.
// Fictional data: messy headers and values on purpose, like a hand-made spreadsheet.

export const DEMO_TABLE: { headers: string[]; rows: RawRow[] } = {
  headers: ["Employer", "Job title", "Status", "Applied on", "Salary", "Found on", "Comment", "Referred by"],
  rows: [
    [
      "Daisy Tech LLC",
      "React Developer",
      "interview",
      "10/15/2026",
      "120-140k USD",
      "LinkedIn",
      "Tech interview on Oct 30",
      "",
    ],
    ["Cloudberry Apps", "TypeScript Engineer", "applied", "2026-05-02", "", "Indeed", "", "Sam"],
    ["Pixel & Co", "UI Engineer", "rejected", "03.10.2026", "from $95,000", "Indeed", "", ""],
    [
      "Starling Software",
      "Frontend Engineer",
      "awaiting reply",
      "21.10.2026",
      "€70,000",
      "Job board",
      "Found via a newsletter",
      "Anna",
    ],
    ["Cedar Labs", "Mid-level Frontend", "take-home", "2026-10-19", "90–110k", "Indeed", "", ""],
    ["Lighthouse Fintech", "Frontend Developer", "", "17/10/2026", "", "Company website", "", ""],
    ["", "Junior Frontend", "applied", "20.10.2026", "", "Indeed", "", ""],
  ],
};
