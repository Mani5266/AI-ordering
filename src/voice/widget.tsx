"use client";
import { useRef, useState } from "react";
import { WebSession } from "@omnidim-ai/client";

// Real OmniDim web call (P3/M3). Table identity travels as agent custom_variables,
// never asked on the call (PRD 7.1). No secret key ever reaches the browser.
export default function VoiceWidget({ table }: { table: number; session: string }) {
  const [state, setState] = useState<"idle" | "connecting" | "live" | "ended" | "failed">("idle");
  const [lines, setLines] = useState<{ role: string; text: string }[]>([]);
  const [why, setWhy] = useState("");
  const sessRef = useRef<{ stop: () => void } | null>(null);

  const start = async () => {
    setState("connecting");
    setLines([]);
    setWhy("");
    try {
      // mic first — fail fast with the exact reason, not a generic error
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch (micErr) {
        const name = micErr instanceof Error ? micErr.name : "";
        throw new Error(name === "NotAllowedError" ? "MIC_DENIED" : "MIC_MISSING");
      }
      const r = await fetch("/api/voice/session", { method: "POST", credentials: "include" });
      if (!r.ok) throw new Error((await r.json()).error ?? "voice unavailable");
      const { ws_url } = (await r.json()) as { ws_url: string };
      const ws = new WebSession();
      sessRef.current = ws as unknown as { stop: () => void };
      ws.on("status", (st: unknown) => {
        if (st === "active") setState("live");
        else if (typeof st === "object") setState("ended");
      });
      ws.on("transcript", (t: { role: string; text: string; final: boolean }) => {
        if (!t.final || !t.text.trim()) return;
        // OmniDim sends cumulative snapshots per turn — replace same-role line, never stack.
        setLines((l) => {
          const last = l[l.length - 1];
          const row = { role: t.role, text: t.text };
          if (last && last.role === t.role) return [...l.slice(0, -1), row];
          return [...l.slice(-3), row];
        });
      });
      ws.on("error", (e: unknown) => { setWhy(e instanceof Error ? e.message : "connection error"); setState("failed"); });
      await ws.start({ wsUrl: ws_url });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      setWhy(msg);
      setState("failed");
    }
  };

  const stop = () => { sessRef.current?.stop(); setState("ended"); };

  if (state === "idle")
    return (
      <button onClick={start} style={{ background: "#ffffff", color: "#0A2463" }} className="mt-3 rounded-full px-8 py-3 text-base font-bold shadow">
        📞 Start call — Table {table}
      </button>
    );
  if (state === "connecting") return <div className="mt-3 text-sm">Connecting your call… (allow the mic)</div>;
  if (state === "failed")
    return (
      <div className="mt-2 text-sm text-amber-300">
        {why === "MIC_DENIED" && <>🎤 Mic blocked — click the mic icon in the address bar, allow it, and tap Start again.</>}
        {why === "MIC_MISSING" && <>🎤 No microphone found on this device — tap your order below, same kitchen.</>}
        {!why && <>Voice call failed — tap your order below, same kitchen.</>}
        {!!why && why !== "MIC_DENIED" && why !== "MIC_MISSING" && <>Voice error: {why} — tap your order below, same kitchen.</>}
      </div>
    );

  return (
    <div className="mt-2">
      <div className="text-sm font-bold">{state === "live" ? "🟢 On call — speak your order" : "Call ended — your order appears on this screen automatically"}</div>
      <div className="mx-auto mt-2 max-h-28 max-w-sm overflow-y-auto text-left text-xs">
        {lines.map((l, i) => <div key={i}><b>{l.role}:</b> {l.text}</div>)}
      </div>
      {state === "live" && <button onClick={stop} className="mt-2 rounded bg-red-700 px-6 py-1 font-bold">End call</button>}
    </div>
  );
}
