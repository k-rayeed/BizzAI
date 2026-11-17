import { useState } from "react";
import { supabase, configError } from "../supabaseClient";

export default function FinanceLogin({ onSignedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      if (!supabase) {
        throw new Error(configError || "Supabase is not configured.");
      }

      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (signInError) throw signInError;

      setPassword("");
      onSignedIn?.(data.session);
    } catch (err) {
      setError(err.message || "Could not sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page finance-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">FINANCE & PAYROLL</div>
          <h1>Finance sign in</h1>
          <p>Sign in with your business account to access finance.</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <form
        className="form-grid finance-login"
        onSubmit={handleSubmit}
      >
        <label>
          Email
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <button
          type="submit"
          className="button button-primary"
          disabled={busy}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}