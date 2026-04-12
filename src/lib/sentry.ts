import * as Sentry from '@sentry/react-native';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (!DSN) return;

  Sentry.init({
    dsn: DSN,
    tracesSampleRate: 0.2,
    sendDefaultPii: true,
    enableAutoSessionTracking: true,
    attachStacktrace: true,
    environment: __DEV__ ? 'development' : 'production',
    enabled: !__DEV__,
    _experiments: {
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    },
    integrations: [
      Sentry.mobileReplayIntegration({
        maskAllText: true,
        maskAllImages: true,
        maskAllVectors: true,
      }),
    ],
    enableLogs: true,
  });
}

/** Capture an error in Sentry (no-op if Sentry not initialized). */
export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (!DSN) return;

  if (error instanceof Error) {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } else {
    Sentry.captureMessage(String(error), {
      level: 'error',
      extra: context,
    });
  }
}

export { Sentry };
