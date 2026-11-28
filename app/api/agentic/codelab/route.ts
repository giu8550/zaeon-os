import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/src/lib/auth';
// #883 (parte 3a): a IA sai pelo envelope (Hugging Face primeiro, Google só de queda), não pelo SDK do Vertex direto
import { iaDoLaboratorio, idDoAluno } from '@/lib/agentic/labIa';
import { CODELAB_SYSTEM, mensagemCodelab } from '@/lib/agentic/prompts';

export const dynamic    = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { prompt, code, language } = await req.json();
    if (!prompt?.trim()) return NextResponse.json({ error: 'Prompt required' }, { status: 400 });

    const userMsg = mensagemCodelab(prompt, code, language);

    const raw = await iaDoLaboratorio('codelab', CODELAB_SYSTEM, userMsg, { temperature: 0.4, maxOutputTokens: 1024, userId: idDoAluno(session) });

    let parsed: any;
    try {
      parsed = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    } catch {
      return NextResponse.json({ response: raw, raw }, { status: 200 });
    }

    return NextResponse.json({ response: parsed.response, updatedCode: parsed.updatedCode });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}
