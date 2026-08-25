import Sidebar from "@/components/layout/Sidebar";

export default function ForsaljningLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 print:h-auto print:overflow-visible">
      <Sidebar />
      <main className="flex-1 pt-14 px-4 pb-6 md:pt-0 md:px-8 md:pb-8 overflow-auto min-w-0 min-h-0 print:pt-0 print:px-0">{children}</main>
    </div>
  );
}
