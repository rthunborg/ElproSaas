"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/server/db/supabase-browser-client";

export default function PasswordUpdatePage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8 || password !== confirmation) {
      setMessage("Choose matching passwords with at least 8 characters.");
      return;
    }
    setSaving(true);
    const { error } = await createSupabaseBrowserClient().auth.updateUser({ password });
    setSaving(false);
    setMessage(error ? "Unable to update your password. Request another reset link and try again." : "Your password has been updated. You can now continue to the app.");
  }

  return <main className="mx-auto max-w-md p-6"><h1 className="text-2xl font-semibold">Set a new password</h1><form className="mt-6 space-y-4" onSubmit={submit}><label className="block">New password<input className="mt-1 w-full rounded border p-2" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} /></label><label className="block">Confirm password<input className="mt-1 w-full rounded border p-2" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={8} /></label><button className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" disabled={saving} type="submit">{saving ? "Saving…" : "Update password"}</button></form>{message && <p className="mt-4" role="status">{message}</p>}</main>;
}
