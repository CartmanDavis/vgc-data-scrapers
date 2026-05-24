/** Returns the Monday of the current ISO week as a YYYY-MM-DD string. */
export function currentWeekMonday(): string {
  const now = new Date();
  const d = new Date(now);
  d.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
