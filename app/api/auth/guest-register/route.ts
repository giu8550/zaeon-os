// app/api/auth/guest-register/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export async function POST(req: Request) {
    try {
        const data = await req.json();

        // 1. Verifica se o usuário já existe
        const existingUser = await prisma.user.findUnique({
            where: { email: data.contactEmail.toLowerCase() }
        });

        if (existingUser) {
            return NextResponse.json({ success: true, message: "Guest already exists" });
        }

        // 2. Se não existir, cria a "Shadow Account"
        const initialSkills = {
            writing: { rank: "F", current: 0, next: 5, metricName: "Papers" },
            focus: { rank: "F", current: 0, next: 10, metricName: "Hours" },
            collab: { rank: "F", current: 0, next: 2, metricName: "Projects" },
            participation: { rank: "F", current: 0, next: 5, metricName: "Validations" }
        };

        // 🔒 SEGURANÇA: nunca confiar no `role` vindo do cliente — só student/teacher.
        // Impede self-provisionar admin/super_admin via esta rota.
        const ALLOWED_ROLES = ['student', 'teacher'];
        const safeRole = ALLOWED_ROLES.includes(String(data.role)) ? data.role : 'student';

        const newUser = await prisma.user.create({
            data: {
                name: data.name,
                email: data.contactEmail.toLowerCase(), // O email digitado no Modal
                phone: data.phone,
                course: data.course,
                role: safeRole,
                age: data.age,
                gender: data.gender,
                countryCode: data.countryCode, 
                institution: data.institution || "Guest",
                verificationDoc: data.verificationDoc,
                torsoImage: data.torsoImage,
                image: data.image,
                kycStatus: 'pending', // Fica aguardando a sua avaliação no Admin Room
                academicLevel: 'Guest', 
                skills: initialSkills
            }
        });

        return NextResponse.json({ success: true, user: newUser });

    } catch (error: any) {
        console.error('ERRO AO CRIAR GUEST:', error);
        return NextResponse.json({ error: 'Falha ao criar Shadow Account.' }, { status: 500 });
    }
}