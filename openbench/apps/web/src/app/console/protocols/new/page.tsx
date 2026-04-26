"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
  Select,
  Spinner,
} from "@/components/ui";
import { documents, protocols } from "@/lib/api";

const TYPES = [
  { value: "sop", label: "SOP / Procedure" },
  { value: "sds", label: "Safety Data Sheet" },
  { value: "manual", label: "Equipment Manual" },
  { value: "policy", label: "Lab Policy" },
];

export default function NewProtocolPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const docs = useQuery({ queryKey: ["docs"], queryFn: documents.list });
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: ({ file, type }: { file: File; type: string }) =>
      documents.uploadDirect(file, type),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["docs"] }),
  });

  const compile = useMutation({
    mutationFn: () =>
      protocols.compileDraft(Array.from(selected), name || undefined),
    onSuccess: (draft) => router.push(`/console/protocols/${draft.id}/review`),
    onError: (e: Error) => setErr(e.message),
  });

  function toggle(id: string) {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>, type: string) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      await upload.mutateAsync({ file, type });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New protocol</h1>
        <p className="text-sm text-ink-500">
          Step 1: upload approved documents (SOP, SDS, equipment manual, optional policy).<br/>
          Step 2: select which documents to compile and click <em>Compile draft</em>.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Upload documents</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {TYPES.map((t) => (
              <div key={t.value} className="flex items-center gap-3">
                <Label className="w-44 mb-0">{t.label}</Label>
                <input
                  type="file"
                  accept="application/pdf,.docx,.doc,.txt"
                  onChange={(e) => onUpload(e, t.value)}
                  className="text-xs"
                  disabled={busy}
                />
              </div>
            ))}
            {busy && <div className="text-xs text-ink-500"><Spinner /> Parsing & chunking…</div>}
            {err && <Banner tone="danger">{err}</Banner>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compile draft</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <div>
              <Label>Protocol name (optional)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sample Prep SOP v1.3" />
            </div>
            <div className="text-xs text-ink-500">
              {selected.size} document{selected.size === 1 ? "" : "s"} selected.
            </div>
            <Button
              onClick={() => compile.mutate()}
              disabled={selected.size === 0 || compile.isPending}
              className="w-full"
            >
              {compile.isPending ? "Compiling… (this can take 30–90 seconds)" : "Compile draft"}
            </Button>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {docs.isLoading ? (
            <div className="p-6 text-ink-500"><Spinner /> Loading…</div>
          ) : docs.data && docs.data.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-xs uppercase text-ink-500">
                <tr>
                  <th className="px-3 py-2 text-left">Select</th>
                  <th className="px-3 py-2 text-left">Title</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Pages</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {docs.data.map((d) => (
                  <tr key={d.id} className="border-t border-ink-200">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(d.id)}
                        onChange={() => toggle(d.id)}
                      />
                    </td>
                    <td className="px-3 py-2 truncate max-w-md">{d.title || d.id}</td>
                    <td className="px-3 py-2">
                      <Badge variant="muted">{d.document_type}</Badge>
                    </td>
                    <td className="px-3 py-2">{d.page_count}</td>
                    <td className="px-3 py-2">
                      <Badge variant={d.parse_status === "ready" ? "ok" : "warn"}>
                        {d.parse_status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6 text-ink-500">No documents yet.</div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
