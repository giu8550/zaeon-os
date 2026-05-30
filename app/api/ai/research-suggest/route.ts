import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

const ENGINE_URL = process.env.RESEARCH_ENGINE_URL ?? "http://localhost:8002";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Session.user has no id — look up from email (same pattern as scholar route)
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!dbUser) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();

  try {
    const upstream = await fetch(`${ENGINE_URL}/suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return new Response(
        JSON.stringify({ error: `Research engine error: ${text}` }),
        { status: upstream.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await upstream.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Research engine offline. Run research-engine on port 8002." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}
