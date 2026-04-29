#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const projectRef = 'tlggdherqjvybpddsqjj';

const requiredBuildEnv = [
  'EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
];

const requiredIosSubmitEnv = [
  'APP_STORE_CONNECT_APP_ID',
  'APPLE_TEAM_ID',
];

const requiredResendSecrets = [
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
];

const PLAY_FIRST_SUBMISSION_ENV = 'ANDROID_FIRST_SUBMISSION_COMPLETE';

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

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function checkFile(filePath, title, missingDetail) {
  if (fs.existsSync(filePath)) {
    addStatus('ok', title, `${path.relative(repoRoot, filePath)} is present.`);
    return true;
  }

  addStatus('block', title, missingDetail);
  return false;
}

function isPlaceholder(value) {
  return typeof value === 'string' && value.startsWith('${') && value.endsWith('}');
}

const localEnv = {
  ...parseEnvFile(path.join(repoRoot, '.env.local')),
  ...process.env,
};
const hasCompletedFirstPlaySubmission = (localEnv[PLAY_FIRST_SUBMISSION_ENV] || '').trim().toLowerCase() === 'true';

const appConfig = readJson('app.json').expo;
if (appConfig?.ios?.bundleIdentifier === 'bz.kanek.app' && appConfig?.android?.package === 'bz.kanek.app') {
  addStatus('ok', 'App identifiers', 'iOS bundle identifier and Android package are both set to bz.kanek.app.');
} else {
  addStatus('block', 'App identifiers', 'app.json must keep both ios.bundleIdentifier and android.package aligned with bz.kanek.app for store testing.');
}

const easConfig = readJson('eas.json');
const buildProfiles = easConfig.build || {};
const submitProfiles = easConfig.submit || {};

const buildProfileNames = Object.keys(buildProfiles);
if (
  buildProfileNames.length === 2
  && buildProfileNames.includes('deviceTest')
  && buildProfileNames.includes('storeTest')
) {
  addStatus('ok', 'Build profile count', 'eas.json keeps only the two active lanes: deviceTest and storeTest.');
} else {
  addStatus('block', 'Build profile count', 'Keep only build.deviceTest and build.storeTest in eas.json so internal installs and store-distributed testing cannot be confused.');
}

if (
  buildProfiles.deviceTest?.distribution === 'internal'
  && buildProfiles.deviceTest?.environment === 'preview'
  && buildProfiles.deviceTest?.ios?.simulator === false
) {
  addStatus('ok', 'Device test build profile', 'build.deviceTest is the direct-install lane and resolves runtime vars from the preview environment.');
} else {
  addStatus('block', 'Device test build profile', 'build.deviceTest should be an internal profile with environment "preview" and ios.simulator set to false.');
}

if (
  buildProfiles.storeTest?.distribution === 'store'
  && buildProfiles.storeTest?.environment === 'production'
) {
  addStatus('ok', 'Store test build profile', 'build.storeTest is the only store-distributed lane and uses the production environment for TestFlight and Play internal builds.');
} else {
  addStatus('block', 'Store test build profile', 'build.storeTest should be a store-distributed profile that uses the production environment.');
}

const androidSubmitProfile = submitProfiles.storeTest?.android;
if (
  androidSubmitProfile?.serviceAccountKeyPath === './play-store-service-account.json'
  && androidSubmitProfile?.track === 'internal'
  && androidSubmitProfile?.releaseStatus === 'completed'
) {
  addStatus('ok', 'Play internal submit profile', 'submit.storeTest.android targets the internal track and publishes finished builds directly to internal testers.');
} else {
  addStatus('block', 'Play internal submit profile', 'submit.storeTest.android should point at ./play-store-service-account.json, target the internal track, and use releaseStatus "completed" so internal testers receive the build automatically.');
}

const iosSubmitProfile = submitProfiles.storeTest?.ios;
const ascAppId = typeof iosSubmitProfile?.ascAppId === 'string' ? iosSubmitProfile.ascAppId.trim() : '';
const appleTeamId = typeof iosSubmitProfile?.appleTeamId === 'string' ? iosSubmitProfile.appleTeamId.trim() : '';
const usesEnvDrivenIosIds = isPlaceholder(ascAppId) && isPlaceholder(appleTeamId);
const usesConcreteIosIds = /^\d+$/.test(ascAppId) && /^[A-Z0-9]{10}$/.test(appleTeamId);

if (usesEnvDrivenIosIds) {
  addStatus('ok', 'TestFlight submit profile', 'submit.storeTest.ios is wired to environment-driven App Store Connect values.');
} else if (usesConcreteIosIds) {
  addStatus('ok', 'TestFlight submit profile', 'submit.storeTest.ios includes concrete App Store Connect values.');
} else {
  addStatus('block', 'TestFlight submit profile', 'submit.storeTest.ios should use either ${APP_STORE_CONNECT_APP_ID}/${APPLE_TEAM_ID} placeholders or concrete App Store Connect values.');
}

checkFile(
  path.join(repoRoot, 'google-services.json'),
  'Android Firebase config',
  'google-services.json is missing from the repo root, so Android release builds will not include the configured Firebase app.',
);

