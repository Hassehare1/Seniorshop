"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";

const franchiseeNav = [
  { href: "/dashboard", label: "Översikt" },
  { href: "/rapportera", label: "Rapportera vecka" },
  { href: "/kunder", label: "Mina kunder" },
];

const adminNav = [
  { href: "/dashboard", label: "Översikt" },
  { href: "/admin/distrikt", label: "Distrikt" },
  { href: "/admin/anvandare", label: "Användare" },
  { href: "/admin/kunder", label: "Alla kunder" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "ADMIN";
  const nav = isAdmin ? adminNav : franchiseeNav;

  return (
    <aside className="w-56 min-h-screen bg-slate-900 flex flex-col">
      <div className="px-6 py-5 border-b border-slate-700">
        <span className="text-white font-bold text-lg">SeniorShop</span>
        {session?.user.districtNumber && (
          <p className="text-slate-400 text-xs mt-0.5">
            Distrikt {session.user.districtNumber}
          </p>
        )}
        {isAdmin && (
          <p className="text-blue-400 text-xs mt-0.5 font-medium">Admin</p>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname === item.href
                ? "bg-blue-600 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-slate-700">
        <p className="text-slate-400 text-xs px-3 mb-2 truncate">
          {session?.user.email}
        </p>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          Logga ut
        </button>
      </div>
    </aside>
  );
}
