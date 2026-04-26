"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { Button, Card, CardBody, CardHeader, CardTitle, Input, Label, Banner } from "@/components/ui";
import { useSession } from "@/lib/session";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/console";
  const login = useSession((s) => s.login);
  const [email, setEmail] = useState("reviewer@demo.lab");
  const [password, setPassword] = useState("Bench!Demo1");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      await login(email, password);
      router.push(next);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Sign in to OpenBench</CardTitle>
          </CardHeader>
          <CardBody>
            <form onSubmit={onSubmit} className="space-y-3">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {err && <Banner tone="danger">{err}</Banner>}
              <Button disabled={loading} type="submit" className="w-full">
                {loading ? "Signing in…" : "Sign in"}
              </Button>
              <div className="text-xs text-ink-500 text-center pt-2">
                Demo seeds: <code>reviewer@demo.lab</code>, <code>operator@demo.lab</code>,{" "}
                <code>admin@demo.lab</code> · <code>Bench!Demo1</code>
              </div>
              <div className="text-xs text-ink-500 text-center">
                <Link href="/register" className="underline">
                  Create a new organization
                </Link>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-ink-500">Loading…</div>}>
      <LoginInner />
    </Suspense>
  );
}
