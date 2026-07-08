# ICT2216 Secure Software Development

## Report II on Secure Software Implementation Project: HealthNexus

Prepared from the current `HealthNexusSSD-1` repository state on July 8, 2026.  
This draft follows the structure of the existing `SSD_Report_2.pdf` template, but intentionally omits the Design Review section as requested.

## Before Submission

### Confirmed repo-backed content

The following sections in this draft are grounded in the current repository:

- Application overview
- CI/CD workflow design and deployment flow
- Repository structure and file mapping
- Login, TLS, session management, CSRF, and access-control implementation
- Secure coding practices evidenced in code
- Local test/build/lint results

### Manual evidence still required

The repository alone cannot fully prove the following items, so these need screenshots or exported evidence before final submission:

- Repeated successful GitHub Actions runs across feature branches, pull requests, and `dev`
- Successful GitHub-to-AWS VM auto-deployment runs
- GitHub contribution evidence for every team member
- Final class diagram
- Final login sequence diagram
- Browser screenshots, DevTools cookie/header screenshots, and terminal screenshots referenced in this report

### Important cross-check findings

1. The older PDF template mentions Mocha and Selenium in Test Automation, but the current repository uses Jest-based backend tests and does not contain Selenium, Playwright, Cypress, or Mocha test suites.
2. The current environment could not refresh `npm audit` results because DNS access to `registry.npmjs.org` was unavailable. The CI workflow still contains `npm audit --audit-level=high` for both backend and frontend.
3. `nginx/certs/fullchain.pem` and `nginx/certs/privkey.pem` exist locally in this checkout, but they are ignored by Git and are not tracked by `git ls-files`, so the report should describe them as local runtime artifacts rather than committed secrets.
4. `docs/diagrams/` currently contains only `.gitkeep`, so the diagrams referenced below still need to be drawn and inserted manually.

## 1. Application Overview

HealthNexus is a role-based Progressive Web Application (PWA) for telemedicine and electronic health records (EHR). The application supports four roles: patient, doctor, pharmacist, and admin. Patients can register, manage their own profile, book appointments, upload medical documents, and view prescriptions. Doctors can manage schedules, record diagnoses, and issue prescriptions. Pharmacists can process prescriptions. Admins can approve doctors, manage users, review audit data, and monitor platform activity.

Security is a core design constraint because the application handles Protected Health Information (PHI). The implementation uses a React frontend, an Express + TypeScript backend, a MySQL 8 database, nginx as a TLS-terminating reverse proxy, and Docker Compose for containerized deployment. The repository also includes CI/CD, secret scanning, static analysis, and automated backend tests.

## 2. Secure Software Implementation

### 2.1 CI/CD

The project implements CI/CD through GitHub Actions in `.github/workflows/ci-cd.yml`. The workflow triggers on:

- every push to `main`
- every push to `dev`
- every push to `feature/**`
- every pull request targeting `main` or `dev`

This is a good fit for the module requirement because secure implementation checks are not postponed to the deadline. Instead, every active development path passes through the same automated pipeline.

The workflow defines four verification jobs and one deployment job:

| Job | Purpose | Evidence in repo |
| --- | --- | --- |
| `backend` | installs dependencies, lints, runs Jest tests, and runs `npm audit --audit-level=high` | `.github/workflows/ci-cd.yml`, `backend/package.json` |
| `frontend` | installs dependencies, builds the React app, and runs `npm audit --audit-level=high` | `.github/workflows/ci-cd.yml`, `frontend/package.json` |
| `sast` | runs Semgrep with JavaScript, TypeScript, and security rules, failing on findings | `.github/workflows/ci-cd.yml` |
| `secret-scan` | runs Gitleaks over full history (`fetch-depth: 0`) | `.github/workflows/ci-cd.yml` |
| `deploy-dev` | deploys to AWS VM only after all checks pass on `dev` | `.github/workflows/ci-cd.yml` |

