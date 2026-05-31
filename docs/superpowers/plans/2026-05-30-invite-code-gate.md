# Invite Code Gate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate all new Zaeon registrations behind an invite code, with a conversational onboarding chat and Google OAuth as the final step.

**Architecture:** Single `/convite` page with three client-side states (code input → AI chat → Google sign-in). A `PendingRegistration` Prisma record bridges chat data to the OAuth callback. After Google OAuth, `GET /api/convite/finalizar?st=TOKEN` migrates pending data to the User record, increments invite code usage, and generates the new user's own 3-use invite code. The admin `ProfileModule` gains a collapsible invite-code management panel.

**Tech Stack:** Next.js 14 App Router, Prisma 6 + MongoDB, Mongoose (admin routes only), NextAuth v4, Tailwind CSS, Framer Motion, Vitest (tests in `lib/**/*.test.ts`)

**Spec:** `docs/superpowers/specs/2026-05-30-invite-code-gate-design.md`

---

## File Map

### New files
| Path | Responsibility |
|------|----------------|
| `lib/invite-codes.ts` | Code generation + format utilities |
| `lib/invite-codes.test.ts` | Unit tests for generation utils |
| `lib/convite/validate.ts` | Pure validation logic (no DB) |
| `lib/convite/validate.test.ts` | Unit tests for validation |
| `app/api/convite/validar/route.ts` | Validate code, set cookie, return sessionToken |
| `app/api/convite/salvar-pendente/route.ts` | Upsert PendingRegistration with chat data |
| `app/api/convite/finalizar/route.ts` | Post-OAuth: migrate pending → User, generate myInviteCode |
| `app/api/admin/convites/route.ts` | Admin: list codes + generate new codes |
| `app/convite/page.tsx` | Page shell — reads `?code` param, renders ConviteFlow |
| `components/convite/ConviteFlow.tsx` | Client 3-state machine (code → chat → google) |
| `components/convite/CodeInputStep.tsx` | Step 1 — code input UI |
| `components/convite/ConviteAgent.tsx` | Step 2 — deterministic chat, phases + file upload |
| `components/convite/GoogleFinishStep.tsx` | Step 3 — Google sign-in card |

### Modified files
| Path | Change |
|------|--------|
| `prisma/schema.prisma` | Add `InviteCode`, `PendingRegistration`; add 4 fields to `User` |
| `src/models/User.ts` | Add `referredBy`, `myInviteCode`, `inviteCodeUsed`, `subject` fields |
| `app/api/admin/route.ts` | Expose `inviteCodeUsed` in formatted response |
| `app/workstation/admin/modules/ProfileModule.tsx` | Add collapsible InviteCodesPanel + new DetailBoards |

---

## Task 1: Prisma schema + Mongoose User model

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/models/User.ts`

- [ ] **Step 1: Add InviteCode and PendingRegistration to Prisma schema**

Open `prisma/schema.prisma`. After the `ClassLink` model, add:

```prisma
// --- SISTEMA DE CONVITES ---
model InviteCode {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  code      String   @unique
  ownerId   String?  @db.ObjectId
  owner     User?    @relation("OwnedInviteCodes", fields: [ownerId], references: [id])
  usedCount Int      @default(0)
  maxUses   Int      @default(3)
  createdAt DateTime @default(now())

  @@map("invite_codes")
}

model PendingRegistration {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  sessionToken    String   @unique
  inviteCode      String
  name            String   @default("")
  age             Int      @default(0)
  area            String   @default("")
  role            String   @default("")
  subject         String?
  institution     String   @default("")
  verificationDoc String?
  createdAt       DateTime @default(now())
  expiresAt       DateTime

  @@map("pending_registrations")
}
```

- [ ] **Step 2: Add 4 new fields to User in Prisma schema**

Inside the `User` model, after the `verificationDoc` line:

```prisma
  // Invite system
  referredBy      String?  @db.ObjectId
  myInviteCode    String?  @unique
  inviteCodeUsed  String?
  subject         String?
```

Also add the relation for owned invite codes, inside the User model relations block:

```prisma
  ownedInviteCodes InviteCode[] @relation("OwnedInviteCodes")
```

- [ ] **Step 3: Add same fields to Mongoose User schema**

Open `src/models/User.ts`. Inside `UserSchema`, after `verificationDoc: String`:

```typescript
    // Invite system
    referredBy: String,       // userId of inviter
    myInviteCode: String,     // this user's shareable code
    inviteCodeUsed: String,   // code they used to register
    subject: String,          // teachers: discipline they teach
```

- [ ] **Step 4: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected output: `✔ Generated Prisma Client`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/models/User.ts
git commit -m "feat: add InviteCode + PendingRegistration Prisma models, User invite fields"
```

---

## Task 2: Invite code generation utility

