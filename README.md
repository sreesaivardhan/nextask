# NexTask

> Project management platform.

NexTask is a full-stack project management platform built on a clean, scalable architecture.

Built for the Alfaleus Full Stack Assignment.

---

## Tech Stack

| Layer      | Technology                                      |
|------------|-------------------------------------------------|
| Frontend   | React 19, Vite, TypeScript, TailwindCSS, Zustand, React Router |
| Backend    | Node.js, Express, TypeScript, Socket.io         |
| Database   | PostgreSQL, Prisma ORM                          |
| Shared     | TypeScript types                                |

---

## Project Structure

```
NexTask/
├── client/          # Vite + React frontend
├── server/          # Express + Socket.io backend
├── shared/          # Shared TypeScript types
├── .env.example     # Environment variable template
├── CONTRACT.md      # Full API & Socket contract
└── README.md
```

---

## Prerequisites

- Node.js ≥ 18
- PostgreSQL ≥ 14
- npm ≥ 9

---

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd NexTask

# Install all workspace dependencies
cd client && npm install && cd ..
cd server && npm install && cd ..
cd shared && npm install && cd ..
```

### 2. Configure environment

```bash
cp .env.example server/.env
# Edit server/.env with your values
```

### 3. Set up the database

```bash
cd server
npm run prisma:migrate   # Run initial migration
npm run prisma:generate  # Generate Prisma client
```

### 4. Start development servers

```bash
# Terminal 1 — Backend
cd server && npm run dev

# Terminal 2 — Frontend
cd client && npm run dev
```

- Frontend: http://localhost:5173
- Backend:  http://localhost:3001
- Health:   http://localhost:3001/health

---

## Available Scripts

### Client (`cd client`)

| Script            | Description                  |
|-------------------|------------------------------|
| `npm run dev`     | Start Vite dev server        |
| `npm run build`   | Production build             |
| `npm run lint`    | Run ESLint                   |
| `npm run format`  | Run Prettier                 |
| `npm run preview` | Preview production build     |

### Server (`cd server`)

| Script                   | Description                    |
|--------------------------|--------------------------------|
| `npm run dev`            | Start with nodemon             |
| `npm run build`          | Compile TypeScript             |
| `npm run start`          | Run compiled output            |
| `npm run lint`           | Run ESLint                     |
| `npm run format`         | Run Prettier                   |
| `npm run prisma:migrate` | Run database migrations        |
| `npm run prisma:generate`| Generate Prisma client         |
| `npm run prisma:studio`  | Open Prisma Studio             |

---

## GitHub Issues Import

The GitHub Import feature is designed for high-performance and real-time responsiveness.
- **Pagination**: Fully supported natively using GitHub's `Link` headers.
- **Pull Requests**: Ignored automatically.
- **Deduplication**: Incremental imports safely ignore duplicates.
- **Import Limit**: The import is intentionally capped to the newest 20 issues.

*Reason*: This limit preserves real-time Socket.IO responsiveness and respects Railway Free Tier CPU/RAM constraints by bounding the heavy board-wide AI recalculations. The importer still fully supports pagination internally to locate 20 importable issues even if the first pages contain only pull requests or already imported issues.

---

## API Contract

See [CONTRACT.md](./CONTRACT.md) for the full REST and Socket.io contract.

---

## Health Check

```
GET /health
→ { "status": "ok" }
```