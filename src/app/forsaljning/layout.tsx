import AppShell from "@/components/layout/AppShell";

export default function ForsaljningLayout({ children }: { children: React.ReactNode }) {
  return <AppShell utskriftsvanlig>{children}</AppShell>;
}
