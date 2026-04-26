"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { admin } from "@/lib/api";
import {
  Banner,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Modal,
  Spinner,
} from "@/components/ui";

const EVENT_TYPES = [
  "run_created",
  "run_started",
  "run_completed",
  "run_blocked",
  "deviation_added",
  "override_requested",
];

export default function SettingsPage() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["org-settings"], queryFn: admin.settings });
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [retention, setRetention] = useState(365);

  useEffect(() => {
    if (settings.data) {
      setName(settings.data.name);
      setRegion(settings.data.data_region);
      setRetention(settings.data.retention_policy_days);
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () =>
      admin.patchSettings({ name, data_region: region, retention_policy_days: retention }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-settings"] }),
  });

  // Webhooks
  const webhooks = useQuery({ queryKey: ["webhooks"], queryFn: admin.webhooks });
  const [whOpen, setWhOpen] = useState(false);
  const [whUrl, setWhUrl] = useState("");
  const [whEvents, setWhEvents] = useState<Set<string>>(new Set());
  const addWebhook = useMutation({
    mutationFn: () => admin.addWebhook(whUrl, Array.from(whEvents)),
    onSuccess: () => {
      setWhOpen(false);
      setWhUrl("");
      setWhEvents(new Set());
      qc.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });
  const delWebhook = useMutation({
    mutationFn: (id: string) => admin.deleteWebhook(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks"] }),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 max-w-lg">
          {settings.isLoading ? (
            <Spinner />
          ) : (
            <>
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Data region</Label>
                <Input value={region} onChange={(e) => setRegion(e.target.value)} />
              </div>
              <div>
                <Label>Retention policy (days)</Label>
                <Input
                  type="number"
                  value={retention}
                  onChange={(e) => setRetention(parseInt(e.target.value || "0", 10))}
                />
              </div>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save"}
              </Button>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="justify-between">
          <CardTitle>Webhooks</CardTitle>
          <Button size="sm" onClick={() => setWhOpen(true)}>+ Add</Button>
        </CardHeader>
        <CardBody>
          {webhooks.isLoading ? (
            <Spinner />
          ) : webhooks.data && webhooks.data.length > 0 ? (
            <ul className="divide-y divide-ink-200">
              {webhooks.data.map((w) => (
                <li key={w.id} className="py-2 flex justify-between items-center">
                  <div>
                    <div className="text-sm font-mono text-ink-700">{w.target_url}</div>
                    <div className="text-xs text-ink-500">{w.event_types.join(", ") || "all events"}</div>
                  </div>
                  <Button variant="ghost" onClick={() => delWebhook.mutate(w.id)}>
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-ink-500">No webhooks configured.</div>
          )}
        </CardBody>
      </Card>

      <Modal open={whOpen} onClose={() => setWhOpen(false)} title="Add webhook">
        <div className="space-y-3">
          <div>
            <Label>Target URL</Label>
            <Input
              value={whUrl}
              onChange={(e) => setWhUrl(e.target.value)}
              placeholder="https://example.com/hooks/openbench"
            />
          </div>
          <div>
            <Label>Event types</Label>
            <div className="grid grid-cols-2 gap-1">
              {EVENT_TYPES.map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={whEvents.has(t)}
                    onChange={() => {
                      const s = new Set(whEvents);
                      s.has(t) ? s.delete(t) : s.add(t);
                      setWhEvents(s);
                    }}
                  />
                  <code>{t}</code>
                </label>
              ))}
            </div>
          </div>
          <Button
            onClick={() => addWebhook.mutate()}
            disabled={!whUrl || addWebhook.isPending}
            className="w-full"
          >
            {addWebhook.isPending ? "Adding…" : "Add"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