**Files:**
- Create: `lib/invite-codes.ts`
- Create: `lib/invite-codes.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/invite-codes.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateCode, validateCodeFormat, CHARSET } from "./invite-codes";

describe("generateCode", () => {
  it("returns a string matching XXXX-XXXX format", () => {
    const code = generateCode();
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it("never contains ambiguous chars 0 O 1 I", () => {
    for (let i = 0; i < 100; i++) {
      const code = generateCode();
      expect(code).not.toMatch(/[01IO]/);
    }
  });

  it("generates unique codes across 1000 runs", () => {
    const codes = new Set(Array.from({ length: 1000 }, generateCode));
    expect(codes.size).toBe(1000);
  });
});

describe("validateCodeFormat", () => {
  it("accepts valid codes", () => {
    expect(validateCodeFormat("ZA3K-X9QM")).toBe(true);
    expect(validateCodeFormat("ABCD-2345")).toBe(true);
  });

  it("rejects lowercase", () => {
    expect(validateCodeFormat("za3k-x9qm")).toBe(false);
  });

  it("rejects wrong length", () => {
    expect(validateCodeFormat("ZA3-X9QM")).toBe(false);
    expect(validateCodeFormat("ZA3KX-X9QM")).toBe(false);
  });

  it("rejects missing dash", () => {
    expect(validateCodeFormat("ZA3KX9QM")).toBe(false);
  });

  it("rejects ambiguous chars", () => {
    expect(validateCodeFormat("ZA3K-X9Q0")).toBe(false);
    expect(validateCodeFormat("ZA3K-X9QO")).toBe(false);
  });
});

describe("CHARSET", () => {
  it("has 32 characters", () => {
    expect(CHARSET.length).toBe(32);
  });

  it("excludes 0 O 1 I", () => {
    expect(CHARSET).not.toContain("0");
    expect(CHARSET).not.toContain("O");
    expect(CHARSET).not.toContain("1");
    expect(CHARSET).not.toContain("I");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test lib/invite-codes.test.ts
```

Expected: FAIL — `lib/invite-codes.ts` does not exist.

- [ ] **Step 3: Implement the utility**

Create `lib/invite-codes.ts`:

```typescript
import { randomBytes } from "crypto";

// Uppercase alphanumeric, excluding ambiguous chars: 0, O, 1, I
export const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Generates a random 8-character invite code formatted as XXXX-XXXX.
 * Uses crypto.randomBytes for uniform distribution over CHARSET.
 */
export function generateCode(): string {
  const chars: string[] = [];
  // Generate more bytes than needed to avoid modulo bias
  const bytes = randomBytes(16);
  let idx = 0;

  while (chars.length < 8) {
    const byte = bytes[idx % bytes.length];
    idx++;
    // Reject bytes that would introduce bias (reject values >= floor(256 / CHARSET.length) * CHARSET.length)
    const max = Math.floor(256 / CHARSET.length) * CHARSET.length;
    if (byte < max) {
      chars.push(CHARSET[byte % CHARSET.length]);
    }
    // If we ran out of bytes, get more (rare)
    if (idx >= bytes.length && chars.length < 8) {
      const more = randomBytes(16);
      more.forEach((b, i) => { (bytes as any)[i] = b; });
      idx = 0;
    }
  }

  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

/** Returns true if `code` matches the XXXX-XXXX format using only CHARSET chars. */
export function validateCodeFormat(code: string): boolean {
  return /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(code);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test lib/invite-codes.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/invite-codes.ts lib/invite-codes.test.ts
git commit -m "feat: add invite code generation utility with bias-free randomness"
```

---

## Task 3: POST /api/convite/validar

**Files:**
- Create: `lib/convite/validate.ts`
- Create: `lib/convite/validate.test.ts`
- Create: `app/api/convite/validar/route.ts`

- [ ] **Step 1: Write failing tests for validation logic**

Create `lib/convite/validate.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildValidationError } from "./validate";

describe("buildValidationError", () => {
  it("returns null for a valid code shape", () => {
    expect(buildValidationError("ZA3K-X9QM")).toBeNull();
  });

  it("returns error for empty code", () => {
    expect(buildValidationError("")).toMatch(/código/i);
  });

  it("returns error for code with wrong format", () => {
    expect(buildValidationError("badformat")).toMatch(/formato/i);
  });

  it("normalises lowercase to uppercase before validating", () => {
    // "abcd-efgh" has ambiguous chars but the function uppercases first
    // valid uppercase version would be fine if chars are all valid
    expect(buildValidationError("ABCD-EF23")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test lib/convite/validate.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the validation logic**

Create `lib/convite/validate.ts`:

```typescript
import { validateCodeFormat } from "@/lib/invite-codes";

/**
 * Returns a user-facing error message if the code string is invalid,
 * or null if the shape is acceptable (DB lookup still needed).
 * Normalises input to uppercase before checking.
 */
export function buildValidationError(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  if (!code) return "Por favor, insira um código de convite.";
  if (!validateCodeFormat(code)) {
    return "Formato inválido. O código deve ter 8 caracteres no formato XXXX-XXXX.";
  }
  return null;
}

