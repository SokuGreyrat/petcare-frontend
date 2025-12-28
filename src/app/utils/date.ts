export function toLocalDateString(d: Date = new Date()): string {
  // Backend uses LocalDate in many places: YYYY-MM-DD
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function toMonthString(d: Date = new Date()): string {
  // YYYY-MM
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

export function formatFriendlyDate(dateLike?: string): string {
  if (!dateLike) return '';
  // Support LocalDate (YYYY-MM-DD) or ISO strings
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return dateLike;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}
