import { collection, doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db, firebaseAuth } from "@/lib/firebase/client";
import { writer } from "@/lib/ops/p2p";

export type SupportLine = {
  id: string;
  from: "user" | "admin";
  text: string;
  image?: string;
  at: string;
};

export type SupportThread = {
  userId: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  balance: number | null;
  lines: SupportLine[];
  status: "pending" | "resolved";
  note: string;
  unread: number;
  customerSeen: string;
  typing: boolean;
};

type DeskMeta = {
  readAt?: string;
  status?: "pending" | "resolved";
  note?: string;
  typing?: string;
};

function fresh(iso?: string) {
  if (!iso) return false;
  const at = new Date(iso).getTime();
  return Number.isFinite(at) && Date.now() - at < 8_000;
}

function asLines(raw: unknown): SupportLine[] {
  if (!Array.isArray(raw)) return [];
  const rows: SupportLine[] = [];
  for (const row of raw) {
    const line = row as Partial<SupportLine>;
    if (line.from !== "user" && line.from !== "admin") continue;
    const text = String(line.text || "").slice(0, 1000);
    const image = typeof line.image === "string" && line.image.startsWith("data:image/") && line.image.length < 120_000 ? line.image : "";
    if (!text && !image) continue;
    rows.push({
      id: String(line.id || Math.random().toString(36).slice(2)),
      from: line.from,
      text,
      image: image || undefined,
      at: String(line.at || ""),
    });
  }
  return rows;
}

function fit(lines: SupportLine[]) {
  let rows = lines.slice(-20);
  while (rows.length > 1 && JSON.stringify(rows).length > 700_000) rows = rows.slice(1);
  return rows;
}

export async function sendSupport(input: { name: string; email: string; userId: string; text: string; image?: string; phone?: string }) {
  const text = input.text.trim().slice(0, 1000);
  const image = input.image && input.image.startsWith("data:image/") ? input.image : "";
  if (!text && !image) return;
  const user = await writer();
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const line: SupportLine = {
    id: `s${Date.now().toString(36)}`,
    from: "user",
    text,
    image: image || undefined,
    at: new Date().toISOString(),
  };
  await setDoc(
    ref,
    {
      name: input.name.slice(0, 40),
      email: input.email.slice(0, 80),
      phone: (input.phone || "").slice(0, 20),
      deskUserId: input.userId,
      supportChat: fit([...asLines(snap.data()?.supportChat), line]),
      supportTyping: "",
    },
    { merge: true },
  );
}

export async function replySupport(userId: string, text: string, image?: string) {
  const clean = text.trim().slice(0, 1000);
  const photo = image && image.startsWith("data:image/") ? image : "";
  if (!clean && !photo) return;
  const user = await writer();
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const bag = (snap.data()?.supportReplies as Record<string, SupportLine[]> | undefined) || {};
  const line: SupportLine = {
    id: `a${Date.now().toString(36)}`,
    from: "admin",
    text: clean,
    image: photo || undefined,
    at: new Date().toISOString(),
  };
  bag[userId] = fit([...asLines(bag[userId]), line]);
  await setDoc(ref, { supportReplies: bag, role: "admin" }, { merge: true });
}

