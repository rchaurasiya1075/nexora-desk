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
  const { signInEmail, signUpEmail, signInGoogle } = useDeskSession();
  const [mode, setMode] = useState<"in" | "up">(admin ? "in" : "in");
  const [email, setEmail] = useState(admin ? "yuvraj1075" : "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
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
      {!admin && (
        <>
          <Button type="button" className="w-full" disabled={pending} onClick={() => void onGoogle()}>
            {pending ? "Opening Google…" : "Continue with Google"}
          </Button>
          <p className="text-center text-[11px] uppercase tracking-wide text-subtle">or user id</p>
        </>
      )}
      <form onSubmit={onEmail} className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-[12px] text-muted">
            {mode === "up" ? "Gmail" : "Gmail or user id"}
          </span>
          <Input
            type={mode === "up" ? "email" : "text"}
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={mode === "up" ? "you@gmail.com" : "you@gmail.com"}
          />
        </label>
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
        {error && <p className="text-sm text-sell">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Please wait…" : mode === "up" ? "Create account" : "Sign in"}
        </Button>
      </form>
      {!admin && (
        <button
          type="button"
          className="w-full text-sm text-muted hover:text-fg"
          onClick={() => {
            setMode((m) => (m === "in" ? "up" : "in"));
            setError(null);
          }}
        >
          {mode === "in" ? "New here? Create a Gmail account" : "Already registered? Sign in"}
        </button>
      )}
    </div>
  );
}
