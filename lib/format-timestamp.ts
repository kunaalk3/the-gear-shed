export function formatTimestamp(value: string | null): string | null {
  if (!value) return null;
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toLocaleString();
}
