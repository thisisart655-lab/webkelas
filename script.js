/* =========================================================================
   1. KONFIGURASI FIREBASE
   -------------------------------------------------------------------------
   Ganti semua nilai di bawah dengan milik project Firebase kamu.
   Ambil dari: Firebase Console > Project Settings > Your apps > SDK setup.
   -------------------------------------------------------------------------
   ATURAN REALTIME DATABASE (Rules) — tempel di tab "Rules":
   {
     "rules": {
       "users": {
         ".read": "auth != null",
         "$uid": { ".write": "auth != null && (auth.uid === $uid || root.child('users').child(auth.uid).child('peran').val() === 'guru')" }
       },
       "usernames": {
         ".read": true,
         "$nama": { ".write": "auth != null" }
       },
       "materi": {
         ".read": "auth != null",
         ".write": "auth != null && root.child('users').child(auth.uid).child('peran').val() === 'guru'"
       },
       "nilai": {
         ".read": "auth != null",
         "$uid": { ".write": "auth != null && (auth.uid === $uid || root.child('users').child(auth.uid).child('peran').val() === 'guru')" }
       }
     }
   }
   ========================================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyBJETCKPOLwFnVp8Q8Zev6tL_MJAsxAAJc",
  authDomain: "kelas6b-bfc03.firebaseapp.com",
  databaseURL: "https://kelas6b-bfc03-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kelas6b-bfc03",
  storageBucket: "kelas6b-bfc03.firebasestorage.app",
  messagingSenderId: "632145539568",
  appId: "1:632145539568:web:136471f4ec654a3097ed35"
};

const KODE_GURU    = "GURU2026";             // kode rahasia untuk daftar sebagai guru
const DOMAIN_EMAIL = "@kelasceria.app";       // email bayangan (username -> email)
const MODE_DEMO    = firebaseConfig.apiKey.startsWith("ISI"); // otomatis demo bila belum diisi

/* =========================================================================
   2. UTILITAS
   ========================================================================= */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const esc = s => String(s ?? "").replace(/[&<>"']/g,
  c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

const PALET = ["#2f6fed", "#ff6b6b", "#2fc48a", "#f4a11d", "#7b5cff", "#e8559b"];
function warnaMapel(s){
  s = String(s || "umum");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
  return PALET[h % PALET.length];
}
const tanggal = ts => ts
  ? new Date(ts).toLocaleDateString("id-ID", { day:"numeric", month:"short", year:"numeric" })
  : "-";

const paragraf = t => String(t || "")
  .split(/\n+/).filter(Boolean)
  .map(b => b.startsWith("## ")
    ? `<h3>${esc(b.slice(3))}</h3>`
    : `<p>${esc(b)}</p>`).join("");

const IKON = {
  home : '<path d="M3 11l9-7.5 9 7.5v8.5a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H4.5A1.5 1.5 0 0 1 3 19.5z"/>',
  book : '<path d="M12 6.6C10.4 5 8.4 4.4 6 4.4H3v13.2h3c2.4 0 4.4.6 6 2 1.6-1.4 3.6-2 6-2h3V4.4h-3c-2.4 0-4.4.6-6 2.2z"/><path d="M12 6.6v13"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M17 11.2a3.2 3.2 0 1 0 0-6.4"/><path d="M21 20a5 5 0 0 0-4-4.9"/>',
  edit : '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="M14.5 5.5l4 4"/>',
  out  : '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 16l-4-4 4-4"/><path d="M6 12h11"/>'
};
const ikon = (n, w = "") =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"
        stroke-linejoin="round" ${w}>${IKON[n] || ""}</svg>`;

/* =========================================================================
   3. LAPISAN DATA (API) — Firebase atau Demo (localStorage)
   ========================================================================= */
const emailDari = u => u.toLowerCase().replace(/[^a-z0-9._-]/g, "") + DOMAIN_EMAIL;

/* ---------- 3a. Firebase ---------- */
function firebaseAPI(){
  let auth, db, M, cbAuth = null;

  return {
    async init(){
      const [appMod, authMod, dbMod] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js")
      ]);
      const app = appMod.initializeApp(firebaseConfig);
      auth = authMod.getAuth(app);
      db   = dbMod.getDatabase(app);
      M    = { authMod, dbMod };
      authMod.onAuthStateChanged(auth, u => cbAuth && cbAuth(u ? u.uid : null));
    },
    onAuth(cb){ cbAuth = cb; },

    async masuk(u, p){
      await M.authMod.signInWithEmailAndPassword(auth, emailDari(u), p);
    },
    async daftar(u, p, kelas, kode){
      const { ref, get, set } = M.dbMod;
      const nama = u.toLowerCase();
      const cek = await get(ref(db, "usernames/" + nama));
      if (cek.exists()) throw new Error("USERNAME_DIPAKAI");

      const cred = await M.authMod.createUserWithEmailAndPassword(auth, emailDari(nama), p);
      const uid  = cred.user.uid;
      const peran = (kode && kode === KODE_GURU) ? "guru" : "siswa";

      await set(ref(db, "users/" + uid), {
        username: nama, kelas: kelas || "-", peran, dibuat: Date.now()
      });
      await set(ref(db, "usernames/" + nama), uid);
      return uid;
    },
    async keluar(){ await M.authMod.signOut(auth); },

    async getUser(uid){
      const { ref, get } = M.dbMod;
      const s = await get(ref(db, "users/" + uid));
      return s.exists() ? { uid, ...s.val() } : null;
    },
    async listUsers(){
      try{
        const { ref, get } = M.dbMod;
        const s = await get(ref(db, "users"));
        const v = s.val() || {};
        return Object.entries(v).map(([uid, d]) => ({ uid, ...d }));
      }catch(e){ return []; }
    },
    async setUser(uid, data){
      await M.dbMod.update(M.dbMod.ref(db, "users/" + uid), data);
    },

    async listMateri(){
      const { ref, get } = M.dbMod;
      const s = await get(ref(db, "materi"));
      const v = s.val() || {};
      return Object.entries(v)
        .map(([id, d]) => ({ id, ...d }))
        .sort((a, b) => (a.dibuat || 0) - (b.dibuat || 0));
    },
    async simpanMateri(m){
      const { ref, set, update, push } = M.dbMod;
      if (m.id){
        const { id, ...data } = m;
        await update(ref(db, "materi/" + id), data);
        return id;
      }
      const r = push(ref(db, "materi"));
      await set(r, { ...m, dibuat: Date.now() });
      return r.key;
    },
    async hapusMateri(id){
      await M.dbMod.remove(M.dbMod.ref(db, "materi/" + id));
    },

    async listNilai(){
      try{
        const { ref, get } = M.dbMod;
        const s = await get(ref(db, "nilai"));
        return s.val() || {};
      }catch(e){ return {}; }
    },
    async simpanNilai(uid, mid, data){
      await M.dbMod.set(M.dbMod.ref(db, `nilai/${uid}/${mid}`), data);
    }
  };
}

/* ---------- 3b. Demo (localStorage) — dipakai bila config belum diisi ---------- */
function demoAPI(){
  const KUNCI = "kelasceria_demo_v1";
  let cbAuth = null;

  const kosong = () => ({ users:{}, usernames:{}, pass:{}, materi:{}, nilai:{} });
  const baca  = () => { try { return JSON.parse(localStorage.getItem(KUNCI)) || kosong(); }
                        catch(e){ return kosong(); } };
  const tulis = d => localStorage.setItem(KUNCI, JSON.stringify(d));
  let D = baca();

  if (!Object.keys(D.materi).length){
    D.materi = materiContoh();
    tulis(D);
  }

  return {
    async init(){ setTimeout(() => cbAuth && cbAuth(sessionStorage.getItem("kc_uid")), 60); },
    onAuth(cb){ cbAuth = cb; },

    async masuk(u, p){
      u = u.toLowerCase();
      const uid = D.usernames[u];
      if (!uid) throw new Error("USER_TIDAK_ADA");
      if (D.pass[uid] !== p) throw new Error("PASSWORD_SALAH");
      sessionStorage.setItem("kc_uid", uid);
      cbAuth && cbAuth(uid);
    },
    async daftar(u, p, kelas, kode){
      u = u.toLowerCase();
      if (D.usernames[u]) throw new Error("USERNAME_DIPAKAI");
      const uid = "u" + Date.now().toString(36);
      D.users[uid] = {
        username: u, kelas: kelas || "-",
        peran: (kode && kode === KODE_GURU) ? "guru" : "siswa",
        dibuat: Date.now()
      };
      D.usernames[u] = uid;
      D.pass[uid] = p;
      tulis(D);
      sessionStorage.setItem("kc_uid", uid);
      cbAuth && cbAuth(uid);
      return uid;
    },
    async keluar(){
      sessionStorage.removeItem("kc_uid");
      cbAuth && cbAuth(null);
    },

    async getUser(uid){ return D.users[uid] ? { uid, ...D.users[uid] } : null; },
    async listUsers(){ return Object.entries(D.users).map(([uid, d]) => ({ uid, ...d })); },
    async setUser(uid, data){ Object.assign(D.users[uid], data); tulis(D); },

    async listMateri(){
      return Object.entries(D.materi)
        .map(([id, d]) => ({ id, ...d }))
        .sort((a, b) => (a.dibuat || 0) - (b.dibuat || 0));
    },
    async simpanMateri(m){
      if (m.id){ const { id, ...d } = m; Object.assign(D.materi[id], d); }
      else { const id = "m" + Date.now().toString(36); D.materi[id] = { ...m, dibuat: Date.now() }; m.id = id; }
      tulis(D);
      return m.id;
    },
    async hapusMateri(id){ delete D.materi[id]; tulis(D); },

    async listNilai(){ return D.nilai; },
    async simpanNilai(uid, mid, data){
      D.nilai[uid] = D.nilai[uid] || {};
      D.nilai[uid][mid] = data;
      tulis(D);
    }
  };
}

function materiContoh(){
  const buat = (judul, mapel, kelas, deskripsi, isi, kuis) =>
    ({ judul, mapel, kelas, deskripsi, isi, kuis, dibuat: Date.now() });
  return {
    m1: buat("Penjumlahan & Pengurangan", "Matematika", "1",
      "Belajar hitung cepat dengan jari dan gambar.",
      "## Ayo Mengenal Angka\nAngka adalah simbol untuk menghitung jumlah benda. Kita mulai dari 1 sampai 10.\n## Cara Menjumlah\nKalau kamu punya 3 permen lalu diberi 2 permen lagi, jumlahnya jadi 5. Ditulis 3 + 2 = 5.\n## Cara Mengurang\nKalau 5 permen dimakan 2, sisanya 3. Ditulis 5 - 2 = 3.",
      [
        { soal:"2 + 3 = ...", pilihan:["4","5","6","7"], jawaban:1 },
        { soal:"7 - 4 = ...", pilihan:["2","3","4","5"], jawaban:1 }
      ]),
    m2: buat("Mengenal Anggota Tubuh", "IPA", "1",
      "Kenali bagian tubuh dan kegunaannya.",
      "## Bagian Tubuh\nTubuh kita punya kepala, badan, tangan, dan kaki.\n## Kegunaannya\nMata untuk melihat, telinga untuk mendengar, hidung untuk mencium bau, dan mulut untuk makan serta berbicara.\n## Menjaga Kesehatan\nRajin mandi, sikat gigi pagi dan malam, serta makan makanan bergizi.",
      [
        { soal:"Kita melihat dengan ...", pilihan:["telinga","mata","hidung","kaki"], jawaban:1 },
        { soal:"Alat untuk mendengar adalah ...", pilihan:["mata","mulut","telinga","tangan"], jawaban:2 }
      ]),
    m3: buat("Membaca Suku Kata", "Bahasa Indonesia", "1",
      "Latihan membaca suku kata terbuka.",
      "## Suku Kata Terbuka\nSuku kata terbuka diakhiri huruf vokal, contohnya ba, bi, bu, be, bo.\n## Menggabungkan\nba + ju = baju. bu + ku = buku. se + patu = sepatu.\n## Latihan\nBacalah dengan suara jelas: buku, meja, kursi, pintu.",
      [
        { soal:"ba + ju menjadi ...", pilihan:["baju","buku","biji","batu"], jawaban:0 }
      ])
  };
}

/* =========================================================================
   4. STATE & INISIALISASI
   ========================================================================= */
let API;
let blokirAuth = false;   // dipakai saat proses daftar (hindari race condition)

const state = {
  uid: null,
  profil: null,
  materi: [],
  users: [],
  nilai: {},
  hal: "beranda",
  param: null
};

const isGuru = () => state.profil && (state.profil.peran === "guru" || state.profil.peran === "admin");

/* ---------- Toast ---------- */
let toastTimer;
function toast(pesan, tipe = ""){
  const t = $("#toast");
  t.textContent = pesan;
  t.className = "toast tampil " + tipe;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = "toast"; }, 2800);
}

/* ---------- Mulai ---------- */
async function mulai(){
  API = MODE_DEMO ? demoAPI() : firebaseAPI();

  API.onAuth(async uid => {
    if (blokirAuth) return;
    await tanganiSesi(uid);
  });

  try{
    await API.init();
  }catch(e){
    pesanLogin("Gagal menyambung ke Firebase. Cek konfigurasi & koneksi internet.");
    console.error(e);
  }

  if (MODE_DEMO) console.info("Mode DEMO aktif — isi firebaseConfig untuk memakai Firebase asli.");
}

async function tanganiSesi(uid){
  state.uid = uid;

  if (!uid){ tampilLogin(); return; }

  try{
    state.profil = await API.getUser(uid);
  }catch(e){ state.profil = null; }

  if (!state.profil){
    await new Promise(r => setTimeout(r, 700));
    try{ state.profil = await API.getUser(uid); }catch(e){}
  }
  if (!state.profil){
    toast("Profil tidak ditemukan.", "err");
    await API.keluar();
    return;
  }

  await muatData();
  tampilApp();
}

async function muatData(){
  const [m, u, n] = await Promise.all([
    API.listMateri().catch(() => []),
    API.listUsers().catch(() => []),
    API.listNilai().catch(() => ({}))
  ]);
  state.materi = m;
  state.users  = u;
  state.nilai  = n;
}

/* =========================================================================
   5. TAMPIL / SEMBUNYI LAYAR
   ========================================================================= */
function tampilLogin(){
  $("#layarApp").classList.remove("aktif");
  $("#layarLogin").classList.add("aktif");
  state.profil = null;
  state.uid = null;
}

function tampilApp(){
  $("#layarLogin").classList.remove("aktif");
  $("#layarApp").classList.add("aktif");

  const p = state.profil;
  $("#namaUser").textContent = p.username;
  $("#peranUser").textContent =
    (isGuru() ? "Guru" : "Siswa") + (p.kelas && p.kelas !== "-" ? " · Kelas " + p.kelas : "");
  $("#avatar").textContent = (p.username || "?").charAt(0);
  $("#topbarSub").textContent = sapaan() + ", semangat belajar!";

  state.hal = "beranda";
  state.param = null;
  render();
}

function sapaan(){
  const j = new Date().getHours();
  if (j < 11) return "Selamat pagi";
  if (j < 15) return "Selamat siang";
  if (j < 18) return "Selamat sore";
  return "Selamat malam";
}

/* =========================================================================
   6. RENDER
   ========================================================================= */
const HALAMAN = {
  beranda:     halBeranda,
  materi:      halMateri,
  detail:      halDetail,
  kuis:        halKuis,
  nilai:       halNilai,
  adminMateri: halAdminMateri,
  adminForm:   halAdminForm,
  adminUser:   halAdminUser,
  adminRekap:  halAdminRekap
};

function render(){
  renderSidebar();
  $("#konten").innerHTML = (HALAMAN[state.hal] || halBeranda)();
  setelahRender();
}

function renderSidebar(){
  const item = (id, label, ic) =>
    `<button class="nav-item ${state.hal === id ? "on" : ""}" data-nav="${id}">
       ${ikon(ic)}<span>${label}</span>
     </button>`;

  let html = item("beranda", "Beranda", "home")
           + item("materi", "Materi", "book")
           + item("nilai", "Nilai Saya", "chart");

  if (isGuru()){
    html += `<div class="nav-judul">Panel Guru</div>`
          + item("adminMateri", "Kelola Materi", "edit")
          + item("adminUser", "Pengguna", "users")
          + item("adminRekap", "Rekap Nilai", "chart");
  }
  $("#sidebar").innerHTML = html;
}

/* ---------- Beranda ---------- */
function cocokKelas(m, p){
  if (isGuru()) return true;
  return !m.kelas || m.kelas === "semua" || String(m.kelas) === String(p.kelas);
}

function kartuMateri(m){
  return `<article class="materi" data-aksi="buka" data-id="${m.id}"
                   style="--warna:${warnaMapel(m.mapel)}">
    <span class="badge" style="--warna:${warnaMapel(m.mapel)}">${esc(m.mapel || "Umum")}</span>
    <h4>${esc(m.judul)}</h4>
    <p>${esc(m.deskripsi || "Klik untuk membaca materi ini.")}</p>
    <span class="kelas-chip">Kelas ${esc(m.kelas || "semua")} · ${(m.kuis || []).length} soal</span>
  </article>`;
}

function halBeranda(){
  const p = state.profil;
  const materiSaya = state.materi.filter(m => cocokKelas(m, p));
  const nilaiSaya  = Object.values(state.nilai[p.uid] || {});
  const rata = nilaiSaya.length
    ? Math.round(nilaiSaya.reduce((a, b) => a + (b.skor || 0), 0) / nilaiSaya.length)
    : 0;

  return `
    <div class="panel glass coret sambutan">
      <h2>Hai, ${esc(p.username)}! 👋</h2>
      <p>${sapaan()}, siap belajar hari ini? Pilih materi di bawah ya.</p>
    </div>

    <div class="statistik">
      <div class="stat glass coret"><b>${materiSaya.length}</b><span>Materi tersedia</span></div>
      <div class="stat glass coret"><b>${nilaiSaya.length}</b><span>Kuis dikerjakan</span></div>
      <div class="stat glass coret"><b>${rata}</b><span>Rata-rata nilai</span></div>
    </div>

    <div class="panel glass coret">
      <div class="panel-kepala">
        <h3>Lanjut belajar</h3>
        <button class="btn btn-lembut" data-nav="materi">Lihat semua</button>
      </div>
      <div class="grid-materi">
        ${materiSaya.slice(0, 3).map(kartuMateri).join("")
          || `<p class="kosong">Belum ada materi untuk kelasmu. Tunggu gurumu menambahkan ya.</p>`}
      </div>
    </div>`;
}

/* ---------- Daftar materi ---------- */
function halMateri(){
  const p = state.profil;
  const daftar = state.materi.filter(m => cocokKelas(m, p));

  return `
    <div class="panel glass coret">
      <div class="panel-kepala">
        <h3>Materi ${isGuru() ? "Semua Kelas" : "Kelas " + esc(p.kelas)}</h3>
        ${isGuru() ? `<button class="btn btn-utama" data-nav="adminForm">+ Materi Baru</button>` : ""}
      </div>
      <div class="grid-materi">
        ${daftar.map(kartuMateri).join("")
          || `<p class="kosong">Belum ada materi di sini.</p>`}
      </div>
    </div>`;
}

/* ---------- Detail materi ---------- */
function halDetail(){
  const m = state.materi.find(x => x.id === state.param);
  if (!m) return `<div class="panel glass coret"><p class="kosong">Materi tidak ditemukan.</p></div>`;

  const nilai = (state.nilai[state.uid] || {})[m.id];
  const adaKuis = (m.kuis || []).length > 0;

  return `
    <div class="panel glass coret">
      <button class="btn btn-lembut" data-aksi="kembali" data-ke="materi">
        ${ikon("out", 'width="16" height="16" style="transform:rotate(180deg)"')} Kembali
      </button>

      <div class="detail-kepala">
        <span class="badge" style="--warna:${warnaMapel(m.mapel)}">${esc(m.mapel || "Umum")}</span>
        <h2>${esc(m.judul)}</h2>
        <p class="meta">
          Kelas ${esc(m.kelas || "semua")}
          ${nilai ? ` · Nilai terakhirmu <b>${nilai.skor}</b>` : ""}
        </p>
      </div>

      <div class="isi-materi">${paragraf(m.isi)}</div>

      ${adaKuis ? `
        <div class="aksi-baris">
          <button class="btn btn-utama" data-aksi="kerjakanKuis" data-id="${m.id}">
            Kerjakan Kuis (${m.kuis.length} soal)
          </button>
        </div>` : ""}
    </div>`;
}

/* ---------- Kuis ---------- */
function halKuis(){
  const m = state.materi.find(x => x.id === state.param);
  if (!m || !(m.kuis || []).length)
    return `<div class="panel glass coret"><p class="kosong">Kuis tidak tersedia.</p></div>`;

  return `
    <div class="panel glass coret">
      <h2>Kuis: ${esc(m.judul)}</h2>
      <p class="meta">Pilih satu jawaban yang paling benar, lalu tekan Kumpulkan.</p>

      <form id="formKuis" style="margin-top:18px">
        ${m.kuis.map((q, i) => `
          <div class="soal">
            <p class="soal-teks"><span class="nomor">${i + 1}</span> ${esc(q.soal)}</p>
            <div class="opsi">
              ${(q.pilihan || []).map((pil, j) => pil ? `
                <label class="opsi-item">
                  <input type="radio" name="q${i}" value="${j}">
                  <span>${"ABCD"[j]}. ${esc(pil)}</span>
                </label>` : "").join("")}
            </div>
          </div>`).join("")}

        <div class="aksi-baris">
          <button class="btn btn-utama" type="submit">Kumpulkan Jawaban</button>
          <button class="btn btn-lembut" type="button" data-aksi="kembali" data-ke="detail">Batal</button>
        </div>
      </form>
    </div>`;
}

/* ---------- Nilai ---------- */
function halNilai(){
  const n = state.nilai[state.uid] || {};
  const baris = Object.entries(n).map(([mid, d]) => {
    const m = state.materi.find(x => x.id === mid);
    return `<tr>
      <td>${esc(m ? m.judul : "(materi dihapus)")}</td>
      <td>${esc(m ? m.mapel : "-")}</td>
      <td><b>${d.skor}</b></td>
      <td>${d.benar ?? "-"}/${d.total ?? "-"}</td>
      <td>${tanggal(d.tanggal)}</td>
    </tr>`;
  }).join("");

  return `
    <div class="panel glass coret">
      <div class="panel-kepala"><h3>Nilai Saya</h3></div>
      ${baris ? `
        <div class="tabel-bungkus">
          <table>
            <thead><tr><th>Materi</th><th>Mapel</th><th>Skor</th><th>Benar</th><th>Tanggal</th></tr></thead>
            <tbody>${baris}</tbody>
          </table>
        </div>` : `<p class="kosong">Kamu belum mengerjakan kuis apa pun. Ayo mulai dari menu Materi!</p>`}
    </div>`;
}

/* ---------- Admin: kelola materi ---------- */
function halAdminMateri(){
  if (!isGuru()) return halBeranda();

  const baris = state.materi.map(m => `
    <tr>
      <td>${esc(m.judul)}</td>
      <td>${esc(m.mapel || "-")}</td>
      <td>Kelas ${esc(m.kelas || "semua")}</td>
      <td>${(m.kuis || []).length}</td>
      <td>
        <div class="aksi-kecil">
          <button class="btn-mini edit"  data-aksi="editMateri"  data-id="${m.id}">Ubah</button>
          <button class="btn-mini hapus" data-aksi="hapusMateri" data-id="${m.id}">Hapus</button>
        </div>
      </td>
    </tr>`).join("");

  return `
    <div class="panel glass coret">
      <div class="panel-kepala">
        <h3>Kelola Materi</h3>
        <button class="btn btn-utama" data-nav="adminForm">+ Materi Baru</button>
      </div>
      ${baris ? `
        <div class="tabel-bungkus">
          <table>
            <thead><tr><th>Judul</th><th>Mapel</th><th>Kelas</th><th>Soal</th><th>Aksi</th></tr></thead>
            <tbody>${baris}</tbody>
          </table>
        </div>` : `<p class="kosong">Belum ada materi. Klik "Materi Baru" untuk membuat.</p>`}
    </div>`;
}

/* ---------- Admin: form materi ---------- */
function halAdminForm(){
  if (!isGuru()) return halBeranda();
  const m = state.param ? state.materi.find(x => x.id === state.param) : null;

  return `
    <div class="panel glass coret">
      <div class="panel-kepala">
        <h3>${m ? "Ubah Materi" : "Materi Baru"}</h3>
        <button class="btn btn-lembut" data-nav="adminMateri">Kembali</button>
      </div>

      <form id="formMateri" class="form-grid">
        <div class="field">
          <label>Judul Materi</label>
          <input name="judul" required value="${esc(m?.judul || "")}" placeholder="mis. Mengenal Angka">
        </div>
        <div class="field">
          <label>Mata Pelajaran</label>
          <input name="mapel" required value="${esc(m?.mapel || "")}" placeholder="mis. Matematika">
        </div>
        <div class="field">
          <label>Untuk Kelas</label>
          <select name="kelas">${opsiKelas(m?.kelas)}</select>
        </div>
        <div class="field">
          <label>Deskripsi Singkat</label>
          <input name="deskripsi" value="${esc(m?.deskripsi || "")}" placeholder="satu kalimat saja">
        </div>
        <div class="field lebar">
          <label>Isi Materi <span class="opsional">(tulis "## " di awal baris untuk sub-judul)</span></label>
          <textarea name="isi" rows="8" placeholder="## Ayo Mengenal Angka&#10;Angka adalah ...">${esc(m?.isi || "")}</textarea>
        </div>

        <div class="lebar">
          <div class="panel-kepala" style="margin-bottom:10px">
            <label style="font-weight:800;color:#41527a">Soal Kuis</label>
            <button type="button" class="btn btn-lembut" data-aksi="tambahSoal">+ Tambah Soal</button>
          </div>
          <div id="daftarSoal"></div>
        </div>

        <div class="lebar aksi-baris">
          <button class="btn btn-utama" type="submit">Simpan Materi</button>
        </div>
      </form>
    </div>`;
}

function opsiKelas(terpilih){
  const daftar = ["1", "2", "3", "4", "5", "6", "semua"];
  return daftar.map(v =>
    `<option value="${v}" ${String(terpilih) === v ? "selected" : ""}>
       ${v === "semua" ? "Semua Kelas" : "Kelas " + v}
     </option>`).join("");
}

function tambahSoal(s = {}){
  const wadah = $("#daftarSoal");
  if (!wadah) return;

  const div = document.createElement("div");
  div.className = "soal-baris";
  div.innerHTML = `
    <button type="button" class="hapus-soal" data-aksi="hapusSoal" title="Hapus soal">×</button>
    <div class="field">
      <label>Pertanyaan</label>
      <input class="s-soal" value="${esc(s.soal || "")}" placeholder="mis. 2 + 3 = ...">
    </div>
    <div class="pilihan">
      ${[0, 1, 2, 3].map(i => `
        <input class="s-pil" value="${esc((s.pilihan && s.pilihan[i]) || "")}"
               placeholder="Pilihan ${"ABCD"[i]}">`).join("")}
    </div>
    <div class="field" style="max-width:220px">
      <label>Jawaban Benar</label>
      <select class="s-jawab">
        ${[0, 1, 2, 3].map(i =>
          `<option value="${i}" ${Number(s.jawaban) === i ? "selected" : ""}>${"ABCD"[i]}</option>`).join("")}
      </select>
    </div>`;
  wadah.appendChild(div);
}

/* ---------- Admin: pengguna ---------- */
function halAdminUser(){
  if (!isGuru()) return halBeranda();

  const baris = state.users.map(u => `
    <tr>
      <td style="text-transform:capitalize">${esc(u.username)}</td>
      <td>
        <select class="kelas-user" data-uid="${u.uid}" style="padding:7px 10px;border-radius:11px;
          border:1.5px solid rgba(47,111,237,.18);background:#fff;font-weight:700">
          ${opsiKelas(u.kelas)}
        </select>
      </td>
      <td>
        <select class="peran-user" data-uid="${u.uid}" style="padding:7px 10px;border-radius:11px;
          border:1.5px solid rgba(47,111,237,.18);background:#fff;font-weight:700">
          <option value="siswa" ${u.peran === "siswa" ? "selected" : ""}>Siswa</option>
          <option value="guru"  ${u.peran === "guru"  ? "selected" : ""}>Guru</option>
        </select>
      </td>
      <td>${tanggal(u.dibuat)}</td>
      <td><button class="btn-mini edit" data-aksi="simpanUser" data-uid="${u.uid}">Simpan</button></td>
    </tr>`).join("");

  return `
    <div class="panel glass coret">
      <div class="panel-kepala">
        <h3>Pengguna (${state.users.length})</h3>
        <button class="btn btn-lembut" data-aksi="muatUlang">Muat ulang</button>
      </div>
      <div class="tabel-bungkus">
        <table>
          <thead><tr><th>Username</th><th>Kelas</th><th>Peran</th><th>Terdaftar</th><th></th></tr></thead>
          <tbody>${baris || '<tr><td colspan="5">Belum ada pengguna.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

/* ---------- Admin: rekap nilai ---------- */
function halAdminRekap(){
  if (!isGuru()) return halBeranda();

  const baris = state.users.map(u => {
    const n = state.nilai[u.uid] || {};
    const daftar = Object.values(n);
    const rata = daftar.length
      ? Math.round(daftar.reduce((a, b) => a + (b.skor || 0), 0) / daftar.length)
      : 0;
    return `<tr>
      <td style="text-transform:capitalize">${esc(u.username)}</td>
      <td>${esc(u.kelas || "-")}</td>
      <td>${daftar.length}</td>
      <td><b>${rata}</b></td>
    </tr>`;
  }).join("");

  return `
    <div class="panel glass coret">
      <div class="panel-kepala">
        <h3>Rekap Nilai</h3>
        <button class="btn btn-lembut" data-aksi="muatUlang">Muat ulang</button>
      </div>
      <div class="tabel-bungkus">
        <table>
          <thead><tr><th>Siswa</th><th>Kelas</th><th>Kuis Selesai</th><th>Rata-rata</th></tr></thead>
          <tbody>${baris || '<tr><td colspan="4">Belum ada data.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

/* ---------- Hook setelah render ---------- */
function setelahRender(){
  if (state.hal === "adminForm"){
    const m = state.param ? state.materi.find(x => x.id === state.param) : null;
    const daftar = $("#daftarSoal");
    if (daftar) daftar.innerHTML = "";
    (m?.kuis || []).forEach(s => tambahSoal(s));
  }
}

/* =========================================================================
   7. AKSI / EVENT
   ========================================================================= */
document.addEventListener("click", async e => {
  /* navigasi sidebar */
  const nav = e.target.closest("[data-nav]");
  if (nav){
    state.hal = nav.dataset.nav;
    state.param = null;
    render();
    return;
  }

  const el = e.target.closest("[data-aksi]");
  if (!el) return;
  const aksi = el.dataset.aksi;

  switch (aksi){
    case "buka":
      state.hal = "detail";
      state.param = el.dataset.id;
      render();
      break;

    case "kerjakanKuis":
      state.hal = "kuis";
      state.param = el.dataset.id;
      render();
      break;

    case "kembali":
      state.hal = el.dataset.ke || "materi";
      state.param = null;
      render();
      break;

    case "tambahSoal":
      tambahSoal();
      break;

    case "hapusSoal":
      el.closest(".soal-baris")?.remove();
      break;

    case "editMateri":
      state.hal = "adminForm";
      state.param = el.dataset.id;
      render();
      break;

    case "hapusMateri": {
      const m = state.materi.find(x => x.id === el.dataset.id);
      if (!confirm(`Hapus materi "${m?.judul || ""}"? Tindakan ini tidak bisa dibatalkan.`)) return;
      await API.hapusMateri(el.dataset.id);
      state.materi = await API.listMateri();
      toast("Materi dihapus.");
      render();
      break;
    }

    case "simpanUser": {
      const uid   = el.dataset.uid;
      const kelas = document.querySelector(`.kelas-user[data-uid="${uid}"]`).value;
      const peran = document.querySelector(`.peran-user[data-uid="${uid}"]`).value;
      await API.setUser(uid, { kelas, peran });
      state.users = await API.listUsers();
      toast("Data pengguna disimpan.");
      render();
      break;
    }

    case "muatUlang":
      await muatData();
      toast("Data diperbarui.");
      render();
      break;
  }
});

/* ---------- Submit form ---------- */
document.addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;

  if (f.id === "formAuth")   return prosesAuth();
  if (f.id === "formMateri") return simpanMateriForm(f);
  if (f.id === "formKuis")   return periksaKuis(f);
});

/* ---------- Keluar ---------- */
$("#tombolKeluar").addEventListener("click", async () => {
  if (!confirm("Yakin mau keluar?")) return;
  await API.keluar();
});

/* ---------- Tab login ---------- */
let modeAuth = "masuk";
$("#tabMasuk").addEventListener("click", e => {
  const b = e.target.closest("button[data-tab]");
  if (!b) return;
  modeAuth = b.dataset.tab;
  $$("#tabMasuk button").forEach(x => x.classList.toggle("on", x === b));
  $("#wrapKelas").hidden = modeAuth !== "daftar";
  $("#wrapKode").hidden  = modeAuth !== "daftar";
  $("#tombolAuth").textContent = modeAuth === "masuk" ? "Masuk" : "Buat Akun";
  pesanLogin("");
});

/* ---------- Isi pilihan kelas ---------- */
$("#kelas").innerHTML = ["1","2","3","4","5","6"]
  .map(v => `<option value="${v}">Kelas ${v}</option>`).join("");

/* ---------- Proses login / daftar ---------- */
function pesanLogin(txt, tipe = ""){
  const p = $("#pesanLogin");
  p.textContent = txt;
  p.className = "pesan " + tipe;
}

function tombolLoading(aktif, label){
  const b = $("#tombolAuth");
  b.disabled = aktif;
  b.textContent = aktif ? "Mohon tunggu..." : (modeAuth === "masuk" ? "Masuk" : "Buat Akun");
  if (label && !aktif) b.textContent = label;
}

function terjemahError(err){
  const kode = err?.code || err?.message || "";
  if (kode.includes("invalid-credential") || kode.includes("wrong-password") ||
      kode.includes("user-not-found")     || kode.includes("invalid-email") ||
      kode.includes("USER_TIDAK_ADA")     || kode.includes("PASSWORD_SALAH"))
    return "Username atau password salah.";
  if (kode.includes("email-already-in-use") || kode.includes("USERNAME_DIPAKAI"))
    return "Username sudah dipakai, coba yang lain.";
  if (kode.includes("weak-password"))
    return "Password terlalu lemah, minimal 6 karakter.";
  if (kode.includes("too-many-requests"))
    return "Terlalu banyak percobaan. Coba lagi sebentar lagi.";
  if (kode.includes("network"))
    return "Koneksi internet bermasalah.";
  return "Terjadi kesalahan: " + (err?.message || kode);
}

async function prosesAuth(){
  const u = $("#username").value.trim().toLowerCase();
  const p = $("#password").value;

  if (!/^[a-z0-9._]{3,20}$/.test(u))
    return pesanLogin("Username 3–20 karakter, hanya huruf kecil, angka, titik, atau garis bawah.");
  if (p.length < 6)
    return pesanLogin("Password minimal 6 karakter.");

  tombolLoading(true);
  pesanLogin("");

  try{
    if (modeAuth === "masuk"){
      await API.masuk(u, p);
    } else {
      blokirAuth = true;                       // cegah callback auth balapan
      const uid = await API.daftar(u, p, $("#kelas").value, $("#kode").value.trim());
      blokirAuth = false;
      await tanganiSesi(uid);
    }
  }catch(err){
    blokirAuth = false;
    pesanLogin(terjemahError(err));
    console.error(err);
  }finally{
    tombolLoading(false);
  }
}

/* ---------- Simpan materi (admin) ---------- */
async function simpanMateriForm(f){
  if (!isGuru()) return;

  const kuis = $$(".soal-baris", f).map(b => ({
    soal: b.querySelector(".s-soal").value.trim(),
    pilihan: [...b.querySelectorAll(".s-pil")].map(i => i.value.trim()),
    jawaban: Number(b.querySelector(".s-jawab").value)
  })).filter(q => q.soal && q.pilihan.filter(Boolean).length >= 2);

  const data = {
    judul:     f.judul.value.trim(),
    mapel:     f.mapel.value.trim(),
    kelas:     f.kelas.value,
    deskripsi: f.deskripsi.value.trim(),
    isi:       f.isi.value.trim(),
    kuis
  };

  if (!data.judul || !data.mapel) return toast("Judul dan mapel wajib diisi.", "err");

  const simpan = f.querySelector('button[type="submit"]');
  simpan.disabled = true;

  try{
    if (state.param) data.id = state.param;
    await API.simpanMateri(data);
    state.materi = await API.listMateri();
    toast("Materi berhasil disimpan.");
    state.hal = "adminMateri";
    state.param = null;
    render();
  }catch(err){
    toast("Gagal menyimpan: " + err.message, "err");
    simpan.disabled = false;
  }
}

/* ---------- Periksa kuis ---------- */
async function periksaKuis(f){
  const m = state.materi.find(x => x.id === state.param);
  if (!m) return;

  const kuis = m.kuis || [];
  let benar = 0;

  kuis.forEach((q, i) => {
    const pilih = f.querySelector(`input[name="q${i}"]:checked`);
    if (pilih && Number(pilih.value) === Number(q.jawaban)) benar++;
  });

  const total = kuis.length;
  const skor  = total ? Math.round((benar / total) * 100) : 0;

  try{
    await API.simpanNilai(state.uid, m.id, {
      skor, benar, total, tanggal: Date.now()
    });
    state.nilai = await API.listNilai();
    toast(`Selesai! Jawaban benar ${benar}/${total} — skor ${skor}.`);
    state.hal = "nilai";
    state.param = null;
    render();
  }catch(err){
    toast("Gagal menyimpan nilai: " + err.message, "err");
  }
}

/* ---------- Enter di form login ---------- */
$("#username").addEventListener("keydown", e => {
  if (e.key === "Enter"){ e.preventDefault(); $("#password").focus(); }
});

/* =========================================================================
   8. JALANKAN
   ========================================================================= */
mulai();
