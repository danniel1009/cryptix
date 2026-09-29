import type { common as en } from "@/lib/i18n/dictionaries/en/common";

/**
 * `t.common` (Bahasa Indonesia) — mirror of `en/common.ts`. Technical terms
 * (exchange, spread, pair, WhatsApp) are kept as-is per brand guidance;
 * formal "Anda" throughout.
 */
export const common: typeof en = {
  brandTagline: "Exchange aset digital profesional",
  requestExchange: "Ajukan exchange",
  checkLiveRate: "Cek kurs live",
  chatOnWhatsApp: "Chat di WhatsApp",
  sendMessage: "Kirim pesan",
  close: "Tutup",
  retry: "Coba lagi",
  loading: "Memuat…",
  sending: "Mengirim…",
  learnMore: "Pelajari lebih lanjut",
  skipToContent: "Langsung ke konten",
  live: "Live",
  reconnecting: "Menyambung ulang",
  unavailable: "Tidak tersedia",
  lastUpdated: "Terakhir diperbarui",
  updatedAgo: "Terakhir diperbarui {time}",
  marketUnavailable: "Data pasar sementara tidak tersedia",
  indicativeRate: "Kurs indikatif",
  ourRate: "Kurs kami",
  marketRate: "Kurs pasar",
  marketPrice: "Harga pasar",
  estimatedReceive: "Estimasi diterima",
  youSend: "Anda kirim",
  youReceive: "Anda terima",
  spreadBadge: "+{spread} DARI HARGA PASAR",
  ourRateFormula: "HARGA PASAR + {spread}",
  devMockData: "Data simulasi (development)",
  optional: "Opsional",
  required: "Wajib diisi",
  selectPair: "Pilih pair",
  amount: "Jumlah",
  whatsapp: "WhatsApp",
  email: "Email",
  /** Localised currency names (config CURRENCIES[code].name is English). */
  currencyNames: {
    USDT: "Tether USD",
    BTC: "Bitcoin",
    SOL: "Solana",
    ETH: "Ethereum",
    IDR: "Rupiah Indonesia",
  },
};
