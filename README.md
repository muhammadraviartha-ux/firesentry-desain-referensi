# FireSentry — AI foto dan cuaca langsung

## Menjalankan
1. Ekstrak ZIP dan buka folder `firesentry-desain-referensi` di VS Code.
2. Jalankan `index.html` dengan Live Server atau host melalui HTTPS.
3. Unggah foto. GPS opsional; jika diizinkan, FireSentry mengambil cuaca saat ini untuk koordinat tersebut dari Open-Meteo.
4. Klik Analisis. Browser memuat Transformers.js dan model CLIP dari Hugging Face untuk membandingkan foto dengan label visual api/asap/vegetasi. Model dapat memerlukan waktu saat pertama kali dijalankan.

## Batasan penting
- Model CLIP adalah model vision-language umum, bukan model khusus deteksi kebakaran yang tervalidasi. Skor kecocokan label bukan probabilitas kebakaran.
- Cuaca langsung hanya tersedia jika GPS diberikan, karena tanpa lokasi tidak ada koordinat untuk mengambil cuaca lokal.
- Skor risiko pada kartu masih simulasi berbasis aturan, bukan prediksi tervalidasi.
- Tidak ada data hotspot satelit pada paket ini.
- Memerlukan koneksi internet untuk Open-Meteo, Transformers.js, dan unduhan model.


Grafik risiko menampilkan skor simulasi pada skala 0–100: Rendah 0–34%, Sedang 35–59%, Tinggi 60–100%. Skala ini adalah aturan tampilan contoh, bukan standar resmi atau probabilitas kebakaran yang tervalidasi.
