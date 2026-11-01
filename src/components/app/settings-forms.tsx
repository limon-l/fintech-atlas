"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { LifeBuoy, Save, Send } from "lucide-react";
import {
  createSupportTicketAction,
  updateProfileAction,
  type ActionState,
} from "@/app/actions/personal";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";

const initial: ActionState = {};

const TIMEZONES = [
  "Europe/London",
  "Europe/Berlin",
  "Europe/Zurich",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Africa/Nairobi",
  "UTC",
];

export function ProfileForm({
  name,
  country,
  timezone,
  email,
}: {
  name: string;
  country: string;
  timezone: string;
  email: string;
}) {
  const [state, action] = useActionState(updateProfileAction, initial);

  useEffect(() => {
    if (state.message) toast.success(state.message);
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name" htmlFor="profile-name">
          <Input id="profile-name" name="name" defaultValue={name} autoComplete="name" required />
        </Field>
        <Field label="Email" htmlFor="profile-email" hint="Email changes require support verification.">
          <Input id="profile-email" value={email} readOnly disabled />
        </Field>
        <Field label="Country (ISO-2)" htmlFor="profile-country">
          <Input id="profile-country" name="country" defaultValue={country} maxLength={2} required />
        </Field>
        <Field label="Timezone" htmlFor="profile-timezone">
          <Select id="profile-timezone" name="timezone" defaultValue={timezone}>
            {TIMEZONES.map((zone) => (
              <option key={zone} value={zone}>{zone}</option>
            ))}
          </Select>
        </Field>
      </div>
      <FormError message={state.error} />
      <div className="flex items-center gap-2">
        <SubmitButton pendingLabel="Saving…">
          <Save className="h-3.5 w-3.5" /> Save profile
        </SubmitButton>
        <span className="text-[10.5px] text-subtle">Changes are written to the audit log.</span>
      </div>
    </form>
  );
}

export function SupportForm() {
  const [state, action] = useActionState(createSupportTicketAction, initial);

  useEffect(() => {
    if (state.message) toast.success(state.message);
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="space-y-3">
      <Field label="What do you need help with?" htmlFor="support-subject">
        <Textarea
          id="support-subject"
          name="subject"
          placeholder="Describe the issue. Include a transfer reference if relevant."
          required
          minLength={6}
          maxLength={400}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-[180px_1fr] sm:items-end">
        <Field label="Priority" htmlFor="support-priority">
          <Select id="support-priority" name="priority" defaultValue="normal">
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </Select>
        </Field>
        <div className="flex items-center gap-2">
          <SubmitButton variant="secondary" pendingLabel="Sending…">
            <Send className="h-3.5 w-3.5" /> Open request
          </SubmitButton>
          <span className="flex items-center gap-1 text-[10.5px] text-subtle">
            <LifeBuoy className="h-3 w-3" /> Routed to the ops support queue.
          </span>
        </div>
      </div>
      <FormError message={state.error} />
    </form>
  );
}