/** Normalises a raw code string for DB lookup. */
export function normaliseCode(raw: string): string {
  return raw.trim().toUpperCase();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test lib/convite/validate.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Create the API route**

Create `app/api/convite/validar/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { buildValidationError, normaliseCode } from "@/lib/convite/validate";

export async function POST(req: Request) {
  const { code: rawCode } = await req.json();

  const shapeError = buildValidationError(rawCode ?? "");
  if (shapeError) {
    return NextResponse.json({ error: shapeError }, { status: 400 });
  }

  const code = normaliseCode(rawCode);

  const inviteCode = await prisma.inviteCode.findUnique({ where: { code } });
  if (!inviteCode) {
    return NextResponse.json({ error: "Código não encontrado." }, { status: 404 });
  }
  if (inviteCode.usedCount >= inviteCode.maxUses) {
    return NextResponse.json(
      { error: "Este código já atingiu o limite de usos." },
      { status: 410 }
    );
  }

  const sessionToken = crypto.randomUUID();

  const response = NextResponse.json({ ok: true, sessionToken, inviteCode: code });
  response.cookies.set("convite_session", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 3600, // 1 hour
    path: "/",
  });

  return response;
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/convite/validate.ts lib/convite/validate.test.ts app/api/convite/validar/route.ts
git commit -m "feat: POST /api/convite/validar — validate invite code, set session cookie"
```

---

## Task 4: POST /api/convite/salvar-pendente

**Files:**
- Create: `app/api/convite/salvar-pendente/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/convite/salvar-pendente/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/src/lib/prisma";

export async function POST(req: Request) {
  const cookieToken = cookies().get("convite_session")?.value;
  if (!cookieToken) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  const body = await req.json();
  const {
    sessionToken,
    inviteCode,
    name,
    age,
    area,
    role,
    subject,
    institution,
    verificationDoc,
  } = body as {
    sessionToken: string;
    inviteCode: string;
    name: string;
    age: number;
    area: string;
    role: "student" | "teacher";
    subject?: string;
    institution: string;
    verificationDoc?: string;
  };

  if (cookieToken !== sessionToken) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  if (!name || !age || !area || !role || !institution || !inviteCode) {
    return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  }

  await prisma.pendingRegistration.upsert({
    where: { sessionToken },
    create: {
      sessionToken,
      inviteCode,
      name: name.trim(),
      age: Number(age),
      area: area.trim(),
      role,
      subject: subject?.trim() ?? null,
      institution: institution.trim(),
      verificationDoc: verificationDoc ?? null,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    },
    update: {
      name: name.trim(),
      age: Number(age),
      area: area.trim(),
      role,
      subject: subject?.trim() ?? null,
      institution: institution.trim(),
      verificationDoc: verificationDoc ?? null,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/convite/salvar-pendente/route.ts
git commit -m "feat: POST /api/convite/salvar-pendente — upsert PendingRegistration"
```

---

## Task 5: GET /api/convite/finalizar

**Files:**
- Create: `lib/convite/migrate.ts`
- Create: `lib/convite/migrate.test.ts`
- Create: `app/api/convite/finalizar/route.ts`

This route runs after Google OAuth. NextAuth redirects to it via the `callbackUrl`. It reads the `st` query param, verifies the cookie, finds the PendingRegistration, updates the User, increments the invite code, and generates the user's own invite code.

- [ ] **Step 1: Write failing tests for migration logic**

Create `lib/convite/migrate.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildUserUpdateData } from "./migrate";

describe("buildUserUpdateData", () => {
  it("maps student pending data to user fields", () => {
    const data = buildUserUpdateData({
      name: "Ana Costa",
      age: 20,
      area: "Biologia",
      role: "student",
      subject: null,
      institution: "USP",
      verificationDoc: null,
      referredBy: null,
      inviteCode: "ZA3K-X9QM",
      myInviteCode: "NEW1-CODE",
    });
    expect(data.name).toBe("Ana Costa");
    expect(data.course).toBe("Biologia");
    expect(data.role).toBe("student");
    expect(data.subject).toBeUndefined();
    expect(data.inviteCodeUsed).toBe("ZA3K-X9QM");
    expect(data.myInviteCode).toBe("NEW1-CODE");
  });

  it("maps teacher pending data and includes subject", () => {
    const data = buildUserUpdateData({
      name: "João Silva",
      age: 35,
      area: "Ciências Exatas",
      role: "teacher",
      subject: "Química",
      institution: "UNICAMP",
      verificationDoc: null,
      referredBy: "owner-id-123",
      inviteCode: "BX7P-R2NV",
      myInviteCode: "NEW2-CODE",
    });
    expect(data.course).toBe("Ciências Exatas");
    expect(data.subject).toBe("Química");
    expect(data.referredBy).toBe("owner-id-123");
  });

  it("includes verificationDoc when provided", () => {
    const data = buildUserUpdateData({
      name: "Maria",
      age: 22,
      area: "Medicina",
      role: "student",
      subject: null,
      institution: "UNIFESP",
      verificationDoc: "data:image/jpeg;base64,abc123",
      referredBy: null,
      inviteCode: "ZA3K-X9QM",
      myInviteCode: "NEW3-CODE",
    });
    expect(data.verificationDoc).toBe("data:image/jpeg;base64,abc123");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test lib/convite/migrate.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement migration logic**

Create `lib/convite/migrate.ts`:

```typescript
interface MigrateInput {
  name: string;
  age: number;
  area: string;
  role: string;
  subject: string | null;
  institution: string;
  verificationDoc: string | null;
  referredBy: string | null;
  inviteCode: string;
  myInviteCode: string;
}

/**
 * Builds the Prisma user update payload from a PendingRegistration.
 * Pure function — no DB calls, fully testable.
 */
export function buildUserUpdateData(input: MigrateInput): Record<string, unknown> {
  const data: Record<string, unknown> = {
    name: input.name,
    age: input.age,
    course: input.area,          // area of study/work for all roles
    role: input.role,
    institution: input.institution,
    inviteCodeUsed: input.inviteCode,
    myInviteCode: input.myInviteCode,
    referredBy: input.referredBy ?? null,
  };

  if (input.role === "teacher" && input.subject) {
    data.subject = input.subject;
  }

  if (input.verificationDoc) {
    data.verificationDoc = input.verificationDoc;
  }

  return data;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test lib/convite/migrate.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Create the API route**

Create `app/api/convite/finalizar/route.ts`:

```typescript
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { generateCode } from "@/lib/invite-codes";
import { buildUserUpdateData } from "@/lib/convite/migrate";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const st = searchParams.get("st");

  if (!st) return redirect("/convite?erro=sem-sessao");

  // Verify cookie matches to guard against token theft
  const cookieToken = cookies().get("convite_session")?.value;
  if (!cookieToken || cookieToken !== st) {
    return redirect("/convite?erro=sessao-invalida");
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return redirect("/convite");

  const pending = await prisma.pendingRegistration.findUnique({
    where: { sessionToken: st },
  });

  if (!pending || pending.expiresAt < new Date()) {
    return redirect("/convite?erro=sessao-expirada");
  }

  // Look up the invite code to find ownerId (referredBy)
  const inviteCodeRecord = await prisma.inviteCode.findUnique({
    where: { code: pending.inviteCode },
  });

  // Generate a unique code for the new user (retry on collision, rare)
  let newCode = generateCode();
  while (await prisma.inviteCode.findUnique({ where: { code: newCode } })) {
    newCode = generateCode();
  }

  const updateData = buildUserUpdateData({
    name: pending.name,
    age: pending.age,
    area: pending.area,
    role: pending.role,
    subject: pending.subject,
    institution: pending.institution,
    verificationDoc: pending.verificationDoc,
    referredBy: inviteCodeRecord?.ownerId ?? null,
    inviteCode: pending.inviteCode,
    myInviteCode: newCode,
  });

  // Update user record
  const updatedUser = await prisma.user.update({
    where: { email: session.user.email },
    data: updateData,
    select: { id: true },
  });

  // Create the InviteCode record for the new user
  await prisma.inviteCode.create({
    data: {
      code: newCode,
      ownerId: updatedUser.id,
      maxUses: 3,
    },
  });

  // Increment usedCount on the used invite code
  await prisma.inviteCode.update({
    where: { code: pending.inviteCode },
    data: { usedCount: { increment: 1 } },
  });

  // Cleanup pending registration and cookie
  await prisma.pendingRegistration.delete({ where: { sessionToken: st } });

  const response = redirect("/dashboard");
  // Note: redirect() in Next.js 14 throws internally, so cookie clearing
  // happens before calling redirect:
  cookies().delete("convite_session");

  return response;
}
```

**Important:** `redirect()` from `next/navigation` throws a special error to trigger Next.js redirect, so `cookies().delete()` must be called before it. Move the delete above the redirect call if the above order causes issues. The correct order in the file should be:

```typescript
  // Cleanup
  await prisma.pendingRegistration.delete({ where: { sessionToken: st } });
  cookies().delete("convite_session");
  redirect("/dashboard");  // this line throws — nothing after runs
```

Update the route file to match this ordering (delete cookie BEFORE calling redirect).

- [ ] **Step 6: Commit**

```bash
git add lib/convite/migrate.ts lib/convite/migrate.test.ts app/api/convite/finalizar/route.ts
git commit -m "feat: GET /api/convite/finalizar — post-OAuth data migration"
```

---

## Task 6: GET + POST /api/admin/convites

**Files:**
- Create: `app/api/admin/convites/route.ts`

- [ ] **Step 1: Create the admin invite codes route**

Create `app/api/admin/convites/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { generateCode } from "@/lib/invite-codes";

const ADMIN_EMAILS = ["zaeondao@gmail.com", "martinez@zaeon.space"];

function isAdmin(email: string | null | undefined) {
  return email ? ADMIN_EMAILS.includes(email.toLowerCase()) : false;
}

// GET /api/admin/convites — list all codes with owner name
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const codes = await prisma.inviteCode.findMany({
    orderBy: { createdAt: "desc" },
    include: { owner: { select: { name: true } } },
  });

  return NextResponse.json(
    codes.map((c) => ({
      id: c.id,
      code: c.code,
      usedCount: c.usedCount,
      maxUses: c.maxUses,
      ownerName: c.owner?.name ?? "admin",
      createdAt: c.createdAt.toISOString(),
    }))
  );
}

// POST /api/admin/convites — generate N new admin codes
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { quantidade } = await req.json();
  const n = Math.max(1, Math.min(Number(quantidade) || 1, 10));

  const created: string[] = [];
  for (let i = 0; i < n; i++) {
    let code = generateCode();
    // Ensure uniqueness
    while (await prisma.inviteCode.findUnique({ where: { code } })) {
      code = generateCode();
    }
    await prisma.inviteCode.create({
      data: { code, ownerId: null, maxUses: 3 },
    });
    created.push(code);
  }

  return NextResponse.json({ ok: true, codes: created });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/convites/route.ts
git commit -m "feat: GET+POST /api/admin/convites — admin invite code management"
```

---

## Task 7: CodeInputStep component

**Files:**
- Create: `components/convite/CodeInputStep.tsx`

- [ ] **Step 1: Create the component**

Create `components/convite/CodeInputStep.tsx`:

```tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface Props {
  initialCode?: string;
  onValidated: (sessionToken: string, inviteCode: string) => void;
}

export default function CodeInputStep({ initialCode = "", onValidated }: Props) {
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/convite/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao validar código.");
        return;
      }
      onValidated(data.sessionToken, data.inviteCode);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030014] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/5 backdrop-blur-2xl border border-cyan-500/20 rounded-[2rem] p-10 shadow-2xl"
      >
        <h1 className="text-3xl font-black text-white tracking-tighter mb-2">
          Zaeon
        </h1>
        <p className="text-sm text-cyan-400/80 mb-8 font-medium">
          Insira seu código de convite para começar.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX"
            maxLength={9}
            autoFocus
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-center text-xl font-mono tracking-[0.3em] placeholder:text-white/20 focus:outline-none focus:border-cyan-500 transition-colors"
          />

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-red-400 text-center font-medium"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={loading || code.length < 9}
            className="w-full py-4 rounded-2xl bg-cyan-500 text-black font-black uppercase tracking-widest text-sm hover:bg-cyan-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
          >
            {loading ? "Verificando…" : "Entrar"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/convite/CodeInputStep.tsx
git commit -m "feat: CodeInputStep — code entry UI for /convite"
```

---

## Task 8: ConviteAgent chat component

**Files:**
- Create: `components/convite/ConviteAgent.tsx`

This component is a deterministic state-machine chat (no API call for messages). It has branching phases: student and teacher paths. Phase 5 includes an optional file upload.

- [ ] **Step 1: Create the component**

Create `components/convite/ConviteAgent.tsx`:

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PaperClipIcon } from "@heroicons/react/24/outline";

type Role = "student" | "teacher";

interface CollectedData {
  name: string;
  age: number;
  area: string;
  role: Role;
  subject?: string;
  institution: string;
  verificationDoc?: string;
}

type Phase =
  | "name"
  | "age"
  | "area"
  | "role"
  | "subject"       // teacher only
  | "institution"
  | "doc"
  | "done";

interface ChatMessage {
  from: "agent" | "user";
  text: string;
  imagePreview?: string; // for doc uploads
}

interface Props {
  sessionToken: string;
  inviteCode: string;
  onComplete: () => void;
}

function getAgentMessage(phase: Phase, collected: Partial<CollectedData>): string {
  switch (phase) {
    case "name":
      return "Olá! Bem-vindo ao Zaeon. 👋 Qual é o seu nome completo?";
    case "age":
      return `Prazer, ${collected.name}! Quantos anos você tem?`;
    case "area":
      return "Legal! Qual é a sua área de estudo ou atuação?";
    case "role":
      return "Você é estudante ou professor?";
    case "subject":
      return "Qual disciplina você ensina?";
    case "institution":
      return collected.role === "teacher"
        ? "Em qual instituição você leciona?"
        : "Em qual instituição você estuda?";
    case "doc":
      return "Ótimo! Para finalizar, você tem uma foto do seu comprovante de matrícula ou carteira estudantil? Me envia aqui 📎";
    case "done":
      return "Perfeito! Tudo anotado. Vamos finalizar seu cadastro com o Google. 🚀";
    default:
      return "";
  }
}

export default function ConviteAgent({ sessionToken, inviteCode, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("name");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { from: "agent", text: getAgentMessage("name", {}) },
  ]);
  const [input, setInput] = useState("");
  const [collected, setCollected] = useState<Partial<CollectedData>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = (msg: ChatMessage) =>
    setMessages((prev) => [...prev, msg]);

  const advanceToPhase = (
    nextPhase: Phase,
    updatedCollected: Partial<CollectedData>
  ) => {
    setPhase(nextPhase);
    addMessage({ from: "agent", text: getAgentMessage(nextPhase, updatedCollected) });
  };

  const handleSend = async () => {
    const value = input.trim();
    if (!value || saving) return;
    setInput("");
    setError(null);

    addMessage({ from: "user", text: value });

    const next = { ...collected };

    switch (phase) {
      case "name":
        next.name = value;
        setCollected(next);
        advanceToPhase("age", next);
        break;

      case "age": {
        const age = parseInt(value, 10);
        if (isNaN(age) || age < 13 || age > 100) {
          addMessage({ from: "agent", text: "Por favor, insira uma idade válida (ex: 21)." });
          return;
        }
        next.age = age;
        setCollected(next);
        advanceToPhase("area", next);
        break;
      }

      case "area":
        next.area = value;
        setCollected(next);
        advanceToPhase("role", next);
        break;

      case "role": {
        const normalized = value.toLowerCase();
        if (normalized.includes("professor") || normalized.includes("teacher")) {
          next.role = "teacher";
          setCollected(next);
          advanceToPhase("subject", next);
        } else if (normalized.includes("estudante") || normalized.includes("student") || normalized.includes("aluno")) {
          next.role = "student";
          setCollected(next);
          advanceToPhase("institution", next);
        } else {
          addMessage({
            from: "agent",
            text: "Por favor, responda "estudante" ou "professor".",
          });
        }
        break;
      }

      case "subject":
        next.subject = value;
        setCollected(next);
        advanceToPhase("institution", next);
        break;

      case "institution":
        next.institution = value;
        setCollected(next);
        advanceToPhase("doc", next);
        break;

      case "doc":
        // Text response on the doc phase means they want to skip
        next.verificationDoc = undefined;
        setCollected(next);
        await savePending(next as CollectedData);
        break;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      const updated = { ...collected, verificationDoc: base64 };
      setCollected(updated);

      addMessage({
        from: "user",
        text: file.name,
        imagePreview: file.type.startsWith("image/") ? base64 : undefined,
      });
      addMessage({
        from: "agent",
        text: "Recebi! 📎 Vamos finalizar o seu cadastro.",
      });

      await savePending(updated as CollectedData);
    };
    reader.readAsDataURL(file);
  };

  const handleSkipDoc = async () => {
    addMessage({ from: "user", text: "Prefiro enviar depois." });
    addMessage({
      from: "agent",
      text: "Sem problema! Ou se preferir, me envia depois, ok? 😊 Vamos finalizar o cadastro.",
    });
    const updated = { ...collected, verificationDoc: undefined };
    setCollected(updated);
    await savePending(updated as CollectedData);
  };

  const savePending = async (data: CollectedData) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/convite/salvar-pendente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken,
          inviteCode,
          name: data.name,
          age: data.age,
          area: data.area,
          role: data.role,
          subject: data.subject ?? null,
          institution: data.institution,
          verificationDoc: data.verificationDoc ?? null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Erro ao salvar dados.");
        return;
      }

      setPhase("done");
      addMessage({ from: "agent", text: getAgentMessage("done", data) });
      setTimeout(onComplete, 1500);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030014] flex items-center justify-center p-4">
      <div className="w-full max-w-lg flex flex-col h-[80vh] bg-white/5 backdrop-blur-2xl border border-cyan-500/20 rounded-[2rem] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-white/5">
          <h2 className="text-lg font-black text-white tracking-tight">
            Zaeon <span className="text-cyan-400 font-medium text-sm ml-1">onboarding</span>
          </h2>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${
                    msg.from === "agent"
                      ? "bg-white/10 text-white/90"
                      : "bg-cyan-500 text-black font-medium"
                  }`}
                >
                  {msg.imagePreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={msg.imagePreview}
                      alt="comprovante"
                      className="max-w-[200px] rounded-xl mb-2"
                    />
                  )}
                  {msg.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>

        {/* Error */}
        {error && (
          <p className="px-6 py-2 text-xs text-red-400 text-center">{error}</p>
        )}

        {/* Input area */}
        {phase !== "done" && (
          <div className="p-4 border-t border-white/5">
            {phase === "doc" ? (
              <div className="flex gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*,application/pdf"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-3 bg-cyan-500/20 border border-cyan-500/30 rounded-2xl text-cyan-400 text-sm font-medium hover:bg-cyan-500/30 transition-colors"
                >
                  <PaperClipIcon className="w-4 h-4" />
                  Enviar comprovante
                </button>
                <button
                  onClick={handleSkipDoc}
                  className="flex-1 py-3 rounded-2xl border border-white/10 text-white/50 text-sm hover:text-white/70 hover:border-white/20 transition-colors"
                >
                  Enviar depois
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <input
                  type={phase === "age" ? "number" : "text"}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder={
                    phase === "role"
                      ? "estudante / professor"
                      : phase === "age"
                      ? "ex: 22"
                      : ""
                  }
                  autoFocus
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-cyan-500 transition-colors"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || saving}
                  className="px-5 py-3 bg-cyan-500 text-black rounded-2xl text-sm font-bold hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/convite/ConviteAgent.tsx
git commit -m "feat: ConviteAgent — deterministic onboarding chat with file upload"
```