The pipeline also uses a concurrency group so that outdated in-progress runs are cancelled when new commits are pushed to the same branch. This reduces wasted CI time and ensures the latest commit is the one that matters.

The deployment stage is security-gated. It runs only on a push to `dev`, and only after `backend`, `frontend`, `sast`, and `secret-scan` succeed. The deployment job validates required secrets first, then uses `appleboy/ssh-action` to connect to the AWS VM, reset the VM copy to `origin/dev`, rebuild the stack with Docker Compose, and poll `https://localhost/api/health` until the service becomes healthy. If the health check fails, the job prints the backend and nginx logs and exits with failure instead of silently leaving a broken deployment online.

This design supports secure software delivery in three ways:

- code quality checks run automatically before deployment
- secret scanning and SAST are part of the default path, not optional extras
- post-deployment health verification prevents hidden failed releases

Repo history also shows the deployment pipeline was actively refined during implementation, for example:

- `5e8eafc` - Add dev auto deploy workflow and setup guide
- `b94292a` - Retry deploy health check after container restart

#### Screenshot to capture manually

Screenshot title: `Repeated GitHub Actions CI/CD Runs`  
Capture:

- GitHub Actions page showing multiple successful runs across feature branches and `dev`
- visible workflow name `HealthNexus SSD CI/CD`
- at least one successful `deploy-dev` run

Highlight:

- backend, frontend, sast, and secret-scan jobs
- successful deployment status
- timestamps showing repeated usage over the implementation phase

Purpose: Demonstrate that CI/CD was actively used throughout implementation, not added only at the end.

### 2.2 GitHub Repository

#### 2.2.1 Directory and File Structure

The repository is organized into clear layers that make source code review easier for another team in Deliverable 3:

| Path | Purpose |
| --- | --- |
| `frontend/` | React PWA client, route pages, auth-aware UI, API wrapper |
| `backend/src/controllers/` | HTTP request handling layer |
| `backend/src/services/` | business logic and database-facing service logic |
| `backend/src/middleware/` | security gates such as auth, RBAC, CSRF, ownership, upload control, validation |
| `backend/src/routes/` | route registration and endpoint grouping |
| `backend/src/config/` | validated environment config and session config |
| `backend/src/types/` | session and domain type definitions |
| `backend/tests/` | automated security and feature tests |
| `db/` | schema, migrations, privileges, and seed data |
| `nginx/` | reverse-proxy and TLS configuration |
| `.github/workflows/` | CI/CD pipeline |
| `docs/diagrams/` | intended diagram storage location |

This separation is useful for QA because reviewers can inspect the application layer by layer instead of searching through mixed concerns. For example, login behavior is split cleanly across `auth.routes.ts`, `auth.controller.ts`, `auth.service.ts`, `session.ts`, `csrf.ts`, `env.ts`, and `nginx.conf`, which makes both tracing and review easier.

The full repository inventory has been moved to Appendix A so the main body stays readable.

#### 2.2.2 Team Member Contributions

The Git history shows multiple contributors and aliases, including:

- `gemokay`
- `muhaimeeeen`
- `Haidar`
- `Nafisuu`
- `Iqbal`
- `Matzz2401229`
- additional name-form aliases such as `Muhammad Muhaimin Bin Abdul Rahman`, `Matin Mirza`, and `Mohamed Iqbal`

This is enough to state that multiple members contributed, but the final report should use GitHub screenshots, PR history, or repository insights to reconcile aliases and prove contribution per student more cleanly.

#### Screenshot to capture manually

Screenshot title: `Team Contribution Evidence`  
Capture:

- GitHub Insights contributors page, commit history, or PR history
- commits/PRs attributable to each team member

Highlight:

- each member's visible contribution
- examples of work across different parts of the repository

Purpose: Demonstrate that repository activity was shared across the team during implementation.

#### 2.2.3 AWS VM Auto-Deployment Evidence

The repository contains the workflow logic for GitHub-to-AWS VM deployment, but the final report still needs visual execution evidence. The deployment flow:

