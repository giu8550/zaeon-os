export async function corePdfUrl(query: string): Promise<string | null> {
  const key = process.env.CORE_API_KEY;
  if (!key) return null; // skipped per spec
  try {
    const res = await fetch(`https://api.core.ac.uk/v3/search/works?q=${encodeURIComponent(query)}&limit=1`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    return j.results?.[0]?.downloadUrl || null;
  } catch { return null; }
}
