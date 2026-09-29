import type { exchangeRequest as en } from "@/lib/i18n/dictionaries/en/exchangeRequest";
import { disclaimer } from "./disclaimer";

/** `t.exchangeRequest` (Bahasa Indonesia) — mirror of `en/exchangeRequest.ts`. */
export const exchangeRequest: typeof en = {
  title: "Ajukan exchange",
  subtitle:
    "Beri tahu kami apa yang ingin Anda tukarkan. Tim kami akan mengonfirmasi kurs final langsung dengan Anda.",
  fields: {
    fullName: { label: "Nama lengkap", placeholder: "Nama lengkap Anda" },
    whatsapp: { label: "Nomor WhatsApp", placeholder: "+62 812 3456 7890" },
    email: { label: "Email", placeholder: "nama@email.com" },
    pair: { label: "Pair exchange", placeholder: "Pilih pair" },
    amount: { label: "Jumlah yang Anda kirim", placeholder: "Masukkan jumlah" },
    estimatedReceive: {
      label: "Estimasi diterima",
      placeholder: "Dihitung dari kurs indikatif",
    },
    message: { label: "Pesan", placeholder: "Ada hal lain yang perlu kami ketahui? (opsional)" },
  },
  estimatedHint: "Berdasarkan kurs indikatif pada {time}. Anda dapat mengubahnya.",
  /** Identical to `t.disclaimer.formRate` by construction. */
  disclaimer: disclaimer.formRate,
  consent:
    "Saya memahami bahwa kurs yang ditampilkan bersifat indikatif dan kurs final akan dikonfirmasi oleh tim exchange.",
  submit: "Kirim permintaan exchange",
  cancel: "Batal",
  success: {
    title: "Permintaan diterima",
    body: "Terima kasih telah menghubungi kami. Tim exchange kami akan meninjau permintaan Anda dan menghubungi Anda melalui WhatsApp atau email.",
    reference: "Referensi Anda: {reference}",
    chat: "Chat langsung di WhatsApp",
    close: "Tutup",
    newRequest: "Ajukan permintaan lain",
  },
  prefillNote: "Terisi dari cek kurs — Anda dapat mengubah nilai apa pun.",
  stepLabel: "Langkah {n} dari {total}",
  noAccountNote: "Tidak perlu akun. Tidak ada transaksi yang dieksekusi tanpa konfirmasi tim kami.",
};
