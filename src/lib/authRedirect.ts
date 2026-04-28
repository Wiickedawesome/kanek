import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const AUTH_REDIRECT_PATH = 'auth/callback';
const handledRedirects = new Map<string, Promise<AuthRedirectResult>>();

type AuthRedirectResult = {
  handled: boolean;
  error: { message: string } | null;
};

export function getOAuthRedirectUrl() {
  return makeRedirectUri({
    scheme: 'kanek',
    path: AUTH_REDIRECT_PATH,
  });
}

function parseAuthParams(url: string) {
  const params = new URLSearchParams();

  const queryIndex = url.indexOf('?');
  const hashIndex = url.indexOf('#');

  if (queryIndex !== -1) {
    const query = url.slice(queryIndex + 1, hashIndex === -1 ? undefined : hashIndex);
    for (const [key, value] of new URLSearchParams(query)) {
      params.set(key, value);
    }
  }

  if (hashIndex !== -1) {
    const hash = url.slice(hashIndex + 1);
    for (const [key, value] of new URLSearchParams(hash)) {
      params.set(key, value);
    }
  }

  return params;
}

function getRedirectKey(params: URLSearchParams): string | null {
  const authCode = params.get('code');
  if (authCode) return `code:${authCode}`;

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    return `token:${accessToken}:${refreshToken}`;
  }

  const errorMessage = params.get('error_description') ?? params.get('error');
  if (errorMessage) return `error:${errorMessage}`;

  return null;
}

export async function consumeAuthRedirectUrl(url: string): Promise<AuthRedirectResult> {
  const params = parseAuthParams(url);
  const redirectKey = getRedirectKey(params);
  if (!redirectKey) {
    return {
      handled: false,
      error: null,
    };
  }

  const existingRedirect = handledRedirects.get(redirectKey);
  if (existingRedirect) {
    return existingRedirect;
  }

  const redirectPromise = (async (): Promise<AuthRedirectResult> => {
  const authCode = params.get('code');
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const errorMessage = params.get('error_description') ?? params.get('error');

  if (errorMessage) {
    return {
      handled: true,
      error: { message: errorMessage },
    };
  }

  if (authCode) {
    const { error } = await supabase.auth.exchangeCodeForSession(authCode);

    return {
      handled: true,
      error: error ? { message: error.message } : null,
    };
  }

  if (!accessToken || !refreshToken) {
    return {
      handled: false,
      error: null,
    };
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return {
    handled: true,
    error: error ? { message: error.message } : null,
  };
  })();

  handledRedirects.set(redirectKey, redirectPromise);
  return redirectPromise;
}