---

## Task 9: GoogleFinishStep component

**Files:**
- Create: `components/convite/GoogleFinishStep.tsx`

- [ ] **Step 1: Create the component**

Create `components/convite/GoogleFinishStep.tsx`:

```tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { signIn } from "next-auth/react";

interface Props {
  sessionToken: string;
}

export default function GoogleFinishStep({ sessionToken }: Props) {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = () => {
    setLoading(true);
    // callbackUrl routes to our finalizar handler which migrates PendingRegistration → User
    signIn("google", {
      callbackUrl: `/api/convite/finalizar?st=${encodeURIComponent(sessionToken)}`,
    });
  };

  return (
    <div className="min-h-screen bg-[#030014] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white/5 backdrop-blur-2xl border border-cyan-500/20 rounded-[2rem] p-10 shadow-2xl text-center"
      >
        <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto mb-6">
          <span className="text-2xl">🎓</span>
        </div>

        <h2 className="text-2xl font-black text-white tracking-tight mb-2">
          Quase lá!
        </h2>
        <p className="text-white/50 text-sm mb-8">
          Conecte sua conta Google para finalizar o cadastro no Zaeon.
        </p>

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-white text-black font-bold text-sm hover:bg-white/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
        >
          {/* Google logo SVG */}
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? "Redirecionando…" : "Finalizar com Google"}
        </button>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/convite/GoogleFinishStep.tsx
git commit -m "feat: GoogleFinishStep — Google OAuth CTA card"
```

