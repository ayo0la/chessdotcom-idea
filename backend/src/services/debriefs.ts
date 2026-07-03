const DAY_MS = 24 * 60 * 60 * 1000;

function utcDayNumber(date: Date): number {
  return Math.floor(date.getTime() / DAY_MS);
}

// Consecutive UTC days with at least one debrief, ending today or yesterday
export function computeStreak(dates: Date[], now: Date = new Date()): number {
  const days = [...new Set(dates.map(utcDayNumber))].sort((a, b) => b - a);
  if (days.length === 0) return 0;

  const today = utcDayNumber(now);
  if (days[0] < today - 1) return 0;

  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i] === days[i - 1] - 1) streak++;
    else break;
  }
  return streak;
}
