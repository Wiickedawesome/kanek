import React, { useImperativeHandle, forwardRef } from 'react';

export interface HCaptchaHandle {
  execute: () => Promise<string>;
  resetCaptcha: () => void;
}

/**
 * Native stub — hCaptcha is web-only.
 * On native, captcha is not required (configure Supabase to exempt mobile clients,
 * or add a WebView-based solution later).
 */
export const HCaptcha = forwardRef<HCaptchaHandle>((_props, ref) => {
  useImperativeHandle(ref, () => ({
    execute: () => Promise.resolve(''),
    resetCaptcha: () => {},
  }));

  return null;
});

HCaptcha.displayName = 'HCaptcha';
