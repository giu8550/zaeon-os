# Invite Code Gate — Design Spec
**Date:** 2026-05-30  
**Project:** Zaeon  
**Scope:** Gate all new registrations behind an invite code + conversational onboarding → Google OAuth at the end

---

## Overview

Every new Zaeon user must arrive via an invite code. The old registration path (direct Google sign-in) is replaced by a three-step flow at `/convite`:

1. **Code input** — user types (or receives via URL) an 8-character invite code
2. **AI onboarding chat** — ConviteAgent collects name, age, area, role, institution, and enrollment proof
3. **Google sign-in** — appears at the end as the account finalization step

Viral growth: admin generates the first codes. Each registered user receives their own 3-use code, automatically generated after their account is created. People who use your code belong to your network mural (mural feature built later).

Brazil-first: all UI copy is in Portuguese.

---

## Registration Flow

```
zaeon.com/convite?code=ABC12345  (or user types it manually)

Step 1 — Code Input
  POST /api/convite/validar { code }
  ├─ invalid / exhausted → inline error, stay on page
  └─ valid → create sessionToken (crypto.randomUUID)
             → set httpOnly cookie "convite_session" (1h TTL)
             → advance to Step 2

Step 2 — ConviteAgent chat (same page, chat replaces form)
  Phase 1: "Qual é o seu nome?"
  Phase 2: "Quantos anos você tem?"
  Phase 3: "Qual é a sua área de estudo ou atuação?"
  Phase 4: "Você é estudante ou professor?"
           ├─ estudante → "Em qual instituição você estuda?"
           └─ professor → "Qual disciplina você ensina?" + "Em qual instituição?"
  Phase 5: "Você tem uma foto do seu comprovante de matrícula ou carteira estudantil? Me envia aqui 📎"
           ├─ user uploads → base64 stored in PendingRegistration.verificationDoc
           └─ user skips  → agent: "Sem problema! Ou se preferir, me envia depois, ok? 😊"
                           → verificationDoc = null
  
  On chat completion:
  POST /api/convite/salvar-pendente { sessionToken, name, age, area, role, subject?, institution, verificationDoc? }
  → upsert PendingRegistration
  → advance to Step 3

Step 3 — Google sign-in
  Card with collected data summary
  Button "Finalizar com Google" → NextAuth signIn("google", { callbackUrl: "/dashboard" })
  
  NextAuth signIn callback:
  → reads "convite_session" cookie → finds PendingRegistration
  → on new user creation: populate name, age, course/subject, institution, role,
    verificationDoc, referredBy (ownerId of the invite code), kycStatus="pending"
  → increment InviteCode.usedCount
  → generate User.myInviteCode (3 uses, ownerId = new user id)
  → delete PendingRegistration
  → clear cookie
  → redirect to /dashboard

Blocked paths:
  All other NextAuth sign-in entry points for new users check for a valid
  "convite_session" cookie. If missing, redirect to /convite.
  (Existing users with kycStatus already set pass through normally.)
```

---

## Data Models

### New: `InviteCode` (Prisma)

```prisma
model InviteCode {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  code      String   @unique          // "ZA3K-X9QM" — 8 chars, no 0/O/I/1
  ownerId   String?  @db.ObjectId     // null = admin-generated
  owner     User?    @relation("OwnedInviteCodes", fields: [ownerId], references: [id])
  usedCount Int      @default(0)
  maxUses   Int      @default(3)
  createdAt DateTime @default(now())

  @@map("invite_codes")
}
```

### New: `PendingRegistration` (Prisma)

```prisma
model PendingRegistration {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  sessionToken    String   @unique
  inviteCode      String
  name            String
  age             Int
  area            String   // area of study / work
  role            String   // "student" | "teacher"
  subject         String?  // teachers only
  institution     String
  verificationDoc String?  // base64 image/PDF
  createdAt       DateTime @default(now())
  expiresAt       DateTime // createdAt + 1h, checked in signIn callback

  @@map("pending_registrations")
}
```

### Updated: `User` (Prisma + Mongoose)

New fields added to both `prisma/schema.prisma` and `src/models/User.ts`:

```
referredBy    String?  @db.ObjectId   // userId of inviter
myInviteCode  String?  @unique        // this user's shareable code
inviteCodeUsed String?               // the code they registered with (for admin display)
```

---

## Pages & Components

### `app/convite/page.tsx`
- Server component reads `?code` query param, passes to client
- Renders `<ConviteFlow initialCode={code} />`

### `components/convite/ConviteFlow.tsx`
- Client component: manages `step: "code" | "chat" | "google"`
- Owns `sessionToken` state
- Renders `<CodeInputStep>`, `<ConviteAgent>`, or `<GoogleFinishStep>` based on step

