import Sidebar from "@/components/layout/Sidebar";

export default function ProfilLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 pt-14 px-4 pb-6 md:pt-0 md:px-8 md:pb-8 overflow-auto min-w-0">{children}</main>
    </div>
  );
}
