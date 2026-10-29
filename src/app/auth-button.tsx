"use client";

import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function sendSignInLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setIsLoading(false);
    setMessage(error ? error.message : "Check your email for a secure sign-in link.");
  }

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage(error.message);
      return;
    }
    setUser(null);
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden max-w-36 truncate text-xs text-slate-500 sm:block">{user.email}</span>
        <button onClick={signOut} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50">Sign out</button>
      </div>
    );
  }

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50">Sign in</button>
      {isOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/30 p-4" role="dialog" aria-modal="true" aria-labelledby="sign-in-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between">
              <div><p className="text-sm font-medium text-emerald-700">Secure access</p><h2 id="sign-in-title" className="mt-1 text-xl font-bold">Sign in to Homewise</h2><p className="mt-1 text-sm text-slate-500">We will email you a one-time sign-in link. No password is needed.</p></div>
              <button onClick={() => setIsOpen(false)} aria-label="Close sign-in form" className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100">×</button>
            </div>
            <form onSubmit={sendSignInLink} className="space-y-4">
              <label className="block text-sm font-semibold text-slate-700">Email address
                <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
              </label>
              <button disabled={isLoading} type="submit" className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">{isLoading ? "Sending link..." : "Email me a sign-in link"}</button>
              {message && <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{message}</p>}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
