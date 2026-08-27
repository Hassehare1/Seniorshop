import Sidebar from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 print:h-auto print:overflow-visible">
      <Sidebar />
      <main className="flex-1 pt-14 px-4 pb-6 md:pt-8 md:px-8 md:pb-8 overflow-auto min-w-0 min-h-0">{children}</main>
    </div>
  );
}
