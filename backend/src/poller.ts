export async function pollAllRatings(): Promise<void> {}

export function startPoller(_intervalMs = 120_000): NodeJS.Timeout {
  return setInterval(() => {}, _intervalMs);
}
