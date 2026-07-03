import { describe, it, expect } from "vitest";
import { computeStreak } from "../src/services/debriefs";

const NOW = new Date("2026-07-02T12:00:00Z");
const day = (offset: number) =>
  new Date(NOW.getTime() - offset * 24 * 60 * 60 * 1000);

describe("computeStreak", () => {
  it("returns 0 with no debriefs", () => {
    expect(computeStreak([], NOW)).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    expect(computeStreak([day(0), day(1), day(2)], NOW)).toBe(3);
  });

  it("still counts a streak that ended yesterday", () => {
    expect(computeStreak([day(1), day(2)], NOW)).toBe(2);
  });

  it("breaks the streak on a missed day", () => {
    expect(computeStreak([day(0), day(2), day(3)], NOW)).toBe(1);
  });

  it("returns 0 when the last debrief is older than yesterday", () => {
    expect(computeStreak([day(3), day(4)], NOW)).toBe(0);
  });

  it("counts multiple debriefs on one day once", () => {
    expect(computeStreak([day(0), day(0), day(1)], NOW)).toBe(2);
  });
});
