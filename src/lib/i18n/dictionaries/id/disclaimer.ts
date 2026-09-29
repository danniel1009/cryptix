import type { disclaimer as en } from "@/lib/i18n/dictionaries/en/disclaimer";

/**
 * `t.disclaimer` (Bahasa Indonesia) — mirror of `en/disclaimer.ts`.
 * `full` is the client-approved wording; do not paraphrase.
 */
export const disclaimer: typeof en = {
  short: "Kurs indikatif. Kurs exchange final akan dikonfirmasi oleh tim exchange kami.",
  full: "Harga pasar yang ditampilkan di website ini hanya sebagai referensi. Kurs yang ditampilkan menggunakan spread {spread} dari harga pasar yang menjadi acuan. Kurs final, ketersediaan dan ketentuan transaksi akan dikonfirmasi oleh tim exchange kami.",
  formRate:
    "Kurs yang ditampilkan hanya bersifat indikatif. Kurs exchange final dan detail transaksi akan dikonfirmasi oleh tim exchange kami.",
};
