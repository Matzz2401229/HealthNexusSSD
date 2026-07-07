import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..', '..');

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('security configuration', () => {
  it('blocks secret and SAST findings in CI without fake deploy jobs', () => {
    const workflow = readRepoFile('.github/workflows/ci-cd.yml');

    expect(workflow).toContain('gitleaks/gitleaks-action@v2');
    expect(workflow).toContain('fetch-depth: 0');
    expect(workflow).toContain('semgrep --config');
    expect(workflow).toContain('--error');
    expect(workflow).not.toContain('continue-on-error');
    expect(workflow).not.toMatch(/\bdeploy\b/i);
  });

  it('keeps production Docker dev-auth and dev-code flags disabled', () => {
    const compose = readRepoFile('docker-compose.yml');
    const dockerfile = readRepoFile('backend/Dockerfile');

    expect(dockerfile).toContain('ENV NODE_ENV=production');
    expect(dockerfile).toContain('ENV ENABLE_DEV_AUTH=false');
    expect(dockerfile).toContain('ENV ALLOW_DEV_CODES=false');
    expect(compose).toContain('ENABLE_DEV_AUTH: "false"');
    expect(compose).toContain('ALLOW_DEV_CODES: "false"');
    expect(compose).not.toMatch(/\b3306:3306\b/);
  });

  it('keeps DB grants environment-driven and auditlog append-only for the app user', () => {
    const initSql = readRepoFile('db/init.sql');
    const migration = readRepoFile('db/migrations/20260708_security_hardening.sql');
    const grants = readRepoFile('db/99-privileges.sh');

    expect(initSql).not.toContain("TO 'healthnexus_app'@'%'");
    expect(migration).not.toContain("TO 'healthnexus_app'@'%'");
    expect(grants).toContain('${MYSQL_USER}');
    expect(grants).toContain('GRANT SELECT, INSERT ON \\`${MYSQL_DATABASE}\\`.auditlog');
    expect(grants).not.toMatch(/GRANT\s+SELECT,\s+INSERT,\s+UPDATE\s+ON\s+\\`\$\{MYSQL_DATABASE\}\\`\.auditlog/i);
  });

  it('keeps the shared frontend PUT helper CSRF-protected', () => {
    const api = readRepoFile('frontend/src/lib/api.js');

    expect(api).toContain("export async function apiPut(path, body)");
    expect(api).toContain("'x-csrf-token': token");
    expect(api).toContain("credentials: 'include'");
    expect(api).toContain('fetch(`${BASE}${path}`');
  });
});
