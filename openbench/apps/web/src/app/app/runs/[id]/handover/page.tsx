"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { runs } from "@/lib/api";
import { Banner, Button, Card, CardBody, CardHeader, CardTitle, Spinner } from "@/components/ui";
import { formatRelative } from "@/lib/format";

export default function BenchHandover() {
  const params = useParams<{ id: string }>();
  const id = params.id as string;
  const qc = useQueryClient();
  const data = useQuery({
    queryKey: ["handover", id],
    queryFn: () => runs.getHandover(id).catch(() => null),
  });
  const generate = useMutation({
    mutationFn: () => runs.generateHandover(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["handover", id] }),
  });
  const finalize = useMutation({
    mutationFn: () => runs.finalizeHandover(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["handover", id] }),
  });

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Handover</h1>
        <div className="flex gap-2">
          <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isPending ? <><Spinner /> Generating…</> : "Generate / refresh"}
          </Button>
          <Button onClick={() => finalize.mutate()} disabled={finalize.isPending} variant="ok">
            {finalize.isPending ? "Finalizing…" : "Finalize PDF"}
          </Button>
          <a href={runs.pdfUrl(id)} target="_blank" rel="noreferrer">
            <Button variant="secondary">Download PDF</Button>
          </a>
        </div>
      </div>
      {data.isLoading ? (
        <Spinner />
      ) : !data.data ? (
        <Banner>No handover yet — click <em>Generate</em>.</Banner>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              Status: {data.data.status} · generated {formatRelative(data.data.generated_at)}
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="prose-handover" dangerouslySetInnerHTML={{ __html: data.data.html_body }} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
