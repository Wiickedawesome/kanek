'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const unauthorized = searchParams.get('error') === 'unauthorized';

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    unauthorized ? 'Access denied. Admin accounts only.' : null,
  );

  const supabase = createClient();

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formatted = phone.startsWith('+') ? phone : `+501${phone}`;
    const { error: sendError } = await supabase.auth.signInWithOtp({ phone: formatted });

    if (sendError) {
      setError(sendError.message);
    } else {
      setStep('otp');
    }
    setLoading(false);
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formatted = phone.startsWith('+') ? phone : `+501${phone}`;
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone: formatted,
      token: otp,
      type: 'sms',
    });

    if (verifyError) {
      setError(verifyError.message);
      setLoading(false);
    } else {
      // Middleware will check admin role on redirect
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-forest-900 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-forest-900">kanek</h1>
          <p className="text-forest-400 mt-1 text-sm">Admin Panel</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">
            {error}
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-forest-800 mb-1">
                Phone Number
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg text-gray-500 text-sm">
                  +501
                </span>
                <input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="6XX-XXXX"
                  required
                  className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || !phone}
              className="w-full bg-accent-green text-white font-semibold py-2.5 rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Sending...' : 'Send Verification Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <p className="text-sm text-forest-400 text-center">
              Code sent to <strong className="text-forest-900">{phone.startsWith('+') ? phone : `+501${phone}`}</strong>
            </p>
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-forest-800 mb-1">
                Verification Code
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                maxLength={6}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full bg-accent-green text-white font-semibold py-2.5 rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Verifying...' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('phone'); setOtp(''); }}
              className="w-full text-sm text-forest-400 hover:text-forest-900 transition-colors"
            >
              ← Change number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
