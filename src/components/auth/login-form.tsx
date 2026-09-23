import { useState, type FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { useDeskSession } from "@/lib/firebase/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({
  callbackURL = "/trade",
  admin = false,
}: {
  callbackURL?: string;
  admin?: boolean;
}) {
  const router = useRouter();
  const { signInEmail, signUpEmail, signInGoogle, resetPassword } = useDeskSession();
  const [mode, setMode] = useState<"in" | "up" | "reset">("in");
  const [email, setEmail] = useState(admin ? "yuvraj1075" : "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      if (mode === "reset") {
        await resetPassword(email);
        setNotice("Reset link sent. Open that Gmail and set a new password, then sign in.");
        setMode("in");
        return;
      }
      if (mode === "up") {
        if (!email.includes("@")) throw new Error("Use a Gmail address to create an account.");
        await signUpEmail(email, password, email.split("@")[0] || "Trader");
      } else {
        await signInEmail(email, password);
      }
      await router.invalidate();
      await router.navigate({ to: callbackURL });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setPending(false);
    }
  }

  async function onGoogle() {
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      await signInGoogle();
      await router.invalidate();
      await router.navigate({ to: callbackURL });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-4">
      {!admin && mode !== "reset" && (
        <>
          <Button type="button" className="w-full" disabled={pending} onClick={() => void onGoogle()}>
            {pending ? "Opening Google…" : "Continue with Google"}
          </Button>
          <p className="text-center text-[11px] uppercase tracking-wide text-subtle">or Gmail</p>
        </>
      )}
      <form onSubmit={onEmail} className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-[12px] text-muted">
            {admin ? "Admin user id" : mode === "up" ? "Gmail" : "Gmail or user id"}
          </span>
          <Input
            type={mode === "up" || mode === "reset" ? "email" : "text"}
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={admin ? "yuvraj1075" : "you@gmail.com"}
          />
        </label>
        {mode !== "reset" && (
          <label className="block">
            <span className="mb-1.5 block text-[12px] text-muted">Password</span>
            <Input
              type="password"
              autoComplete={mode === "up" ? "new-password" : "current-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        {notice && <p className="text-sm text-buy">{notice}</p>}
        {error && <p className="text-sm text-sell">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending
            ? "Please wait…"
            : mode === "reset"
              ? "Send reset email"
              : mode === "up"
                ? "Create account"
                : "Sign in"}
        </Button>
      </form>
      {!admin && (
        <div className="flex flex-col gap-2 text-sm text-muted">
          {mode === "in" && (
            <button
              type="button"
              className="hover:text-fg"
              onClick={() => {
                setMode("reset");
                setError(null);
                setNotice(null);
              }}
            >
              Forgot password?
            </button>
          )}
          <button
            type="button"
            className="hover:text-fg"
            onClick={() => {
              setMode((m) => (m === "up" ? "in" : m === "reset" ? "in" : "up"));
              setError(null);
              setNotice(null);
            }}
          >
            {mode === "in"
              ? "New here? Create a Gmail account"
              : mode === "up"
                ? "Already registered? Sign in"
                : "Back to sign in"}
          </button>
        </div>
      )}
    </div>
  );
}