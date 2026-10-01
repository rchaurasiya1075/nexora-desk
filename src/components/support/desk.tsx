import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDeskSession } from "@/lib/firebase/session";
import {
  replySupport,
  sendSupport,
  shrinkImage,
  watchMySupport,
  watchSupportThreads,
  type SupportLine,
  type SupportThread,
} from "@/lib/ops/support-chat";

function when(iso: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Bubbles({ lines, mine }: { lines: SupportLine[]; mine: "user" | "admin" }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [lines]);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1 py-3">
      {lines.length === 0 && <p className="text-sm text-muted">No messages yet. Write the concern, or attach a photo.</p>}
      {lines.map((line) => {
        const own = line.from === mine;
        return (
          <div key={line.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${own ? "ml-auto bg-[#00b386] text-white" : "bg-bg-subtle"}`}>
            <p className={`text-[10px] ${own ? "text-white/80" : "text-subtle"}`}>{own ? "You" : line.from === "admin" ? "Solution" : "Complaint"} · {when(line.at)}</p>
            {line.text && <p className="mt-1 whitespace-pre-wrap">{line.text}</p>}
            {line.image && <img src={line.image} alt="Shared" className="mt-2 max-h-56 rounded-lg" />}
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}

function Composer({
  onSend,
}: {
  onSend: (text: string, image?: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  async function send() {
    if (busy || (!text.trim() && !image)) return;
    setBusy(true);
    try {
      await onSend(text, image || undefined);
      setText("");
      setImage("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Message was not sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-border pt-3">
      {image && <img src={image} alt="Ready to send" className="mb-2 h-16 rounded-lg" />}
      <div className="flex items-center gap-2">
        <button type="button" className="h-10 rounded-lg bg-bg-subtle px-3 text-xs" onClick={() => file.current?.click()}>
          Photo
        </button>
        <input
          ref={file}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const picked = e.target.files?.[0];
            e.target.value = "";
            if (!picked) return;
            void shrinkImage(picked).then(setImage).catch((err) => toast.error(err instanceof Error ? err.message : "Photo failed"));
          }}
        />
        <Input
          value={text}
          placeholder="Write your concern"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send();
          }}
        />
        <Button type="button" disabled={busy} onClick={() => void send()}>
          Send
        </Button>
      </div>
    </div>
  );
}

export function CustomerSupport() {
  const { user } = useDeskSession();
  const [lines, setLines] = useState<SupportLine[]>([]);
  useEffect(() => watchMySupport(setLines), []);
  if (!user) return null;

  return (
    <main className="mx-auto flex h-dvh max-w-lg flex-col bg-bg px-4 py-4 text-fg">
      <header className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <Logo compact />
          <p className="mt-1 text-sm text-muted">Raise a complaint. The admin reply shows in this chat.</p>
        </div>
        <Link to="/trade" className="text-sm text-muted">
          Back
        </Link>
      </header>
      <Bubbles lines={lines} mine="user" />
      <Composer
        onSend={(text, image) => sendSupport({ name: user.name, email: user.email, userId: user.id, text, image })}
      />
    </main>
  );
}

export function SupportInbox() {
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => watchSupportThreads(setThreads), []);
  const thread = threads.find((row) => row.userId === open) || threads[0];

  return (
    <div className="grid min-h-[70vh] gap-4 md:grid-cols-[240px_1fr]">
      <ul className="max-h-[70vh] space-y-1 overflow-y-auto">
        {threads.map((row) => {
          const last = row.lines.at(-1);
          return (
            <li key={row.userId}>
              <button
                type="button"
                onClick={() => setOpen(row.userId)}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm ${thread?.userId === row.userId ? "bg-bg-subtle" : ""}`}
              >
                <span className="block font-medium">{row.name}</span>
                <span className="block truncate text-xs text-muted">{row.email}</span>
                <span className="mt-1 block truncate text-xs text-subtle">{last?.image && !last.text ? "Photo" : last?.text}</span>
              </button>
            </li>
          );
        })}
        {!threads.length && <li className="text-sm text-muted">No customer messages yet.</li>}
      </ul>
      {thread && (
        <div className="flex min-h-[70vh] flex-col">
          <p className="text-sm font-medium">{thread.name}</p>
          <p className="text-xs text-muted">{thread.email || thread.userId}</p>
          <Bubbles lines={thread.lines} mine="admin" />
          <Composer onSend={(text, image) => replySupport(thread.userId, text, image)} />
        </div>
      )}
    </div>
  );
}