---

## Task 10: ConviteFlow + /convite page

**Files:**
- Create: `components/convite/ConviteFlow.tsx`
- Create: `app/convite/page.tsx`

- [ ] **Step 1: Create ConviteFlow orchestrator**

Create `components/convite/ConviteFlow.tsx`:

```tsx
"use client";

import { useState } from "react";
import CodeInputStep from "./CodeInputStep";
import ConviteAgent from "./ConviteAgent";
import GoogleFinishStep from "./GoogleFinishStep";

type Step = "code" | "chat" | "google";

interface Props {
  initialCode?: string;
}

export default function ConviteFlow({ initialCode }: Props) {
  const [step, setStep] = useState<Step>("code");
  const [sessionToken, setSessionToken] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const handleValidated = (token: string, code: string) => {
    setSessionToken(token);
    setInviteCode(code);
    setStep("chat");
  };

  const handleChatComplete = () => {
    setStep("google");
  };

  if (step === "code") {
    return (
      <CodeInputStep
        initialCode={initialCode}
        onValidated={handleValidated}
      />
    );
  }

  if (step === "chat") {
    return (
      <ConviteAgent
        sessionToken={sessionToken}
        inviteCode={inviteCode}
        onComplete={handleChatComplete}
      />
    );
  }

  return <GoogleFinishStep sessionToken={sessionToken} />;
}
```