1. waits for backend, frontend, SAST, and secret-scan checks to pass
2. validates AWS secrets
3. SSHes into the VM
4. synchronizes the working copy to `origin/dev`
5. rebuilds containers with `docker compose up --build -d`
6. polls `https://localhost/api/health`
7. fails loudly if health never becomes ready

This deployment path is stronger than a plain copy-and-restart script because it is gated, reproducible, and health-checked.

#### Screenshot to capture manually

Screenshot title: `AWS VM Auto-Deployment Run`  
Capture:

- a successful `deploy-dev` GitHub Actions job
- the step logs showing SSH deployment and health-check polling

Highlight:

- `needs: [backend, frontend, sast, secret-scan]`
- `docker compose up --build -d`
- successful `curl -k -fsS https://localhost/api/health`

Purpose: Demonstrate that repository changes were automatically deployed from GitHub to the AWS VM.

#### 2.2.4 Class Diagram

The repository does not yet contain the final class diagram asset, but the codebase structure is stable enough to define what the diagram should include.

Diagram title: `HealthNexus Backend Domain and Service Structure`

Purpose:
Show how the main user roles, clinical entities, and backend service/controller modules relate to one another.

What components should appear:

- Entities: `users`, `patient`, `doctor`, `pharmacist`, `admin`
- Clinical data: `appointment`, `diagnosis`, `prescription`, `medical_document`, `document_request`
- Control/support data: `sessions`, `auditlog`, `password_reset_token`, `email_verification_code`
- Service classes/modules: `auth.service`, `appointment.service`, `profile.service`, `prescription.service`, `document.service`, `admin.service`, `audit.service`
- Controllers corresponding to the major services

Relationships:

- `users` is the parent identity table for all role-specific profile tables
- `doctor_patient_auth` links doctor-patient treatment relationships
- `appointment` links patients and doctors
- `diagnosis` belongs to an appointment and a doctor
- `prescription` belongs to a patient and doctor, and may link to an appointment
- `medical_document` belongs to a patient and uploader
- `document_request` references a `medical_document` and requester
- `sessions` optionally links server-side sessions to `user_id`

Layout guidance:

- place `users` at the center top
- place role tables directly below `users`
- place clinical tables in the middle
- place support/security tables on the side
- place services/controllers as a separate logical layer beside or below the database entities

Labels to include:

- PK/FK relationships
- one-to-many links
- security-relevant notes such as `server-side session`, `hash-chained audit log`, and `doctor-patient authorization`

### 2.3 Secure Implementation of Login

#### 2.3.1 Login Sequence Diagram

Diagram title: `Secure Login Sequence`

Purpose:
Show the end-to-end login flow, including validation, password verification, session regeneration, CSRF token issuance, and audit logging.

What components should appear:

- Browser / React frontend
- `frontend/src/lib/api.js`
- nginx reverse proxy
- `/api/auth/login` route
- `auth.controller.ts`
- `auth.service.ts`
- MySQL `users` table
- MySQL `sessions` table
- CSRF middleware/session store
- audit log service

Relationships / message flow:

1. user submits email and password from the frontend
2. frontend sends POST request with credentials
3. nginx terminates TLS and proxies request to backend
4. controller validates the request body
5. auth service loads the user by normalized email
6. auth service verifies bcrypt password hash
7. service enforces generic failure behavior, lockout rules, and inactive-account mapping
8. controller regenerates the session ID on success
9. server stores identity in session and links session ID to user ID
10. server issues CSRF token cookie and returns sanitized user data
11. audit log records success or failure

Layout guidance:

- left-to-right sequence with browser first and database last
- keep security controls visible as distinct steps, especially session regeneration and audit logging

Labels to include:

- `req.session.regenerate()`
- `bcryptjs`
- `hn.sid`
- `csrf_token`
- `recordAudit(...)`
- `attachSessionToUser(...)`

