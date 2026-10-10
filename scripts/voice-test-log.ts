// M8 — voice test log. One row per test/live call -> data/voice-log.jsonl (+ RESULTS.md summary).
import { appendFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

export type VoiceLogRow = {
  ts: string; provider: "omnidim" | "vapi"; language: string;
  attempted: boolean; completed: boolean;
  items_ordered: number; items_correct: number; fallback_used: boolean; notes?: string;
};

export function logVoiceCall(row: Omit<VoiceLogRow, "ts">) {
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = join(here, "..", "data");
  mkdirSync(dir, { recursive: true });
  const full: VoiceLogRow = { ts: new Date().toISOString(), ...row };
  appendFileSync(join(dir, "voice-log.jsonl"), JSON.stringify(full) + "\n");
  console.log("[voice-log]", JSON.stringify(full));
  return full;
}

// ponytail: CLI usage — tsx scripts/voice-test-log.ts <provider> <lang> <completed 0|1> <ordered> <correct> <fallback 0|1> [notes]
if (process.argv[1]?.includes("voice-test-log")) {
  const [provider, language, completed, ordered, correct, fallback, ...rest] = process.argv.slice(2);
  logVoiceCall({
    provider: (provider ?? "omnidim") as "omnidim" | "vapi", language: language ?? "en",
    attempted: true, completed: completed === "1",
    items_ordered: Number(ordered ?? 0), items_correct: Number(correct ?? 0),
    fallback_used: fallback === "1", notes: rest.join(" ") || undefined,
  });
}
