import BenchShell from "@/components/bench/BenchShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <BenchShell>{children}</BenchShell>;
}
