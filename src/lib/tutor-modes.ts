/**
 * Tutor modes change how the tutor teaches. Shared by the mode picker (client) and the
 * prompt builder in src/lib/ai.ts (server). The notes stay first in the prompt, so every
 * mode shares the same prompt cache.
 */
export const TUTOR_MODES = {
  explain: {
    label: "Explain",
    description: "Clear step-by-step explanations",
    instructions: "Explain step by step with short examples. End with one quick question that checks understanding when the student is learning something new.",
  },
  socratic: {
    label: "Socratic",
    description: "Guides you to the answer with questions",
    instructions: "Don't give the answer outright. Guide the student with one question at a time, building on their reply, and only confirm the answer once they reach it. Give a hint if they are stuck twice.",
  },
  quiz: {
    label: "Quiz me",
    description: "Asks exam questions one at a time",
    instructions: "Act as an examiner. Ask one exam-style question at a time about the topic the student names (or their weak areas). After each answer, mark it, explain briefly what was right or missing, then ask the next question. Keep a running score.",
  },
  eli5: {
    label: "Simplify",
    description: "Plain language and analogies",
    instructions: "Explain as simply as possible: plain words, short sentences, and an everyday analogy. Avoid jargon; if a technical term is unavoidable, define it in a few words.",
  },
  exam: {
    label: "Exam coach",
    description: "How to write full-mark answers",
    instructions: "Coach exam technique. Show what a full-mark answer to the student's question looks like, point out the keywords an examiner looks for, and mention common mistakes that lose marks.",
  },
} as const;

export type TutorMode = keyof typeof TUTOR_MODES;

export function isTutorMode(value: unknown): value is TutorMode {
  return typeof value === "string" && value in TUTOR_MODES;
}