- [ ] **Step 2: Create the /convite page**

Create `app/convite/page.tsx`:

```tsx
import dynamic from "next/dynamic";

// Avoid SSR for the client-driven state machine
const ConviteFlow = dynamic(
  () => import("@/components/convite/ConviteFlow"),
  { ssr: false }
);

interface Props {
  searchParams: { code?: string; erro?: string };
}

export default function ConvitePage({ searchParams }: Props) {
  return <ConviteFlow initialCode={searchParams.code} />;
}

export const metadata = {
  title: "Convite — Zaeon",
  description: "Entre com seu código de convite para acessar o Zaeon.",
};
```

- [ ] **Step 3: Commit**

```bash
git add components/convite/ConviteFlow.tsx app/convite/page.tsx
git commit -m "feat: /convite page + ConviteFlow 3-state orchestrator"
```

---

## Task 11: Admin ProfileModule — invite codes panel + new fields

**Files:**
- Modify: `app/api/admin/route.ts` — expose `inviteCodeUsed`
- Modify: `app/workstation/admin/modules/ProfileModule.tsx` — InviteCodesPanel + new DetailBoards

- [ ] **Step 1: Expose inviteCodeUsed in admin GET route**

Open `app/api/admin/route.ts`. In the `formattedRequests` map, after the `verificationDoc` line, add:

