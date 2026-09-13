import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import ReactHCaptcha from '@hcaptcha/react-hcaptcha';

const SITE_KEY = process.env.EXPO_PUBLIC_HCAPTCHA_SITE_KEY ?? '';

export interface HCaptchaHandle {
  getToken: () => string;
  resetCaptcha: () => void;
  isConfigured: () => boolean;
}

export const HCaptcha = forwardRef<HCaptchaHandle>((_props, ref) => {
  const hcaptchaRef = useRef<ReactHCaptcha>(null);
  const tokenRef = useRef('');

  useImperativeHandle(ref, () => ({
    getToken: () => tokenRef.current,
    resetCaptcha: () => {
      tokenRef.current = '';
      hcaptchaRef.current?.resetCaptcha();
    },
    isConfigured: () => Boolean(SITE_KEY),
  }));

  if (!SITE_KEY) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12, marginBottom: 12, color: '#d32f2f' }}>
        Captcha is not configured. Email sign-in is unavailable until the hCaptcha key is set.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12, marginBottom: 12 }}>
      <ReactHCaptcha
        ref={hcaptchaRef}
        sitekey={SITE_KEY}
        size="normal"
        onVerify={(token) => { tokenRef.current = token; }}
        onExpire={() => { tokenRef.current = ''; }}
        onError={() => { tokenRef.current = ''; }}
      />
    </div>
  );
});

HCaptcha.displayName = 'HCaptcha';
