"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { protocols } from "@/lib/api";
import { Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, Spinner } from "@/components/ui";

export default function BenchProtocols() {
  const list = useQuery({ queryKey: ["versions"], queryFn: protocols.listPublished });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Protocol library</h1>
      {list.isLoading ? (
        <Spinner />
      ) : list.data && list.data.length > 0 ? (
        <div className="space-y-2">
          {list.data.map((v) => (
            <Card key={v.id}>
              <CardBody>
                <Link href={`/app/protocols/${v.id}`} className="flex justify-between bench-target">
                  <div>
                    <div className="text-sm font-semibold">{v.summary?.split("\n")[0] || v.version_label}</div>
                    <code className="text-xs text-ink-500">{v.id}</code>
                  </div>
                  <Badge>{v.version_label}</Badge>
                </Link>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No published protocols" />
      )}
    </div>
  );
}
