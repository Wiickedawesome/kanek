/** Format BZD from cents */
export function formatBZD(cents: number): string {
  return `$${(cents / 100).toFixed(2)} BZD`;
}

/** Format date string to readable format */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-BZ', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Format date + time */
export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-BZ', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Full name from nullable first/last */
export function fullName(first: string | null, last: string | null): string {
  return `${first ?? ''} ${last ?? ''}`.trim() || 'Unknown';
}
