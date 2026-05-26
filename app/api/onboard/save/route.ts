import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';
import { cookies } from 'next/headers';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cookieStore = cookies();
  const raw = cookieStore.get('zaeon_onboard')?.value;
  if (!raw) {
    return NextResponse.json({ error: 'No onboard data' }, { status: 400 });
  }

  let data: {
    name: string;
    age: string;
    gender: string;
    city: string;
    university: string;
    universityName: string;
    course: string;
    inviteToken: string;
  };

  try {
    data = JSON.parse(decodeURIComponent(raw));
  } catch {
    return NextResponse.json({ error: 'Invalid onboard data' }, { status: 400 });
  }

  await prisma.user.update({
    where: { email: session.user.email },
    data: {
      name: data.name || undefined,
      age: data.age ? parseInt(data.age, 10) : undefined,
      gender: data.gender || undefined,
      city: data.city || undefined,
      institution: data.university || undefined,
      course: data.course || undefined,
      onboardingComplete: true,
    },
  });

  const response = NextResponse.json({ success: true });
  response.cookies.set('zaeon_onboard', '', { path: '/', maxAge: 0 });
  return response;
}
