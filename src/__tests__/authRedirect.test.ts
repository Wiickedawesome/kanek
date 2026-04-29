import { consumeAuthRedirectUrl } from '@/lib/authRedirect';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: jest.fn(),
      setSession: jest.fn(),
    },
  },
}));

const mockedAuth = jest.mocked(supabase.auth);

describe('consumeAuthRedirectUrl', () => {
  beforeEach(() => {
    mockedAuth.exchangeCodeForSession.mockReset();
    mockedAuth.setSession.mockReset();
  });

  it('exchanges auth codes for a session', async () => {
    mockedAuth.exchangeCodeForSession.mockResolvedValue({
      data: { session: null, user: null, redirectType: null },
      error: null,
    } as never);

    const result = await consumeAuthRedirectUrl('kanek://auth/callback?code=test-code');

    expect(mockedAuth.exchangeCodeForSession).toHaveBeenCalledWith('test-code');
    expect(mockedAuth.setSession).not.toHaveBeenCalled();
    expect(result).toEqual({ handled: true, error: null });
  });

  it('sets the session for implicit token callbacks', async () => {
    mockedAuth.setSession.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    } as never);

    const result = await consumeAuthRedirectUrl('kanek://auth/callback#access_token=access&refresh_token=refresh');

    expect(mockedAuth.setSession).toHaveBeenCalledWith({
      access_token: 'access',
      refresh_token: 'refresh',
    });
    expect(mockedAuth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(result).toEqual({ handled: true, error: null });
  });

  it('deduplicates repeated auth code callbacks', async () => {
    mockedAuth.exchangeCodeForSession.mockResolvedValue({
      data: { session: null, user: null, redirectType: null },
      error: null,
    } as never);

    const [firstResult, secondResult] = await Promise.all([
      consumeAuthRedirectUrl('kanek://auth/callback?code=repeat-code'),
      consumeAuthRedirectUrl('kanek://auth/callback?code=repeat-code'),
    ]);

    expect(mockedAuth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(firstResult).toEqual({ handled: true, error: null });
    expect(secondResult).toEqual({ handled: true, error: null });
  });

  it('returns provider errors from the callback url', async () => {
    const result = await consumeAuthRedirectUrl('kanek://auth/callback?error=access_denied&error_description=User%20cancelled');

    expect(result).toEqual({
      handled: true,
      error: { message: 'User cancelled' },
    });
  });

  it('ignores unrelated deep links', async () => {
    const result = await consumeAuthRedirectUrl('kanek://profile');

    expect(mockedAuth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockedAuth.setSession).not.toHaveBeenCalled();
    expect(result).toEqual({ handled: false, error: null });
  });
});