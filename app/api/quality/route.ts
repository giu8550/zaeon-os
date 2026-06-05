import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { requestScore } from "@/lib/quality/scoreClient";

export const dynamic = "force-dynamic";

const ENGINE_URL = process.env.QUALITY_ENGINE_URL ?? "http://localhost:8003";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Session.user não tem id — busca por email (mesmo padrão do scholar/research-suggest).
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!dbUser) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const result = await requestScore(body, { engineUrl: ENGINE_URL });

  if (result.ok) {
    return new Response(JSON.stringify(result.data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      error: result.offline
        ? "Quality engine offline. Run quality-engine on port 8003."
        : result.error,
    }),
    {
      status: result.offline ? 503 : 502,
      headers: { "Content-Type": "application/json" },
    }
  );
}
