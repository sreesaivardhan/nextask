<div align="center">

# NexTask

### AI-Powered Collaborative Kanban — Built for Production

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white&style=flat-square)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white&style=flat-square)](https://www.typescriptlang.org)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white&style=flat-square)](https://expressjs.com)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=nodedotjs&logoColor=white&style=flat-square)](https://nodejs.org)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white&style=flat-square)](https://www.prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white&style=flat-square)](https://neon.tech)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socketdotio&logoColor=white&style=flat-square)](https://socket.io)
[![Gemini](https://img.shields.io/badge/Google_Gemini-AI-4285F4?logo=google&logoColor=white&style=flat-square)](https://ai.google.dev)
[![Render](https://img.shields.io/badge/Backend-Render-46E3B7?logo=render&logoColor=white&style=flat-square)](https://render.com)
[![Vercel](https://img.shields.io/badge/Frontend-Vercel-000000?logo=vercel&logoColor=white&style=flat-square)](https://vercel.com)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

**[Live Demo](https://nextask-flame.vercel.app) · [Backend API](https://nexttask-backend.onrender.com/health) · [GitHub](https://github.com/sreesaivardhan/nextask)**

</div>

---

NexTask is a **production-grade, AI-powered collaborative Kanban platform** that helps engineering teams move faster and smarter. It combines real-time multi-user synchronization with an autonomous AI scheduler — continuously analyzing board health, predicting sprint risks, detecting bottlenecks, and surfacing actionable insights without any manual input.

Built on a modern full-stack architecture with **React + Express + Prisma + Socket.IO + Google Gemini**, NexTask is deployed across **Vercel**, **Render**, and **Neon PostgreSQL**.

---

## Features

### Real-Time Collaboration
| Feature | Description |
|---|---|
| **Live Kanban Board** | Multiple users edit the same board simultaneously with zero refresh |
| **Drag & Drop** | Fluid card sorting and column transitions with @dnd-kit |
| **Socket.IO Sync** | All mutations (move, edit, comment, delete) broadcast instantly to every connected client |
| **Conflict Resolution** | Optimistic concurrency via `version` field — HTTP 409 + UI dialog on simultaneous edits |
| **Activity Logs** | Full audit trail of every board action |

### AI Project Manager
| Feature | Description |
|---|---|
| **Bottleneck Detection** | Identifies over-loaded columns vs. historical averages |
| **Sprint Risk Assessment** | Computes completion probability from velocity + remaining sprint days |
| **Deadline Prediction** | Flags individual cards at risk of missing the sprint deadline |
| **Story Point Suggestions** | Gemini infers complexity on a Fibonacci scale from card title + description |
| **Weekly Digest** | Auto-generated 7-day velocity summaries with trend analysis |
| **AI Insights Panel** | Dedicated in-app dashboard streaming AI findings asynchronously |

### GitHub Integration
| Feature | Description |
|---|---|
| **Issue Import** | Import issues from any public GitHub repository |
| **Pagination** | Handles multi-page API responses via `Link` header traversal |
| **Deduplication** | Composite unique index prevents duplicate imports (`boardId + repo + issueNumber`) |
| **Label Mapping** | Converts GitHub labels into NexTask labels automatically |

### Authentication
| Feature | Description |
|---|---|
| **Email / Password** | Bcrypt-hashed local auth with email verification flow |
| **Google OAuth** | One-click sign-in via Google |
| **GitHub OAuth** | One-click sign-in via GitHub |
| **Forgot / Reset Password** | Cryptographically secure one-time tokens via email |
| **Persistent Sessions** | Express sessions stored in PostgreSQL — survive backend restarts |

### Team Management
| Feature | Description |
|---|---|
| **Role-Based Access** | Owner · Admin · Member · Viewer permissions |
| **Board Sharing** | Invite collaborators by email |
| **Comments** | Contextual card-level discussion |
| **Assignments** | Assign cards to board members |
| **Dashboard Analytics** | Cross-board velocity, completion rates, WIP trends |

### Chrome Extension
Clip text or full URLs from any webpage directly into a NexTask card — without leaving your browser tab.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Vercel (Frontend)                    │
│              React · Vite · Tailwind · Zustand          │
└────────────────────────┬────────────────────────────────┘
                         │  HTTPS + WebSocket
┌────────────────────────▼────────────────────────────────┐
│                   Render (Backend)                      │
│           Express · TypeScript · Prisma · Socket.IO     │
│   ┌──────────────┐  ┌──────────────┐  ┌─────────────┐   │
│   │  REST API    │  │  Socket.IO   │  │ AI Scheduler│   │
│   │  /api/*      │  │  WS Rooms    │  │  (Gemini)   │   │
│   └──────────────┘  └──────────────┘  └─────────────┘   │
└────────────────────────┬────────────────────────────────┘
                         │  Pooled Connection (pgbouncer)
┌────────────────────────▼────────────────────────────────┐
│                   Neon PostgreSQL                       │
│           Serverless · Pooled · Auto-scaling            │
└─────────────────────────────────────────────────────────┘
```

**Request lifecycle:**
1. User action → REST API call
2. Backend validates, persists to Neon via Prisma
3. Success → Socket.IO broadcasts mutation to all room members
4. All connected clients apply the event to local Zustand state instantly

**AI lifecycle:**
- Background scheduler fires every N minutes (configurable via `AI_ANALYSIS_INTERVAL_MINUTES`)
- Gemini API analyzes board state independently of the request lifecycle
- Results are written to `AIInsight` records and pushed to connected clients via Socket.IO

---

## Tech Stack

| Layer | Technology |
|:---|:---|
| **Frontend** | React 19, TypeScript, Tailwind CSS, Vite, Zustand, @dnd-kit |
| **Backend** | Node.js 20, Express 4, TypeScript |
| **Database** | Neon PostgreSQL, Prisma ORM 5 |
| **Realtime** | Socket.IO 4 |
| **Auth** | Express-Session, bcrypt, Google OAuth, GitHub OAuth |
| **AI** | Google Gemini API (`@google/genai`) |
| **Email** | Nodemailer (Gmail SMTP) |
| **Deployment** | Vercel (frontend) · Render (backend) · Neon (database) |
| **Extension** | Chrome Manifest V3, React, Vite |

---

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL (local) or a [Neon](https://neon.tech) account
- Google Gemini API key

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/sreesaivardhan/nextask.git
cd nextask

# 2. Install server dependencies
cd server && npm install

# 3. Install client dependencies
cd ../client && npm install
```

### Database Setup

```bash
cd server

# Apply migrations to your local database
npx prisma migrate dev

# Generate the Prisma client
npx prisma generate
```

### Running Locally

```bash
# Terminal 1 — Backend (http://localhost:3001)
cd server
npm run dev

# Terminal 2 — Frontend (http://localhost:5173)
cd client
npm run dev
```

---

## Environment Variables

Create a `server/.env` file with the following variables:

```env
# ─── Database ─────────────────────────────────────────────────────────────────
# For Neon: use the pooled connection string for DATABASE_URL
# and the direct connection string for DIRECT_URL
DATABASE_URL="postgresql://user:password@host:6543/neondb?pgbouncer=true"
DIRECT_URL="postgresql://user:password@host:5432/neondb"

# For local development, both can point to the same Postgres instance:
# DATABASE_URL="postgresql://postgres:password@localhost:5432/nextask"
# DIRECT_URL="postgresql://postgres:password@localhost:5432/nextask"

# ─── App ──────────────────────────────────────────────────────────────────────
NODE_ENV=development
PORT=3001
SESSION_SECRET="replace_with_64_char_random_string"

# ─── URLs ─────────────────────────────────────────────────────────────────────
# Comma-separated list of allowed client origins
CLIENT_URL="http://localhost:5173"
# Public URL of this backend (used to construct OAuth callback URLs)
SERVER_URL="http://localhost:3001"

# ─── AI ───────────────────────────────────────────────────────────────────────
GEMINI_API_KEY="your_google_gemini_api_key"
AI_ANALYSIS_INTERVAL_MINUTES=360

# ─── Google OAuth ─────────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# ─── GitHub OAuth ─────────────────────────────────────────────────────────────
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""

# ─── GitHub API (for issue import) ────────────────────────────────────────────
GITHUB_TOKEN=""

# ─── Email (Gmail App Password) ───────────────────────────────────────────────
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your_email@gmail.com"
SMTP_PASS="your_gmail_app_password"
SMTP_FROM="NexTask <your_email@gmail.com>"
```

> **Generate a strong session secret:**
> ```bash
> openssl rand -hex 64
> ```

---

## Production Deployment

NexTask is deployed across three services:
Database - Neon PostgreSQL

| Service | Platform | URL |
|---|---|---|
| Frontend | Vercel | https://nextask-flame.vercel.app |
| Backend | Render | https://nexttask-backend.onrender.com |

### Backend (Render)

| Setting | Value |
|---|---|
| **Root Directory** | `server` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start:prod` |
| **Health Check Path** | `/health` |

The `build` script runs `prisma generate && tsc`.  
The `start:prod` script runs `prisma migrate deploy && node dist/server.js` — automatically applying pending schema migrations on every deploy.

**Required Render environment variables:**

```
DATABASE_URL    → Neon pooled connection string (port 6543, pgbouncer=true)
DIRECT_URL      → Neon direct connection string (port 5432)
SESSION_SECRET  → 64-char random string
CLIENT_URL      → https://nextask-flame.vercel.app
SERVER_URL      → https://nexttask-backend.onrender.com
NODE_ENV        → production
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
GITHUB_TOKEN
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM
GEMINI_API_KEY
AI_ANALYSIS_INTERVAL_MINUTES
```

### Frontend (Vercel)

Set a single environment variable in Vercel → Project Settings → Environment Variables:

```
VITE_API_URL=https://nexttask-backend.onrender.com
```

### OAuth Callback URLs

After deploying, register these exact URLs:

**Google Cloud Console → Authorized Redirect URIs:**
```
https://nexttask-backend.onrender.com/api/auth/google/callback
```

**GitHub → OAuth App → Authorization callback URL:**
```
https://nexttask-backend.onrender.com/api/auth/github/callback
```

### Neon Connection Pooling

NexTask uses Neon's PgBouncer integration to maximise connection efficiency:

- `DATABASE_URL` → pooled endpoint (port **6543**, `?pgbouncer=true`) — used by Prisma for all queries
- `DIRECT_URL` → direct endpoint (port **5432**) — used only by `prisma migrate deploy`

This prevents connection exhaustion on Neon's serverless infrastructure under concurrent Socket.IO sessions.

---

## Chrome Extension

The NexTask Chrome Extension lets you clip selected text or page URLs directly into a Kanban card from any website.

### Build & Install

```bash
cd extension
npm install
npm run build
```

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select `extension/dist/`
4. Click the NexTask icon, log in, and start clipping

> The extension communicates directly with the production backend at `https://nexttask-backend.onrender.com`. Sessions are shared with the web app via the `connect.sid` cookie using a custom `X-Extension-Session` header to work around Chrome's cross-origin cookie restrictions.

---

## Project Structure

```
nextask/
├── client/                 # React + Vite frontend (Vercel)
│   └── src/
│       ├── components/     # Reusable UI components
│       ├── layouts/        # Page wrappers (AppLayout, AuthLayout)
│       ├── pages/          # Route-level components
│       ├── services/       # API client, Socket.IO service
│       ├── stores/         # Zustand state management
│       └── routes/         # React Router configuration
│
├── server/                 # Express + Prisma backend (Render)
│   ├── prisma/
│   │   ├── schema.prisma   # Database schema
│   │   └── migrations/     # Applied migration history
│   └── src/
│       ├── config/         # env.ts, cors.ts, session.ts
│       ├── controllers/    # Route handlers
│       ├── services/       # Business logic, AI, OAuth, Email
│       ├── repositories/   # Prisma data-access layer
│       ├── middleware/      # Auth, error handler, logger
│       ├── routes/         # Express router definitions
│       ├── socket/         # Socket.IO initialisation + rooms
│       └── utils/          # Shared helpers
│
└── extension/              # Chrome Extension (Manifest V3)
    └── src/
        ├── popup/          # React popup UI
        ├── background/     # Service worker
        └── content/        # Content script (text selection)
```

---

## Real-Time Architecture

The real-time layer uses **Socket.IO over WebSocket** with a session-sharing bridge.

- **Board rooms:** Each board lives in an isolated Socket.IO room (`boardId`). Clients subscribe on load and unsubscribe on navigate.
- **User rooms:** Every authenticated socket auto-joins a `user:<id>` room — enabling notifications like "board shared with you" to reach the dashboard without the user being inside a board.
- **Mutation flow:** REST → PostgreSQL → Socket.IO broadcast. No polling. Zero latency between persistence and client update.
- **Reconnection:** `reconnectionAttempts: Infinity` with exponential backoff. Board room automatically re-joined after reconnect.
- **Session bridge:** Socket.IO engine shares the Express session middleware, making `req.session.userId` available on every connected socket for server-side authorization.

---

## AI Methodology

NexTask's AI scheduler operates **asynchronously and independently** — it never blocks the request lifecycle.

| Analysis | Method |
|---|---|
| **Bottleneck Detection** | Compares current column card counts against rolling averages; flags deviation > 1.5σ |
| **Sprint Risk** | `(completed SP / total SP) vs (elapsed days / total sprint days)` → confidence interval |
| **Deadline Prediction** | Per-card: complexity × assignee load × remaining sprint days → deadline risk score |
| **Story Point Inference** | Gemini prompted with card title + description → Fibonacci estimate with reasoning |
| **Weekly Digest** | 7-day velocity aggregation, WIP trend, top bottleneck, AI-generated recommendations |

All results are written to the `AIInsight` and `WeeklyDigest` tables and pushed to the client via Socket.IO — the UI updates without any polling.

---

## Concurrent User Testing

NexTask was validated under simultaneous multi-user workloads across multiple isolated browser sessions:

| Scenario | Result |
|---|---|
| Card move sync across browsers | ~30ms observed latency locally |
| Simultaneous card edit (409 conflict) | Conflict dialog shown correctly — zero silent data loss |
| Socket disconnect + reconnect | Board room rejoined automatically, no duplicate events |
| 10+ concurrent users on one board | Stable — no data races or silent overwrites observed |

---

## Future Improvements

| Feature | Status |
|---|---|
| Dependency mapping (blocking relationships) | Planned |
| Time tracking (estimated vs actual) | Planned |
| Public read-only board links | Planned |
| Mobile-responsive PWA | Planned |
| Webhook-based GitHub sync | Planned |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---