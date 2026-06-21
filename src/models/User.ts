import mongoose, { Schema, model, models } from "mongoose";

const UserSchema = new Schema({
    name: { type: String },
    email: { type: String, unique: true, required: true },
    image: String,
    emailVerified: Date,

    // --- DADOS DO ONBOARDING & RPG ACADÊMICO ---
    role: { type: String, default: "student" }, // Removido o enum estrito para evitar bloqueios de novas roles
    course: String,
    age: Number,
    gender: String,
    countryCode: String,
    academicLevel: { type: String, default: "Graduação" },

    // O motor do RPG (XP e Barras de Rank) - Salvo como JSON livre
    skills: { type: Schema.Types.Mixed },

    // O Documento Principal (Base64 da Imagem ou PDF)
    verificationDoc: String,

    // Invite system
    referredBy: { type: Schema.Types.ObjectId, ref: 'User' },  // userId of inviter (bare ObjectId, no FK enforcement)
    myInviteCode: String,     // this user's shareable code
    inviteCodeUsed: String,   // code they used to register
    subject: String,          // teachers: discipline they teach

    // --- DADOS DE IDENTIDADE ---
    phone: String,
    identityId: String,
    identityType: String,
    institution: String,
    bio: String,
    walletAddress: String,

    // Array antigo de Documentos (mantido para compatibilidade se você usou antes)
    documents: [
        {
            name: String,
            url: String,
            uploadedAt: { type: Date, default: Date.now }
        }
    ],

    // --- PLANOS & LIBERAÇÕES (modo econômico de tokens) ---
    plan: { type: String, default: "free" },        // free | plus | pro | max
    plusUntil: { type: Date, default: null },        // expiração do trial/Plus
    trialGranted: { type: Boolean, default: false }, // já recebeu o mês grátis acadêmico
    eduEmail: String,
    eduVerified: { type: Boolean, default: false },
    deepThinkEnabled: { type: Boolean, default: false },   // override: profundo ilimitado
    advancedVoiceEnabled: { type: Boolean, default: false }, // override: voz avançada
    projectsEnabled: { type: Boolean, default: false },      // override: sala Projetos
    deepThinkUsedAt: { type: Date, default: null },          // cota diária do Plus

    // --- CONTROLE DE STATUS DO ADMIN ---
    kycStatus: {
        type: String,
        // CORREÇÃO CRUCIAL: Adicionado o "verified" que o nosso Admin Room envia
        enum: ["pending", "verified", "rejected"],
        default: "pending"
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
}, {
    // Permite que campos não mapeados não quebrem o sistema
    strict: false,
    // Garante que campos não mapeados também sejam enviados nas respostas JSON
    toJSON: { virtuals: true, strict: false },
    toObject: { virtuals: true, strict: false }
});

const User = models.User || model("User", UserSchema);

export default User;