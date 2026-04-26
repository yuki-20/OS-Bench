"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { admin } from "@/lib/api";
import {
  Badge,
  Banner,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Modal,
  Select,
  Spinner,
} from "@/components/ui";

const ROLES = ["operator", "reviewer", "manager", "safety_lead", "admin"];

export default function TeamPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["members"], queryFn: admin.members });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    email: "",
    display_name: "",
    role: "operator",
    initial_password: "Bench!Demo1",
  });
  const [err, setErr] = useState<string | null>(null);
  const invite = useMutation({
    mutationFn: () => admin.invite(form.email, form.display_name, form.role, form.initial_password),
    onSuccess: () => {
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e: Error) => setErr(e.message),
  });
  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => admin.updateRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-sm text-ink-500">Invite members and manage roles.</p>
        </div>
        <Button onClick={() => setOpen(true)}>+ Invite</Button>
      </div>

      <Card>
        <CardBody className="p-0">
          {list.isLoading ? (
            <div className="p-6 text-ink-500"><Spinner /> Loading…</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-xs uppercase text-ink-500">
                <tr>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Role</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {(list.data || []).map((m) => (
                  <tr key={m.membership_id} className="border-t border-ink-100">
                    <td className="px-4 py-2">{m.user.display_name}</td>
                    <td className="px-4 py-2 text-ink-600">{m.user.email}</td>
                    <td className="px-4 py-2">
                      <Select
                        value={m.role}
                        onChange={(e) =>
                          updateRole.mutate({ id: m.membership_id, role: e.target.value })
                        }
                        className="w-40"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-4 py-2"><Badge variant="muted">{m.user.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Invite member">
        <div className="space-y-3">
          <div>
            <Label>Email</Label>
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>Display name</Label>
            <Input
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Initial password</Label>
            <Input
              value={form.initial_password}
              onChange={(e) => setForm({ ...form, initial_password: e.target.value })}
            />
          </div>
          {err && <Banner tone="danger">{err}</Banner>}
          <Button onClick={() => invite.mutate()} disabled={invite.isPending} className="w-full">
            {invite.isPending ? "Inviting…" : "Invite"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
