import type { market as en } from "@/lib/i18n/dictionaries/en/market";

/** `t.market` (Bahasa Indonesia) — mirror of `en/market.ts`. */
export const market: typeof en = {
  eyebrow: "Market",
  title: "Market live",
  description:
    "Harga pasar terbaru dari penyedia data kami. Hanya sebagai referensi — kurs exchange kami ditampilkan di bagian cek kurs.",
  live: "LIVE",
  reconnecting: "MENYAMBUNG ULANG",
  unavailable: "TIDAK TERSEDIA",
  stale: "TIDAK TERKINI",
  connecting: "Menyambungkan",
  columns: {
    pair: "Pair",
    price: "Harga",
    change24h: "Perubahan 24 jam",
    updated: "Diperbarui",
    status: "Status",
    source: "Sumber",
  },
  lastUpdated: "Terakhir diperbarui: {time}",
  updatedAgo: "Terakhir diperbarui {time}",
  unavailableTitle: "Data pasar sementara tidak tersedia",
  unavailableBody:
    "Kami tidak dapat menghubungi penyedia data pasar. Harga akan kembali ditampilkan segera setelah koneksi data pulih.",
  staleBody:
    "Harga mungkin sudah tidak terkini. Nilai yang ditampilkan tidak sedang diperbarui secara real-time.",
  sourceNote: "Sumber data: {sources}",
  refresh: "Muat ulang",
  pollingNote: "Streaming live tidak tersedia — data diperbarui secara berkala.",
  offlineNote: "Anda tampaknya sedang offline.",
  devMock: "Data simulasi (development)",
};