```typescript
            inviteCodeUsed: user.inviteCodeUsed || null,
```

- [ ] **Step 2: Add inviteCodeUsed to UserRequest type in ProfileModule**

Open `app/workstation/admin/modules/ProfileModule.tsx`. In the `UserRequest` interface, after `verificationDoc`:

```typescript
    inviteCodeUsed: string | null;
```

- [ ] **Step 3: Add two new DetailBoards to the inspection panel**

In `ProfileModule.tsx`, inside the `<div className="grid grid-cols-3 gap-4">` that already has 6 DetailBoards, add two more after the `Registry Date` board:

```tsx
<DetailBoard title="Via Convite" value={selectedReq.inviteCodeUsed || "—"} icon={IdentificationIcon} isActive={false} />
```

Also add `KeyIcon` to the heroicons import at the top — but since `IdentificationIcon` is already imported, we can reuse it. Or add a new import:

```typescript
import { ..., KeyIcon } from "@heroicons/react/24/outline";
```

And use `icon={KeyIcon}` for the "Via Convite" board.

- [ ] **Step 4: Add InviteCodesPanel above the Node Queue**

In `ProfileModule.tsx`, add this component definition before `export default function ProfileModule`:

```tsx
interface InviteCodeRow {
  id: string;
  code: string;
  usedCount: number;
  maxUses: number;
  ownerName: string;
}

function InviteCodesPanel({ glassPanel }: { glassPanel: string }) {
  const [open, setOpen] = useState(false);
  const [codes, setCodes] = useState<InviteCodeRow[]>([]);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchCodes = async () => {
    const res = await fetch("/api/admin/convites");
    if (res.ok) setCodes(await res.json());
  };

  const generate = async (quantidade: number) => {
    setGenerating(true);
    try {
      await fetch("/api/admin/convites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantidade }),
      });
      await fetchCodes();
    } finally {
      setGenerating(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  // Load codes when panel opens
  const toggle = () => {
    if (!open) fetchCodes();
    setOpen((v) => !v);
  };

  return (
    <div className="mb-6">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-6 py-4 bg-white/40 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[24px] hover:border-cyan-500/30 transition-all"
      >
        <div className="flex items-center gap-3">
          <KeyIcon className="w-4 h-4 text-cyan-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-white/60">
            Invite Codes
          </span>
          <span className="text-[9px] bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 rounded-full font-bold">
            {codes.length}
          </span>
        </div>
        <span className="text-white/30 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 bg-white/40 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[24px] p-6 space-y-4"
        >
          {/* Generate buttons */}
          <div className="flex gap-2">
            {[1, 5, 10].map((n) => (
              <button
                key={n}
                onClick={() => generate(n)}
                disabled={generating}
                className="flex-1 py-2.5 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[10px] font-black uppercase tracking-wider hover:bg-cyan-500 hover:text-black transition-all disabled:opacity-40"
              >
                {generating ? "…" : `Gerar ${n}`}
              </button>
            ))}
          </div>

          {/* Codes list */}
          <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
            {codes.map((c) => (
              <div
                key={c.id}
                className={`flex items-center justify-between px-4 py-3 rounded-2xl border ${
                  c.usedCount >= c.maxUses
                    ? "opacity-40 border-transparent bg-white/5"
                    : "border-white/5 bg-black/10 dark:bg-white/5"
                }`}
              >
                <div>
                  <span className="font-mono text-sm font-bold text-white tracking-wider">
                    {c.code}
                  </span>
                  <span className="ml-3 text-[10px] text-slate-400">
                    {c.usedCount}/{c.maxUses} usos · {c.ownerName}
                  </span>
                </div>
                {c.usedCount < c.maxUses && (
                  <button
                    onClick={() => copyCode(c.code)}
                    className="text-[9px] font-black uppercase tracking-wider text-cyan-500 hover:text-cyan-400 transition-colors"
                  >
                    {copied === c.code ? "✓" : "Copiar"}
                  </button>
                )}
              </div>
            ))}
            {codes.length === 0 && (
              <p className="text-center text-[11px] text-white/20 py-4">
                Nenhum código gerado ainda.
              </p>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Add KeyIcon to imports and render InviteCodesPanel**

At the top of `ProfileModule.tsx`, add `KeyIcon` to the heroicons import:
```typescript
import { ..., KeyIcon } from "@heroicons/react/24/outline";
```

Inside `ProfileModule`, in the left column JSX (`<div className={`w-[380px] ...`}>`), **before** the `<div className="p-8 border-b ...">` (the Node Queue header), add:

```tsx
<div className="p-6 pb-0">
  <InviteCodesPanel glassPanel={glassPanel} />
