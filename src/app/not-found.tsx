import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="text-4xl mb-3">🔍</div>
        <h1 className="text-xl font-bold text-slate-800">Sidan hittades inte</h1>
        <p className="text-slate-500 text-sm mt-2">
          Sidan eller resursen finns inte (längre).
        </p>
        <Link
          href="/dashboard"
          className="inline-block mt-5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg"
        >
          Till översikten
        </Link>
      </div>
    </div>
  );
}
