# **Expeditoo Features Breakdown**

---

# **1. User Flows**

## **1.1 Bid Auction (Buy Item)**

- User masuk ke `/home`
- User melihat listing barang di map & list
- User memilih sebuah listing
- User melakukan **bid**
- User menunggu hasil bid
  (harus ada halaman: **My Bids** untuk melihat semua bid dan statusnya)
- Jika user menang bid:
  - user lanjut ke halaman **Checkout**
  - user memilih metode pembayaran driver (included atau cod) serta pilih destination pengiriman (alamat dan peta)
  - user bayar (jika ada sistem pembayaran)

- User menunggu paket dikirim oleh driver
- User dapat melihat **driver tracking** di map
- User konfirmasi bahwa paket telah tiba
- Order selesai

---

# **2. Seller Flows (Orang yang upload barang)**

## **2.1 Create Listing**

- Seller masuk ke `/create`
- Seller mengisi:
  - nama barang
  - kategori
  - kondisi barang
  - lokasi penjemputan (ditampilkan di map)
  - foto barang
  - batas waktu lelang
  - harga minimum bid (optional)

- Seller submit listing
- Listing muncul di map & list untuk user lain melakukan bid

## **2.2 Manage Listing**

- Seller masuk ke **My Auctions**
- Seller dapat:
  - melihat semua bid yang masuk
  - memilih pemenang (jika manual) ATAU sistem auto-pick (jika otomatis)

- Setelah pemenang bid ditentukan:
  - Tunggu user untuk mengisi rincian alamat pengiriman dan pembayaran
  - Seller menunggu driver datang untuk pickup barang

## **2.3 Delivery (via Driver)**

- Seller memasang paket untuk dikirim
- Barang diserahkan ke driver
- Status: "On Delivery"

## **2.4 Completion**

- Seller melihat konfirmasi bahwa barang telah diterima user
- Transaksi selesai

---

# **3. Driver Flows**

## **3.1 Accept Delivery Job**

- Driver masuk ke dashboard driver `/driver/dashboard`
- Driver melihat list order yang tersedia pada `/driver/shipments`
- Driver memberikan proposal dengan mengisi rincian harga dan waktu pengiriman
- Driver melihat pickup location dan destination di map

## **3.2 Pickup Barang**

- Driver menuju lokasi seller
- Seller menyerahkan barang
- Driver tap **Pickup Confirmed**
- Status berubah menjadi: **On The Way**

## **3.3 Deliver Barang**

- Driver menuju lokasi user (buyer)
- Driver menyerahkan barang
- User melakukan **Delivery Confirmation**
- Job selesai
- Driver mendapat pemasukan

---

# **4. Admin Flows**

## **4.1 Dashboard Management**

- Admin melihat total:
  - user
  - driver
  - listing
  - bid
  - delivery

## **4.2 Driver Verification**

- Admin melihat request driver baru
- Admin approve / reject

## **4.3 Listing Moderation**

- Admin bisa:
  - hapus listing illegal
  - suspend user

## **4.4 Disputes Handling**

- Admin menangani masalah:
  - barang rusak
  - delivery gagal
  - user/driver scam

---

# **5. Map Features (Shared Across Roles)**

## **User**

- Melihat listing barang dekat lokasi

## **Seller**

- Menandai lokasi pickup

## **Driver**

- Melihat rute pickup → dropoff
- Navigasi langsung (Google Maps) langsung dari map kita pencet navigasi buat google map
