import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Tvinga HTTPS i webbläsaren i ett år framåt. Vercel serverar redan
          // bara HTTPS, men utan headern finns ett fönster vid första besöket
          // där en nedgradering till http är möjlig.
          // includeSubDomains är säkert här: seniorshop.vercel.app har inga
          // subdomäner. Byter portalen till en egen domän med subdomäner som
          // inte kör HTTPS måste den delen omprövas.
          // preload är MEDVETET bortvalt — det kräver anmälan till en extern
          // lista och är svårt att ta tillbaka.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
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
