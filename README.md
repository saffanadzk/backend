# Prelove Standalone Payment Backend (Node.js + Express.js + Midtrans Snap + Prisma ORM)

Modul backend pembayaran **Midtrans Snap (Sandbox)** untuk web prelove (jual beli barang bekas). Modul ini berdiri sendiri (**standalone**) tanpa ketergantungan pada tabel user atau order.

---

## 1. Arsitektur & Struktur Direktori

```
backend/
├── prisma/
│   └── schema.prisma             # Skema tabel payments (Prisma ORM)
├── scripts/
│   └── simulate-webhook.js       # Script CLI simulasi webhook Midtrans lokal
├── src/
│   ├── config/
│   │   ├── env.js                # Konfigurasi environment (dotenv, sanitasi key)
│   │   └── prisma.js             # Singleton instance PrismaClient
│   ├── controllers/
│   │   └── paymentController.js  # Controller create, getDetail, notification
│   ├── middlewares/
│   │   ├── errorHandler.js       # Centralized error handler
│   │   └── validatePayment.js    # Validasi request amount & items
│   ├── routes/
│   │   └── paymentRoutes.js      # /api/payments, /api/payments/:orderId, /api/payments/notification
│   ├── services/
│   │   ├── midtransService.js    # Wrapper SDK midtrans-client & verifikasi signature SHA-512
│   │   └── paymentService.js     # Logika pembayaran, idempotensi, callback status
│   ├── utils/
│   │   ├── date.js               # Parser & formatter ISO 8601 offset +07:00 (WIB)
│   │   └── generator.js          # Generator order_id Midtrans (PAY-<timestamp>-<hex>)
│   ├── app.js                    # Konfigurasi Express, middleware, routing
│   └── server.js                 # Entry point server (port 3000)
├── tests/
│   └── payment.test.js           # 12 automated unit & integration tests
├── .env.example                  # Template environment variables
├── .env                          # Kredensial lokal
├── package.json
├── postman_collection.json       # Koleksi Postman siap pakai
└── README.md
```

---

## 2. Persyaratan & Instalasi

### Prasyarat
- Node.js v18 ke atas (teruji pada Node.js v26)
- Akun Midtrans Sandbox (https://dashboard.sandbox.midtrans.com)

### Langkah Instalasi
1. Masuk ke direktori `backend`:
   ```bash
   cd e:\payment\backend
   ```
2. Pasang dependensi npm:
   ```bash
   npm install
   ```
3. Konfigurasi file `.env`:
   Salin dari `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Isi dengan kredensial Sandbox Anda:
   ```env
   # Midtrans Configuration (Sandbox)
   MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxxxxxx
   MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxxxxxx
   MIDTRANS_IS_PRODUCTION=false

   # Database Connection (Default: SQLite dev.db)
   DATABASE_URL="file:./dev.db"

   # Server Port
   PORT=3000
   ```
   > **Catatan Database PostgreSQL / MySQL:**
   > Jika ingin menggunakan PostgreSQL atau MySQL, ubah `provider` di `prisma/schema.prisma` menjadi `"postgresql"` atau `"mysql"`, sesuaikan `DATABASE_URL` (misal: `postgresql://user:pass@localhost:5432/prelove?schema=public`), lalu jalankan `npm run prisma:push`.

4. Sinkronisasi Skema Database (Prisma):
   ```bash
   npm run prisma:push
   ```

5. Jalankan Server:
   ```bash
   npm run dev
   ```
   Server akan berjalan di `http://localhost:3000`.

---

## 3. Dokumentasi Endpoint API

### 1. `POST /api/payments` (Buat Pembayaran)
Membuat transaksi pembayaran di Midtrans Snap dengan batas waktu pembayaran (expiry) **60 menit**.
- **Header:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "amount": 150000,
    "reference_id": "ORDER-PRELOVE-001",
    "items": [
      {
        "id": "PROD-101",
        "price": 150000,
        "quantity": 1,
        "name": "Kamera Vintage Polaroid 600"
      }
    ],
    "customer": {
      "first_name": "Siti",
      "last_name": "Pembeli",
      "email": "siti@prelove.com",
      "phone": "08123456789"
    },
    "metadata": {
      "seller_id": "USER-BUDI-123",
      "note": "Barang mulus tanpa lecet"
    }
  }
  ```
- **Validasi:**
  - `amount` wajib berupa integer > 0.
  - `items` wajib array tidak kosong.
  - Total `(price * quantity)` dari seluruh item **harus sama persis** dengan `amount`.
  - Jika tidak valid, mengembalikan error `400 Bad Request`.
- **Response (201 Created):**
  ```json
  {
    "payment_id": "4b87e220-410a-42c2-b348-18e47b4c6e93",
    "order_id": "PAY-1732280000-A1B2C3D4",
    "token": "753f7c16-b8cb-4df3-a607-42c174d12345",
    "redirect_url": "https://app.sandbox.midtrans.com/snap/v4/redirection/753f7c16-b8cb-4df3-a607-42c174d12345",
    "status": "pending",
    "expires_at": "2026-11-22T20:47:28+07:00"
  }
  ```

---

### 2. `GET /api/payments/:orderId` (Status Pembayaran)
Mengambil status pembayaran terkini. Waktu ditampilkan dalam zona Asia/Jakarta (`+07:00`).
- **Response (200 OK):**
  ```json
  {
    "order_id": "PAY-1732280000-A1B2C3D4",
    "reference_id": "ORDER-PRELOVE-001",
    "amount": 150000,
    "status": "lunas",
    "payment_type": "bank_transfer",
    "created_at": "2026-11-22T19:47:28+07:00",
    "expires_at": "2026-11-22T20:47:28+07:00",
    "paid_at": "2026-11-22T19:50:00+07:00"
  }
  ```

---

### 3. `POST /api/payments/notification` (Webhook Midtrans)
Endpoint publik penerima callback dari Midtrans.
- **Aturan Pemrosesan:**
  1. **Verifikasi Signature:** `SHA512(order_id + status_code + gross_amount + SERVER_KEY) === signature_key`. Jika tidak valid -> return `403 Forbidden`.
  2. **Pengecekan Order:** Jika `order_id` tidak ada di DB -> log warning dan return `404 Not Found`.
  3. **Idempotensi:** Jika status di database sudah `"lunas"`, notifikasi berikutnya diabaikan dan `paid_at` tidak ditimpa.
  4. **Mapping Status:**
     - `capture` & `fraud_status == "accept"` $\rightarrow$ `"lunas"`
     - `capture` & `fraud_status != "accept"` $\rightarrow$ `"challenge"`
     - `settlement` $\rightarrow$ `"lunas"`
     - `pending` $\rightarrow$ `"pending"`
     - `deny` / `cancel` $\rightarrow$ `"gagal"`
     - `expire` $\rightarrow$ `"kadaluarsa"`
  5. **Waktu Lunas (`paid_at`):** Diambil dari `settlement_time` (fallback `transaction_time`), diparse dari WIB (+07:00) dan disimpan sebagai UTC.
  6. **Callback Event:** Memanggil fungsi `onPaymentStatusChanged(payment)` (`// TODO: nanti modul order yang mengisinya`).
  7. **Response:** HTTP `200 OK`.