#### 2.3.2 Server Authentication (HTTPS, Cipher Suites, Key Storage)

Server authentication is handled at the nginx layer in `nginx/nginx.conf`. HTTP on port 80 is redirected to HTTPS on port 443. The configuration enables only TLS 1.2 and TLS 1.3, and explicitly sets ECDHE + AES-GCM cipher suites:

- `ECDHE-ECDSA-AES128-GCM-SHA256`
- `ECDHE-RSA-AES128-GCM-SHA256`
- `ECDHE-ECDSA-AES256-GCM-SHA384`
- `ECDHE-RSA-AES256-GCM-SHA384`

This is a strong modern choice because:

- ECDHE provides forward secrecy
- AES-GCM provides authenticated encryption
- weak legacy protocols and ciphers are excluded

The server private key is referenced at `/etc/nginx/certs/privkey.pem` inside the nginx container. In this repository, certificate files are intended to be local runtime artifacts. `.gitignore` excludes `*.pem`, `*.key`, `*.crt`, and `certs/`, and `git ls-files` confirms these local certificate files are not tracked in Git. That means the correct report wording is that the private key is mounted into the container for runtime use and is not meant to be stored in the repository.

During TLS key establishment, the client and server negotiate an ephemeral ECDHE exchange, after which TLS derives symmetric session keys for encrypted application traffic. This means the confidentiality of traffic is protected in transit, and past sessions remain harder to decrypt even if a long-term private key is later exposed.

As defense in depth, nginx also applies rate limiting to general traffic and stricter limits to `/api/auth/login`.

#### Screenshot to capture manually

Screenshot title: `HTTPS and Response Security Headers`  
Capture:

- browser DevTools or `curl -vk` output against `https://localhost`
- response headers from login or health-related endpoints

Highlight:

- HTTPS endpoint
- HSTS
- CSP
- `X-Content-Type-Options`
- rate-limited login endpoint if visible

Purpose: Demonstrate transport-layer protection and security header enforcement.

#### 2.3.3 User Authentication (Password Hashing, Salts, Verification, Lockout)

User authentication is implemented mainly in `backend/src/services/auth.service.ts`, supported by `backend/src/utils/password.ts` and `backend/src/controllers/auth.controller.ts`.

Passwords are hashed using `bcryptjs`, with the cost factor supplied by environment configuration and defaulting to 12 rounds. bcrypt automatically generates a unique random salt for each hash, so identical passwords do not produce identical stored outputs. Plaintext passwords are never stored in the database.

The login flow includes several security controls:

- emails are normalized before lookup
- login failures return the same generic message whether the email exists or not
- a dummy password compare is performed for unknown emails to reduce timing-based enumeration signals
- per-account lockout occurs after repeated failures
- nginx and Express rate limits add IP-based throttling
- doctor and pharmacist self-registration create inactive accounts pending admin approval

The application also implements email verification and password reset support. Verification codes are stored as HMAC-based hashes in `email_verification_code`, reset tokens are stored hashed in `password_reset_token`, and both are time-limited and attempt-limited.

Evidence in code and schema:

- `backend/src/services/auth.service.ts`
- `backend/src/controllers/auth.controller.ts`
- `backend/src/utils/password.ts`
- `db/init.sql`
- `db/migrations/20260708_email_verification_code.sql`
- `db/migrations/20260708_password_reset_token.sql`

### 2.4 Secure Implementation of Session Management

#### 2.4.1 Session Token / Cookie Structure

The application uses server-side session management with `express-session` and `express-mysql-session`, configured in `backend/src/config/session.ts`. The browser stores only an opaque session identifier in the `hn.sid` cookie. Identity and authorization data remain on the server side in the session record and the `sessions` table.

The session user object includes:

- `id`
- `role`
- `status`
- `fullName`
- `loginAt`

This is defined in `backend/src/types/session.d.ts`. Because the cookie does not contain readable role or PHI data, the client cannot promote its own privileges by editing cookie contents.

