import type { validation as en } from "@/lib/i18n/dictionaries/en/validation";

/** `t.validation` (Bahasa Indonesia) — one message per `ValidationErrorCode`. */
export const validation: typeof en = {
  required: "Kolom ini wajib diisi.",
  invalid_email: "Masukkan alamat email yang valid.",
  invalid_phone: "Masukkan nomor WhatsApp yang valid, termasuk kode negara.",
  too_short: "Isian terlalu pendek.",
  too_long: "Isian terlalu panjang.",
  invalid_pair: "Pilih pair exchange yang didukung.",
  invalid_amount: "Masukkan jumlah yang valid.",
  amount_too_small: "Jumlah di bawah minimum untuk mata uang ini.",
  amount_too_large: "Jumlah melebihi maksimum untuk mata uang ini.",
  consent_required: "Mohon konfirmasi bahwa Anda memahami kurs bersifat indikatif.",
  invalid_value: "Nilai ini tidak valid.",
};
