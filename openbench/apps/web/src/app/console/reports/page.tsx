"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { exports_, runs } from "@/lib/api";
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, EmptyState, Spinner } from "@/components/ui";
import { formatRelative } from "@/lib/format";

export default function ReportsPage() {
  const list = useQuery({ queryKey: ["runs-completed"], queryFn: () => runs.list("completed") });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-ink-500">
          Completed runs and downloadable exports. CSV/JSON exports are filtered to your org.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Exports (manager+)</CardTitle></CardHeader>
        <CardBody className="grid sm:grid-cols-2 gap-3">
          <a href={exports_.runsCsvUrl()} target="_blank" rel="noreferrer">
            <Button variant="secondary" className="w-full">runs.csv (all)</Button>
          </a>
          <a href={exports_.runsCsvUrl("completed")} target="_blank" rel="noreferrer">
            <Button variant="secondary" className="w-full">runs.csv (completed)</Button>
          </a>
          <a href={exports_.deviationsCsvUrl()} target="_blank" rel="noreferrer">
            <Button variant="secondary" className="w-full">deviations.csv</Button>
          </a>
          <a href={exports_.deviationsCsvUrl("open")} target="_blank" rel="noreferrer">
            <Button variant="secondary" className="w-full">deviations.csv (open only)</Button>
          </a>
          <a href={exports_.handoversJsonUrl()} target="_blank" rel="noreferrer">
            <Button variant="secondary" className="w-full">handovers.json</Button>
          </a>
          <a href={exports_.protocolsJsonUrl()} target="_blank" rel="noreferrer">
            <Button variant="secondary" className="w-full">protocols.json (published)</Button>
          </a>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Completed runs</CardTitle></CardHeader>
        <CardBody className="p-0">
          {list.isLoading ? (
            <div className="p-4 text-ink-500"><Spinner /> Loading…</div>
          ) : list.data && list.data.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-xs uppercase text-ink-500">
                <tr>
                  <th className="text-left px-4 py-2">Run</th>
                  <th className="text-left px-4 py-2">Operator</th>
                  <th className="text-left px-4 py-2">Ended</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.data.map((r) => (
                  <tr key={r.id} className="border-t border-ink-100">
                    <td className="px-4 py-2"><code className="text-xs">{r.id}</code></td>
                    <td className="px-4 py-2 text-xs text-ink-500">{r.operator_id}</td>
                    <td className="px-4 py-2 text-xs">{formatRelative(r.ended_at)}</td>
                    <td className="px-4 py-2 text-right">
                      <Link className="text-brand-700 underline text-xs" href={`/console/runs/${r.id}`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6">
              <EmptyState title="No completed runs yet" />
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
