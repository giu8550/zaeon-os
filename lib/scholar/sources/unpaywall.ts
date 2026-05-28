export async function unpaywallPdfUrl(doi: string): Promise<string | null> {
  const email = process.env.UNPAYWALL_EMAIL;
  if (!email) return null;
  try {
    const res = await fetch(`https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${encodeURIComponent(email)}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    return j.best_oa_location?.url_for_pdf || j.best_oa_location?.url || null;
  } catch { return null; }
}
