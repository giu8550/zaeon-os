import type { Paper } from "./types";

// Format ONE author per ABNT: "SURNAME, Given names".
// Handles "Given Family" (CrossRef/OpenAlex/arXiv/S2) AND "Family Initials" (PubMed, e.g. "Doudna J").
export function formatAbntAuthor(name: string): string {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";
  if (tokens.length === 1) return tokens[0].toUpperCase();
  const last = tokens[tokens.length - 1];
  // PubMed style: trailing token is 1-3 uppercase letters (optionally dotted), e.g. "J", "JA", "J.A."
  // AND the first token (surname) must look like a real word (len > 1), not itself an initial.
  // In that case the first token is the surname.
  const stripped = last.replace(/\./g, "");
  const isInitials =
    /^[A-Z]{1,3}$/.test(stripped) &&
    /^[A-Z.]{1,4}$/.test(last) &&
    tokens[0].length > 1;
  if (isInitials) {
    const surname = tokens[0];
    const given = tokens.slice(1).join(" ");
    return `${surname.toUpperCase()}, ${given}`;
  }
  const surname = last;
  const given = tokens.slice(0, -1).join(" ");
  return `${surname.toUpperCase()}, ${given}`;
}

// ABNT author list: list all if <=3, else first author + " et al.". Joined by "; ".
export function formatAbntAuthors(authors: string[]): string {
  const cleaned = authors.map((a) => a.trim()).filter(Boolean);
  if (cleaned.length === 0) return "";
  if (cleaned.length > 3) return `${formatAbntAuthor(cleaned[0])} et al.`;
  return cleaned.map(formatAbntAuthor).join("; ");
}

// Full NBR 6023 reference (plain text — valid for copy/download).
// Article (has venue): AUTHORS. Title. Venue, year. DOI/Disponível em.
// No venue: AUTHORS. Title. year. Disponível em.
export function formatAbntReference(p: Paper): string {
  const year = p.year ? String(p.year) : "[s. d.]";
  const authors = formatAbntAuthors(p.authors);
  const title = (p.title || "[sem título]").replace(/\.\s*$/, "");
  const head = authors ? `${authors}. ` : "";
  let body: string;
  if (p.venue) body = `${title}. ${p.venue}, ${year}.`;
  else body = `${title}. ${year}.`;
  let tail = "";
  if (p.doi) tail = ` DOI: ${p.doi}.`;
  else if (p.url) tail = ` Disponível em: ${p.url}.`;
  return `${head}${body}${tail}`.replace(/\s+/g, " ").trim();
}
