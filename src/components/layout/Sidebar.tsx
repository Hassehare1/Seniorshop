"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

const franchiseeNav = [
  { href: "/dashboard", label: "Översikt" },
  { href: "/rapportera", label: "Rapportera vecka" },
  { href: "/kunder", label: "Mina kunder" },
];

const adminNav = [
  { href: "/dashboard", label: "Översikt" },
  { href: "/admin/distrikt", label: "Distrikt & avgifter" },
  { href: "/admin/rapporter", label: "Rapportstatus", badge: true },
  { href: "/admin/sasonger", label: "Säsonger" },
  { href: "/admin/anvandare", label: "Användare" },
  { href: "/admin/kunder", label: "Alla kunder" },
  { href: "/admin/logg", label: "Händelselogg" },
];

function NavLinks({
  nav,
  pathname,
  submittedCount,
  onNavigate,
}: {
  nav: { href: string; label: string; badge?: boolean }[];
  pathname: string;
  submittedCount: number;
  onNavigate?: () => void;
}) {
  return (
    <>
      {nav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
            pathname === item.href || pathname.startsWith(item.href + "/")
              ? "bg-blue-600 text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
        >
          <span>{item.label}</span>
          {item.badge && submittedCount > 0 && (
            <span className="bg-amber-400 text-slate-900 text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
              {submittedCount}
            </span>
          )}
        </Link>
      ))}
    </>
  );
}

function SidebarFooter({
  pathname,
  email,
  confirmLogout,
  setConfirmLogout,
  onNav,
}: {
  pathname: string;
  email?: string | null;
  confirmLogout: boolean;
  setConfirmLogout: (v: boolean) => void;
  onNav?: () => void;
}) {
  return (
    <div className="px-3 py-4 border-t border-slate-700">
      <p className="text-slate-400 text-xs px-3 mb-2 truncate">{email}</p>
      <Link
        href="/profil"
        onClick={onNav}
        className={`block px-3 py-2 rounded-lg text-sm transition-colors mb-1 ${
          pathname === "/profil" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`}
      >
        Min profil
      </Link>
      {confirmLogout ? (
        <div className="px-3 py-2 space-y-1">
          <p className="text-xs text-slate-400 mb-1">Logga ut?</p>
          <div className="flex gap-2">
            <button
              onClick={() => { onNav?.(); signOut({ callbackUrl: "/login" }); }}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium py-1.5 rounded-lg transition-colors"
            >
              Ja, logga ut
            </button>
            <button
              onClick={() => setConfirmLogout(false)}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium py-1.5 rounded-lg transition-colors"
            >
              Avbryt
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirmLogout(true)}
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          Logga ut
        </button>
      )}
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "ADMIN";
  const nav = isAdmin ? adminNav : franchiseeNav;
  const [open, setOpen] = useState(false);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Hämta antal inlämnade rapporter för admin-badge
  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/admin/stats")
      .then(r => r.json())
      .then(d => setSubmittedCount(d.submittedCount ?? 0))
      .catch(() => {});
  }, [isAdmin, pathname]); // uppdatera vid navigation

  return (
    <>
      {/* ── MOBILE top bar ── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-slate-900 flex items-center h-14 px-4 border-b border-slate-700">
        <button onClick={() => setOpen(true)} aria-label="Öppna meny" className="text-slate-300 hover:text-white p-1 mr-3">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-white font-bold">SeniorShop</span>
        {isAdmin && <span className="ml-2 text-blue-400 text-xs font-medium">Admin</span>}
        {isAdmin && submittedCount > 0 && (
          <span className="ml-2 bg-amber-400 text-slate-900 text-xs font-bold px-1.5 py-0.5 rounded-full">
            {submittedCount}
          </span>
        )}
      </header>

      {/* ── MOBILE drawer overlay ── */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <aside
            className="relative w-64 max-w-[80vw] bg-slate-900 flex flex-col h-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <div>
                <span className="text-white font-bold text-lg">SeniorShop</span>
                {session?.user.districtNumber && (
                  <p className="text-slate-400 text-xs mt-0.5">Distrikt {session.user.districtNumber}</p>
                )}
                {isAdmin && <p className="text-blue-400 text-xs font-medium mt-0.5">Admin</p>}
              </div>
              <button onClick={() => setOpen(false)} aria-label="Stäng" className="text-slate-400 hover:text-white p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              <NavLinks nav={nav} pathname={pathname} submittedCount={submittedCount} onNavigate={() => setOpen(false)} />
            </nav>
            <SidebarFooter
              pathname={pathname}
              email={session?.user.email}
              confirmLogout={confirmLogout}
              setConfirmLogout={setConfirmLogout}
              onNav={() => setOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* ── DESKTOP sidebar ── */}
      <aside className="hidden md:flex w-56 min-h-screen bg-slate-900 flex-col shrink-0">
        <div className="px-6 py-5 border-b border-slate-700">
          <span className="text-white font-bold text-lg">SeniorShop</span>
          {session?.user.districtNumber && (
            <p className="text-slate-400 text-xs mt-0.5">Distrikt {session.user.districtNumber}</p>
          )}
          {isAdmin && <p className="text-blue-400 text-xs mt-0.5 font-medium">Admin</p>}
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLinks nav={nav} pathname={pathname} submittedCount={submittedCount} />
        </nav>
        <SidebarFooter
          pathname={pathname}
          email={session?.user.email}
          confirmLogout={confirmLogout}
          setConfirmLogout={setConfirmLogout}
        />
      </aside>
    </>
  );
}