#### 2.4.2 Transmission and Tamper Prevention

The session cookie is configured with:

- `httpOnly: true`
- `sameSite: 'strict'`
- `rolling: true`
- `secure: 'auto'` in production-aware deployments

These settings reduce exposure to XSS-based cookie theft, help defend against CSRF, and support idle timeout renewal.

For state-changing requests, the frontend obtains a CSRF token through `/api/auth/csrf`, reads the readable `csrf_token` cookie, and echoes it in the `x-csrf-token` header. The backend hashes the token with an HMAC based on the session secret and stores only the hash in the session. On every unsafe request, `csrfProtection` checks:

- token present in cookie
- token present in header
- cookie token equals header token
- HMAC(token) equals the hash stored in that exact session

Because the real session state lives server-side, tampering with cookie contents or replaying a mismatched CSRF token does not yield a valid authenticated state.

#### 2.4.3 Session Attack Mitigations

The implementation addresses several common session threats:

| Threat | Mitigation |
| --- | --- |
| Session fixation | `req.session.regenerate()` is called after successful login |
| Session hijacking | `HttpOnly`, `SameSite=Strict`, TLS, rolling timeout, and absolute timeout reduce token abuse |
| Session replay after logout | `req.session.destroy()` removes the server-side record and cookies are cleared |
| Infinite active sessions | absolute timeout enforced from `loginAt` in `middleware/auth.ts` |
| CSRF | signed, session-bound double-submit token pattern with timing-safe comparison |

The session layer therefore does more than store identity. It actively constrains the lifetime, transport, and validity of authenticated state.

#### Screenshot to capture manually

Screenshot title: `Session and CSRF Cookies After Login`  
Capture:

- DevTools `Application` tab after a successful login
- `hn.sid` and `csrf_token` cookies

Highlight:

- opaque `hn.sid` value
- presence of `csrf_token`
- `HttpOnly` on `hn.sid`
- `SameSite=Strict`

Purpose: Show that the client holds only the opaque session ID and CSRF token, not the full session state.

### 2.5 Secure Implementation of Access Control

Access control is enforced through layered checks:

1. authentication via `requireAuth`
2. active-account enforcement via `requireRole` / `requireActive`
3. role-based access control via `requireRole`
4. ownership / relationship checks via `requireOwnership`
5. database query scoping in services and controllers

The most important design choice is that user identity comes from `req.session.user`, not from client-supplied IDs in the request body. This blocks a large class of horizontal privilege-escalation and IDOR attacks.

Examples from the repository:

- Patients book appointments using `req.session.user.id` in `appointment.controller.ts`
- Profile read/update operations scope entirely to the authenticated user's own ID in `profile.controller.ts` and `profile.service.ts`
- `ownership.ts` defines resolvers such as `canAccessAppointment`, `canAccessPrescription`, `canAccessDocument`, and `canAccessPatientRecord`
- doctor-patient clinical access depends on a real treatment relationship through `doctor_patient_auth` or qualifying appointments
- `requireRole` now blocks inactive accounts as well as wrong-role users and audit-logs denied attempts

This is stronger than frontend-only route protection because the actual enforcement occurs server-side before service logic or database mutations are allowed to proceed.

The access-control design also follows deny-by-default behavior:

- unknown or missing identity -> `401`
- inactive account -> `403`
- wrong role -> `403`
- unauthorized resource ownership -> generic `404` to avoid confirming resource existence

#### Key evidence paths

- `backend/src/middleware/auth.ts`
- `backend/src/middleware/rbac.ts`
- `backend/src/middleware/ownership.ts`
- `backend/src/controllers/appointment.controller.ts`
- `backend/src/controllers/profile.controller.ts`
- `backend/src/services/profile.service.ts`
- `db/init.sql`

### 2.6 Secure Coding Practices (OWASP-Oriented)

#### 2.6.1 Injection Prevention