export function watchSupportThreads(onThreads: (rows: SupportThread[]) => void) {
  return onSnapshot(collection(db, "users"), (snap) => {
    const replies = new Map<string, SupportLine[]>();
    const meta = new Map<string, DeskMeta>();
    snap.forEach((row) => {
      const bag = row.data().supportReplies as Record<string, unknown> | undefined;
      if (bag) {
        for (const [userId, lines] of Object.entries(bag)) replies.set(userId, asLines(lines));
      }
      const desk = row.data().supportDesk as Record<string, DeskMeta> | undefined;
      if (!desk) return;
      for (const [userId, value] of Object.entries(desk)) {
        const prev = meta.get(userId) || {};
        meta.set(userId, {
          readAt: (value.readAt || "") > (prev.readAt || "") ? value.readAt : prev.readAt,
          status: value.status || prev.status,
          note: value.note ?? prev.note,
          typing: (value.typing || "") > (prev.typing || "") ? value.typing : prev.typing,
        });
      }
    });
    const threads: SupportThread[] = [];
    snap.forEach((row) => {
      const data = row.data();
      const own = asLines(data.supportChat);
      const extra = replies.get(row.id) || [];
      const lines = [...own, ...extra].sort((a, b) => a.at.localeCompare(b.at));
      if (!lines.length) return;
      const info = meta.get(row.id) || {};
      const readAt = info.readAt || "";
      const unread = lines.filter((line) => line.from === "user" && line.at > readAt).length;
      threads.push({
        userId: row.id,
        name: String(data.name || "Trader"),
        email: String(data.email || ""),
        phone: String(data.phone || ""),
        createdAt: String(data.createdAt || ""),
        balance: typeof data.balance === "number" ? data.balance : null,
        lines,
        status: info.status === "resolved" ? "resolved" : "pending",
        note: String(info.note || ""),
        unread,
        customerSeen: String(data.supportSeen || ""),
        typing: fresh(String(data.supportTyping || "")),
      });
    });
    threads.sort((a, b) => (b.lines.at(-1)?.at || "").localeCompare(a.lines.at(-1)?.at || ""));
    onThreads(threads);
  }, () => onThreads([]));
}

async function patchDesk(userId: string, patch: DeskMeta) {
  const user = await writer();
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const bag = { ...((snap.data()?.supportDesk as Record<string, DeskMeta> | undefined) || {}) };
  bag[userId] = { ...bag[userId], ...patch };
  await setDoc(ref, { supportDesk: bag, role: "admin" }, { merge: true });
}

export function markSupportRead(userId: string) {
  return patchDesk(userId, { readAt: new Date().toISOString() });
}

export function setSupportStatus(userId: string, status: "pending" | "resolved") {
  return patchDesk(userId, { status });
}

export function saveSupportNote(userId: string, note: string) {
  return patchDesk(userId, { note: note.slice(0, 500) });
}

export function setAdminTyping(userId: string, on: boolean) {
  return patchDesk(userId, { typing: on ? new Date().toISOString() : "" });
}

export async function markCustomerSeen() {
  const user = await writer();
  await setDoc(doc(db, "users", user.uid), { supportSeen: new Date().toISOString() }, { merge: true });
}

export async function setCustomerTyping(on: boolean) {
  const user = await writer();
  await setDoc(doc(db, "users", user.uid), { supportTyping: on ? new Date().toISOString() : "" }, { merge: true });
}

export function watchMySupport(onLines: (rows: SupportLine[]) => void, onTyping?: (typing: boolean) => void) {
  return onSnapshot(collection(db, "users"), (snap) => {
    const me = firebaseAuth.currentUser?.uid || "";
    if (!me) {
      onLines([]);
      onTyping?.(false);
      return;
    }
    let own: SupportLine[] = [];
    let extra: SupportLine[] = [];
    let typing = false;
    snap.forEach((row) => {
      if (row.id === me) own = asLines(row.data().supportChat);
      const bag = row.data().supportReplies as Record<string, unknown> | undefined;
      if (bag?.[me]) extra = extra.concat(asLines(bag[me]));
      const desk = row.data().supportDesk as Record<string, DeskMeta> | undefined;
      if (desk?.[me] && fresh(desk[me].typing)) typing = true;
    });
    onLines([...own, ...extra].sort((a, b) => a.at.localeCompare(b.at)));
    onTyping?.(typing);
  }, () => onLines([]));
}

export function shrinkImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 720 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read that photo."));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      let quality = 0.62;
      let data = canvas.toDataURL("image/jpeg", quality);
      while (data.length > 70_000 && quality > 0.28) {
        quality -= 0.08;
        data = canvas.toDataURL("image/jpeg", quality);
      }
      if (data.length > 100_000) reject(new Error("Photo is too large. Choose a smaller one."));
      else resolve(data);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that photo."));
    };
    img.src = url;
  });
}
