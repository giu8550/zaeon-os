/**
 * GitHub App client — authenticated Octokit for the Projetos agentic IDE.
 *
 * Auth model (decided 2026-06-13): GitHub *App* with an installation token,
 * server-to-server. We mint short-lived installation tokens from the App's
 * private key (least privilege, scoped to whatever repos the installation
 * covers). No user OAuth token is stored client-side; secrets live only on the
 * server (route runtime = nodejs).
 *
 * HONEST BUILD STATUS — mirrors the Anthropic approach in lib/ai/router.ts:
 *   The `octokit` package is imported DYNAMICALLY and typed as `any`, so the
 *   Next.js build stays green BEFORE the dependency is installed. The catalog
 *   route keeps returning `connected:false` until BOTH are true:
 *     1. the env is configured (isGitHubConfigured() === true), and
 *     2. `octokit` + `@octokit/auth-app` are installed (npm i octokit @octokit/auth-app).
 *
 * Required env (see .env.deploy.example):
 *   GITHUB_APP_ID                 — numeric App ID
 *   GITHUB_APP_PRIVATE_KEY        — PEM private key (\n-escaped is tolerated)
 *   GITHUB_APP_INSTALLATION_ID    — default installation id (pilot fallback)
 *   GITHUB_APP_CLIENT_ID          — (optional) for future per-user OAuth
 *   GITHUB_APP_CLIENT_SECRET      — (optional) for future per-user OAuth
 *
 * Per-user installation: User.githubInstallationId (Prisma) overrides the env
 * default when present, so each student can install the App on their own repos.
 */

// Typed as `any` ON PURPOSE so we never need the octokit types at build time.
type AnyOctokit = any;

// ─── Errors ──────────────────────────────────────────────────────────────────

/** Thrown when the App env is missing or the SDK is not installed. */
export class GitHubNotConfiguredError extends Error {
  status = 503 as const;
  constructor(message: string) {
    super(message);
    this.name = "GitHubNotConfiguredError";
  }
}

// ─── Configuration ──────────────────────────────────────────────────────────

/**
 * True when the minimum GitHub App env is present. Does NOT verify the SDK.
 * Only APP_ID + PRIVATE_KEY are required: the installation id can be discovered
 * at runtime via `GET /app/installations` when not pinned in env / per user.
 */
export function isGitHubConfigured(): boolean {
  return !!process.env.GITHUB_APP_ID && !!process.env.GITHUB_APP_PRIVATE_KEY;
}

/** Normalize a PEM that may arrive with literal "\n" sequences from env. */
function readPrivateKey(): string {
  const raw = process.env.GITHUB_APP_PRIVATE_KEY || "";
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

/** Statically-known installation id: explicit (per-user) > env default. May be empty. */
export function pinnedInstallationId(explicit?: string | null): string {
  return explicit || process.env.GITHUB_APP_INSTALLATION_ID || "";
}

// ─── Lazy SDK loading + token caching ─────────────────────────────────────────

let _appPromise: Promise<AnyOctokit> | null = null;

/** Load `octokit` lazily and build the App once. Throws if the SDK is absent. */
async function getApp(): Promise<AnyOctokit> {
  if (!isGitHubConfigured()) {
    throw new GitHubNotConfiguredError(
      "GitHub App não configurado. Defina GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY e GITHUB_APP_INSTALLATION_ID.",
    );
  }
  if (!_appPromise) {
    _appPromise = (async () => {
      let mod: any;
      try {
        // Dynamic import keeps the build green before `npm i octokit`.
        mod = await import("octokit");
      } catch {
        throw new GitHubNotConfiguredError(
          "Pacote 'octokit' não instalado. Rode: npm i octokit @octokit/auth-app",
        );
      }
      const App = mod.App;
      return new App({
        appId: process.env.GITHUB_APP_ID!,
        privateKey: readPrivateKey(),
        ...(process.env.GITHUB_APP_CLIENT_ID
          ? { oauth: { clientId: process.env.GITHUB_APP_CLIENT_ID, clientSecret: process.env.GITHUB_APP_CLIENT_SECRET || "" } }
          : {}),
      });
    })().catch((e) => {
      _appPromise = null; // allow retry on transient failures
      throw e;
    });
  }
  return _appPromise;
}

// Caches the auto-discovered installation id (when none is pinned in env/user).
let _discoveredIdPromise: Promise<string> | null = null;

/**
 * Resolve the installation id to use: pinned (per-user > env) when available,
 * otherwise discover it from the App's installations (first one — typical for a
 * single-org pilot). Cached after first discovery.
 */
export async function resolveInstallationId(explicit?: string | null): Promise<string> {
  const pinned = pinnedInstallationId(explicit);
  if (pinned) return pinned;

  if (!_discoveredIdPromise) {
    _discoveredIdPromise = (async () => {
      const app = await getApp();
      const res = await app.octokit.request("GET /app/installations", { per_page: 100 });
      const list = res.data ?? [];
      if (!list.length) {
        throw new GitHubNotConfiguredError(
          "O GitHub App não está instalado em nenhuma conta/repo. Instale o App e tente de novo.",
        );
      }
      return String(list[0].id);
    })().catch((e) => {
      _discoveredIdPromise = null; // allow retry
      throw e;
    });
  }
  return _discoveredIdPromise;
}

// Cache installation Octokit instances by installation id. The octokit `App`
// already mints + refreshes installation tokens internally, so caching the
// instance is enough.
const _installationCache = new Map<string, Promise<AnyOctokit>>();

/**
 * Return an Octokit authenticated as the given installation (pinned or
 * auto-discovered).
 * @throws GitHubNotConfiguredError when env/SDK are missing or the App has no installation.
 */
export async function getInstallationOctokit(installationId?: string | null): Promise<AnyOctokit> {
  const id = await resolveInstallationId(installationId);
  let cached = _installationCache.get(id);
  if (!cached) {
    cached = (async () => {
      const app = await getApp();
      return app.getInstallationOctokit(Number(id));
    })().catch((e) => {
      _installationCache.delete(id);
      throw e;
    });
    _installationCache.set(id, cached);
  }
  return cached;
}

// ─── App metadata (slug → public install URL) ────────────────────────────────

let _slugPromise: Promise<string | null> | null = null;

/** The App's public slug (for the install URL). Falls back to GITHUB_APP_SLUG env. */
export async function getAppSlug(): Promise<string | null> {
  if (!isGitHubConfigured()) return process.env.GITHUB_APP_SLUG || null;
  if (!_slugPromise) {
    _slugPromise = (async () => {
      try {
        const app = await getApp();
        const res = await app.octokit.request("GET /app");
        return res.data?.slug || process.env.GITHUB_APP_SLUG || null;
      } catch {
        return process.env.GITHUB_APP_SLUG || null;
      }
    })();
  }
  return _slugPromise;
}

/** Public per-account install URL students use to install the App on their repos. */
export function buildInstallUrl(slug: string | null): string | null {
  return slug ? `https://github.com/apps/${slug}/installations/new` : null;
}

/** Test-only / ops helper: drop cached instances (e.g. after key rotation). */
export function _resetGitHubClientCache(): void {
  _slugPromise = null;
  _appPromise = null;
  _discoveredIdPromise = null;
  _installationCache.clear();
}
