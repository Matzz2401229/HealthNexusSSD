# HealthNexus (SSD Group Project — Deliverable 2)

Secure, role-based telemedicine + EHR **Progressive Web App**. Handles PHI, so
security is a core requirement. Four roles: **patient, doctor, pharmacist, admin**.
Group 5 "Gunners".

> This is the D2 implementation skeleton. Feature logic is stubbed with `TODO`s
> mapped to the workstreams in the D1 design brief §8. Security controls live
> server-side and are deny-by-default.

## Stack
- **Frontend:** React PWA (React Router, Bootstrap, Workbox via vite-plugin-pwa)
- **Backend:** Node.js + TypeScript (Express)
- **Database:** MySQL 8
- **Reverse proxy:** nginx (TLS on 443, security headers, rate limiting)
- **Containers:** Docker + Docker Compose (non-root)

## Repository layout
```
├── docker-compose.yml       # local stack: nginx -> frontend + backend -> MySQL
├── .env.example             # env template (copy to .env; never commit .env)
├── nginx/nginx.conf         # TLS termination, HTTP->HTTPS, security headers, rate limits
├── db/init.sql              # schema (D1 §9.7) + restricted app DB user
├── docs/diagrams/           # DFD, architecture, class + login sequence diagrams
├── backend/
│   └── src/
│       ├── config/          # validated env config (secrets from env only)
│       ├── db/              # parameterised-query pool
│       ├── middleware/      # auth, rbac, ownership/IDOR, validation, csrf, fileUpload, securityHeaders, errorHandler
│       ├── services/        # auth, audit (append-only hash-chained)
│       ├── controllers/     # HTTP layer
│       ├── routes/          # route wiring
│       └── utils/           # password policy/hashing, logger
│   └── tests/               # password / rbac / fileUpload unit tests
└── frontend/                # React PWA skeleton
```
The `backend/src/middleware/` folder is a 1:1 match to the D1 "Security
Middleware" box — see the D1 design brief §3 for the security acceptance checklist.

## Getting started (every team member)

### 1. Prerequisites (install once on your machine)
| Tool | Why | Notes |
|---|---|---|
| **Node.js 20 LTS** | run backend + frontend | matches the `node:20` Docker images |
| **npm** | install dependencies | ships with Node |
| **Git** | clone / branch / PR | — |
| **Docker Desktop** | full-stack run + MySQL | only needed for `docker compose up`; must be running |

> `node_modules/` is **not** in git by design — everyone installs dependencies
> locally with `npm install`. Nothing is installed globally.

### 2. One-time repo setup
```bash
git clone https://github.com/Matzz2401229/HealthNexusSSD.git
cd HealthNexusSSD
git checkout main && git pull

cd backend  && npm install && cd ..     # backend dependencies
cd frontend && npm install && cd ..     # frontend dependencies

cp .env.example .env                     # local env file (never committed)
```

### 3. Run it — three options

**A. Frontend only (fastest, see the PWA UI — no DB/backend needed)**
```bash
cd frontend && npm run dev               # http://localhost:3000
```

**B. Backend only (boots + serves /api health; DB calls need a database)**
```bash
cd backend && npm run dev                # http://localhost:8080
# check:  curl http://localhost:8080/health   -> {"status":"ok"}
```

**C. Full stack via Docker (nginx TLS -> frontend + backend -> MySQL)**
> nginx needs a TLS cert/key at `nginx/certs/` (gitignored). Generate a
> self-signed pair for local dev — never commit real keys.
```bash
mkdir -p nginx/certs
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout nginx/certs/privkey.pem -out nginx/certs/fullchain.pem \
  -subj "/CN=localhost"

docker compose up --build                # https://localhost (accept self-signed warning)
```

### 4. Backend dev commands
```bash
cd backend
npm run dev      # ts-node-dev (hot reload)
npm test         # jest + coverage (should show 12 passing)
npm run lint     # eslint
```

### 5. Contributing (workflow — SDR2)
`main` is protected and auto-deploys. Never push to it directly. Work on a
short-lived feature branch per workstream (D1 design brief §8), then open a PR.
```bash
git checkout main && git pull
git checkout -b feat/<workstream>        # e.g. feat/auth-login, feat/rbac
# ...code + write tests for auth/authz/validation paths...
git push -u origin feat/<workstream>     # then open a PR into main, get 1 approval, merge
```

## Deployment
AWS Ubuntu EC2; repo is the source of truth. A deploy is essentially
`git pull && docker compose up -d --build` on the box, later automated via
GitHub Actions over SSH. See the D1 design brief §6. **Never commit the `.pem` SSH
key.** The EC2 can be wiped without warning — everything lives in Git.

## Security checklist
Implemented to the D1 commitments in the D1 design brief §3: bcrypt password
hashing + policy, RBAC + IDOR/ownership checks, server-side validation +
parameterised queries, CSRF tokens, magic-byte file-upload validation,
append-only hash-chained audit log, TLS + HSTS + security headers, restricted
DB user, non-root containers.
