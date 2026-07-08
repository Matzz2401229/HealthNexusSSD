# HealthNexus (SSD Group Project — Deliverable 2)

Secure, role-based telemedicine + EHR **Progressive Web App**. Handles PHI, so
security is a core requirement. Four roles: **patient, doctor, pharmacist, admin**.

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

## First-time setup

Use the Docker setup for the full app. It starts nginx, the React frontend,
the Express backend, and MySQL together.

### 1. Prerequisites
| Tool | Why |
|---|---|
| **Git** | Clone the repository |
| **Docker + Docker Compose** | Run the full stack |
| **OpenSSL** | Generate a local TLS certificate |
| **Node.js 20 + npm** | Optional, only needed for running tests/lint outside Docker |

On a fresh Ubuntu VM, install Docker first:
```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
newgrp docker

docker --version
docker compose version
```

On macOS, install and start Docker Desktop before running Docker commands.

### 2. Clone the repo
```bash
git clone https://github.com/Matzz2401229/HealthNexusSSD.git
cd HealthNexusSSD
```

### 3. Create `.env`
```bash
cp .env.example .env
```

Edit `.env`:
```bash
nano .env
```

Update at least these values before running:
```env
MYSQL_PASSWORD=your_app_db_password
MYSQL_ROOT_PASSWORD=your_root_db_password
SESSION_SECRET=your_random_32_byte_secret
```

Generate a strong `SESSION_SECRET` with:
```bash
openssl rand -hex 32
```

For real email verification and forgot-password emails, also configure SMTP:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_email_app_password
SMTP_FROM=your_email@gmail.com
```

Usually keep these as-is for local Docker:
```env
NODE_ENV=development
BACKEND_PORT=8080
ENABLE_DEV_AUTH=false
MYSQL_HOST=db
MYSQL_PORT=3306
MYSQL_DATABASE=healthnexus
MYSQL_USER=healthnexus_app
ALLOW_DEV_CODES=false
FRONTEND_API_BASE_URL=https://localhost/api
```

Never commit `.env`. Only `.env.example` belongs in Git.

### 4. Generate local HTTPS certificate
For local machine:
```bash
mkdir -p nginx/certs
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout nginx/certs/privkey.pem \
  -out nginx/certs/fullchain.pem \
  -subj "/CN=localhost"
```

For a VM public IP, replace the subject with your VM IP:
```bash
mkdir -p nginx/certs
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout nginx/certs/privkey.pem \
  -out nginx/certs/fullchain.pem \
  -subj "/CN=YOUR_VM_PUBLIC_IP"
```

The browser will show a privacy warning because this is a self-signed
certificate. For local/demo use, click **Advanced** and proceed. For real
production, use a real domain and a trusted certificate such as Let's Encrypt.

### 5. Start the full stack
```bash
docker compose up --build -d
```

Check containers:
```bash
docker compose ps
```

Check backend health:
```bash
curl -k https://localhost/api/health
```

Expected:
```json
{"status":"ok"}
```

Open the app:
```text
https://localhost
```

For a VM:
```text
https://YOUR_VM_PUBLIC_IP
```

### 6. Load seed data
Run the SQL seed first:
```bash
docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" healthnexus' < db/seed.sql
```

Then generate the seeded PDF files:
```bash
docker compose exec backend npm run seed:documents
```

Seed login password for all seeded accounts:
```text
Password123!
```

Example seeded account:
```text
admin@test.com
Password123!
```

Other seeded accounts include:
```text
patient@test.com
doctor@test.com
pharmacist@test.com
patient2@test.com
doctor2@test.com
patient3@test.com
doctor3@test.com
```

If PDF seeding fails with `EACCES: permission denied`, fix upload-folder
ownership and rerun the PDF seed:
```bash
sudo mkdir -p backend/uploads
sudo chown -R 1000:1000 backend/uploads
docker compose restart backend
docker compose exec backend npm run seed:documents
```

### 7. Optional local development commands
Only needed if you want to run tests/lint/build outside Docker:
```bash
cd backend
npm install
npm test
npm run lint
npm run build

cd ../frontend
npm install
npm run lint
npm run build
```

### 8. Common Docker commands
```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
docker compose down
docker compose up --build -d
```

## Contributing (workflow — SDR2)
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
