import { useState, type FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { useDeskSession } from "@/lib/firebase/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({ callbackURL = "/trade" }: { callbackURL?: string }) {
  const router = useRouter();
  const { signInEmail, signUpEmail, enterDemo } = useDeskSession();
  const [mode, setMode] = useState<"in" | "up">("up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function go() {
    await router.invalidate();
    await router.navigate({ to: callbackURL });
  }

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === "up") {
        await signUpEmail(email, password, email.split("@")[0] || "Trader");
      } else {
        await signInEmail(email, password);
      }
      await go();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setPending(false);
    }
  }

  async function onDemo() {
    setError(null);
    setPending(true);
    try {
      await enterDemo();
      await go();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the desk.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-4">
      <Button
        type="button"
        className="w-full"
        size="lg"
        disabled={pending}
        onClick={() => void onDemo()}
      >
        {pending ? "Opening desk…" : "Open paper desk — $10,000"}
      </Button>
      <p className="text-center text-[12px] text-subtle">
        Instant web trader. No Firebase click required.
      </p>
      <div className="relative py-1 text-center text-[11px] uppercase tracking-wide text-subtle">
        <span className="bg-bg px-2">or email</span>
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
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="text-sm text-sell">{error}</p>}
        <Button type="submit" className="w-full" variant="outline" disabled={pending}>
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
      <p className="text-center text-[11px] text-subtle">
        Shared login across devices needs{" "}
        <a
          className="underline hover:text-fg"
          href="https://console.firebase.google.com/project/nexora-bb654/authentication/providers"
          target="_blank"
          rel="noreferrer"
        >
          Email/Password enabled
        </a>{" "}
        on nexora-bb654.
      </p>
    </div>
  );
}
