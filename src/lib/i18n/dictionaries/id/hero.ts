import type { hero as en } from "@/lib/i18n/dictionaries/en/hero";

/**
 * `t.hero` (Bahasa Indonesia) — mirror of `en/hero.ts`. The headline is one
 * sentence split over two lines ("Cara lebih cerdas untuk / menukar aset
 * digital"), so line 2 starts lowercase.
 */
export const hero: typeof en = {
  eyebrow: "Exchange aset digital profesional",
  titleLine1: "Cara lebih cerdas untuk",
  titleLine2: "menukar aset digital",
  subtitle:
    "Cek kurs crypto terkini, hitung nilai exchange indikatif, dan terhubung langsung dengan tim exchange kami.",
  supporting: ["Data pasar live", "Harga transparan", "Dukungan personal"],
  ctaPrimary: "Cek kurs live",
  ctaSecondary: "Chat di WhatsApp",
  processSteps: ["Cek kurs", "Ajukan exchange", "Hubungi tim kami", "Exchange manual"],
  scrollHint: "Gulir untuk menjelajah",
  trustNote:
    "Tanpa akun, tanpa koneksi wallet, dan tanpa eksekusi oleh sistem — setiap exchange ditangani langsung oleh tim kami.",
};
