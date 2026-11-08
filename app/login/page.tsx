"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handlePasswordReset() {
    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }

    setResetLoading(true);

    const supabase = createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/set-password`,
    });

    if (error) {
      setError(error.message);
      setResetLoading(false);
      return;
    }

    setSuccess(
      "If an account exists for this email, a password recovery link has been sent. Check your inbox.",
    );

    setResetLoading(false);
  }

  return (
    <main className="auth-page">
      <Link href="/" className="brand">
        <span className="brand-mark">S</span> SchoolScore
      </Link>

      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="eyebrow">WELCOME BACK</div>

        <h1>Sign in to your workspace</h1>

        <p className="muted">
          Use the account provided by your school administrator.
        </p>

        <label>
          Email address
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>

        <div className="text-right">
          <button
            type="button"
            onClick={handlePasswordReset}
            disabled={resetLoading}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            {resetLoading ? "Sending recovery link..." : "Forgot password?"}
          </button>
        </div>

        {error && <div className="error-box">{error}</div>}

        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <button className="button button-primary full-width" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
