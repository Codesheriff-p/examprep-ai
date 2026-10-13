"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound, X } from "lucide-react";
import { login, signup } from "@/app/actions/auth";
import { FormMessage } from "@/components/FormMessage";
import { LogoMark } from "@/components/Logo";
import { SubmitButton } from "@/components/SubmitButton";
import { Button } from "@/components/ui/Button";
import { Field, Hint, Input } from "@/components/ui/Field";
import { Muted, PageTitle } from "@/components/ui/Typography";

type Demo = { email: string; password: string } | null;

/**
 * Copies text to the clipboard. Safari and non-HTTPS pages (e.g. the LAN address) can
 * reject the Clipboard API, so fall back to the older execCommand route.
 */
async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.className = "fixed -left-[9999px] opacity-0";
    document.body.appendChild(area);
    area.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="h-7 w-7"
      aria-label={status === "failed" ? `Couldn't copy ${label}; select it and press ⌘C` : `Copy ${label}`}
      title={status === "failed" ? "Couldn't copy: select the text and press ⌘C" : `Copy ${label}`}
      onClick={async () => {
        setStatus((await copyText(value)) ? "copied" : "failed");
        setTimeout(() => setStatus("idle"), 2000);
      }}
    >
      {status === "copied" ? (
        <Check className="h-3.5 w-3.5 text-good" />
      ) : status === "failed" ? (
        <X className="h-3.5 w-3.5 text-bad" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

export function AuthForm({ mode, demo }: { mode: "login" | "signup"; demo?: Demo }) {
  const [state, action] = useActionState(mode === "login" ? login : signup, undefined);
  const [showPassword, setShowPassword] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const isSignup = mode === "signup";

  function logInWithDemo() {
    if (!demo || !emailRef.current || !passwordRef.current) return;
    emailRef.current.value = demo.email;
    passwordRef.current.value = demo.password;
    passwordRef.current.form?.requestSubmit();
  }

  return (
    <div className="w-full max-w-sm animate-fade-up">
      <LogoMark className="h-9 w-9 lg:hidden" />
      <PageTitle className="mt-6 lg:mt-0">{isSignup ? "Create your account" : "Log in"}</PageTitle>
      <Muted className="mt-2">
        {isSignup ? "Start turning your notes into a revision plan." : "Welcome back. Pick up where you left off."}
      </Muted>

      <form action={action} className="mt-8 space-y-4">
        {isSignup && (
          <Field label="Full name" htmlFor="name">
            <Input id="name" name="name" autoComplete="name" required />
          </Field>
        )}
        <Field label="Email" htmlFor="email">
          <Input ref={emailRef} id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="password">Password</label>
          <div className="relative">
            <Input
              ref={passwordRef}
              className="pr-11"
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={isSignup ? "new-password" : "current-password"}
              minLength={isSignup ? 8 : undefined}
              aria-describedby={isSignup ? "password-hint" : undefined}
              required
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-0.5 right-0.5"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((s) => !s)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {isSignup && <Hint id="password-hint">At least 8 characters.</Hint>}
        </div>
        <FormMessage state={state} />
        <SubmitButton size="lg" className="w-full" pendingText={isSignup ? "Creating account…" : "Logging in…"}>
          {isSignup ? "Create account" : "Log in"}
        </SubmitButton>
      </form>

      {!isSignup && demo && (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface-2/60 p-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-accent" aria-hidden="true" />
            <p className="text-sm font-medium">Demo account</p>
          </div>
          <Hint className="mt-1">Comes with a sample course, quiz and mock exam results, flashcards, a study plan and a study streak.</Hint>
          <dl className="mt-3 space-y-1.5 text-sm">
            {[
              ["Email", demo.email],
              ["Password", demo.password],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-1.5">
                <dt className="text-muted">{label}</dt>
                <dd className="flex items-center gap-1 font-mono text-[13px]">
                  <span className="select-all">{value}</span>
                  <CopyButton value={value} label={label.toLowerCase()} />
                </dd>
              </div>
            ))}
          </dl>
          <Button variant="secondary" className="mt-3 w-full" onClick={logInWithDemo}>
            Log in with the demo account
          </Button>
        </div>
      )}

      <p className="mt-8 text-center text-sm text-muted">
        {isSignup ? "Already have an account? " : "Don't have an account? "}
        <Link className="font-medium text-accent hover:underline" href={isSignup ? "/login" : "/signup"}>
          {isSignup ? "Log in" : "Create one"}
        </Link>
      </p>
    </div>
  );
}
