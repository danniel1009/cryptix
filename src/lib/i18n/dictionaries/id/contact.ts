import type { contact as en } from "@/lib/i18n/dictionaries/en/contact";

/** `t.contact` (Bahasa Indonesia) — mirror of `en/contact.ts`. */
export const contact: typeof en = {
  eyebrow: "Kontak",
  title: "Hubungi tim kami",
  description: "Ada pertanyaan tentang exchange atau butuh bantuan?",
  fields: {
    name: { label: "Nama", placeholder: "Nama lengkap Anda" },
    email: { label: "Email", placeholder: "nama@email.com" },
    whatsapp: { label: "Nomor WhatsApp", placeholder: "+62 812 3456 7890" },
    subject: { label: "Subjek", placeholder: "Apa yang ingin Anda tanyakan?" },
    message: { label: "Pesan", placeholder: "Ceritakan bagaimana kami dapat membantu." },
  },
  submit: "Kirim pesan",
  success: {
    title: "Pesan terkirim",
    body: "Terima kasih. Tim kami akan menghubungi Anda kembali melalui WhatsApp atau email.",
    chat: "Chat langsung di WhatsApp",
    reference: "Referensi: {reference}",
    another: "Kirim pesan lain",
  },
  privacyNote:
    "Data Anda hanya digunakan untuk merespons pertanyaan Anda dan tidak dibagikan kepada pihak lain.",
  directTitle: "Ingin berbicara langsung?",
  directBody: "Hubungi tim exchange kami melalui WhatsApp atau email.",
  whatsappLabel: "WhatsApp",
  emailLabel: "Email",
  responseTime: "Kami biasanya membalas pada jam kerja.",
  formTitle: "Kirim pesan kepada kami",
  formNote: "Semua kolom wajib diisi. Tim kami membalas melalui WhatsApp atau email.",
  whatsappHint: "Cara tercepat menghubungi tim kami",
  emailHint: "Untuk pertanyaan tertulis atau terperinci",
  retryAfter: "Anda dapat mencoba lagi dalam {seconds} detik.",
};
