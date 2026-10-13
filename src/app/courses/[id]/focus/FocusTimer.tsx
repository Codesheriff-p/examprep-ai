"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Coffee, Pause, Play, RotateCcw, SkipForward, Target } from "lucide-react";
import { logFocusSession } from "@/app/actions/focus";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Eyebrow } from "@/components/ui/Typography";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";

const PRESETS = {
  pomodoro: { label: "Pomodoro", description: "25 min focus · 5 min break", focus: 25, rest: 5 },
  deep: { label: "Deep work", description: "50 min focus · 10 min break", focus: 50, rest: 10 },
  sprint: { label: "Quick sprint", description: "15 min focus · 3 min break", focus: 15, rest: 3 },
} as const;
type Preset = keyof typeof PRESETS;

type Phase = "focus" | "break";
type TimerState = {
  preset: Preset;
  phase: Phase;
  running: boolean;
  endsAt: number | null; // epoch ms while running
  remaining: number; // seconds left while paused
  task: string;
  completed: number; // focus blocks finished this session
};

function initial(preset: Preset = "pomodoro"): TimerState {
  return { preset, phase: "focus", running: false, endsAt: null, remaining: PRESETS[preset].focus * 60, task: "", completed: 0 };
}

/** A short two-note chime so the end of a block is noticeable without a sound file. */
function chime() {
  try {
    const ctx = new AudioContext();
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.25);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + i * 0.25 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.25 + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.25);
      osc.stop(ctx.currentTime + i * 0.25 + 0.45);
    });
  } catch {}
}

export function FocusTimer({ courseId, suggestions }: { courseId: string; suggestions: string[] }) {
  const storageKey = `focus-${courseId}`;
  const [state, setState] = useState<TimerState>(initial());
  const [now, setNow] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const finishing = useRef(false);

  // Latest state and completion handler, read by the ticking interval below.
  const stateRef = useRef(state);
  const completeRef = useRef<(early?: boolean) => Promise<void>>(async () => {});
  useEffect(() => {
    stateRef.current = state;
  });

  // Save after the first restore, so the initial state never overwrites a saved timer.
  const restored = useRef(false);
  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {}
  }, [state, storageKey]);

  const preset = PRESETS[state.preset];
  const total = (state.phase === "focus" ? preset.focus : preset.rest) * 60;
  const remaining = state.running && state.endsAt && now ? Math.max(0, Math.ceil((state.endsAt - now) / 1000)) : state.remaining;

  const completePhase = useCallback(
    async (early = false) => {
      if (finishing.current) return;
      finishing.current = true;
      if (state.phase === "focus") {
        const minutes = early ? Math.floor((total - remaining) / 60) : preset.focus;
        if (minutes >= 1) {
          await logFocusSession(courseId, minutes);
          setMessage(`Logged ${minutes} minute${minutes === 1 ? "" : "s"} of focus. Take a ${preset.rest}-minute break.`);
        }
        setState((s) => ({ ...s, phase: "break", running: !early, endsAt: early ? null : Date.now() + preset.rest * 60_000, remaining: preset.rest * 60, completed: s.completed + (minutes >= 1 ? 1 : 0) }));
      } else {
        setMessage("Break's over. Ready for the next block?");
        setState((s) => ({ ...s, phase: "focus", running: false, endsAt: null, remaining: preset.focus * 60 }));
      }
      if (!early) chime();
      finishing.current = false;
    },
    [courseId, preset, remaining, state.phase, total],
  );

  useEffect(() => {
    completeRef.current = completePhase;
  });

  // Restore a timer that was running before a reload or navigation, then tick twice a second.
  useEffect(() => {
    const tick = () => {
      const t = Date.now();
      setNow(t);
      const s = stateRef.current;
      if (s.running && s.endsAt && s.endsAt <= t) void completeRef.current();
    };
    const restore = setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as TimerState | null;
        if (saved && saved.preset in PRESETS) {
          stateRef.current = saved;
          setState(saved);
        }
      } catch {}
      restored.current = true;
      tick();
    }, 0);
    const interval = setInterval(tick, 500);
    return () => {
      clearTimeout(restore);
      clearInterval(interval);
    };
  }, [storageKey]);

  // Show the countdown in the browser tab while running.
  useEffect(() => {
    const original = "ExamPrep AI";
    if (state.running) document.title = `${formatDuration(remaining)} · ${state.phase === "focus" ? "Focus" : "Break"}`;
    return () => {
      document.title = original;
    };
  }, [remaining, state.running, state.phase]);

  function start() {
    setMessage(null);
    setState((s) => ({ ...s, running: true, endsAt: Date.now() + s.remaining * 1000 }));
  }
  function pause() {
    setState((s) => ({ ...s, running: false, endsAt: null, remaining }));
  }
  function reset(p: Preset = state.preset) {
    setMessage(null);
    setState((s) => ({ ...initial(p), task: s.task, completed: s.completed }));
  }

  const progress = 1 - remaining / total;
  const size = 248;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const isFocus = state.phase === "focus";

  return (
    <Card className="flex flex-col items-center gap-6 py-8 sm:py-10">
      <div className="flex w-full max-w-sm flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <Label htmlFor="focus-preset">Timer</Label>
          <Select
            id="focus-preset"
            value={state.preset}
            onChange={(v) => reset(v as Preset)}
            options={Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label, description: p.description }))}
          />
        </div>
      </div>

      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={isFocus ? "var(--accent)" : "var(--good)"}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - progress)}
            className="transition-[stroke-dashoffset] duration-500 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center" role="timer" aria-live="off">
          <Eyebrow className={cn("flex items-center gap-1.5", isFocus ? "text-accent" : "text-good")}>
            {isFocus ? <Target className="h-3.5 w-3.5" aria-hidden="true" /> : <Coffee className="h-3.5 w-3.5" aria-hidden="true" />}
            {isFocus ? "Focus" : "Break"}
          </Eyebrow>
          <span className="mt-1 font-mono text-5xl font-semibold tracking-tight tabular-nums">
            {now === null ? "--:--" : formatDuration(remaining)}
          </span>
          <span className="mt-2 text-xs text-muted tabular-nums">
            {state.completed} block{state.completed === 1 ? "" : "s"} done this session
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => reset()} aria-label="Reset timer" title="Reset">
          <RotateCcw className="h-4 w-4" />
        </Button>
        {state.running ? (
          <Button size="lg" className="min-w-36" onClick={pause}>
            <Pause className="h-4 w-4" aria-hidden="true" /> Pause
          </Button>
        ) : (
          <Button size="lg" className="min-w-36" onClick={start}>
            <Play className="h-4 w-4" aria-hidden="true" /> {remaining < total ? "Resume" : isFocus ? "Start focus" : "Start break"}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => completePhase(true)}
          aria-label={isFocus ? "Finish focus block early" : "Skip break"}
          title={isFocus ? "Finish early (logs time so far)" : "Skip break"}
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>

      {message && (
        <p className="animate-fade-up rounded-xl bg-good-soft px-4 py-2.5 text-sm text-good" role="status">{message}</p>
      )}

      <div className="w-full max-w-sm">
        <Label htmlFor="focus-task">What are you working on?</Label>
        <Input
          id="focus-task"
          value={state.task}
          onChange={(e) => setState((s) => ({ ...s, task: e.target.value }))}
          placeholder="e.g. Banker's algorithm practice"
          list="focus-suggestions"
        />
        <datalist id="focus-suggestions">
          {suggestions.map((s) => <option key={s} value={s} />)}
        </datalist>
      </div>
    </Card>
  );
}
