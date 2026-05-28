export function isSafePublicHttpUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();

  // Compute cleaned host: strip trailing dot, then strip surrounding [ ] brackets (IPv6)
  let cleaned = host.endsWith(".") ? host.slice(0, -1) : host;
  if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
    cleaned = cleaned.slice(1, -1);
  }

  // localhost check on cleaned host
  if (cleaned === "localhost" || cleaned.endsWith(".localhost")) return false;

  // Block obvious private / link-local / loopback IPv4 literals
  const m = cleaned.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 127) return false;            // loopback
    if (a === 10) return false;             // private
    if (a === 192 && b === 168) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 169 && b === 254) return false; // link-local
    if (a === 0) return false;
  }

  // Block IPv6 loopback/link-local/ULA/IPv4-mapped literals (on cleaned host, brackets stripped)
  if (cleaned === "::1") return false;
  if (cleaned.startsWith("fe80")) return false;
  if (cleaned.startsWith("fc")) return false;
  if (cleaned.startsWith("fd")) return false;
  if (cleaned.startsWith("::ffff:")) return false;

  return true;
}
