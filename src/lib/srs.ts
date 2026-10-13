/**
 * SM-2 spaced-repetition scheduling (Wozniak, 1990), simplified to four grades.
 * A card the student remembers is shown again after a growing interval; a card they
 * forget restarts at one day.
 */
export type Grade = "again" | "hard" | "good" | "easy";

const QUALITY: Record<Grade, number> = { again: 1, hard: 3, good: 4, easy: 5 };

export type CardState = { ease: number; interval: number; repetitions: number };

export function schedule(card: CardState, grade: Grade, now = new Date()) {
  const q = QUALITY[grade];
  let { ease, interval, repetitions } = card;

  if (q < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) interval = 1;
    else if (repetitions === 2) interval = 6;
    else interval = Math.round(interval * ease);
    if (grade === "easy") interval = Math.round(interval * 1.3);
  }

  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  const dueAt = new Date(now);
  dueAt.setDate(dueAt.getDate() + interval);
  return { ease, interval, repetitions, dueAt };
}
