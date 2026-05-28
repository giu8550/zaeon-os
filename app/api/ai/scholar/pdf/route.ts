import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { isSafePublicHttpUrl } from "@/lib/scholar/ssrf";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response("Unauthorized", { status: 401 });

  // The session.user does NOT carry an id field — look it up from email.
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!dbUser) return new Response("Unauthorized", { status: 401 });
  const userId = dbUser.id;

  const target = new URL(req.url).searchParams.get("url") ?? "";
  if (!isSafePublicHttpUrl(target)) return new Response("Bad URL", { status: 400 });

  // The URL must already exist as a pdfUrl in one of THIS user's sessions.
  const sessions = await prisma.scholarSession.findMany({
    where: { userId },
    select: { references: true },
  });
  const allowed = sessions.some(
    (s) =>
      Array.isArray(s.references) &&
      (s.references as any[]).some((p) => p?.pdfUrl === target)
  );
  if (!allowed) return new Response("Forbidden", { status: 403 });

  // Follow redirects manually, validating every hop against the SSRF guard.
  let current = target;
  let upstream: Response | null = null;
  for (let hop = 0; hop < 5; hop++) {
    if (!isSafePublicHttpUrl(current)) {
      return new Response("Blocked redirect to private host", { status: 403 });
    }
    upstream = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(20000) });
    const loc = upstream.headers.get("location");
    if (upstream.status >= 300 && upstream.status < 400 && loc) {
      current = new URL(loc, current).toString();
      continue;
    }
    break;
  }
  if (!upstream || !upstream.ok || !/pdf/i.test(upstream.headers.get("content-type") ?? "")) {
    return new Response("Upstream error", { status: 502 });
  }
  return new Response(upstream.body, {
    headers: { "Content-Type": "application/pdf", "Cache-Control": "private, max-age=3600" },
  });
}