Database interactions are implemented with parameterized queries through `mysql2`, for example in `auth.service.ts`, `appointment.service.ts`, `profile.service.ts`, and other backend services. User-controlled values are passed as parameters rather than concatenated into raw SQL strings. This reduces SQL injection risk.

Representative evidence:

- `backend/src/services/auth.service.ts`
- `backend/src/services/appointment.service.ts`
- `backend/src/services/profile.service.ts`

#### 2.6.2 Broken Access Control Prevention

The application uses server-side session identity, role checks, active-account enforcement, ownership resolvers, and database scoping to prevent users from reading or modifying other users' records. This directly addresses one of the highest-impact OWASP risks for a healthcare platform.

Representative evidence:

- `backend/src/middleware/rbac.ts`
- `backend/src/middleware/ownership.ts`
- `backend/src/controllers/appointment.controller.ts`
- `backend/src/services/profile.service.ts`

#### 2.6.3 Insecure Design and Input Validation

Input validation is implemented with Zod schemas in multiple controllers and route modules. Examples include:

- login, registration, forgot-password, reset-password, and DOB validation in `auth.controller.ts`
- strict profile field allowlisting in `profile.controller.ts`
- appointment booking validation in `appointment.routes.ts`
- document schema validation in `document.schema.ts`

This matters because the backend does not rely on the frontend alone to protect data integrity. The server re-checks format, field presence, role constraints, and time-based validity.

#### 2.6.4 Security Misconfiguration Prevention

Several defensive configuration choices are visible in the repository:

- secrets are loaded from environment variables and validated on startup in `config/env.ts`
- `.env` is excluded from Git while `.env.example` is retained
- nginx enforces HTTPS and sets security headers
- CI includes secret scanning with Gitleaks
- CI includes SAST with Semgrep
- Docker deployment keeps development bypass flags disabled in production-oriented configuration
- database privileges are constrained in `db/99-privileges.sh`

#### 2.6.5 Identification and Authentication Failures

Authentication protections include:

- bcrypt password hashing
- generic login failure responses
- dummy compare for unknown users
- account lockout
- password policy enforcement
- email verification / reset codes with expiry and attempt limits
- session regeneration on login

Together these controls reduce brute-force, enumeration, weak-password, and stale-session risks.

## 3. Test Automation

### 3.1 Dependency Inventory and Dependency Check

The repository defines dependencies in `backend/package.json` and `frontend/package.json`. A summarized inventory is included in Appendix B.

Dependency checking is built into the CI/CD workflow:

- backend: `npm audit --audit-level=high`
- frontend: `npm audit --audit-level=high`

In this local environment, both backend and frontend audit commands failed to refresh because DNS resolution to `registry.npmjs.org` was unavailable. Therefore, this draft can truthfully claim that dependency checking is implemented in the pipeline, but it should not claim a fresh local vulnerability count unless the team reruns `npm audit` with working internet access and captures the output.

### 3.2 Automated Testing Evidence

The current repository contains automated backend tests implemented with Jest, not Mocha or Selenium. Local validation on this checkout produced:

- 17 test suites passed
- 147 tests passed
- 0 failed
- statement coverage: 76.26%
- branch coverage: 63.91%
- function coverage: 83.97%
- line coverage: 76.22%

The test suite covers a meaningful set of security-sensitive behaviors, including:

- authentication service logic
- session and auth middleware
- CSRF enforcement
- RBAC
- ownership/IDOR checks
- file upload validation
- audit-service behavior
- security configuration expectations
- admin, profile, document, and prescription service logic

Local checks performed on this repository state:

| Command | Result |
| --- | --- |
| `cd backend && npm test` | passed |
| `cd backend && npm run lint` | passed |
| `cd frontend && npm run build` | passed |

This gives stronger evidence than a purely descriptive report because the codebase was revalidated directly from the current checkout.

#### Screenshot to capture manually

Screenshot title: `Local Jest Test Run`  
Capture:

- terminal output of `npm test` inside `backend/`

Highlight:

- `17 passed`
- `147 passed`
- coverage summary

