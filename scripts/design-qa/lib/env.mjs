import fs from 'node:fs';
import path from 'node:path';

const ENV_FILE = path.resolve('.env.qa');

export function loadQaEnv(file = ENV_FILE) {
  if (!fs.existsSync(file)) return false;
  const text = fs.readFileSync(file, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
  return true;
}

export function requireEnv(keys) {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(
      `Missing QA configuration: ${missing.join(', ')}\n` +
        `Create .env.qa in the repo root (gitignored) — see scripts/design-qa/env.qa.example.`
    );
    process.exit(1);
  }
}

export function accounts() {
  requireEnv([
    'QA_PATIENT_EMAIL',
    'QA_PATIENT_PASSWORD',
    'QA_PROVIDER_EMAIL',
    'QA_PROVIDER_PASSWORD',
    'QA_ADMIN_EMAIL',
    'QA_ADMIN_PASSWORD',
  ]);
  return {
    patient: { email: process.env.QA_PATIENT_EMAIL, password: process.env.QA_PATIENT_PASSWORD },
    provider: { email: process.env.QA_PROVIDER_EMAIL, password: process.env.QA_PROVIDER_PASSWORD },
    admin: { email: process.env.QA_ADMIN_EMAIL, password: process.env.QA_ADMIN_PASSWORD },
  };
}
