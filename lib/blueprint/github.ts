/**
 * BLUEPRINT PRÁTICO — os REPOSITÓRIOS do tema (servidor). Pedido do dono: "ver repositórios anexados com o tema". Eles
 * vêm SEMPRE da API do GitHub (busca pelos termos que a Zaeon deu) — o modelo nunca escreve nome de repositório (regra
 * do harness2: nunca inventar identificador). Sem `GITHUB_TOKEN` a API aceita ~10 buscas/min pro servidor inteiro, então
 * cada termo fica em CACHE por 24 h; erro, limite ou demora = lista vazia (o blueprint segue sem repositórios novos).
 */
import { MAX_REPOS, type Repo } from "./tipos";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
export const TTL_REPOS_MS = 24 * 3600 * 1000;
const TIMEOUT_MS = 8000, POR_TERMO = 5, MAX_TERMOS = 2;
const cache = new Map<string, { em: number; repos: Repo[] }>();
export const limparCacheRepos = () => cache.clear();

const cabecalhos = (token?: string): Record<string, string> => ({
  Accept: "application/vnd.github+json", "User-Agent": "ZaeonBlueprint/1.0", ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

async function buscarTermo(termo: string, f: FetchLike, token: string | undefined, agora: number): Promise<Repo[]> {
  const chave = termo.toLowerCase().replace(/\s+/g, " ").trim();
  const c = cache.get(chave); if (c && agora - c.em < TTL_REPOS_MS) return c.repos;
  try {
    const r = await f(`https://api.github.com/search/repositories?q=${encodeURIComponent(chave)}&sort=stars&per_page=${POR_TERMO}`, { headers: cabecalhos(token), signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!r.ok) return [];
    const j = (await r.json()) as { items?: { full_name?: string; html_url?: string; description?: string | null; stargazers_count?: number }[] };
    const repos = (j.items ?? []).filter((i) => i.full_name && i.html_url?.startsWith("https://github.com/"))
      .map((i): Repo => ({ nome: i.full_name!, url: i.html_url!, ...(i.description ? { descricao: i.description.slice(0, 240) } : {}), estrelas: i.stargazers_count ?? 0 }));
    cache.set(chave, { em: agora, repos });
    return repos;
  } catch { return []; }
}

/** os repositórios mais estrelados pros termos (sem repetir), no máximo MAX_REPOS */
export async function buscarRepos(termos: string[], o: { fetch?: FetchLike; token?: string; agora?: number } = {}): Promise<Repo[]> {
  const f = o.fetch ?? fetch, token = o.token ?? process.env.GITHUB_TOKEN ?? undefined, agora = o.agora ?? Date.now();
  const listas = await Promise.all(termos.filter((t) => t.trim()).slice(0, MAX_TERMOS).map((t) => buscarTermo(t, f, token, agora)));
  const vistos = new Map<string, Repo>();
  for (const r of listas.flat()) if (!vistos.has(r.nome.toLowerCase())) vistos.set(r.nome.toLowerCase(), r);
  return [...vistos.values()].sort((a, b) => (b.estrelas ?? 0) - (a.estrelas ?? 0)).slice(0, MAX_REPOS);
}

const RE_REPO = /^https:\/\/github\.com\/([\w.-]{1,100})\/([\w.-]{1,100})(?:[/?#].*)?$/i;
/** o repositório de uma prova: existe? é público? quando foi o último push? (null = não é repo do GitHub ou não existe) */
export async function repoInfo(url: string, o: { fetch?: FetchLike; token?: string } = {}): Promise<{ nome: string; publico: boolean; pushedAt: number } | null> {
  const m = RE_REPO.exec(url.trim()); if (!m) return null;
  const nome = `${m[1]}/${m[2]!.replace(/\.git$/i, "")}`;
  try {
    const r = await (o.fetch ?? fetch)(`https://api.github.com/repos/${nome}`, { headers: cabecalhos(o.token ?? process.env.GITHUB_TOKEN ?? undefined), signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!r.ok) return null;
    const j = (await r.json()) as { full_name?: string; private?: boolean; pushed_at?: string };
    const pushedAt = Date.parse(j.pushed_at ?? "");
    return { nome: j.full_name ?? nome, publico: j.private !== true, pushedAt: Number.isFinite(pushedAt) ? pushedAt : 0 };
  } catch { return null; }
}