---

## 4. Cara Uji Coba

### Opsi A: Uji Coba Lokal Tanpa ngrok (Menggunakan Simulator Script)
Telah disediakan script [scripts/simulate-webhook.js](file:///e:/payment/backend/scripts/simulate-webhook.js) untuk menghitung signature SHA-512 secara otomatis dan menembak webhook lokal:

1. Buat pembayaran via curl atau Postman, catat `order_id` (misal: `PAY-1732280000-A1B2C3D4`).
2. Jalankan simulasi webhook:
   ```bash
   node scripts/simulate-webhook.js PAY-1732280000-A1B2C3D4 150000
   ```
3. Cek status pembayaran:
   ```bash
   curl http://localhost:3000/api/payments/PAY-1732280000-A1B2C3D4
   ```
   Status akan langsung berubah menjadi `"lunas"` dengan `paid_at` zona WIB.

---

### Opsi B: Uji Coba Langsung dengan Simulator Midtrans & ngrok
1. Jalankan ngrok:
   ```bash
   ngrok http 3000
   ```
2. Salin URL HTTPS ngrok, contoh: `https://abcd-1234.ngrok-free.app`
3. Masuk ke **Midtrans Dashboard Sandbox** (https://dashboard.sandbox.midtrans.com):
   - Menu: **Settings $\rightarrow$ Configuration**
   - **Payment Notification URL:** Masukkan `https://abcd-1234.ngrok-free.app/api/payments/notification`
   - Klik **Update**.
4. Lakukan pembayaran via redirect URL di browser:
   - **Kartu Kredit Uji Coba Sandbox:**
     - Nomor Kartu: `4811 1111 1111 1114`
     - Masa Berlaku: Bulan/Tahun apa saja di masa depan (misal: `12/28`)
     - CVV: `123`
     - OTP: `112`
   - Atau gunakan **BCA Virtual Account** / **GoPay Simulator**.
5. Midtrans akan otomatis mengirim webhook ke ngrok $\rightarrow$ backend $\rightarrow$ status otomatis menjadi `"lunas"`.

---

## 5. Contoh Perintah cURL

### 1. Buat Pembayaran:
```bash
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 150000,
    "reference_id": "ORDER-PRELOVE-001",
    "items": [
      {
        "id": "PROD-101",
        "price": 150000,
        "quantity": 1,
        "name": "Kamera Vintage Polaroid 600"
      }
    ],
    "customer": {
      "first_name": "Siti",
      "email": "siti@prelove.com",
      "phone": "08123456789"
    }
  }'
```

### 2. Cek Status:
```bash
curl -X GET http://localhost:3000/api/payments/<ORDER_ID_DARI_MIDTRANS>
```

---

## 6. Menjalankan Automated Tests

Test suite dijalankan dengan test runner bawaan Node.js:
```bash
npm test
```
*Hasil:* 12 skenario pengujian komprehensif berhasil 100% (validasi input, snap expiry 60 menit, verifikasi signature SHA-512, pemetaan status, penanganan WIB, idempotensi webhook).
