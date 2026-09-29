import type { pairs as en } from "@/lib/i18n/dictionaries/en/pairs";

/** `t.pairs` (Bahasa Indonesia) — mirror of `en/pairs.ts`. */
export const pairs: typeof en = {
  eyebrow: "Pair exchange",
  title: "Pair exchange yang didukung",
  description:
    "Saat ini kami melayani exchange untuk pair berikut. Setiap kartu menampilkan acuan harga pasar dan kurs indikatif kami.",
  ourRate: "Kurs kami",
  ourRateFormula: "HARGA PASAR + {spread}",
  note: "Kurs exchange final dikonfirmasi oleh tim kami sebelum transaksi.",
  youSend: "Anda kirim",
  youReceive: "Anda terima",
  checkRate: "Cek kurs",
  checkRateFor: "Cek kurs untuk {pair}",
  indicativeLabel: "Indikatif",
  perPairNote: "Kurs bersifat indikatif dan diperbarui mengikuti data pasar.",
  reverseNote:
    "Setiap pair juga dapat diajukan dalam arah sebaliknya (misalnya BTC → USDT). Gunakan pengecek kurs untuk memilih aset yang Anda miliki dan aset yang ingin Anda terima.",
};
