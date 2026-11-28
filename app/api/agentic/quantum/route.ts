import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/src/lib/auth';
// #883 (parte 3a): a IA sai pelo envelope (Hugging Face primeiro, Google só de queda), não pelo SDK do Vertex direto
import { iaDoLaboratorio, idDoAluno } from '@/lib/agentic/labIa';
import { QUANTUM_SYSTEM, mensagemQuantum } from '@/lib/agentic/prompts';

export const dynamic    = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { prompt } = await req.json();
    if (!prompt?.trim()) return NextResponse.json({ error: 'Prompt required' }, { status: 400 });

    const raw = await iaDoLaboratorio('quantum', QUANTUM_SYSTEM, mensagemQuantum(prompt), { temperature: 0.3, maxOutputTokens: 512, userId: idDoAluno(session) });

    let scene: any;
    try {
      scene = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    } catch {
      return NextResponse.json({ error: 'AI returned invalid JSON', raw }, { status: 500 });
    }

    if (!scene.vizMode || !scene.title) {
      return NextResponse.json({ error: 'Incomplete scene', raw }, { status: 500 });
    }

    return NextResponse.json({ scene });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 });
  }
}
