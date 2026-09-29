import type { security as en } from "@/lib/i18n/dictionaries/en/security";

/**
 * `t.security` (Bahasa Indonesia) — mirror of `en/security.ts`. Factual
 * descriptions only; no regulatory, licensing or custody claims.
 */
export const security: typeof en = {
  eyebrow: "Keamanan",
  title: "Dibangun dengan mengutamakan keamanan",
  description:
    "Website ini adalah layanan informasi dan pengajuan permintaan. Kami membangunnya agar data Anda dan data pasar kami ditangani dengan hati-hati di setiap langkah.",
  items: [
    {
      title: "Komunikasi aman",
      body: "Seluruh lalu lintas antara browser Anda dan website ini dienkripsi melalui HTTPS.",
    },
    {
      title: "Infrastruktur terlindungi",
      body: "Data pasar dan pengiriman permintaan diproses di server kami, bukan di browser Anda, sehingga layanan pihak ketiga tidak pernah diakses dari perangkat Anda.",
    },
    {
      title: "Kredensial API di sisi server",
      body: "API key dan kredensial pengiriman hanya disimpan di lingkungan server dan tidak pernah diekspos ke sisi klien.",
    },
    {
      title: "Validasi input",
      body: "Setiap formulir divalidasi di sisi klien dan server, lalu disanitasi sebelum diteruskan ke tim kami.",
    },
    {
      title: "Perlindungan rate limit",
      body: "Pengiriman formulir dibatasi per alamat IP untuk mengurangi spam dan penyalahgunaan.",
    },
    {
      title: "Sumber data pasar",
      body: "Harga diambil dari penyedia data pasar terpercaya dengan penyedia cadangan bila salah satu tidak tersedia, dan ditandai dengan jelas sebagai tidak terkini bila sudah tidak diperbarui.",
    },
  ],
  note: "Kami tidak menyimpan dana pelanggan maupun mengelola kustodi aset di website ini. Setiap exchange diatur dan dikonfirmasi langsung oleh tim kami.",
};
