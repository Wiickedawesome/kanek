#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const projectRef = 'tlggdherqjvybpddsqjj';

const requiredEasEnv = [
  'EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
];

const ekyashSecrets = [
  'EKYASH_SID',
  'EKYASH_PIN_HASH',
  'EKYASH_API_KEY',
  'EKYASH_API_URL',
];

const resendSecrets = [
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
];

const statuses = [];

function addStatus(level, title, detail) {
  statuses.push({ level, title, detail });
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 120000,
  });

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error,
  };
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const env = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    env[key] = value;
  }

  return env;
}

function parseEnvNames(output) {
  return new Set(
    output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.includes('='))
      .map((line) => line.split('=')[0].trim())
      .filter(Boolean),
  );
}

function parseTable(output) {
  const rows = [];
  let headers = null;

  for (const rawLine of output.split(/\r?\n/)) {
    if (!rawLine.includes('|')) continue;
    const cells = rawLine.split('|').map((cell) => cell.trim()).filter(Boolean);
    if (cells.length === 0) continue;

    if (!headers) {
      headers = cells;
      continue;
    }

    if (cells.every((cell) => /^-+$/.test(cell.replace(/\s/g, '')))) {
      continue;
    }

    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] || '';
    });
    rows.push(row);
  }

  return rows;
}

function getLocalFunctionSlugs() {
  const functionsDir = path.join(repoRoot, 'supabase', 'functions');
  return fs.readdirSync(functionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== '_shared')
    .sort();
}

function getLocalMigrationCount() {
  const migrationsDir = path.join(repoRoot, 'supabase', 'migrations');
  return fs.readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .length;
}

function checkMigrationStatus(dbPassword) {
  const migrationResult = run('npx', ['--yes', 'supabase', 'migration', 'list', '-p', dbPassword]);
  if (!migrationResult.ok) {
    addStatus('warn', 'Migration status', 'Could not verify remote migrations even with SUPABASE_DB_PASSWORD set. Re-run `npx supabase migration list -p <password>` directly to inspect the failure.');
    return;
  }

  const rows = parseTable(migrationResult.stdout);
  const mismatchedRows = rows.filter((row) => row.Local !== row.Remote);
  if (mismatchedRows.length === 0) {
    addStatus('ok', 'Migration status', `Remote database migrations match the repo (${rows.length} applied migrations).`);
  } else {
    addStatus('block', 'Migration status', `Remote migration mismatch detected in ${mismatchedRows.length} row(s). Run \'npx supabase migration list -p <password>\' for details before launch.`);
  }
}

