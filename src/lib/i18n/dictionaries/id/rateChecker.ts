import type { rateChecker as en } from "@/lib/i18n/dictionaries/en/rateChecker";
import { disclaimer } from "./disclaimer";

/** `t.rateChecker` (Bahasa Indonesia) — mirror of `en/rateChecker.ts`. */
export const rateChecker: typeof en = {
  eyebrow: "Cek kurs",
  title: "Cek kurs exchange",
  description: "Dapatkan kurs exchange indikatif berdasarkan harga pasar terbaru yang tersedia.",
  youSend: "Anda kirim",
  youReceive: "Anda terima sekitar",
  amountLabel: "Jumlah",
  amountPlaceholder: "Masukkan jumlah",
  currencyLabel: "Mata uang",
  pairLabel: "Pair exchange",
  marketRate: "Kurs pasar",
  ourRate: "Kurs kami",
  estimatedReceive: "Estimasi diterima",
  spreadBadge: "+{spread} DARI HARGA PASAR",
  ourRateFormula: "HARGA PASAR + {spread}",
  /** Identical to `t.disclaimer.short` by construction. */
  disclaimer: disclaimer.short,
  requestExchange: "Ajukan exchange",
  chatOnWhatsApp: "Chat di WhatsApp",
  swapHint: "Pilih mata uang yang Anda kirim dan mata uang yang ingin Anda terima.",
  unavailableTitle: "Data pasar sementara tidak tersedia",
  unavailableBody:
    "Kurs indikatif belum dapat dihitung saat ini. Silakan coba beberapa saat lagi atau hubungi tim kami secara langsung.",
  staleNote: "Terakhir diperbarui {time}",
  derivedNote: "Kurs silang dihitung dari {sources}",
  perUnit: "per 1 {currency}",
  enterAmount: "Masukkan jumlah untuk melihat estimasi.",
  invalidAmount: "Masukkan jumlah yang valid.",
  minAmount: "Minimum {amount}",
  maxAmount: "Maksimum {amount}",
  sourceLabel: "Sumber",
  rateBasis: "Kurs diperbarui secara berkala mengikuti data pasar terbaru.",
  quickAmounts: "Jumlah cepat",
};
