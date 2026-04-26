"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Banner, Button, Card, CardBody, CardHeader, CardTitle, Input, Label } from "@/components/ui";
import { useSession } from "@/lib/session";

export default function RegisterPage() {
  const router = useRouter();
  const register = useSession((s) => s.register);
  const [form, setForm] = useState({
    email: "",
    password: "",
    display_name: "",
    org_name: "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      await register(form);
      router.push("/console");
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
            <CardTitle>Create a new OpenBench org</CardTitle>
          </CardHeader>
          <CardBody>
            <form onSubmit={onSubmit} className="space-y-3">
              <div>
                <Label>Organization name</Label>
                <Input
                  value={form.org_name}
                  onChange={(e) => setForm({ ...form, org_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Your name</Label>
                <Input
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  minLength={8}
                  required
                />
              </div>
              {err && <Banner tone="danger">{err}</Banner>}
              <Button disabled={loading} type="submit" className="w-full">
                {loading ? "Creating…" : "Create org"}
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