if (fs.existsSync(path.join(repoRoot, 'play-store-service-account.json'))) {
  addStatus('ok', 'Play service account', 'play-store-service-account.json is present for EAS submit automation.');
} else {
  addStatus('warn', 'Play service account', 'play-store-service-account.json is missing. Android store builds can still be uploaded manually, but eas submit automation will fail until the file is restored.');
}

if (hasCompletedFirstPlaySubmission) {
  addStatus('ok', 'Android first Play release', `The first manual Google Play submission has been acknowledged via ${PLAY_FIRST_SUBMISSION_ENV}=true.`);
} else {
  addStatus('warn', 'Android first Play release', `Google Play rejected first-time automated submits until the app had Play Console access configured. Once Android submission is verified, set ${PLAY_FIRST_SUBMISSION_ENV}=true in your shell or .env.local to silence this warning.`);
}

const aasaPath = path.join(repoRoot, 'public', '.well-known', 'apple-app-site-association');
if (checkFile(aasaPath, 'Apple associated domains file', 'public/.well-known/apple-app-site-association is missing.')) {
  const aasa = fs.readFileSync(aasaPath, 'utf8');
  if (aasa.includes('APPLE_TEAM_ID')) {
    addStatus('block', 'Apple associated domains file', 'public/.well-known/apple-app-site-association still contains the APPLE_TEAM_ID placeholder, so Universal Links will not verify on iOS devices yet.');
  } else {
    addStatus('ok', 'Apple associated domains file', 'apple-app-site-association no longer contains the APPLE_TEAM_ID placeholder.');
  }
}

const assetLinksPath = path.join(repoRoot, 'public', '.well-known', 'assetlinks.json');
if (checkFile(assetLinksPath, 'Android asset links file', 'public/.well-known/assetlinks.json is missing.')) {
  const assetLinks = fs.readFileSync(assetLinksPath, 'utf8');
  if (assetLinks.includes('SHA256_FINGERPRINT_FROM_EAS_CREDENTIALS')) {
    addStatus('block', 'Android asset links file', 'public/.well-known/assetlinks.json still contains the SHA256_FINGERPRINT_FROM_EAS_CREDENTIALS placeholder, so Android App Links will not verify yet.');
  } else {
    addStatus('ok', 'Android asset links file', 'assetlinks.json includes a concrete certificate fingerprint.');
  }
}

if (usesEnvDrivenIosIds) {
  const missingIosSubmitEnv = requiredIosSubmitEnv.filter((name) => !(localEnv[name] || '').trim());
  if (missingIosSubmitEnv.length === 0) {
    addStatus('ok', 'Local iOS submit env', 'APP_STORE_CONNECT_APP_ID and APPLE_TEAM_ID are available to the current shell for eas submit.');
  } else {
    addStatus('warn', 'Local iOS submit env', `Missing ${missingIosSubmitEnv.join(', ')} in the current shell or .env.local. Set them before running eas submit --platform ios --profile storeTest.`);
  }
} else {
  addStatus('ok', 'Local iOS submit env', 'Local APP_STORE_CONNECT_APP_ID and APPLE_TEAM_ID are not required because eas.json already contains concrete iOS submit values.');
}

const easEnvResult = run('npx', ['--yes', 'eas-cli', 'env:list', '--environment', 'production', '--format', 'short']);
if (easEnvResult.ok) {
  const easEnvNames = parseEnvNames(easEnvResult.stdout);
  const missingBuildEnv = requiredBuildEnv.filter((name) => !easEnvNames.has(name));
  if (missingBuildEnv.length === 0) {
    addStatus('ok', 'EAS production env', 'Required production runtime variables are present for store-distributed builds.');
  } else {
    addStatus('block', 'EAS production env', `Missing required EAS production variables: ${missingBuildEnv.join(', ')}.`);
  }
} else {
  addStatus('warn', 'EAS production env', 'Could not read EAS production env variables. Run npx eas-cli env:list --environment production --format short after authenticating.');
}

const secretsResult = run('npx', ['--yes', 'supabase', 'secrets', 'list', '--project-ref', projectRef]);
if (secretsResult.ok) {
  const remoteSecrets = new Set(parseTable(secretsResult.stdout).map((row) => row.NAME).filter(Boolean));
  const missingResendSecrets = requiredResendSecrets.filter((name) => !remoteSecrets.has(name));
  if (missingResendSecrets.length === 0) {
    addStatus('ok', 'Auth and email delivery secrets', 'Required Resend secrets are present for email auth and SOS delivery in production.');
  } else {
    addStatus('block', 'Auth and email delivery secrets', `Missing required production secrets: ${missingResendSecrets.join(', ')}.`);
  }
} else {
  addStatus('warn', 'Auth and email delivery secrets', 'Could not list Supabase secrets. Run npx supabase secrets list --project-ref tlggdherqjvybpddsqjj after authenticating.');
}

const counts = statuses.reduce((acc, item) => {
  acc[item.level] = (acc[item.level] || 0) + 1;
  return acc;
}, {});

console.log('Kanek Store Test Readiness');
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