const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");
const photoInput = document.getElementById("photoInput");
const uploadZone = document.getElementById("uploadZone");
const fileName = document.getElementById("fileName");
const gpsButton = document.getElementById("gpsButton");
const locationTitle = document.getElementById("locationTitle");
const locationText = document.getElementById("locationText");
const riskForm = document.getElementById("riskForm");
const toast = document.getElementById("toast");
let selectedPhoto = null;
let gpsPosition = null;
let toastTimer;
let weatherData = null;
let aiPipelinePromise = null;
let aiResult = null;

menuToggle?.addEventListener("click", () => {
  const isOpen = navLinks.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
});
navLinks?.querySelectorAll("a").forEach(link => link.addEventListener("click", () => navLinks.classList.remove("open")));
function showToast(message) {
  toast.textContent = message; toast.classList.add("show"); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 4200);
}
function handleFile(file) {
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return showToast("Pilih gambar JPG, PNG, atau WEBP.");
  if (file.size > 5 * 1024 * 1024) return showToast("Ukuran gambar maksimal 5 MB.");
  selectedPhoto = file; aiResult = null;
  fileName.textContent = `Dipilih: ${file.name}`; uploadZone.classList.add("has-file");
  let preview = document.getElementById("photoPreview");
  if (!preview) { preview = document.createElement("img"); preview.id = "photoPreview"; preview.alt = "Pratinjau foto"; preview.style.cssText = "display:block;max-width:100%;max-height:130px;object-fit:contain;border-radius:12px;margin:0 auto 10px;"; uploadZone.insertBefore(preview, uploadZone.querySelector(".upload-icon")); }
  if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
  const url = URL.createObjectURL(file); preview.src = url; preview.dataset.objectUrl = url;
  document.getElementById("aiResultLine").textContent = "AI foto: foto dipilih; jalankan analisis untuk memprosesnya.";
  showToast("Foto berhasil dipilih.");
}
photoInput?.addEventListener("change", e => handleFile(e.target.files[0]));
["dragenter", "dragover"].forEach(n => uploadZone?.addEventListener(n, e => {e.preventDefault();uploadZone.classList.add("dragover");}));
["dragleave", "drop"].forEach(n => uploadZone?.addEventListener(n, e => {e.preventDefault();uploadZone.classList.remove("dragover");}));
uploadZone?.addEventListener("drop", e => handleFile(e.dataTransfer?.files?.[0]));

