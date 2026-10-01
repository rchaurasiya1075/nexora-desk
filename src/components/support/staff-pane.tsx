import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupportAgent, removeSupportAgent, watchSupportStaff, type SupportAgent } from "@/lib/ops/support-staff";

export function SupportStaffPane() {
  const [agents, setAgents] = useState<SupportAgent[]>([]);
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => watchSupportStaff(setAgents), []);

  async function create() {
    setBusy(true);
    try {
      await createSupportAgent({ id, name, password });
      setName("");
      setId("");
      setPassword("");
      toast.success("Support login saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the login.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Support employee login</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Create a user id and password for an employee. They can sign in only at the customer support desk, not the rest of this admin panel.
      </p>
      <p className="mt-2 text-sm text-white">Login link: /#/support-login</p>
      <div className="mt-5 grid max-w-md gap-2">
        <Input value={name} placeholder="Employee name" onChange={(e) => setName(e.target.value)} />
        <Input value={id} placeholder="User id" onChange={(e) => setId(e.target.value)} />
        <Input value={password} type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
        <Button type="button" disabled={busy} onClick={() => void create()}>
          {busy ? "Saving…" : "Create login"}
        </Button>
      </div>
      <ul className="mt-6 max-w-md divide-y divide-white/10">
        {agents.map((row) => (
          <li key={row.id} className="flex items-center justify-between py-3 text-sm">
            <span>
              <span className="block font-medium text-white">{row.name}</span>
              <span className="text-muted">{row.id}</span>
            </span>
            <button
              type="button"
              className="text-xs text-red-300"
              onClick={() => void removeSupportAgent(row.id).catch((err) => toast.error(err instanceof Error ? err.message : "Could not remove."))}
            >
              Remove
            </button>
          </li>
        ))}
        {!agents.length && <li className="py-3 text-sm text-muted">No support employees yet.</li>}
      </ul>
    </div>
  );
}