### `components/convite/CodeInputStep.tsx`
- Text input + "Entrar" button
- Calls `POST /api/convite/validar`
- On success: calls `onValidated(sessionToken)`
- Cyan palette, `#030014` bg, `rounded-[2rem]` glass card

### `components/convite/ConviteAgent.tsx`
- Fork of `components/onboard/OnboardAgent.tsx`
- Phases: name → age → area → role → [branch] → institution → verificationDoc
- File upload input for Phase 5 (image/PDF, converted to base64)
- Skip path for Phase 5
- On completion: calls `POST /api/convite/salvar-pendente`, then `onComplete()`

### `components/convite/GoogleFinishStep.tsx`
- Shows collected data summary card
- Single CTA: "Finalizar com Google" → `signIn("google")`
- Cyan/glass styling

---

## API Routes

### `POST /api/convite/validar`
```typescript
body: { code: string }
// 1. Find InviteCode where code matches
// 2. Check usedCount < maxUses
// 3. Generate sessionToken = crypto.randomUUID()
// 4. Set cookie "convite_session" (httpOnly, sameSite=lax, maxAge=3600)
// 5. Return { ok: true, sessionToken }
// Errors: 404 code not found, 410 code exhausted
```

### `POST /api/convite/salvar-pendente`
```typescript
body: { sessionToken, name, age, area, role, subject?, institution, verificationDoc? }
// 1. Verify cookie "convite_session" matches sessionToken
// 2. Upsert PendingRegistration (expiresAt = now + 1h)
// 3. Return { ok: true }
```

### `POST /api/admin/convites/gerar`
```typescript
body: { quantidade: number }  // 1..10
// Admin only (check ADMIN_EMAILS)
// Generate `quantidade` unique 8-char codes (chars: A-Z2-9 minus O,I)
// Insert as InviteCode records (ownerId=null, usedCount=0)
// Return { codes: string[] }
```

### `GET /api/admin/convites`
```typescript
// Admin only
// Return all InviteCodes with owner name if ownerId set
// Sorted by createdAt desc
```

---

## Admin Panel Changes (`ProfileModule.tsx`)

Add a collapsible "🔑 Invite Codes" section at the top, above the Node Queue:

```
[🔑 INVITE CODES ▼]
  [Gerar 1] [Gerar 5] [Gerar 10]
  
  Code        │ Uses │ Owner    │ Action
  ZA3K-X9QM  │ 2/3  │ admin    │ [copiar]
  BX7P-R2NV  │ 0/3  │ admin    │ [copiar]
  KQ9L-M4TW  │ 3/3✓ │ João S.  │ —
```

DetailBoard additions for selected user:
- "Via Convite" → `inviteCodeUsed`  
- "Indicado por" → resolved name of `referredBy` user

The `verificationDoc` viewer already works and will continue to work — the new onboarding feeds the same field.

---

## NextAuth Changes (`src/lib/auth.ts`)

Add `signIn` callback:

```typescript
async signIn({ user, account, profile, isNewUser }) {
  if (account?.provider === "google" && isNewUser) {
    // Read convite_session cookie from request headers
    const sessionToken = getCookieFromRequest("convite_session");
    if (!sessionToken) return "/convite?erro=sem-convite";
    
    const pending = await prisma.pendingRegistration.findUnique({ where: { sessionToken } });
    if (!pending || pending.expiresAt < new Date()) return "/convite?erro=sessao-expirada";
    
    // Populate user record
    await prisma.user.update({
      where: { email: user.email! },
      data: {
        name: pending.name,
        age: pending.age,
        course: pending.role === "student" ? pending.area : pending.subject,
        role: pending.role,
        institution: pending.institution,
        verificationDoc: pending.verificationDoc,
        referredBy: /* ownerId from InviteCode */ ...,
        inviteCodeUsed: pending.inviteCode,
        myInviteCode: generateCode(),  // new 3-use code for this user
      }
    });
    
    // InviteCode.usedCount++
    await prisma.inviteCode.update({
      where: { code: pending.inviteCode },
      data: { usedCount: { increment: 1 } }
    });
    
    // Cleanup
    await prisma.pendingRegistration.delete({ where: { sessionToken } });
    // Clear cookie in response (set maxAge=0)
  }
  return true;
}
```

---

## Code Format

8 uppercase alphanumeric characters, split 4-4 with a dash: `XXXX-XXXX`  
Character set: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (removes 0, O, 1, I for readability)  
Generated with `crypto.randomBytes` → base-N encode → slice to 8 chars → insert dash.

---

## What Is NOT in Scope

- Network mural (referredBy stored, mural built later)
- Email notifications for invite usage
- Code expiry by date (only by use count)
- Resending verification doc (done manually via email for now)
- Blocking existing verified users from logging in (they pass through normally)