async function loadWeather(lat, lon) {
  const status = document.getElementById("weatherStatus");
  status.textContent = "Mengambil cuaca…";
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m&timezone=auto`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Layanan cuaca tidak merespons");
    const data = await response.json(); const c = data.current;
    if (!c) throw new Error("Data cuaca saat ini tidak tersedia");
    weatherData = c;
    document.getElementById("weatherTemp").textContent = `${c.temperature_2m} °C`;
    document.getElementById("weatherHumidity").textContent = `${c.relative_humidity_2m}%`;
    document.getElementById("weatherRain").textContent = `${c.precipitation} mm`;
    document.getElementById("weatherWind").textContent = `${c.wind_speed_10m} km/jam`;
    status.textContent = `Diperbarui: ${c.time || "waktu sumber tersedia"}`;
    document.getElementById("weatherAttribution").textContent = "Sumber: Open-Meteo API · Cuaca aktual untuk koordinat GPS yang dipilih. Bukan data hotspot.";
  } catch (err) {
    weatherData = null; status.textContent = "Gagal mengambil cuaca";
    showToast("Data cuaca tidak dapat diambil. Periksa internet lalu coba lagi.");
  }
}
gpsButton?.addEventListener("click", () => {
  if (!("geolocation" in navigator)) return showToast("Browser tidak mendukung GPS. Kamu tetap bisa lanjut tanpa GPS.");
  gpsButton.disabled = true; gpsButton.textContent = "Mencari…";
  navigator.geolocation.getCurrentPosition(async p => {
    gpsPosition = {latitude:p.coords.latitude, longitude:p.coords.longitude};
    locationTitle.textContent = "2. Lokasi GPS berhasil didapat";
    locationText.textContent = `${gpsPosition.latitude.toFixed(5)}, ${gpsPosition.longitude.toFixed(5)}`;
    gpsButton.textContent = "Perbarui cuaca"; gpsButton.disabled = false;
    await loadWeather(gpsPosition.latitude, gpsPosition.longitude);
    showToast("Koordinat diperoleh dan cuaca diperbarui.");
  }, e => {
    showToast(e.code === 1 ? "Izin lokasi ditolak. Kamu bisa lanjut tanpa GPS." : "Lokasi tidak ditemukan. Coba lagi atau lanjut tanpa GPS.");
    gpsButton.textContent = "Coba GPS lagi"; gpsButton.disabled = false;
  }, {enableHighAccuracy:true, timeout:12000, maximumAge:60000});
});

// AI klasifikasi gambar berbasis CLIP dijalankan di browser via Transformers.js.
// Model diunduh dari Hugging Face saat pertama kali dipakai; perlu internet dan browser modern.
async function runImageAI(file) {
  const line = document.getElementById("aiResultLine");
  line.textContent = "AI foto: memuat model; pertama kali bisa memerlukan waktu…";
  try {
    if (!aiPipelinePromise) {
      aiPipelinePromise = import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2").then(({pipeline, env}) => {
        env.allowLocalModels = false;
        return pipeline("zero-shot-image-classification", "Xenova/clip-vit-base-patch32");
      });
    }
    const classifier = await aiPipelinePromise;
    const results = await classifier(URL.createObjectURL(file), [
      "a photograph of an active fire with visible flames",
      "a photograph of smoke rising from vegetation or forest",
      "a photograph of a forest or plantation without fire or smoke",
      "a photograph of dry grass, peatland or dry vegetation",
      "a photograph of a field being burned"
    ]);
    aiResult = results?.[0] || null;
    if (!aiResult) throw new Error("Model tidak mengembalikan hasil");
    const labels = {
      "a photograph of an active fire with visible flames":"indikasi visual api",
      "a photograph of smoke rising from vegetation or forest":"indikasi visual asap",
      "a photograph of a forest or plantation without fire or smoke":"vegetasi tanpa indikasi api/asap yang kuat",
      "a photograph of dry grass, peatland or dry vegetation":"vegetasi kering",
      "a photograph of a field being burned":"indikasi visual pembakaran lahan"
    };
    line.textContent = `AI foto (CLIP): ${labels[aiResult.label] || aiResult.label} · skor kecocokan ${(aiResult.score*100).toFixed(1)}%. Ini kecocokan label model, bukan probabilitas kebakaran.`;
    return aiResult;
  } catch (err) {
    line.textContent = "AI foto: model tidak dapat dijalankan. Pastikan internet aktif dan buka melalui HTTPS atau localhost.";
    showToast("Model AI gagal dimuat. Analisis aturan tetap bisa ditampilkan.");
    return null;
  }
}
const landRiskScores = {"Gambut":35,"Hutan":24,"Perkebunan":20,"Semak belukar":27,"Lahan pertanian":16,"Tidak diketahui":18};
const rainRiskScores = {"Hari ini":4,"1–3 hari lalu":12,"4–7 hari lalu":22,"Lebih dari 7 hari":30,"Tidak diketahui":12};
function renderFactors(factors) {
  const container = document.getElementById("factorTags"); container.replaceChildren();
  factors.slice(0,4).forEach(f => {const tag=document.createElement("span");tag.textContent=f;container.appendChild(tag);});
}
function renderRiskResult({score, level, landType, rainfall, factors, advice}) {
  document.getElementById("riskTitle").textContent = `Risiko simulasi ${level.toLowerCase()}`;
  document.getElementById("riskTitle").style.color = level === "Tinggi" ? "#c52d22" : level === "Sedang" ? "#b96b16" : "#237a48";
  document.getElementById("riskPercent").textContent = `${score}%`;
  const marker = document.getElementById("riskMarker");
  if (marker) { marker.style.left = `${score}%`; marker.setAttribute("aria-label", `Skor simulasi ${score} persen`); }
  const markerLabel = document.getElementById("riskMarkerLabel");
  if (markerLabel) markerLabel.textContent = `${score}%`;
  document.getElementById("adviceText").textContent = advice;
  const weatherNote = weatherData ? ` Cuaca langsung: ${weatherData.temperature_2m}°C, kelembapan ${weatherData.relative_humidity_2m}%, hujan ${weatherData.precipitation} mm, angin ${weatherData.wind_speed_10m} km/jam.` : " Cuaca langsung belum tersedia karena GPS tidak digunakan atau data cuaca gagal diambil.";
  document.getElementById("sampleWarning").textContent = `Skor ini simulasi berbasis aturan (lahan: ${landType}; pilihan hujan: ${rainfall}), bukan indeks resmi atau probabilitas tervalidasi.${weatherNote}`;
  renderFactors(factors);
  document.getElementById("resultCard").scrollIntoView({behavior:"smooth",block:"center"});
}
riskForm?.addEventListener("submit", async e => {
  e.preventDefault();
  const landType = document.getElementById("landType").value;
  const rainfall = document.getElementById("rainfall").value;
  if (!selectedPhoto) return showToast("Silakan unggah foto lahan atau asap terlebih dahulu.");
  if (!landType || !rainfall) return showToast("Lengkapi pilihan jenis lahan dan hujan terakhir.");
  const submit = riskForm.querySelector('[type="submit"]'); submit.disabled = true; submit.textContent = "Menganalisis foto…";
  const visual = await runImageAI(selectedPhoto);
  let score = (landRiskScores[landType] ?? 18) + (rainRiskScores[rainfall] ?? 12);
  if (weatherData && weatherData.precipitation === 0) score += 5;
  if (weatherData && weatherData.temperature_2m >= 33) score += 5;
  score = Math.min(95, Math.max(5, score));
  const level = score >= 60 ? "Tinggi" : score >= 35 ? "Sedang" : "Rendah";
  const factors = [landType === "Gambut" ? "Jenis lahan gambut" : `Jenis lahan: ${landType}`];
  factors.push(rainfall === "Lebih dari 7 hari" ? "Periode tanpa hujan panjang" : rainfall === "4–7 hari lalu" ? "Hujan sudah 4–7 hari lalu" : rainfall === "Hari ini" ? "Hujan dilaporkan hari ini" : "Riwayat hujan sesuai pilihan pengguna");
  if (weatherData) factors.push(`Cuaca langsung ${weatherData.temperature_2m}°C`);
  if (visual) factors.push("Foto diproses model AI CLIP");
  if (gpsPosition) factors.push("Koordinat GPS tersedia"); else factors.push("Analisis berjalan tanpa GPS");
  const advice = level === "Tinggi" ? "Skor simulasi tinggi: hindari pembakaran lahan. Jika melihat api atau asap, menjauh ke tempat aman dan laporkan kepada BPBD atau petugas setempat." : level === "Sedang" ? "Skor simulasi sedang: hindari pembakaran terbuka dan pantau kondisi sekitar. Laporkan tanda api atau asap kepada petugas." : "Skor simulasi rendah bukan jaminan lokasi bebas kebakaran. Tetap hindari pembakaran lahan dan lakukan pemantauan.";
  renderRiskResult({score,level,landType,rainfall,factors,advice});
  submit.disabled = false; submit.innerHTML = '3. Analisis risiko <span>→</span>';
  showToast(visual ? "Analisis model AI dan hasil simulasi selesai." : "Hasil simulasi selesai; model AI belum berhasil dijalankan.");
});
