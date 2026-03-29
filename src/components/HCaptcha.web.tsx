import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';

const SITE_KEY = process.env.EXPO_PUBLIC_HCAPTCHA_SITE_KEY ?? '';

export interface HCaptchaHandle {
  getToken: () => string;
  resetCaptcha: () => void;
}

/** Load the hCaptcha JS SDK once */
function loadScript(): Promise<void> {
  if ((window as any).hcaptcha) return Promise.resolve();
  if (document.getElementById('hcaptcha-script')) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if ((window as any).hcaptcha) { clearInterval(check); resolve(); }
      }, 50);
    });
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.id = 'hcaptcha-script';
    s.src = 'https://js.hcaptcha.com/1/api.js?render=explicit&recaptchacompat=off';
    s.async = true;
    s.onload = () => {
      const check = setInterval(() => {
        if ((window as any).hcaptcha) { clearInterval(check); resolve(); }
      }, 50);
    };
    s.onerror = () => reject(new Error('Failed to load hCaptcha'));
    document.head.appendChild(s);
  });
}

export const HCaptcha = forwardRef<HCaptchaHandle>((_props, ref) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const tokenRef = useRef('');

  const onVerify = useCallback((token: string) => {
    tokenRef.current = token;
  }, []);

  const onExpire = useCallback(() => {
    tokenRef.current = '';
  }, []);

  useEffect(() => {
    if (!SITE_KEY) return;

    const div = document.createElement('div');
    div.style.cssText = 'margin-top:12px;margin-bottom:4px;display:flex;justify-content:center;';
    containerRef.current = div;

    // Find the mount point — the element with data-hcaptcha attribute
    const mount = document.getElementById('hcaptcha-mount');
    if (mount) {
      mount.appendChild(div);
    }

    loadScript().then(() => {
      const hc = (window as any).hcaptcha;
      if (!hc || !containerRef.current) return;
      widgetIdRef.current = hc.render(containerRef.current, {
        sitekey: SITE_KEY,
        size: 'normal',
        callback: onVerify,
        'expired-callback': onExpire,
        'error-callback': onExpire,
      });
    });

    return () => {
      const hc = (window as any).hcaptcha;
      if (hc && widgetIdRef.current !== null) {
        try { hc.remove(widgetIdRef.current); } catch {}
      }
      div.remove();
      widgetIdRef.current = null;
    };
  }, [onVerify, onExpire]);

  useImperativeHandle(ref, () => ({
    getToken: () => tokenRef.current,
    resetCaptcha: () => {
      tokenRef.current = '';
      const hc = (window as any).hcaptcha;
      if (hc && widgetIdRef.current !== null) hc.reset(widgetIdRef.current);
    },
  }));

  return null;
});

HCaptcha.displayName = 'HCaptcha';
