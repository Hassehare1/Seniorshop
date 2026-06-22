"use client";

// Fångar fel i rot-layouten. Måste rendera egen html/body och kan inte
// förlita sig på Tailwind — därför inline-stilar.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="sv">
      <body style={{ fontFamily: "Arial, Helvetica, sans-serif", background: "#f8fafc", margin: 0 }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ textAlign: "center", maxWidth: 420 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", margin: 0 }}>Något gick fel</h1>
            <p style={{ color: "#64748b", fontSize: 14, marginTop: 8 }}>
              Ett oväntat fel inträffade. Ladda om sidan.
            </p>
            {error.digest && (
              <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 8 }}>Felkod: {error.digest}</p>
            )}
            <button
              onClick={() => reset()}
              style={{ marginTop: 20, background: "#2563eb", color: "#fff", border: "none", fontSize: 14, fontWeight: 500, padding: "10px 20px", borderRadius: 8, cursor: "pointer" }}
            >
              Ladda om
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
