"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { protocols } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Spinner,
} from "@/components/ui";
import { formatRelative } from "@/lib/format";

export default function ProtocolsPage() {
  const list = useQuery({ queryKey: ["protocols"], queryFn: protocols.list });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Protocols</h1>
          <p className="text-sm text-ink-500">
            Upload SOPs/SDSs/manuals, compile them into a structured graph, review, and publish.
          </p>
        </div>
        <Link href="/console/protocols/new">
          <Button>+ New protocol from documents</Button>
        </Link>
      </div>

      {list.isLoading ? (
        <div className="text-ink-500"><Spinner /> Loading…</div>
      ) : list.data && list.data.length > 0 ? (
        <div className="space-y-3">
          {list.data.map((p) => (
            <Card key={p.id}>
              <CardHeader className="justify-between">
                <CardTitle>{p.name}</CardTitle>
                <Badge variant="muted">{p.id}</Badge>
              </CardHeader>
              <CardBody className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-ink-50 text-xs uppercase text-ink-500">
                    <tr>
                      <th className="text-left px-4 py-2">Version</th>
                      <th className="text-left px-4 py-2">Status</th>
                      <th className="text-left px-4 py-2">Published</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.versions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-ink-500">
                          No versions yet.
                        </td>
                      </tr>
                    ) : (
                      p.versions.map((v) => (
                        <tr key={v.id} className="border-t border-ink-200">
                          <td className="px-4 py-2">{v.version_label}</td>
                          <td className="px-4 py-2">
                            <Badge
                              variant={
                                v.status === "published"
                                  ? "ok"
                                  : v.status === "archived"
                                  ? "muted"
                                  : "brand"
                              }
                            >
                              {v.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-2 text-ink-500">
                            {v.published_at ? formatRelative(v.published_at) : "—"}
                          </td>
                          <td className="px-4 py-2 text-right space-x-2">
                            {v.status === "draft" || v.status === "in_review" ? (
                              <Link href={`/console/protocols/${v.id}/review`} className="text-brand-700 underline text-xs">
                                Review draft
                              </Link>
                            ) : (
                              <Link href={`/console/protocols/${v.id}`} className="text-brand-700 underline text-xs">
                                Open
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No protocols yet"
          description="Compile your first protocol from approved documents."
          action={
            <Link href="/console/protocols/new">
              <Button>+ New protocol</Button>
            </Link>
          }
        />
      )}
    </div>
  );
}