Purpose: Show that automated tests were actually run successfully on the current implementation.

#### Screenshot to capture manually

Screenshot title: `GitHub Actions Test and Build Run`  
Capture:

- successful Actions run showing backend tests and frontend build

Highlight:

- backend lint/test/audit steps
- frontend build/audit steps

Purpose: Show that validation is automated in CI in addition to local runs.

#### Brief reflection

The strongest testing value in the current repository is around security regressions rather than UI automation. The suite protects against mistakes such as:

- weakening session or CSRF behavior
- allowing inactive accounts through role-gated routes
- weakening least-privilege database grants
- removing CI security gates
- breaking profile scoping or ownership checks

If the team wants stronger evidence for end-to-end user workflows, browser automation would still be a reasonable future improvement, but it is not currently present in this repository and should not be claimed as implemented.

## 4. Appendix

### Appendix A - Full Repository Inventory

See `docs/report/repo_inventory.txt`.

### Appendix B - Dependency Inventory

#### Backend runtime dependencies

| Package | Version | Purpose |
| --- | --- | --- |
| `bcryptjs` | `^2.4.3` | password hashing |
| `cookie-parser` | `^1.4.7` | cookie parsing for session/CSRF checks |
| `dotenv` | `^16.4.5` | environment variable loading |
| `express` | `^4.21.0` | backend HTTP server |
| `express-mysql-session` | `^3.0.3` | MySQL-backed server-side session store |
| `express-rate-limit` | `^7.4.0` | IP-based throttling |
| `express-session` | `^1.19.0` | session management |
| `helmet` | `^7.1.0` | security headers |
| `mysql2` | `^3.11.0` | parameterized MySQL access |
| `nodemailer` | `^9.0.3` | verification/reset emails |
| `zod` | `^3.23.8` | request/schema validation |

#### Backend development dependencies

| Package | Version | Purpose |
| --- | --- | --- |
| `@types/bcryptjs` | `^2.4.6` | TypeScript typing |
| `@types/cookie-parser` | `^1.4.7` | TypeScript typing |
| `@types/express` | `^4.17.21` | TypeScript typing |
| `@types/express-session` | `^1.19.0` | TypeScript typing |
| `@types/jest` | `^29.5.13` | Jest typing |
| `@types/node` | `^20.16.5` | Node typing |
| `@types/nodemailer` | `^8.0.1` | Nodemailer typing |
| `@typescript-eslint/eslint-plugin` | `^7.18.0` | TS lint rules |
| `@typescript-eslint/parser` | `^7.18.0` | TS lint parser |
| `eslint` | `^8.57.0` | linting |
| `jest` | `^29.7.0` | automated testing |
| `ts-jest` | `^29.2.5` | Jest TypeScript support |
| `ts-node-dev` | `^2.0.0` | backend development runner |
| `typescript` | `^5.5.4` | TypeScript compiler |

#### Frontend dependencies

| Package | Version | Purpose |
| --- | --- | --- |
| `bootstrap` | `^5.3.3` | UI styling |
| `react` | `^18.3.1` | frontend framework |
| `react-dom` | `^18.3.1` | browser rendering |
| `react-router-dom` | `^6.26.2` | client-side routing |

#### Frontend development dependencies

| Package | Version | Purpose |
| --- | --- | --- |
| `@vitejs/plugin-react` | `^4.6.0` | React support for Vite |
| `eslint` | `^8.57.0` | linting |
| `vite` | `^7.0.0` | frontend build/dev server |
| `vite-plugin-pwa` | `^1.0.0` | PWA support |

### Appendix C - Manual Figure and Screenshot Checklist

Add the following before submission:

- GitHub Actions repeated-run evidence
- GitHub-to-AWS deployment evidence
- GitHub contribution evidence for all members
- class diagram
- login sequence diagram
- DevTools cookie screenshot
- response-header / TLS screenshot
- local Jest run screenshot
- CI run screenshot
