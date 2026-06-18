# 🌌 Zaeon OS (载恩 / 제온)
### The Research Operating System — AI × Science × Web3

![Zaeon Banner](public/zaeon-logo.png)

<div align="center">

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript)](https://www.typescriptlang.org)
[![Three.js](https://img.shields.io/badge/Three.js-r160-black?logo=three.js)](https://threejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.x-47a248?logo=mongodb)](https://mongodb.com)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-2d3748?logo=prisma)](https://prisma.io)
[![Google AI](https://img.shields.io/badge/Gemini-2.0-4285F4?logo=google)](https://ai.google.dev)

</div>

---

## 🌍 Overview

**Zaeon** is an **Operating System for Science** — a comprehensive academic workspace powering student-teacher collaboration, AI-driven research tools, real-time 3D scientific visualization, and a Liquidity Protocol for Intellectual Property (IP) built on the **VERY Network** (EVM-compatible blockchain).

**Three core pillars:**
1. **Academic Workspace** — AI tools for students, teachers, and researchers
2. **BioSim 3D Engine** — Voxel science visualizer powered by Gemini AI + Three.js
3. **IP Liquidity Engine** — Tokenize research as tradeable on-chain assets

---

## 📁 Repository Structure

```
zaeon-os/
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # Root layout (fonts, providers, navbar)
│   ├── page.tsx                      # Landing page
│   ├── globals.css                   # Global CSS (tokens, dark/light mode)
│   ├── fonts.ts                      # Google Fonts configuration
│   ├── providers.tsx                 # next-themes ThemeProvider
│   │
│   ├── agentic-modules/              # 🆕 Modular AI agents
│   │   └── biosim3d/                 # 🆕 BioSim 3D Voxel Engine
│   │       ├── index.ts              # Barrel exports
│   │       ├── types.ts              # TypeScript interfaces
│   │       ├── presets.ts            # Room-specific preset catalog
│   │       ├── BioSim3DModule.tsx    # Main UI component
│   │       ├── VoxelCanvas.tsx       # Three.js InstancedMesh renderer
│   │       └── voxelGenerators/      # Structure generators
│   │           ├── index.ts          # Registry / dispatcher
│   │           ├── dna.ts            # DNA / RNA double helix
│   │           ├── molecule.ts       # Atoms, bonds, crystal lattice
│   │           ├── cell.ts           # Plant / animal / bacteria cell
│   │           ├── plant.ts          # Trees, ferns, seeds, flowers
│   │           ├── fungus.ts         # Mushrooms, mycelium (in plant.ts)
│   │           ├── animal.ts         # Horse, dog, human, fish
│   │           ├── quantum.ts        # Electron orbitals, probability clouds
│   │           ├── math.ts           # 3D surfaces (ripple, saddle, torus…)
│   │           └── protein.ts        # Alpha-helix protein chain
│   │
│   ├── api/                          # Next.js API Routes
│   │   ├── agentic/
│   │   │   └── biosim/route.ts       # 🆕 Gemini → SceneDescriptor
│   │   ├── ai/
│   │   │   └── generate-document/    # Homework / exam generation (Vertex AI)
│   │   ├── auth/[...nextauth]/       # NextAuth.js handlers
│   │   ├── admin/                    # Admin-only endpoints
│   │   ├── chat/messages/            # Lounge real-time chat (Pusher)
│   │   ├── citations/                # Academic citation engine
│   │   ├── cyber/                    # Cyber Room data
│   │   ├── feed/                     # Social feed posts / comments
│   │   ├── gemini/                   # Direct Gemini streaming
│   │   ├── network/request/          # Connection requests
│   │   ├── news/                     # Zaeon news posts
│   │   ├── plugins/                  # Plugin store CRUD
│   │   ├── posts/                    # Study room posts
│   │   ├── research/                 # Research workspace
│   │   ├── teacher/                  # Teacher document management
│   │   ├── user/                     # User profile / avatar / skills
│   │   ├── user-space/               # Persistent layout / notes state
│   │   └── workspace/                # Workspace state
│   │
│   ├── about/                        # About page
│   ├── plugin-store/                 # Plugin marketplace
│   ├── research-lab/                 # Research lab workspace
│   ├── study-rooms/                  # Study rooms hub
│   │   ├── page.tsx                  # Rooms index
│   │   ├── bio/                      # Biology room
│   │   ├── cyber/                    # Computer Science room
│   │   ├── humanities/               # Humanities room
│   │   ├── lounge/                   # Social lounge (chat, feed)
│   │   ├── med/                      # Medicine / Health Sciences room
│   │   └── quantic/                  # Math / Physics / Quantic room
│   └── workstation/                  # Main workstation
│       ├── page.tsx                  # Student workstation (RPG profile)
│       ├── WorkStationContent.tsx
│       ├── [id]/                     # Social profiles (visit)
│       ├── admin/                    # Admin dashboard
│       ├── profiles/                 # Network mural
│       └── teacher/                  # Teacher workstation
│           ├── layout.tsx            # Teacher sidebar layout
│           ├── AgenticAreaContent.tsx # 🆕 Aura + BioSim3D
│           ├── FinancesContent.tsx
│           ├── LoungeContent.tsx
│           ├── ResearchAreaContent.tsx
│           ├── WorkAreaContent.tsx    # Homework / exam generator
│           └── [module]/             # Dynamic teacher modules
│
├── components/
│   ├── main/
│   │   ├── navbar.tsx                # Top navigation bar
│   │   ├── star-background.tsx       # MatrixRain particle background
│   │   ├── OnboardModal.tsx          # User onboarding flow
│   │   ├── ParticleSystem.tsx
│   │   ├── footer.tsx
│   │   └── GlobalClickSound.tsx      # Audio feedback system
│   ├── sub/
│   │   ├── LoungeChatWidget.tsx      # Floating global chat widget
│   │   └── MenuNavigation.tsx        # Study room navigation
│   └── ui/                           # Shared UI primitives
│
├── config/                           # Site configuration (metadata, SEO)
├── constants/                        # App-wide constants
├── lib/
│   └── utils.ts                      # cn() and utility helpers
├── prisma/
│   └── schema.prisma                 # MongoDB schema (Prisma ODM)
├── public/                           # Static assets
├── src/
│   ├── context/Web3Context.tsx        # Wagmi / Web3 provider
│   ├── i18n.ts                       # i18next multilingual setup
│   ├── lib/auth.ts                   # NextAuth config (Google OAuth, Email)
│   └── providers/SessionProvider.tsx
├── backend/                          # Express server utilities
├── server.js                         # Custom Next.js + Socket.io server
├── next.config.mjs                   # Next.js configuration
├── tailwind.config.ts                # Tailwind CSS config
├── tsconfig.json                     # TypeScript config
└── prisma/schema.prisma              # Database schema
```

---

## 🛣️ API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/agentic/biosim` | 🆕 Gemini → SceneDescriptor for BioSim3D |
| POST | `/api/ai/generate-document` | Generate homework/exam via Vertex AI |
| GET/POST | `/api/auth/[...nextauth]` | NextAuth authentication |
| GET/POST | `/api/feed` | Social feed posts |
| GET/POST | `/api/posts` | Study room posts |
| POST | `/api/chat/messages` | Lounge real-time chat |
| GET/POST | `/api/user` | User profile |
| PATCH | `/api/user/avatar` | Upload compressed avatar |
| GET/PUT | `/api/user/skills` | RPG skill tree (XP, rank) |
| GET/PUT | `/api/user-space` | Persistent workspace state |
| GET/POST | `/api/network/request` | Connection request send/accept |
| GET/POST | `/api/research` | Research workspace data |
| GET/POST/DELETE | `/api/teacher` | Teacher documents |
| GET/POST | `/api/plugins` | Plugin store listing |
| GET/POST | `/api/news` | News posts (admin) |
| GET/POST | `/api/citations` | Academic citation engine |
| POST | `/api/gemini` | Streaming Gemini responses |
| GET | `/api/admin` | Admin dashboard data |

---

## 🗄️ Database Architecture (MongoDB via Prisma)

**Database:** MongoDB Atlas  
**ORM:** Prisma 6.x  
**Provider string:** `mongodb`

### Core Models

#### `User`
Primary identity model — mapped to NextAuth's `users` collection.
```
id              ObjectId    Primary key
name            String?     Display name
email           String?     @unique — used for auth
image           String?     Avatar URL or Base64

// Academic profile
course          String?     e.g. "Ciências Biológicas"
bio             String?
age             Int?
gender          String?     "masculino"|"feminino"|"lgbtqi+"
countryCode     String?     Flag code for onboarding
role            String?     "student"|"teacher"|"professor"
academicLevel   String      "Graduação"|"Mestrado"|"Doutorado"

// Gamification
level           Int         @default(1)
streak          Int         @default(0)
xp              Int         @default(0)
skills          Json?       { writing, focus, collab, participation }

// Web3 identity
walletAddress   String?
identityId      String?
kycStatus       String      "pending"|"approved"|"rejected"

// Relations
accounts        Account[]
sessions        Session[]
posts           Post[]
sentMessages    Message[]   @relation("SentMessages")
sentRequests    ConnectionRequest[] @relation("SentRequests")
teacherStudents TeacherStudent[]   @relation("TeacherStudents")
teacherDocuments TeacherDocument[]
```

#### `UserSpaceData`
Persistent workspace state (layout, notes, history) — one per user.
```
userId          ObjectId    @unique
layout          Json?       Window positions
settings        Json?       Theme preferences
chatHistory     Json?       Aura / AI conversations
schedule        Json?       Study schedule
stickyNote      String?
objectives      Json?       Research objectives
```

#### `Post`
Study room posts (social feed per room).
```
id              ObjectId
title           String?
content         String
tags            String[]
images          String[]    Max 5 base64/URLs
room            String      "cyber"|"bio"|"med"|"quantic"|"humanities"
userId          ObjectId?   → User
comments        Comment[]
```

#### `TeacherDocument`
AI-generated homework/exams created by teachers.
```
id              ObjectId
teacherId       ObjectId    → User (teacher)
title           String
type            String      "tarefa"|"prova"
subject         String?
questions       Json        Array<{ number, statement, type, options, answer }>
headerImage     String?     Institution logo (Base64)
status          String      "draft"|"published"
assignedTo      String[]    Array of student IDs
```

#### `TeacherStudent`
Teacher-to-student assignment relationship (no approval needed).
```
teacherId       ObjectId    → User
studentId       ObjectId    → User
@@unique([teacherId, studentId])
```

#### `ConnectionRequest`
Academic networking requests (like LinkedIn).
```
senderId        ObjectId    → User
receiverId      ObjectId    → User
message         String
status          String      "PENDING"|"ACCEPTED"|"REJECTED"
```

#### `Message`
Direct messages between users (Pusher-powered).
```
senderId        ObjectId    → User
receiverId      ObjectId    → User
text            String
```

#### Other models: `Plugin`, `Post`, `Comment`, `NewsPost`, `PersonalPhoto`, `SystemLog`, `SystemSetting`

---

## 🎨 Visual Design System

### Typography

| Variable | Font | Usage |
|----------|------|-------|
| `--font-space` | Space Grotesk | Primary UI text, headings |
| `--font-code` | JetBrains Mono | Code blocks, technical data |
| `--font-outfit` | Outfit | Display text, hero elements |
| `Cedarville Cursive` | (Google Fonts) | `.cursive` accent text |

Loaded via `next/font/google` in `app/layout.tsx`.

### CSS Custom Properties (Dark / Light Mode)

Defined in `app/globals.css` via `@layer base`:

```css
/* ─── Light Mode ─────────────────────────── */
:root {
  --background: #f8fafc;   /* slate-50 */
  --foreground: #0f172a;   /* slate-900 */
}

/* ─── Dark Mode ──────────────────────────── */
.dark {
  --background: #030014;   /* deep space indigo */
  --foreground: #ffffff;
}
```

### Tailwind Color Tokens (thematic rooms)

| Room | Primary | Accent | Background (dark) |
|------|---------|--------|-------------------|
| Bio | `emerald-400` | `#22c55e` | `bg-emerald-500/10` |
| Med | `rose-400` | `#f87171` | `bg-rose-500/10` |
| Quantic | `indigo-400` | `#818cf8` | `bg-indigo-500/10` |
| Cyber | `cyan-400` | `#22d3ee` | `bg-cyan-500/10` |
| Humanities | `amber-400` | `#f59e0b` | `bg-amber-500/10` |

### Glass Morphism Design Language

Zaeon uses a consistent glass-card pattern throughout:
```css
/* Glass card — dark mode */
bg-white/5 dark:bg-black/20
backdrop-blur-2xl
border border-white/60 dark:border-white/10
shadow-[0_8px_30px_rgb(0,0,0,0.2)]
rounded-[2rem]

/* Glow blobs (background decoration) */
.glow-blob {
  background: radial-gradient(circle, <accent-color>/10 0%, transparent 70%);
  filter: blur(80px);
  border-radius: 50%;
}
```

### Global CSS Utilities

| Class | Effect |
|-------|--------|
| `.cursive` | Cedarville Cursive font |
| `.Welcome-text` | Gradient text (violet → blue) |
| `.Welcome-box` | Glassmorphism pill component |
| `.button-primary` | Glowing purple CTA button |
| `.scrollbar-hidden` | Hides scrollbar cross-browser |

### Dark / Light Mode Implementation

- Managed by `next-themes` via `<ThemeProvider attribute="class" defaultTheme="dark">`
- CSS class `.dark` on `<html>` triggers all dark-mode Tailwind variants
- Transition: `transition: background-color 0.3s ease, color 0.3s ease`
- Theme toggle in `<Navbar />` sets `useTheme().setTheme()`

### Gender-Adaptive Themes (Workstation)

The `WorkStationPage` dynamically adjusts its color theme based on user gender profile:

| Gender | Theme |
|--------|-------|
| Feminino | Rose / Fuchsia palette, `bg-[#1a0a13]` dark base |
| Masculino | Blue / Cyan palette, `bg-[#050a1f]` dark base |
| Default / LGBTQI+ | Slate / Cyan, `bg-[#030014]` dark base |

---

## 🧬 BioSim 3D Engine (Agentic Module)

### Architecture

```
User prompt / preset click
        │
        ▼
┌─────────────────────────┐
│  BioSim3DModule.tsx     │  ← UI: presets, prompt, canvas wrapper
│  (React, "use client")  │
└────────┬────────────────┘
         │
    ┌────┴────────────────────────────────┐
    │    Gemini API                       │
    │    POST /api/agentic/biosim         │
    │    → SceneDescriptor JSON           │
    └────┬────────────────────────────────┘
         │
    ┌────▼────────────────────────────────┐
    │  buildVoxels(mode, params)          │  ← voxelGenerators/index.ts
    │  → VoxelBlock[]                     │
    └────┬────────────────────────────────┘
         │
    ┌────▼────────────────────────────────┐
    │  VoxelCanvas.tsx                    │  ← Three.js InstancedMesh
    │  @react-three/fiber + drei          │
    │  OrbitControls, auto-rotate, fog    │
    └─────────────────────────────────────┘
```

### Voxel Generators

Each generator is a pure TypeScript function:  
`(params: SceneParameters) => VoxelBlock[]`

| Generator | Structures | Key Algorithm |
|-----------|-----------|---------------|
| `dna.ts` | DNA helix, RNA strand | Sinusoidal parametric path, base-pair fill |
| `molecule.ts` | H₂O, CO₂, CH₄, adenine, glucose, NaCl | Pre-built CPK layouts + 3D Bresenham line |
| `cell.ts` | Plant cell, animal cell | Sphere shell algorithm + box organelles |
| `plant.ts` | Tree, flower, fern, seed | Recursive branching, leaf pads |
| `plant.ts` | Mushroom, mycelium | Hemisphere + recursive stochastic growth |
| `animal.ts` | Horse, dog, human, fish | Joint-based box & line anatomy |
| `quantum.ts` | 1s, 2p, 3d orbitals | Probability density functions → stochastic blocks |
| `math.ts` | Ripple, saddle, paraboloid, torus | Discrete function evaluation → height map |
| `protein.ts` | Alpha-helix | 3.6 residues/turn parametric helix + H-bond render |

### SceneDescriptor JSON Schema

```typescript
interface SceneDescriptor {
  renderMode: 'dna'|'rna'|'molecule'|'crystal'|'cell'|'plant'|
              'fungus'|'animal'|'quantum'|'atom'|'math'|'protein';
  title:       string;          // e.g. "DNA Double Helix"
  description: string;          // 2-3 sentence educational text
  hint?:       string;          // "Blue blocks = Oxygen"
  parameters:  SceneParameters; // mode-specific (see types.ts)
  accentColor?: string;         // hex, e.g. "#22c55e"
  backgroundColor?: string;     // hex, default "#030014"
}
```

### Room Preset Catalog

Each study room has 8 curated presets:

| Room | Presets include |
|------|----------------|
| **bio** | DNA, Plant Cell, Animal Cell, Fungus, Plant, Fern, Protein, Glucose |
| **med** | Human Cell, CRISPR DNA, Protein, H₂O, Glucose, Adenine, DNA, NaCl Crystal |
| **quantic** | 1s Orbital, 2p Orbital, 3d Orbital, Ripple Wave, Saddle Surface, Crystal, DNA, H₂O |
| **cyber** | Wave Surface, Saddle, Crystal Lattice, 2p Orbital, DNA, H₂O, Protein, mRNA |
| **humanities** | Plant, Horse Skeleton, DNA, Human Cell, Mushroom, Crystal, Wave Math, Fern |

---

## 🚀 Developer Setup

### Prerequisites
- Node.js 20+, npm/yarn
- MongoDB Atlas connection string
- Google Cloud project with Vertex AI enabled
- Google OAuth credentials (for NextAuth)
- **Python 3.10+ and LibreOffice** — required only for the `abnt-service` backend (ABNT document export). Install LibreOffice with `brew install libreoffice` (macOS) or `sudo apt install libreoffice` (Linux).

### Environment Variables (`.env.local`)

```bash
# Database
DATABASE_URL="mongodb+srv://..."

# Authentication
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Google AI / Vertex AI
GOOGLE_CREDENTIALS='{"project_id":"...","client_email":"...","private_key":"..."}'
GOOGLE_PROJECT_ID="your-gcp-project"
GOOGLE_LOCATION="us-central1"

# Real-time (Pusher)
NEXT_PUBLIC_PUSHER_KEY="..."
PUSHER_APP_ID="..."
PUSHER_SECRET="..."
PUSHER_CLUSTER="..."

# Redis (Upstash)
UPSTASH_REDIS_REST_URL="..."
UPSTASH_REDIS_REST_TOKEN="..."

# ABNT backend (Python microservice — see "Run Locally")
# Where the Next app reaches the abnt-service. Defaults to http://localhost:8001 if unset.
ABNT_SERVICE_URL="http://localhost:8001"

# Voice engine (TTS neural — OPCIONAL; ver "Run Locally", Terminal 3)
# Sem isto, a voz usa o sintetizador do navegador (Web Speech). Default http://localhost:8004.
VOICE_ENGINE_URL="http://localhost:8004"

# Omega Scholar research agent (academic full-text)
UNPAYWALL_EMAIL="you@example.com"   # any email you control — Unpaywall's politeness/contact field
CORE_API_KEY=""                     # optional; free key from core.ac.uk. CORE is skipped if unset
```

### Run Locally

The app runs as **two processes**: the Next.js frontend/API, and the `abnt-service` Python backend it calls for ABNT document export. Run each in its own terminal.

**Terminal 1 — Next.js app** (frontend + API routes + Socket.IO, port 3000):

```bash
npm install
npx prisma generate
npm run dev             # → http://localhost:3000  (runs server.js, not `next dev`)
```

`npm run dev` is the only entry point for the web app — it executes the custom `server.js`, which boots Next.js **and** the Socket.IO server together. (`npm run build` then `npm start` is the production equivalent.)

**Terminal 2 — `abnt-service` backend** (FastAPI, port 8001):

```bash
cd abnt-service
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001 --reload   # → http://localhost:8001
```

The Next app reaches it via `ABNT_SERVICE_URL` (default `http://localhost:8001`). It's only needed for ABNT export — the rest of the app runs without it, but ABNT export will show "Serviço ABNT offline" until it's up. Quick check: `curl http://localhost:8001/health`. See `abnt-service/README.md` for details.

**Terminal 3 — `voice-engine` (OPCIONAL — só para a voz NEURAL; FastAPI, porta 8004):**

```bash
cd voice-engine
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --port 8004     # → http://localhost:8004  (Kokoro baixa os pesos no 1º uso)
```

O modo voz **funciona sem este serviço**: o ditado usa o reconhecimento do navegador (Web Speech) e os
botões de "Ouvir" (🔊) caem na voz do navegador (`speechSynthesis`). O `voice-engine` só troca a voz por
uma neural de melhor textura (Kokoro/Piper) via `VOICE_ENGINE_URL`. Quick check: `curl http://localhost:8004/health`.
Detalhes em `voice-engine/README.md`. Modo de voz **passivo/ativo** fica no toggle do widget de chat.

> **Tests:** `npm test` (Vitest) runs the `lib/scholar/*` unit suite; `npm run test:watch` for watch mode.

---

## 🏆 Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3, Framer Motion |
| 3D Engine | Three.js r160, @react-three/fiber, @react-three/drei |
| AI | Google Gemini 2.0 Flash (Vertex AI) |
| Database | MongoDB 6 + Prisma 6 |
| Auth | NextAuth.js 4 (Google OAuth) |
| Real-time | Pusher + Socket.io |
| Cache | Redis (Upstash) |
| Web3 | Viem, Ethers.js, Wagmi |
| Fonts | Space Grotesk, JetBrains Mono, Outfit |

---

Built with hardcore love ❤️ — Zaeon Team