"use client";

import { useActionState, useState } from "react";
import { ArrowRight, KeyRound, Lock, Mail, Sparkles } from "lucide-react";
import { signInAction, type AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { DEMO_PASSWORD } from "@/lib/demo";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<AuthState, FormData>(signInAction, {});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="Email address" htmlFor="email">
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@atlas.demo"
            className="pl-9"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
      </Field>
      <Field label="Password" htmlFor="password">
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Enter your password"
            className="pl-9"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
      </Field>

      {state.error ? (
        <div
          role="alert"
          className="rounded-[9px] border border-danger/25 bg-danger-soft px-3 py-2.5 text-[12.5px] font-medium text-danger"
        >
          {state.error}
        </div>
      ) : null}

      <SubmitButton size="lg" className="w-full" pendingLabel="Signing in…">
        Sign in to Atlas <ArrowRight className="h-4 w-4" />
      </SubmitButton>

      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={() => {
            setEmail("maya@atlas.demo");
            setPassword(DEMO_PASSWORD);
          }}
          className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-primary hover:underline"
        >
          <Sparkles className="h-3.5 w-3.5" /> Fill personal demo credentials
        </button>
        <span className="mono text-[10px] text-subtle">PIN 246810</span>
      </div>

      <div className="flex items-start gap-2 rounded-[9px] bg-surface-2 px-3 py-2.5 text-[11px] leading-relaxed text-muted">
        <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          All demo accounts use <span className="mono font-semibold text-foreground">{DEMO_PASSWORD}</span>.
          Choose a persona below for one-click access.
        </span>
      </div>
    </form>
  );
}
