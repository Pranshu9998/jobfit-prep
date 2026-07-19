"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendMagicLink(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setMessage(error ? error.message : "Check your email for a secure sign-in link.");
    setBusy(false);
  }

  return <main className="login-shell"><section className="login-card"><div className="eyebrow"><span />Private beta</div><h1>Prepare for the role,<br /><em>not the average.</em></h1><p>Sign in to keep your confirmed resume facts, tailored drafts, and interview packs synced to your account.</p><form onSubmit={sendMagicLink}><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /><button className="primary-button" disabled={busy} type="submit">{busy ? "Sending link…" : "Email me a sign-in link"}</button></form>{message && <div className="login-message" role="status">{message}</div>}<small>No password required. Your application materials stay private to your account.</small></section><aside className="login-proof"><span>ONE JOB / ONE PACK</span><blockquote>“Your experience stays factual. The positioning gets sharper.”</blockquote><div><b>01</b><p>Confirm your evidence</p></div><div><b>02</b><p>Measure role alignment</p></div><div><b>03</b><p>Tailor and prepare</p></div></aside></main>;
}
