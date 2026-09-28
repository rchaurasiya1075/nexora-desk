import { useState, type FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { useDeskSession } from "@/lib/firebase/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const FAIL_KEY = "sikkaaa.admin.fails";

function locked() {
  try {
    const raw = sessionStorage.getItem(FAIL_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { n: number; until: number };
    return parsed.until > Date.now();
  } catch {
    return false;
  }
}

function noteFail() {
  try {
    const raw = sessionStorage.getItem(FAIL_KEY);
    const parsed = raw ? (JSON.parse(raw) as { n: number; until: number }) : { n: 0, until: 0 };
    const n = parsed.until > Date.now() ? parsed.n : parsed.n + 1;
    const until = n >= 5 ? Date.now() + 120_000 : 0;
    sessionStorage.setItem(FAIL_KEY, JSON.stringify({ n: until ? 0 : n, until }));
  } catch {
    /* ignore */
  }
}

export function LoginForm({
  callbackURL = "/trade",
  admin = false,
}: {
  callbackURL?: string;
  admin?: boolean;
}) {
  const router = useRouter();
  const { signInEmail, signInGoogle, resetPassword, verifyGmail, registerLocalAccount } = useDeskSession();
  const [mode, setMode] = useState<"in" | "up" | "reset">("in");
  const [step, setStep] = useState<"details" | "access">("details");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (admin && locked()) {
      setError("Too many attempts. Wait two minutes, then try again.");
      return;
    }
    setPending(true);
    try {
      if (mode === "reset") {
        await resetPassword(email);
        setNotice("Reset link sent. Open that Gmail and set a new password, then sign in.");
        setMode("in");
        return;
      }
      if (mode === "up") {
        if (step === "details") {
          if (name.trim().length < 2) throw new Error("Enter your full name.");
          if (!/^\d{10}$/.test(phone.replace(/\s/g, ""))) throw new Error("Enter a 10-digit mobile number.");
          if (!email.toLowerCase().endsWith("@gmail.com")) throw new Error("Use a Gmail address.");
          await verifyGmail(email);
          setStep("access");
          setNotice("Gmail verified. Now choose the user id and password you will use to sign in.");
          return;
        }
        if (!/^[a-zA-Z0-9._]{4,20}$/.test(userId.trim())) throw new Error("User id must be 4 to 20 letters or numbers.");
        if (password.length < 6) throw new Error("Password must be at least 6 characters.");
        if (password !== confirm) throw new Error("Password and confirm password do not match.");
        await registerLocalAccount({
          email,
          password,
          name: name.trim(),
          phone: phone.replace(/\s/g, ""),
          username: userId.trim().toLowerCase(),
        });
      } else {
        await signInEmail(email, password);
      }
      await router.invalidate();
      await router.navigate({ to: callbackURL });
    } catch (err) {
      if (admin) noteFail();
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
      {!admin && mode === "in" && (
        <>
          <Button type="button" className="w-full" disabled={pending} onClick={() => void onGoogle()}>
            {pending ? "Opening Google…" : "Continue with Google"}
          </Button>
          <p className="text-center text-[11px] uppercase tracking-wide text-subtle">or user id</p>
        </>
      )}
      <form onSubmit={onEmail} className="space-y-3">
        {mode === "up" && step === "details" && (
          <>
            <label className="block">
              <span className="mb-1.5 block text-[12px] text-muted">Full name</span>
              <Input required value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} placeholder="Your legal name" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] text-muted">Mobile number</span>
              <Input required inputMode="numeric" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" />
            </label>
          </>
        )}
        {mode === "up" && step === "access" ? (
          <label className="block">
            <span className="mb-1.5 block text-[12px] text-muted">User id</span>
            <Input required value={userId} autoComplete="username" onChange={(e) => setUserId(e.target.value)} placeholder="Choose a user id" />
          </label>
        ) : (
          <label className="block">
            <span className="mb-1.5 block text-[12px] text-muted">
              {admin ? "Admin user id" : mode === "up" ? "Gmail" : "User id or Gmail"}
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
        )}
        {(mode === "in" || (mode === "up" && step === "access")) && (
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
        {mode === "up" && step === "access" && (
          <label className="block">
            <span className="mb-1.5 block text-[12px] text-muted">Confirm password</span>
            <Input type="password" autoComplete="new-password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </label>
        )}
        {mode === "up" && step === "details" && (
          <p className="text-xs text-muted">Next, Google confirms this Gmail. Email codes are off in Firebase, so this check is the Gmail proof. Then you set a user id and password.</p>
        )}
        {notice && <p className="text-sm text-buy">{notice}</p>}
        {error && <p className="text-sm text-sell">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending
            ? "Please wait…"
            : mode === "reset"
              ? "Send reset email"
              : mode === "up"
                ? step === "details"
                  ? "Verify Gmail"
                  : "Create account"
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
              setStep("details");
              setError(null);
              setNotice(null);
            }}
          >
            {mode === "in"
              ? "New here? Create an account"
              : mode === "up"
                ? "Already registered? Sign in"
                : "Back to sign in"}
          </button>
        </div>
      )}
    </div>
  );
}
