const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,}$/;

export function isStrongPassword(value: string): boolean {
  return PASSWORD_RE.test(value);
}

export const MAX_REASON_LENGTH = 500;
export const MAX_NAME_LENGTH = 50;

export function parseJsonBody(body: unknown): { ok: true; data: Record<string, unknown> } | { ok: false } {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return { ok: true, data: body as Record<string, unknown> };
  }
  return { ok: false };
}
