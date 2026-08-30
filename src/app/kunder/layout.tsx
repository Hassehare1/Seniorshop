import AppShell from "@/components/layout/AppShell";

export default function KunderLayout({ children }: { children: React.ReactNode }) {
  return <AppShell utskriftsvanlig>{children}</AppShell>;
}
