import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Portalen ska aldrig bäddas in i iframe (clickjacking-skydd)
          { key: "X-Frame-Options", value: "DENY" },
          // Hindra MIME-sniffning av svar (t.ex. uppladdade/exporterade filer)
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Läck inte interna URL:er (t.ex. /admin/...) till externa länkmål
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
