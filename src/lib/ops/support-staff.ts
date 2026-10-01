import { useEffect, useState } from "react";
import { collection, doc, getDocs, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { hashPassword } from "@/lib/desk/local-store";
import { writer } from "@/lib/ops/p2p";

export type SupportAgent = {
  id: string;
  name: string;
  passwordHash: string;
  createdAt: string;
};

type StaffBook = {
  agents: SupportAgent[];
  updatedAt: string;
};

const SESSION_KEY = "morgan.support.agent";
const MAX_AGE = 12 * 60 * 60 * 1000;

function asAgent(raw: unknown): SupportAgent | null {
  const row = raw as Partial<SupportAgent>;
  if (!row?.id || !row.passwordHash) return null;
  return {
    id: String(row.id).slice(0, 24),
    name: String(row.name || row.id).slice(0, 40),
    passwordHash: String(row.passwordHash),
    createdAt: String(row.createdAt || ""),
  };
}

function asBook(raw: unknown): StaffBook | null {
  const book = raw as Partial<StaffBook>;
  if (!book || !Array.isArray(book.agents)) return null;
  return {
    agents: book.agents.map(asAgent).filter((row): row is SupportAgent => !!row),
    updatedAt: String(book.updatedAt || ""),
  };
}

function newest(books: StaffBook[]) {
  return books.reduce<StaffBook>((best, book) => (book.updatedAt >= best.updatedAt ? book : best), { agents: [], updatedAt: "" });
}

export function watchSupportStaff(onAgents: (rows: SupportAgent[]) => void) {
  return onSnapshot(collection(db, "users"), (snap) => {
    const books: StaffBook[] = [];
    snap.forEach((row) => {
      const book = asBook(row.data().supportStaff);
      if (book) books.push(book);
    });
    onAgents(newest(books).agents);
  }, () => onAgents([]));
}

async function loadBook() {
  const snap = await getDocs(collection(db, "users"));
  const books: StaffBook[] = [];
  snap.forEach((row) => {
    const book = asBook(row.data().supportStaff);
    if (book) books.push(book);
  });
  return newest(books);
}

async function saveBook(agents: SupportAgent[]) {
  const user = await writer();
  await setDoc(
    doc(db, "users", user.uid),
    { supportStaff: { agents, updatedAt: new Date().toISOString() } },
    { merge: true },
  );
}

export async function createSupportAgent(input: { id: string; name: string; password: string }) {
  const id = input.id.trim();
  const name = input.name.trim() || id;
  if (!/^[a-zA-Z0-9._-]{3,24}$/.test(id)) throw new Error("User id must be 3 to 24 letters or numbers.");
  if (input.password.length < 6) throw new Error("Password must be at least 6 characters.");
  const book = await loadBook();
  const passwordHash = await hashPassword(input.password);
  const prev = book.agents.find((row) => row.id.toLowerCase() === id.toLowerCase());
  const next: SupportAgent = { id, name: name.slice(0, 40), passwordHash, createdAt: prev?.createdAt || new Date().toISOString() };
  const agents = [next, ...book.agents.filter((row) => row.id.toLowerCase() !== id.toLowerCase())];
  await saveBook(agents);
}

export async function removeSupportAgent(id: string) {
  const book = await loadBook();
  await saveBook(book.agents.filter((row) => row.id.toLowerCase() !== id.toLowerCase()));
}

export function readAgentSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const row = JSON.parse(raw) as { id?: string; name?: string; at?: number };
    if (!row.id || !row.at || Date.now() - row.at > MAX_AGE) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return { id: row.id, name: row.name || row.id };
  } catch {
    return null;
  }
}

export function logoutSupportAgent() {
  sessionStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event("support-agent"));
}

export async function loginSupportAgent(id: string, password: string) {
  const book = await loadBook();
  const hash = await hashPassword(password);
  const agent = book.agents.find((row) => row.id.toLowerCase() === id.trim().toLowerCase());
  if (!agent || agent.passwordHash !== hash) throw new Error("User id or password is wrong.");
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: agent.id, name: agent.name, at: Date.now() }));
  window.dispatchEvent(new Event("support-agent"));
  return { id: agent.id, name: agent.name };
}

export function useSupportAgent() {
  const [agent, setAgent] = useState(readAgentSession);
  useEffect(() => {
    const sync = () => setAgent(readAgentSession());
    window.addEventListener("support-agent", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("support-agent", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return agent;
}
