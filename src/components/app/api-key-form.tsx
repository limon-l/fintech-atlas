"use client";

import { useActionState, useEffect, useState } from "react";
import { KeyRound, Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { createApiKeyAction, type DeveloperActionState } from "@/app/actions/developers";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { CopyButton } from "@/components/ui/copy-button";

const initial: DeveloperActionState = {};

export function ApiKeyForm() {
  const [state, action] = useActionState(createApiKeyAction, initial);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state.message) toast.success(state.message);
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <div className="space-y-3">
      {!open ? (
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Create API key
        </Button>
      ) : (
        <form action={action} className="space-y-3 rounded-[10px] border border-border bg-surface-2/40 p-3">
          <Field label="Key name" htmlFor="api-key-name" hint="Shown in the key list. Use a service name, not a person.">
            <Input id="api-key-name" name="name" placeholder="Production reconciliation" required minLength={3} />
          </Field>
          <FormError message={state.error} />
          <div className="flex items-center gap-2">
            <SubmitButton size="sm" pendingLabel="Creating…"><KeyRound className="h-3.5 w-3.5" /> Create</SubmitButton>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {state.secret ? (
        <div className="rounded-[10px] border border-warning/25 bg-warning-soft p-3">
          <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-warning">
            <ShieldAlert className="h-3.5 w-3.5" /> Copy this key now. It will not be shown again.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="mono min-w-0 flex-1 truncate rounded bg-surface px-2.5 py-2 text-[10.5px] text-foreground">
              {state.secret}
            </code>
            <CopyButton value={state.secret} label="Copy key" variant="secondary" size="sm" />
          </div>
          <p className="mt-1.5 text-[9.5px] text-warning/80">Only the SHA-256 hash is stored server-side.</p>
        </div>
      ) : null}
    </div>
  );
}
