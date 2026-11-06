export function isPastIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value))) return false;
  if (new Date(value).toISOString().slice(0, 10) !== value) return false;
  return value <= new Date().toISOString().slice(0, 10);
}
