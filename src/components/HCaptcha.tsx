import React, { useImperativeHandle, forwardRef } from 'react';

export interface HCaptchaHandle {
  getToken: () => string;
  resetCaptcha: () => void;
}

/**
 * Native stub — hCaptcha is web-only.
 * On native, captcha is not required (configure Supabase to exempt mobile clients,
 * or add a WebView-based solution later).
 */
export const HCaptcha = forwardRef<HCaptchaHandle>((_props, ref) => {
  useImperativeHandle(ref, () => ({
    getToken: () => '',
    resetCaptcha: () => {},
  }));

  return null;
});

HCaptcha.displayName = 'HCaptcha';
