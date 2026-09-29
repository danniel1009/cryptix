import type { faq as en } from "@/lib/i18n/dictionaries/en/faq";

/**
 * `t.faq` (Bahasa Indonesia) — mirror of `en/faq.ts`. Exactly 8 items;
 * `{spread}` follows config. Every answer states that pricing is indicative
 * and the transaction is confirmed manually by the team.
 */
export const faq: typeof en = {
  eyebrow: "FAQ",
  title: "Pertanyaan yang sering diajukan",
  description: "Jawaban singkat untuk pertanyaan umum tentang kurs, proses, dan cara menghubungi kami.",
  items: [
    {
      question: "Pair exchange apa saja yang tersedia?",
      answer:
        "Seluruh pair yang tersedia tercantum di bagian Pair exchange yang didukung pada halaman ini. Saat ini kami melayani exchange USDT, ETH, dan SOL ke BTC, serta USDT ke Rupiah (IDR). Pair yang tidak tercantum tidak tersedia.",
    },
    {
      question: "Bagaimana kurs exchange dihitung?",
      answer:
        "Kami mengambil harga pasar terbaru dari penyedia data kami sebagai acuan, lalu menerapkan spread {spread}. Hasilnya adalah kurs indikatif — kurs final dikonfirmasi oleh tim exchange kami sebelum transaksi.",
    },
    {
      question: 'Apa arti "Harga pasar + {spread}"?',
      answer:
        "Harga pasar adalah harga acuan yang kami peroleh dari penyedia data pasar. Kurs kami adalah harga tersebut ditambah spread {spread}, yang diterapkan pada aset yang Anda terima. Fitur cek kurs menampilkan kedua nilai agar Anda dapat melihat selisihnya sebelum menghubungi kami.",
    },
    {
      question: "Apakah harga yang ditampilkan bersifat final?",
      answer:
        "Tidak. Seluruh harga dan kurs di website ini bersifat indikatif dan dapat berubah mengikuti pasar. Kurs exchange final, ketersediaan, dan detail transaksi dikonfirmasi secara manual oleh tim kami saat Anda menghubungi kami.",
    },
    {
      question: "Bagaimana cara mengajukan exchange?",
      answer:
        "Cek kurs untuk pair dan jumlah Anda, lalu kirim formulir permintaan exchange atau hubungi kami melalui WhatsApp. Tim kami akan meninjau permintaan Anda dan membalas dengan kurs yang telah dikonfirmasi beserta langkah selanjutnya.",
    },
    {
      question: "Apakah saya bisa menghubungi Anda melalui WhatsApp?",
      answer:
        "Bisa. Gunakan tombol WhatsApp di halaman ini untuk chat langsung dengan tim kami. Fitur cek kurs juga dapat menyiapkan pesan yang berisi pair dan jumlah Anda.",
    },
    {
      question: "Apakah saya perlu membuat akun?",
      answer:
        "Tidak. Website ini tidak memiliki akun, wallet, maupun saldo. Tidak ada transaksi yang dieksekusi di website — setiap exchange diatur dan diproses secara manual bersama tim kami.",
    },
    {
      question: "Berapa lama proses exchange berlangsung?",
      answer:
        "Tergantung pada pair, jumlah, dan kondisi jaringan. Setelah Anda mengirim permintaan, tim kami biasanya merespons pada jam kerja dan mengonfirmasi perkiraan waktunya bersama Anda sebelum proses dimulai. Kami tidak dapat menjanjikan durasi yang pasti.",
    },
  ],
};
