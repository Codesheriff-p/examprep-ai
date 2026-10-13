"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { changePassword } from "@/app/actions/auth";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePassword, undefined);
  const [show, setShow] = useState(false);
  const type = show ? "text" : "password";

  return (
    <Card>
      <CardHeader
        title="Change password"
        description="Your password is stored securely as a hash in the local database."
        action={
          <Button variant="ghost" size="sm" onClick={() => setShow((s) => !s)} aria-pressed={show}>
            {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            {show ? "Hide" : "Show"}
          </Button>
        }
      />
      <form action={action} className="mt-5 space-y-4">
        <Field label="Current password" htmlFor="currentPassword">
          <Input id="currentPassword" name="currentPassword" type={type} autoComplete="current-password" required />
        </Field>
        <Field label="New password" htmlFor="newPassword" hint="At least 8 characters.">
          <Input id="newPassword" name="newPassword" type={type} autoComplete="new-password" minLength={8} required />
        </Field>
        <Field label="Confirm new password" htmlFor="confirmPassword">
          <Input id="confirmPassword" name="confirmPassword" type={type} autoComplete="new-password" minLength={8} required />
        </Field>
        <FormMessage state={state} />
        <SubmitButton className="w-full" pendingText="Updating…">
          <KeyRound className="h-4 w-4" aria-hidden="true" /> Update password
        </SubmitButton>
      </form>
    </Card>
  );
}
