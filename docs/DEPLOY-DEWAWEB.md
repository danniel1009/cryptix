# Deploy ke DewaWeb (VPS) — runbook

Cryptix butuh proses Node yang hidup terus (Next.js server + stream SSE), jadi targetnya **DewaVPS / Cloud VPS** (Ubuntu 22.04/24.04, akses root SSH). Shared hosting cPanel "Node.js App" (Passenger) bisa menjalankan Next.js tetapi memutus stream panjang dan tidak bisa pakai systemd; kalau terpaksa, lihat bagian paling bawah.

## 0. Yang saya perlukan dari Anda saat server siap
- IP server + user SSH (biasanya `root`) + private key (mis. `~/.ssh/cryptix_vps`)
- Domain yang akan dipakai (A record diarahkan ke IP server)
- Nomor WhatsApp, email kontak, dan channel penerima lead (webhook atau Resend)

## 1. Sekali saja: bootstrap server
```bash
scp -i ~/.ssh/cryptix_vps -r deploy root@<IP>:/root/cryptix-deploy
ssh -i ~/.ssh/cryptix_vps root@<IP> "bash /root/cryptix-deploy/server-setup.sh <domain>"
```
Script ini memasang Node 22, nginx, certbot, membuat user `cryptix` + `/opt/cryptix`, menulis `/opt/cryptix/.env.production` (isi nilainya!), memasang unit `cryptix-web`, dan config nginx dengan dukungan SSE. Setelah DNS mengarah ke server:
```bash
ssh -i ~/.ssh/cryptix_vps root@<IP> "certbot --nginx -d <domain> --redirect"
```

## 2. Setiap deploy (dari laptop)
```bash
cp deploy/.deployrc.example deploy/.deployrc   # isi DEPLOY_HOST, DEPLOY_KEY (sekali saja)
npm run deploy
```
Urutannya: typecheck + lint + test lokal → rsync source **tanpa `--delete`** (file khusus server seperti `.env.production` aman) → `npm ci` di server hanya jika `package-lock.json` berubah → build ke `.next.new` sebagai user `cryptix` sementara build lama tetap melayani → swap `.next.new → .next` (≈0,04 s) + restart service → health check `/api/market` → rollback otomatis kalau gagal. Dua build sebelumnya disimpan sebagai `.next.rollback-<stamp>`.

Rollback manual:
```bash
ssh -i ~/.ssh/cryptix_vps root@<IP> "cd /opt/cryptix && systemctl stop cryptix-web && mv .next .next.broken && mv \$(ls -d .next.rollback-* | tail -1) .next && systemctl start cryptix-web"
```

## 3. Cek setelah deploy
```bash
curl -s https://<domain>/api/market | head -c 200      # status live, 8 rates
curl -sI https://<domain>/ | grep -i strict-transport   # header keamanan
```
Log: `journalctl -u cryptix-web -f`. Lead yang masuk terlihat di log sebagai `[lead] delivered …` (teks lengkap hanya di development; di produksi wajib ada `LEAD_WEBHOOK_URL` atau Resend, kalau tidak API menjawab `delivery_failed`).

## 4. Variabel `.env.production` yang wajib
`NEXT_PUBLIC_SITE_URL`, `WHATSAPP_NUMBER`, `PUBLIC_CONTACT_EMAIL`, `CONTACT_EMAIL`, dan salah satu channel lead (`LEAD_WEBHOOK_URL` atau `RESEND_API_KEY` + `RESEND_FROM_EMAIL`). `TRUSTED_PROXY_HOPS=1` karena nginx ada di depan aplikasi. Variabel `NEXT_PUBLIC_*` di-inline saat build: setelah mengubahnya, jalankan `npm run deploy` lagi. **Kecuali** nomor WhatsApp dan email kontak — keduanya dibaca saat runtime (bagian 5), jadi `NEXT_PUBLIC_WHATSAPP_NUMBER` / `NEXT_PUBLIC_CONTACT_EMAIL` tidak perlu diisi.

## 5. Mengganti nomor WhatsApp (atau email kontak)
Tidak perlu deploy, tidak perlu build. Server membaca `WHATSAPP_NUMBER` (dan `PUBLIC_CONTACT_EMAIL`) pada **setiap request** dan meneruskannya ke halaman, jadi semua tombol/link WhatsApp (hero, footer, menu mobile, FAQ, kontak, rate checker, modal request, tombol melayang) ikut berubah sekaligus:
```bash
ssh -i ~/.ssh/cryptix_vps root@<IP>
nano /opt/cryptix/.env.production      # ubah baris: WHATSAPP_NUMBER=6282317600972
systemctl restart cryptix-web          # ≈3 detik, lalu service melayani lagi
curl -s https://<domain>/ | grep -o 'wa.me/[0-9]*' | head -1   # verifikasi → wa.me/6282317600972
```
Format bebas: `+62 823-1760-0972` juga diterima (semua selain digit dibuang) dan menghasilkan `https://wa.me/6282317600972`. Kosongkan nilainya untuk menyembunyikan tombol WhatsApp — semua CTA jatuh ke form kontak, tidak ada link mati. Email kontak publik diganti dengan cara yang sama lewat `PUBLIC_CONTACT_EMAIL` (kosong = tidak ditampilkan).

## Alternatif: shared hosting cPanel (DewaWeb "Node.js App")
1. Setup Node.js App di cPanel: Node 20+, application root `cryptix`, startup file `server.js` (buat: `require("next/dist/server/lib/start-server")` tidak diperlukan — cukup `const { spawn } = require("child_process"); spawn("npx", ["next", "start", "-p", process.env.PORT], { stdio: "inherit" });`).
2. Upload repo (tanpa `node_modules`/`.next`), jalankan `npm ci && npm run build` di terminal cPanel, set env di panel.
3. Keterbatasan: Passenger memutus koneksi lama, jadi stream SSE akan sering reconnect dan klien jatuh ke polling (tetap berfungsi, indikator akan sering "Reconnecting"). Untuk pengalaman "Live" yang mulus, pakai VPS.
