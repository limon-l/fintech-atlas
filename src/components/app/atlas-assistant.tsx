"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2, Send, Sparkles } from "lucide-react";
import { askAtlasAction } from "@/app/actions/assistant";
import type { AssistantAnswer } from "@/server/assistant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function AtlasAssistant({ prompts }: { prompts: string[] }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function ask(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setQuestion(trimmed);
    setError(null);
    startTransition(async () => {
      const result = await askAtlasAction(trimmed);
      if (!result.ok || !result.answer) {
        setError(result.error ?? "No answer.");
        return;
      }
      setAnswer(result.answer);
    });
  }

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-gradient-to-br from-primary to-teal text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[13px] font-semibold">Atlas Assistant</p>
            <p className="text-[10px] text-muted">Grounded in your ledger records · read-only</p>
          </div>
        </div>
        <Badge variant="teal">No generative claims</Badge>
      </div>
      <div className="space-y-3 p-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            ask(question);
          }}
          className="flex gap-2"
        >
          <Input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about spending, budgets, goals or a transfer…"
            aria-label="Ask Atlas Assistant"
            maxLength={300}
          />
          <Button type="submit" size="md" disabled={pending || question.trim().length < 3}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="hidden sm:inline">Ask</span>
          </Button>
        </form>

        <div className="flex flex-wrap gap-1.5">
          {prompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => ask(prompt)}
              className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[9.5px] font-medium text-muted transition-colors hover:border-border-strong hover:text-foreground"
            >
              {prompt}
            </button>
          ))}
        </div>

        {error ? <p className="rounded-[9px] border border-danger/25 bg-danger-soft px-3 py-2 text-[11px] text-danger">{error}</p> : null}

        {answer ? (
          <div className="rounded-[11px] border border-border bg-surface-2/50 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="neutral" className="!text-[8.5px] uppercase">{answer.intent.replace(/_/g, " ")}</Badge>
              <span className="text-[8.5px] text-subtle">deterministic rule engine</span>
            </div>
            <p className="mt-2.5 whitespace-pre-line text-[11.5px] leading-relaxed text-foreground">{answer.answer}</p>
            {answer.citations.length > 0 ? (
              <div className="mt-3 space-y-1.5 border-t border-border/70 pt-2.5">
                {answer.citations.map((citation) =>
                  citation.href ? (
                    <Link key={`${citation.label}-${citation.value}`} href={citation.href} className={cn("flex items-center justify-between gap-3 rounded-[6px] px-1 py-0.5 text-[10px] hover:bg-surface")}>
                      <span className="truncate text-muted">{citation.label}</span>
                      <span className="flex items-center gap-1 font-semibold">{citation.value} <ArrowUpRight className="h-2.5 w-2.5 text-subtle" /></span>
                    </Link>
                  ) : (
                    <div key={`${citation.label}-${citation.value}`} className="flex items-center justify-between gap-3 px-1 py-0.5 text-[10px]">
                      <span className="text-muted">{citation.label}</span>
                      <span className="font-semibold">{citation.value}</span>
                    </div>
                  ),
                )}
              </div>
            ) : null}
            <p className="mt-2.5 text-[9px] leading-relaxed text-subtle">{answer.disclaimer}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