function readCaptchaConfig() {
  const configPath = path.join(repoRoot, 'supabase', 'config.toml');
  const config = fs.readFileSync(configPath, 'utf8');
  const blockMatch = config.match(/\[auth\.captcha\]([\s\S]*?)(?:\n\[|$)/);
  const enabledMatch = blockMatch?.[1]?.match(/enabled\s*=\s*(true|false)/);

  return enabledMatch?.[1] === 'true';
}

function readFeatureFlags() {
  const constantsPath = path.join(repoRoot, 'src', 'lib', 'constants.ts');
  const source = fs.readFileSync(constantsPath, 'utf8');
  const ekyashMatch = source.match(/export const ENABLE_EKYASH = (true|false);/);
  const sosDeliveryMethodMatch = source.match(/export const SOS_DELIVERY_METHOD = '(email|sms)' as const;/);

  return {
    ekyashEnabled: ekyashMatch?.[1] === 'true',
    sosDeliveryMethod: sosDeliveryMethodMatch?.[1] || 'sms',
  };
}

function formatNames(names) {
  return names.length ? names.join(', ') : 'none';
}

const localEnv = parseEnvFile(path.join(repoRoot, '.env.local'));
const featureFlags = readFeatureFlags();

if (fs.existsSync(path.join(repoRoot, 'google-services.json'))) {
  addStatus('ok', 'Android Firebase config', 'google-services.json is present in the repo root.');
} else {
  addStatus('block', 'Android Firebase config', 'google-services.json is missing from the repo root.');
}

const easEnvResult = run('npx', ['--yes', 'eas-cli', 'env:list', '--environment', 'production', '--format', 'short']);
let easEnvNames = new Set();

if (easEnvResult.ok) {
  easEnvNames = parseEnvNames(easEnvResult.stdout);
  const missingRequiredEasEnv = requiredEasEnv.filter((name) => !easEnvNames.has(name));

  if (missingRequiredEasEnv.length === 0) {
    addStatus('ok', 'EAS production env', `Required runtime variables are present: ${requiredEasEnv.join(', ')}.`);
  } else {
    addStatus('block', 'EAS production env', `Missing required production env variables: ${missingRequiredEasEnv.join(', ')}.`);
  }

  if (easEnvNames.has('EXPO_PUBLIC_SENTRY_DSN')) {
    addStatus('ok', 'Runtime Sentry', 'EXPO_PUBLIC_SENTRY_DSN is set in the EAS production environment.');
  } else {
    addStatus('warn', 'Runtime Sentry', 'EXPO_PUBLIC_SENTRY_DSN is not set in EAS production, so runtime crash reporting will stay disabled.');
  }
} else {
  addStatus('warn', 'EAS production env', 'Could not read EAS production env variables. Run `npx eas-cli env:list --environment production --format short` after authenticating.');
}

const captchaEnabled = readCaptchaConfig();
if (!captchaEnabled) {
  addStatus('ok', 'hCaptcha', 'Supabase repo config currently has auth.captcha.enabled=false, so a blank hCaptcha site key does not block launch.');
} else if (easEnvNames.has('EXPO_PUBLIC_HCAPTCHA_SITE_KEY') || (localEnv.EXPO_PUBLIC_HCAPTCHA_SITE_KEY || '').trim()) {
  addStatus('ok', 'hCaptcha', 'Bot protection is enabled and a site key is available.');
} else {
  addStatus('block', 'hCaptcha', 'Bot protection is enabled, but EXPO_PUBLIC_HCAPTCHA_SITE_KEY is missing from both local env and EAS production env.');
}

if (!featureFlags.ekyashEnabled) {
  addStatus('ok', 'E-Kyash launch posture', 'ENABLE_EKYASH is false in src/lib/constants.ts, so E-Kyash payment and receipt secrets are treated as deferred for this launch.');
}

const secretsResult = run('npx', ['--yes', 'supabase', 'secrets', 'list', '--project-ref', projectRef]);
if (secretsResult.ok) {
  const remoteSecrets = new Set(parseTable(secretsResult.stdout).map((row) => row.NAME).filter(Boolean));
  const requiredSupabaseSecrets = Array.from(new Set([
    ...(featureFlags.ekyashEnabled ? ekyashSecrets : []),
    ...(featureFlags.sosDeliveryMethod === 'email' ? resendSecrets : []),
  ]));
  const missingRequiredSecrets = requiredSupabaseSecrets.filter((name) => !remoteSecrets.has(name));
  const missingDeferredSecrets = !featureFlags.ekyashEnabled
    ? ekyashSecrets.filter((name) => !remoteSecrets.has(name))
    : [];

  if (missingRequiredSecrets.length === 0) {
    if (featureFlags.ekyashEnabled) {
      addStatus('ok', 'Supabase Edge Function secrets', 'Required production secrets are present for E-Kyash and email delivery.');
    } else if (featureFlags.sosDeliveryMethod === 'email') {
      addStatus('ok', 'Supabase Edge Function secrets', 'Required production secrets are present for email-based SOS delivery.');
    } else {
      addStatus('ok', 'Supabase Edge Function secrets', 'No immediate edge-function secrets are required for the current launch posture.');
    }
  } else {
    addStatus('block', 'Supabase Edge Function secrets', `Missing required production secrets: ${missingRequiredSecrets.join(', ')}.`);
  }

  if (missingDeferredSecrets.length > 0) {
    addStatus('warn', 'Deferred payment secrets', `E-Kyash is disabled for launch, but these later-rollout secrets are still unset: ${missingDeferredSecrets.join(', ')}.`);
  }
} else {
  addStatus('warn', 'Supabase Edge Function secrets', 'Could not list production secrets. Run `npx supabase secrets list --project-ref tlggdherqjvybpddsqjj` after authenticating.');
}

const functionsResult = run('npx', ['--yes', 'supabase', 'functions', 'list', '--project-ref', projectRef]);
if (functionsResult.ok) {
  const remoteFunctions = parseTable(functionsResult.stdout).map((row) => row.SLUG).filter(Boolean).sort();
  const localFunctions = getLocalFunctionSlugs();
  const missingRemote = localFunctions.filter((slug) => !remoteFunctions.includes(slug));
  const extraRemote = remoteFunctions.filter((slug) => !localFunctions.includes(slug));

  if (missingRemote.length === 0 && extraRemote.length === 0) {
    addStatus('ok', 'Supabase Edge Function deployment', `Remote function set matches the repo (${localFunctions.length} functions).`);
  } else {
    addStatus('warn', 'Supabase Edge Function deployment', `Function mismatch detected. Missing remotely: ${formatNames(missingRemote)}. Extra remotely: ${formatNames(extraRemote)}.`);
  }
} else {
  addStatus('warn', 'Supabase Edge Function deployment', 'Could not list deployed functions. Run `npx supabase functions list --project-ref tlggdherqjvybpddsqjj` after authenticating.');
}

const migrationCount = getLocalMigrationCount();
if (process.env.SUPABASE_DB_PASSWORD) {
  checkMigrationStatus(process.env.SUPABASE_DB_PASSWORD);
} else {
  addStatus('warn', 'Migration status', `The repo has ${migrationCount} migration files, but remote migration status still requires SUPABASE_DB_PASSWORD for \'supabase db push\' or \'supabase migration list -p <password>\'.`);
}

const counts = statuses.reduce((acc, item) => {
  acc[item.level] = (acc[item.level] || 0) + 1;
  return acc;
}, {});

console.log('Kanek Launch Readiness (Non-Google)');
console.log('');
for (const item of statuses) {
  console.log(`${item.level.toUpperCase()}  ${item.title}`);
  console.log(`  ${item.detail}`);
}

console.log('');
console.log(`Summary: ${counts.block || 0} blocker(s), ${counts.warn || 0} warning(s), ${counts.ok || 0} passing check(s).`);

if ((counts.block || 0) > 0) {
  process.exitCode = 1;
}