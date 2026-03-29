import { useEffect, useImperativeHandle, forwardRef } from 'react';

const SITE_KEY = process.env.EXPO_PUBLIC_HCAPTCHA_SITE_KEY ?? '';

export interface HCaptchaHandle {
  execute: () => Promise<string>;
  resetCaptcha: () => void;
}

/** Load the hCaptcha JS SDK once */
function loadScript(): Promise<void> {
  if (document.getElementById('hcaptcha-script')) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.id = 'hcaptcha-script';
    s.src = 'https://js.hcaptcha.com/1/api.js?render=explicit&recaptchacompat=off';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load hCaptcha'));
    document.head.appendChild(s);
  });
}

let widgetId: string | null = null;
let containerEl: HTMLDivElement | null = null;

function ensureWidget(): string | null {
  const hc = (window as any).hcaptcha;
  if (!hc || !SITE_KEY) return null;
  if (widgetId !== null) return widgetId;

  if (!containerEl) {
    containerEl = document.createElement('div');
    containerEl.id = 'hcaptcha-container';
    containerEl.style.cssText = 'position:fixed;bottom:0;right:0;z-index:-1;opacity:0;pointer-events:none;';
    document.body.appendChild(containerEl);
  }

  widgetId = hc.render(containerEl, {
    sitekey: SITE_KEY,
    size: 'invisible',
  });
  return widgetId;
}

export const HCaptcha = forwardRef<HCaptchaHandle>((_props, ref) => {
  useEffect(() => {
    if (SITE_KEY) loadScript().then(() => ensureWidget());
  }, []);

  useImperativeHandle(ref, () => ({
    execute: async () => {
      try {
        await loadScript();
        const id = ensureWidget();
        const hc = (window as any).hcaptcha;
        if (!hc || id === null) {
          console.warn('[hCaptcha] SDK not available or widget not rendered');
          return '';
        }
        const res = await hc.execute(id, { async: true });
        return res.response as string;
      } catch (e) {
        console.warn('[hCaptcha] execute error:', e);
        return '';
      }
    },
    resetCaptcha: () => {
      const hc = (window as any).hcaptcha;
      if (hc && widgetId !== null) hc.reset(widgetId);
    },
  }));

  return null;
});

HCaptcha.displayName = 'HCaptcha';