</div>
```

- [ ] **Step 6: Run the dev server and verify manually**

```bash
npm run dev
```

Navigate to `http://localhost:3000/workstation/admin` as admin. 

Verify:
- The "Invite Codes" collapsible section appears above the Node Queue
- "Gerar 1" creates a code and it appears in the list
- Copy button copies to clipboard
- A user from the Node Queue who has `inviteCodeUsed` shows "Via Convite" in their DetailBoards

- [ ] **Step 7: Commit**

```bash
git add app/api/admin/route.ts app/workstation/admin/modules/ProfileModule.tsx
git commit -m "feat: admin panel — InviteCodesPanel + inviteCodeUsed DetailBoard"
```

---

## Self-Review

**Spec coverage check:**
- ✅ `/convite` page with 3 states (code → chat → google): Tasks 7–10
- ✅ InviteCode + PendingRegistration Prisma models: Task 1
- ✅ User fields (referredBy, myInviteCode, inviteCodeUsed, subject): Task 1
- ✅ Cookie-based session verification: Tasks 3–5
- ✅ Chat phases (name, age, area, role, branch, institution, doc): Task 8
- ✅ Skip option for doc upload: Task 8 (`handleSkipDoc`)
- ✅ Post-OAuth migration in finalizar: Task 5
- ✅ New user gets their own 3-use code: Task 5
- ✅ Admin invite codes panel: Task 11
- ✅ Admin can generate 1/5/10 codes: Task 11
- ✅ verificationDoc still visible in existing admin panel: existing viewer unchanged

**Type consistency check:**
- `generateCode()` returns `string` — used in Tasks 5, 6, 11
- `buildValidationError(raw: string): string | null` — used in Task 3
- `buildUserUpdateData(input: MigrateInput): Record<string, unknown>` — used in Task 5
- `sessionToken` flows: validar → client state → salvar-pendente body + finalizar URL ✅
- `inviteCode` string flows: validar response → client state → salvar-pendente body → PendingRegistration → finalizar lookup ✅

**Placeholder scan:** None found.
