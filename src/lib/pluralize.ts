/**
 * Returns "1 item" / "2 items" style strings.
 * Pass an explicit `plural` for irregulars (e.g. "1 person" / "2 people").
 */
export function pluralize(n: number, singular: string, plural?: string): string {
  return n === 1 ? `${n} ${singular}` : `${n} ${plural || singular + 's'}`;
}
