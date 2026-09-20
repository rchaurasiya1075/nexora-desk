import { useState, type FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({ callbackURL = "/trade" }: { callbackURL?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === "up") {
        const res = await authClient.signUp.email({
          email,
          password,
          name: email.split("@")[0] || "Trader",
        });
        if (res.error) throw new Error(res.error.message || "Could not create account.");
      } else {
        const res = await authClient.signIn.email({ email, password });
        if (res.error) throw new Error(res.error.message || "Could not sign in.");
      }
      await router.invalidate();
      await router.navigate({ to: callbackURL });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setPending(false);
    }
  }

  if (!authEnabled) {
    return <p className="text-sm text-muted">Sign-in is disabled.</p>;
  }

  return (
    <div className="w-full max-w-sm space-y-4">
      <div className="space-y-2">
        {GROK_PROVIDERS.map((p) => (
          <Button
            key={p.providerId}
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => signIn(p.providerId, { callbackURL })}
          >
            Continue with {p.label}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-wide text-subtle">
        <span className="h-px flex-1 bg-border" />
        Email
        <span className="h-px flex-1 bg-border" />
      </div>
      <form onSubmit={onEmail} className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-[12px] text-muted">Email</span>
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12px] text-muted">Password</span>
          <Input
            type="password"
            autoComplete={mode === "up" ? "new-password" : "current-password"}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="text-sm text-sell">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Please wait…" : mode === "up" ? "Create account" : "Sign in"}
        </Button>
      </form>
      <button
        type="button"
        className="w-full text-sm text-muted hover:text-fg"
        onClick={() => {
          setMode((m) => (m === "in" ? "up" : "in"));
          setError(null);
        }}
      >
        {mode === "in" ? "New here? Create an account" : "Already registered? Sign in"}
      </button>
    </div>
  );
}
