import type { form as en } from "@/lib/i18n/dictionaries/en/form";

/** `t.form` (Bahasa Indonesia) — mirror of `en/form.ts`. */
export const form: typeof en = {
  errors: {
    rate_limited: "Terlalu banyak permintaan. Silakan coba lagi dalam beberapa menit.",
    delivery_failed:
      "Pesan Anda belum dapat kami terima saat ini. Silakan coba lagi atau hubungi kami melalui WhatsApp.",
    network_error: "Terjadi gangguan jaringan. Periksa koneksi Anda dan coba lagi.",
    spam_detected:
      "Pengiriman tidak dapat diproses. Silakan coba lagi atau hubungi kami melalui WhatsApp.",
    unknown: "Terjadi kesalahan. Silakan coba lagi.",
  },
  honeypotLabel: "Biarkan kolom ini kosong",
  submitting: "Mengirim…",
  retry: "Coba lagi",
};
