#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const envFilePath = path.join(repoRoot, '.env.local');
const requestedPlatformArgIndex = process.argv.indexOf('--platform');
const requestedPlatform = requestedPlatformArgIndex === -1
  ? 'all'
  : process.argv[requestedPlatformArgIndex + 1] || 'all';
const shouldCheckAndroid = requestedPlatform === 'all' || requestedPlatform === 'android';
const shouldCheckIos = requestedPlatform === 'all' || requestedPlatform === 'ios';

const requiredLocalEnv = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN',
];

const statuses = [];

function addStatus(level, title, detail) {
  statuses.push({ level, title, detail });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 120000,
    env: options.env || process.env,
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

function extractFirstLine(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || '';
}

const localEnv = {
  ...parseEnvFile(envFilePath),
  ...process.env,
};

const commandEnv = {
  ...process.env,
  ...parseEnvFile(envFilePath),
};

const nodeMajor = Number(process.versions.node.split('.')[0] || 0);
if (nodeMajor >= 24) {
  addStatus('ok', 'Node.js version', `Detected Node.js ${process.versions.node}.`);
} else {
  addStatus('block', 'Node.js version', `Detected Node.js ${process.versions.node}. Install Node.js 24 LTS before running mobile tooling.`);
}

if (fs.existsSync(envFilePath)) {
  addStatus('ok', 'Local environment file', '.env.local is present.');
} else {
  addStatus('block', 'Local environment file', 'Create .env.local with the Expo public runtime variables before starting mobile development.');
}

const missingLocalEnv = requiredLocalEnv.filter((name) => !(localEnv[name] || '').trim());
if (missingLocalEnv.length === 0) {
  addStatus('ok', 'Expo public env vars', `Required local runtime variables are present: ${requiredLocalEnv.join(', ')}.`);
} else {
  addStatus('block', 'Expo public env vars', `Missing local runtime variables: ${missingLocalEnv.join(', ')}.`);
}

if (fs.existsSync(path.join(repoRoot, 'google-services.json'))) {
  addStatus('ok', 'Android Firebase config', 'google-services.json is present for Android builds.');
} else {
  addStatus('block', 'Android Firebase config', 'google-services.json is missing from the repo root, so Android native builds will fail to configure Firebase.');
}

const typecheckResult = run('npm', ['run', 'typecheck'], { env: commandEnv });
if (typecheckResult.ok) {
  addStatus('ok', 'TypeScript', 'npm run typecheck passed.');
} else {
  addStatus('block', 'TypeScript', `npm run typecheck failed: ${extractFirstLine(typecheckResult.stderr || typecheckResult.stdout) || 'See terminal output for details.'}`);
}

const expoDoctorResult = run('npx', ['--yes', 'expo-doctor'], { env: commandEnv });
const expoDoctorOutput = `${expoDoctorResult.stdout}\n${expoDoctorResult.stderr}`;
const hasKnownExpoPatchMismatch =
  expoDoctorOutput.includes('Check that packages match versions required by installed Expo SDK')
  && expoDoctorOutput.includes('expo                ~55.0.18  55.0.17')
  && expoDoctorOutput.includes('expo-notifications  ~55.0.21  55.0.20');

if (expoDoctorResult.ok) {
  addStatus('ok', 'Expo Doctor', 'npx expo-doctor passed.');
} else if (hasKnownExpoPatchMismatch) {
  addStatus('warn', 'Expo Doctor', 'Known Expo SDK 55 patch-version mismatch for expo and expo-notifications; documented as non-fatal for this repo.');
} else {
  addStatus('block', 'Expo Doctor', `npx --yes expo-doctor failed: ${extractFirstLine(expoDoctorResult.stderr || expoDoctorResult.stdout) || 'See terminal output for details.'}`);
}

if (shouldCheckAndroid) {
  const javaResult = run('java', ['-version']);
  const hasJavaHome = Boolean((process.env.JAVA_HOME || '').trim());
  if (javaResult.ok) {
    const javaVersion = extractFirstLine(javaResult.stderr || javaResult.stdout);
    addStatus('ok', 'Android Java runtime', hasJavaHome
      ? `${javaVersion} and JAVA_HOME is set.`
      : `${javaVersion}. Set JAVA_HOME as well so Gradle resolves the intended JDK consistently.`);
  } else {
    addStatus('block', 'Android Java runtime', 'Install JDK 17+ and set JAVA_HOME before running npm run android or gradlew.');
  }

  const adbResult = run('adb', ['version']);
  const androidSdkPath = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '';
  if (adbResult.ok) {
    addStatus('ok', 'Android SDK tools', androidSdkPath
      ? `adb is available and the Android SDK path is set to ${androidSdkPath}.`
      : 'adb is available. Set ANDROID_HOME or ANDROID_SDK_ROOT as well to make the SDK location explicit.');
  } else if (androidSdkPath) {
    addStatus('warn', 'Android SDK tools', `ANDROID_HOME/ANDROID_SDK_ROOT is set to ${androidSdkPath}, but adb is not on PATH yet.`);
  } else {
    addStatus('block', 'Android SDK tools', 'Install Android Studio or command-line tools, then set ANDROID_HOME or ANDROID_SDK_ROOT and add platform-tools to PATH.');
  }
}

if (shouldCheckIos) {
  if (os.platform() === 'darwin') {
    const xcodebuildResult = run('xcodebuild', ['-version']);
    if (xcodebuildResult.ok) {
      addStatus('ok', 'iOS local build tooling', extractFirstLine(xcodebuildResult.stdout));
    } else {
      addStatus('block', 'iOS local build tooling', 'Install Xcode and its command-line tools before running npm run ios locally.');
    }
  } else {
    addStatus(requestedPlatform === 'ios' ? 'block' : 'warn', 'iOS local build tooling', `Local iOS builds require macOS and Xcode. This machine is ${os.platform()}, so use EAS Build for iOS artifacts instead of npm run ios.`);
  }
}

const counts = statuses.reduce((acc, item) => {
  acc[item.level] = (acc[item.level] || 0) + 1;
  return acc;
}, {});

console.log(`Kanek Mobile Readiness${requestedPlatform === 'all' ? '' : ` (${requestedPlatform})`}`);
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