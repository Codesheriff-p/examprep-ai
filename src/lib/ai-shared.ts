/** Types shared by the Claude client (ai.ts) and the offline engine (offline-ai.ts). */

/** An error whose message is safe to show to the student. */
export class AIError extends Error {}

export type NoteDoc = { title: string; content: string };

export type ChatTurn = { role: "user" | "assistant"; content: string };
