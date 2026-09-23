export function firebaseMessage(err: unknown): string {
  const code =
    err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
  const raw = err instanceof Error ? err.message : "Something went wrong.";
  const blob = `${code} ${raw}`;
  if (isAuthNotConfigured(err)) {
    return "Sign-in failed. Use your Gmail and password, or the admin user id.";
  }
  switch (code) {
    case "auth/email-already-in-use":
      return "That email is already registered.";
    case "auth/invalid-email":
      return "Enter a valid email.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password is wrong.";
    case "auth/operation-not-allowed":
      return "Enable Email/Password in Firebase Authentication, then try again.";
    case "auth/unauthorized-domain":
      return "Firebase → Authentication → Settings → Authorized domains mein rchaurasiya1075.github.io add karo.";
    case "auth/popup-blocked":
      return "Browser ne Google popup block kar diya. Allow popups, phir Continue with Google dabao.";
    case "auth/account-exists-with-different-credential":
      return "Ye Gmail pehle kisi aur method se bana hai. Wahi method use karo.";
    case "permission-denied":
      return "Firestore rules blocked this. Use test mode or the Nexora rules on project nexora-bb654.";
    case "unavailable":
      return "Firebase is unreachable. Create the Firestore database for nexora-bb654.";
    default:
      if (/firestore/i.test(raw)) {
        return "Could not reach Firestore. Create the Firestore database in Firebase, then retry.";
      }
      return raw;
  }
}

export function isAuthNotConfigured(err: unknown): boolean {
  const code =
    err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const blob = `${code} ${raw}`;
  return /CONFIGURATION_NOT_FOUND|configuration-not-found|auth\/operation-not-allowed|auth\/admin-restricted-operation/i.test(
    blob,
  );
}