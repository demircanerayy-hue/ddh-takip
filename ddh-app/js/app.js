import { PRELOADED_KUYULAR, PRELOADED_GUNLUK, PRELOADED_NEXTID } from './data.js';
// ── SABITLER ────────────────────────────────────────────────
const MAKINELER = ['GS-200','DBC-U6','BATUHAN-600X','GS-600','BDU-600'];
const MAKINE_RENK = {
  'GS-200':       '#3b82f6',  // mavi
  'DBC-U6':       '#8b5cf6',  // mor
  'BATUHAN-600X': '#f97316',  // turuncu
  'GS-600':       '#10b981',  // yeşil
  'BDU-600':      '#ef4444',  // kırmızı
};
const VRD_LABEL = {1:'00:00—08:00', 2:'08:00—16:00', 3:'16:00—00:00'};
const VRD_CLASS = {1:'v1-tag', 2:'v2-tag', 3:'v3-tag'};
const VRD_CLR   = {1:'var(--v1b)', 2:'var(--v2b)', 3:'var(--v3b)'};

// ── VERİ ────────────────────────────────────────────────────
const SK = 'ddh2_v1';
let db = {kuyular:[], gunluk:[], duraklamalar:[], butce:{}};
let nextId = 1;
let editKId = null;
let aktifMakine = 'GS-200';
// Bugünün tarihi ile başlat
const _bugun = new Date();
const _bugunAy = _bugun.getFullYear() + '-' + String(_bugun.getMonth()+1).padStart(2,'0');
const _bugunGun = _bugunAy + '-' + String(_bugun.getDate()).padStart(2,'0');

let aktifAy = _bugunAy;
let zamanFiltre = 'gun';      // 'gun' | 'hafta' | 'ay'
let seciliGun   = _bugunGun;  // 'YYYY-MM-DD' — bugün açılışta seçili
let seciliHafta = null;       // {bas, bit, label}
let seciliAy    = _bugunAy;   // 'YYYY-MM'

// ── DROPDOWN YARDIMCILARI ────────────────────────────────────
function closeAllDropdowns(except){
  ['gun','hafta','ay'].forEach(k => {
    if(k !== except){
      const el = document.getElementById('dd-'+k);
      if(el) el.style.display = 'none';
    }
  });
}

document.addEventListener('click', e => {
  if(!e.target.closest('#filtre-group')) closeAllDropdowns(null);
});

function toggleDropdown(tip){
  closeAllDropdowns(tip);
  const dd = document.getElementById('dd-'+tip);
  const isOpen = dd.style.display !== 'none';
  dd.style.display = isOpen ? 'none' : 'block';
  if(!isOpen) buildDropdown(tip);
}

// Dropdown içeriğini oluştur
function buildDropdown(tip){
  const dd = document.getElementById('dd-'+tip);
  if(!dd) return;

  if(tip === 'ay'){
    // Mevcut 12 ay listesi
    const aylar = [
      {v:'2026-12',l:'Aralık 2026'},{v:'2026-11',l:'Kasım 2026'},
      {v:'2026-10',l:'Ekim 2026'},{v:'2026-09',l:'Eylül 2026'},
      {v:'2026-08',l:'Ağustos 2026'},{v:'2026-07',l:'Temmuz 2026'},
      {v:'2026-06',l:'Haziran 2026'},{v:'2026-05',l:'Mayıs 2026'},
      {v:'2026-04',l:'Nisan 2026'},{v:'2026-03',l:'Mart 2026'},
      {v:'2026-02',l:'Şubat 2026'},{v:'2026-01',l:'Ocak 2026'}
    ];
    dd.innerHTML = aylar.map(a => {
      const aktif = a.v === seciliAy && zamanFiltre === 'ay';
      return `<div onclick="seciAy('${a.v}','${a.l}')" style="padding:7px 12px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:${aktif?'700':'400'};color:${aktif?'var(--accent)':'var(--text2)'};background:${aktif?'var(--accent-dim)':'transparent'};transition:background .1s"
        onmouseover="if(!${aktif})this.style.background='var(--bg3)'"
        onmouseout="if(!${aktif})this.style.background='transparent'">${a.l}</div>`;
    }).join('');
  }

  else if(tip === 'hafta'){
    // Seçili ayın 4 haftasını oluştur
    const [yil, ay] = seciliAy.split('-').map(Number);
    const ilkGun = new Date(yil, ay-1, 1);
    const sonGun = new Date(yil, ay, 0).getDate();
    // Hafta sınırları: 1-7, 8-14, 15-21, 22-son
    const haftalar = [
      {no:1, bas:1,  bit:7},
      {no:2, bas:8,  bit:14},
      {no:3, bas:15, bit:21},
      {no:4, bas:22, bit:sonGun}
    ];
    const pad = n => String(n).padStart(2,'0');
    dd.innerHTML = haftalar.map(h => {
      const basStr = `${seciliAy}-${pad(h.bas)}`;
      const bitStr = `${seciliAy}-${pad(h.bit)}`;
      const lbl = `${h.bas} - ${h.bit} ${['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'][ay-1]}`;
      const aktif = zamanFiltre==='hafta' && seciliHafta && seciliHafta.bas===basStr;
      return `<div onclick="seciHafta('${basStr}','${bitStr}','${lbl}','${h.no}')" style="padding:7px 12px;border-radius:7px;cursor:pointer;font-size:12px;color:${aktif?'var(--accent)':'var(--text2)'};font-weight:${aktif?'700':'400'};background:${aktif?'var(--accent-dim)':'transparent'};transition:background .1s"
        onmouseover="if(!${aktif})this.style.background='var(--bg3)'"
        onmouseout="if(!${aktif})this.style.background='transparent'">
        <span style="font-family:IBM Plex Mono,monospace;font-size:10px;color:var(--text3);margin-right:6px">${h.no}.Hafta</span>${lbl}
      </div>`;
    }).join('');
  }

  else if(tip === 'gun'){
    // Seçili ayın tüm günleri
    const [yil, ay] = seciliAy.split('-').map(Number);
    const sonGun = new Date(yil, ay, 0).getDate();
    const pad = n => String(n).padStart(2,'0');
    const ayAdi = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'][ay-1];
    const gunIsimleri = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];
    let html = `<div style="max-height:260px;overflow-y:auto;">`;
    for(let g=1; g<=sonGun; g++){
      const tarih = `${seciliAy}-${pad(g)}`;
      const gunAdı = gunIsimleri[new Date(yil,ay-1,g).getDay()];
      const aktif = zamanFiltre==='gun' && seciliGun===tarih;
      html += `<div onclick="seciGun('${tarih}')" style="padding:6px 12px;border-radius:7px;cursor:pointer;font-size:12px;color:${aktif?'var(--accent)':'var(--text2)'};font-weight:${aktif?'700':'400'};background:${aktif?'var(--accent-dim)':'transparent'};display:flex;align-items:center;gap:8px;transition:background .1s"
        onmouseover="this.style.background='var(--bg3)'"
        onmouseout="this.style.background='${aktif?'var(--accent-dim)':'transparent'}'">
        <span style="font-family:IBM Plex Mono,monospace;font-size:10px;min-width:22px;color:var(--text3)">${pad(g)}</span>
        <span style="font-size:10px;color:var(--text3);min-width:24px">${gunAdı}</span>
        <span>${g} ${ayAdi}</span>
      </div>`;
    }
    html += '</div>';
    dd.innerHTML = html;
  }
}

// Seçim fonksiyonları
function seciAy(val, label){
  seciliAy = val;
  aktifAy  = val;
  zamanFiltre = 'ay';
  seciliHafta = null;
  seciliGun   = null;
  // Gizli select'i güncelle (export fonksiyonları için)
  const sel = document.getElementById('sel-ay');
  if(sel) sel.value = val;
  document.getElementById('dd-ay').style.display = 'none';
  const ayKisa = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'][parseInt(val.split('-')[1])-1];
  document.getElementById('zf-ay-lbl').textContent = ayKisa;
  updateBtnStyles('ay');
  renderAll();
}

function seciHafta(bas, bit, label, no){
  seciliHafta = {bas, bit, label};
  zamanFiltre = 'hafta';
  seciliGun   = null;
  document.getElementById('dd-hafta').style.display = 'none';
  document.getElementById('zf-hafta-lbl').textContent = no+'.H';
  updateBtnStyles('hafta');
  renderAll();
}

function seciGun(tarih){
  seciliGun   = tarih;
  zamanFiltre = 'gun';
  seciliHafta = null;
  document.getElementById('dd-gun').style.display = 'none';
  const parts = tarih.split('-');
  document.getElementById('zf-gun-lbl').textContent = parts[2]+'.'+parts[1];
  updateBtnStyles('gun');
  renderAll();
}

function updateBtnStyles(aktifTip){
  ['gun','hafta','ay'].forEach(k => {
    const btn = document.getElementById('zf-'+k);
    if(!btn) return;
    if(k === aktifTip){
      btn.style.background = 'var(--accent)';
      btn.style.color = '#fff';
    } else {
      btn.style.background = 'transparent';
      btn.style.color = 'var(--text2)';
    }
  });
}

// Zaman filtresine göre tarih aralığı
function zamanFiltreTarihler(){
  if(zamanFiltre === 'gun' && seciliGun){
    const parts = seciliGun.split('-');
    const label = parts[2]+'.'+parts[1]+'.'+parts[0].slice(2);
    return { bas: seciliGun, bit: seciliGun, label, ayMod:false };
  }
  if(zamanFiltre === 'hafta' && seciliHafta){
    return { bas: seciliHafta.bas, bit: seciliHafta.bit, label: seciliHafta.label, ayMod:false };
  }
  // Aylık (varsayılan)
  const ayEl = document.getElementById('sel-ay');
  const label = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'][parseInt(seciliAy.split('-')[1])-1]+' '+seciliAy.split('-')[0];
  return { bas: seciliAy+'-01', bit: seciliAy+'-31', label, ayMod: true };
}

// Zaman filtresine göre günlük kayıt listesi
function filtreliGunluk(){
  const { bas, bit, ayMod } = zamanFiltreTarihler();
  if(ayMod) return db.gunluk.filter(r => r.tarih && r.tarih.startsWith(seciliAy));
  return db.gunluk.filter(r => r.tarih && r.tarih >= bas && r.tarih <= bit);
}

// Zaman filtresine göre duraklama listesi
function filtreliDurak(){
  const { bas, bit, ayMod } = zamanFiltreTarihler();
  if(ayMod) return db.duraklamalar.filter(r => r.tarih && r.tarih.startsWith(seciliAy));
  return db.duraklamalar.filter(r => r.tarih && r.tarih >= bas && r.tarih <= bit);
}

// ── FİREBASE ────────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBED0e8g8qUcWozK_hr46fFHBB6IairBwM",
  authDomain: "ddh-gumustas.firebaseapp.com",
  databaseURL: "https://ddh-gumustas-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "ddh-gumustas",
  storageBucket: "ddh-gumustas.firebasestorage.app",
  messagingSenderId: "262897200615",
  appId: "1:262897200615:web:4ae8b8bd4b59b2a77e2142"
};

const fbApp = initializeApp(firebaseConfig);
const fbDb  = getDatabase(fbApp);
const fbAuth = getAuth(fbApp);
const dbRef = ref(fbDb, 'data');

function setStatus(ok, msg){
  const el = document.getElementById('save-ind');
  if(!el) return;
  el.style.color = ok ? '#27ae60' : '#e05252';
  el.textContent = msg;
}

const LOCAL_BACKUP_KEY = 'ddh-takip-data-v1';

function firebasePayload(){
  const maxPre = PRELOADED_KUYULAR.length > 0 ? Math.max(...PRELOADED_KUYULAR.map(k=>k.id)) : 0;
  const kuyular_user = db.kuyular.filter(k => k.id > maxPre);
  const kuyular_updates = db.kuyular
    .filter(k => k.id <= maxPre && k.bit)
    .map(k => ({id: k.id, bit: k.bit}));
  return {
    gunluk:          db.gunluk,
    duraklamalar:    db.duraklamalar,
    kuyular:         db.kuyular,
    kuyular_user,
    kuyular_updates,
    nextId,
    butce:           db.butce || {},
    at: new Date().toISOString()
  };
}

function saveLocalBackup(payload){
  try{
    localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(payload || firebasePayload()));
  }catch(e){
    console.warn('Yerel yedek kaydedilemedi:', e);
  }
}

function readLocalBackup(){
  try{
    const raw = localStorage.getItem(LOCAL_BACKUP_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){
    console.warn('Yerel yedek okunamadı:', e);
    return null;
  }
}

function newerData(firebaseData, localData){
  if(!firebaseData) return localData || null;
  if(!localData) return firebaseData;
  const fbTime = Date.parse(firebaseData.at || '') || 0;
  const localTime = Date.parse(localData.at || '') || 0;
  return localTime > fbTime ? localData : firebaseData;
}

function applySavedData(data){
  if(!data) return false;
  const fbGunluk = data.gunluk || [];
  if(fbGunluk.length){
    const fbIds = new Set(fbGunluk.map(r => r.id));
    const eksik = PRELOADED_GUNLUK.filter(r => !fbIds.has(r.id));
    db.gunluk = [...eksik, ...fbGunluk];
  } else {
    db.gunluk = [...PRELOADED_GUNLUK];
  }
  normalizeDbMakineAdlari();
  db.duraklamalar = data.duraklamalar || [];
  normalizeDbMakineAdlari();
  db.butce = data.butce || db.butce || {};
  if(data.nextId && data.nextId > nextId) nextId = data.nextId;

  if(Array.isArray(data.kuyular) && data.kuyular.length > 0){
    db.kuyular = data.kuyular;
  } else {
    db.kuyular = [...PRELOADED_KUYULAR];
  }
  if(!Array.isArray(data.kuyular) && data.kuyular_user && data.kuyular_user.length > 0){
    const maxPre = PRELOADED_KUYULAR.length > 0 ? Math.max(...PRELOADED_KUYULAR.map(k=>k.id)) : 0;
    db.kuyular = [...db.kuyular, ...data.kuyular_user.filter(k=>k.id>maxPre)];
  }
  if(data.kuyular_updates){
    data.kuyular_updates.forEach(u => {
      const k = db.kuyular.find(x=>x.id===u.id);
      if(k) k.bit = u.bit;
    });
  }
  normalizeDbMakineAdlari();
  ensureNextId();
  return true;
}

function initFiltreBtnLabels(){
  // Günlük başlasın, bugünün tarihi gösterilsin
  const parts = seciliGun ? seciliGun.split('-') : null;
  const gunLbl = document.getElementById('zf-gun-lbl');
  if(gunLbl && parts) gunLbl.textContent = parts[2]+'.'+parts[1];
  const ayKisa = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'][parseInt(seciliAy.split('-')[1])-1];
  const lbl = document.getElementById('zf-ay-lbl');
  if(lbl) lbl.textContent = ayKisa;
  updateBtnStyles('gun');
}

function save(){
  const payload = firebasePayload();
  saveLocalBackup(payload);

  setStatus(false, '● Kaydediliyor...');
  set(dbRef, payload).then(() => {
    setStatus(true, 'Kaydedildi · ' + new Date().toLocaleTimeString('tr-TR'));
    renderAll();
  }).catch(e => {
    console.error('Kayıt hatası:', e);
    setStatus(false, '● Firebase kayıt hatası · yerel yedek alındı');
  });
}

function girisYap(){
  const email = document.getElementById('auth-email').value.trim();
  const sifre = document.getElementById('auth-sifre').value;
  const hata  = document.getElementById('auth-hata');
  hata.textContent = '';
  document.getElementById('auth-btn').textContent = 'Giriş yapılıyor...';
  signInWithEmailAndPassword(fbAuth, email, sifre)
    .then(() => {})
    .catch(e => {
      hata.textContent = 'Email veya şifre hatalı';
      document.getElementById('auth-btn').textContent = 'Giriş Yap';
    });
}

function cikisYap(){
  signOut(fbAuth);
}

function load(){
  setStatus(false, '● Bağlanıyor...');
  get(dbRef).then(snapshot => {
    const data = snapshot.val();
    if(data){
      const chosen = newerData(data, readLocalBackup());
      applySavedData(chosen);
      saveLocalBackup(chosen);
    } else {
      const local = readLocalBackup();
      if(local){
        applySavedData(local);
        setStatus(false, '● Yerel yedekten açıldı');
        renderAll();
        return;
      }
      db.gunluk = [...PRELOADED_GUNLUK];
      save();
      return;
    }
    setStatus(true, '● Firebase bağlı');
    // sel-ay'ı bugünün ayına getir
    const _selAy = document.getElementById('sel-ay');
    if(_selAy && _bugunAy) _selAy.value = _bugunAy;
    renderAll();
  }).catch(e => {
    console.error('Yükleme hatası:', e);
    const local = readLocalBackup();
    if(local){
      applySavedData(local);
      setStatus(false, '● Firebase bağlantı hatası · yerel yedekten açıldı');
    } else {
      setStatus(false, '● Bağlantı hatası');
      db.gunluk = [...PRELOADED_GUNLUK];
    }
    renderAll();
  });
}

function ensureNextId(){
  const ids = []
    .concat((db.kuyular || []).map(x => parseInt(x.id,10) || 0))
    .concat((db.gunluk || []).map(x => parseInt(x.id,10) || 0))
    .concat((db.duraklamalar || []).map(x => parseInt(x.id,10) || 0));
  const maxId = Math.max(0, ...ids);
  if(!Number.isFinite(nextId) || nextId <= maxId) nextId = maxId + 1;
}

function uid(){
  ensureNextId();
  return nextId++;
}
function esc(s){ return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
const MAKINE_ALIAS = {
  'GS-200': 'GS-200',
  'GS 200': 'GS-200',
  'DBC-U6': 'DBC-U6',
  'DBC U-6': 'DBC-U6',
  'DBC-U-6': 'DBC-U6',
  'U-6 ( YENI )': 'DBC-U6',
  'U-6 ( YENİ )': 'DBC-U6',
  'BATUHAN-600X': 'BATUHAN-600X',
  'BTHN-600X': 'BATUHAN-600X',
  'BATUHAN 600X': 'BATUHAN-600X',
  'GS-600': 'GS-600',
  'GS 600': 'GS-600',
  'BDU-600': 'BDU-600',
  'BDU 600': 'BDU-600'
};

function makineKey(makine){
  const raw = String(makine || '').trim();
  const up = raw.toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ');
  return MAKINE_ALIAS[up] || MAKINE_ALIAS[raw] || raw;
}

function normalizeDbMakineAdlari(){
  ['kuyular','gunluk','duraklamalar'].forEach(tbl => {
    (db[tbl] || []).forEach(r => { if(r && r.makine) r.makine = makineKey(r.makine); });
  });
}

function tamamlananKuyular(ay){
  const sayimAy = ay || seciliAy || aktifAy;
  const goruldu = new Set();
  return (db.kuyular || [])
    .filter(k => k && k.bit && String(k.bit).trim() !== '' && String(k.bit).startsWith(sayimAy))
    .filter(k => {
      const key = String(k.no || '') + '|' + String(k.bit || '') + '|' + String(k.id || '');
      if(goruldu.has(key)) return false;
      goruldu.add(key);
      return true;
    })
    .sort((a,b) => String(a.bit || '').localeCompare(String(b.bit || '')) || String(a.no || '').localeCompare(String(b.no || '')));
}

function aktifKuyular(){
  const byNo = new Map();
  (db.kuyular || []).filter(isAktifKuyu).forEach(k => {
    const key = String(k.no || k.id || '');
    if(!byNo.has(key)) byNo.set(key, k);
  });
  return Array.from(byNo.values());
}
function fmtDate(d){
  if(!d) return '—';
  // UTC parse hatası olmaması için doğrudan string parse
  try{
    const parts = String(d).split('-');
    if(parts.length===3) return `${parts[2]}.${parts[1]}.${parts[0].slice(2)}`;
    return new Date(d).toLocaleDateString('tr-TR',{day:'2-digit',month:'2-digit',year:'2-digit'});
  }catch(e){ return d; }
}

// ── BİTİŞ KOTU FORMÜLÜ ──────────────────────────────────────
// Bitiş Kotu = Z + sin(Eğim * PI/180) * Derinlik
function hesapBitisKotu(z, egim, derinlik){
  if(!z || !egim || !derinlik) return null;
  const kotu = parseFloat(z) + Math.sin(parseFloat(egim) * Math.PI / 180) * parseFloat(derinlik);
  return kotu.toFixed(2);
}

// ── AKTİF METRAj: vardiya kayıtlarından topla ───────────────
function aktifMetraj(kuyuNo){
  // Tüm aylardan o kuyunun toplam metrajı (yeni veri modeli: s1/s2/s3 per row)
  let toplam = 0;
  db.gunluk.forEach(r => {
    // Yeni model: sondaj alanında kuyu adı var
    if(r.sondaj){
      const sondajlar = r.sondaj.split('/').map(s=>s.trim());
      if(sondajlar.includes(kuyuNo)){
        toplam += (parseFloat(r.s1)||0)+(parseFloat(r.s2)||0)+(parseFloat(r.s3)||0);
      }
    }
    // Eski model (import uyumluluğu için)
    if(r.kuyular){
      r.kuyular.forEach(k => {
        if(k.no === kuyuNo) toplam += parseFloat(k.ilerleme)||0;
      });
    }
  });
  return toplam;
}

function makineAyMetraj(makine, ay){
  let toplam = 0;
  db.gunluk.filter(r => makineEslesir(r.makine, makine) && r.tarih && r.tarih.startsWith(ay)).forEach(r => {
    toplam += (parseFloat(r.s1)||0)+(parseFloat(r.s2)||0)+(parseFloat(r.s3)||0);
    // Eski model
    if(r.kuyular) r.kuyular.forEach(k => { toplam += parseFloat(k.ilerleme)||0; });
  });
  return toplam;
}

// ── AY FİLTRE ───────────────────────────────────────────────
function ayFiltre(tarih){
  if(!tarih) return false;
  return tarih.startsWith(aktifAy);
}

// Kuyu başlangıç tarihine göre o ayın kuyuları
function ayKuyulari(){
  return db.kuyular.filter(k => k.bas && k.bas.startsWith(aktifAy));
}

// Aktif kuyu = bitiş tarihi boş VE boş string değil sadece gerçekten boş
function isAktifKuyu(k){
  return !k.bit || k.bit.trim() === '';
}

// Bugünün ayı mı?
function bugunAyMi(){
  const bugun = new Date();
  const buAy = bugun.getFullYear()+'-'+String(bugun.getMonth()+1).padStart(2,'0');
  return aktifAy === buAy;
}

function makineEslesir(a, b){
  return makineKey(a) === makineKey(b);
}

function kuyuNolariFromSondaj(sondaj){
  return (sondaj || '').split('/').map(s=>s.trim()).filter(Boolean).filter(no => no !== '-');
}

function gunlukMetraj(r){
  return (parseFloat(r.s1)||0)+(parseFloat(r.s2)||0)+(parseFloat(r.s3)||0);
}

function seciliAralikGunlukleri(makine){
  return filtreliGunluk()
    .filter(r => makineEslesir(r.makine, makine) && kuyuNolariFromSondaj(r.sondaj).length)
    .sort((a,b) => (b.tarih || '').localeCompare(a.tarih || '') || (b.id || 0) - (a.id || 0));
}

function sonGunlukKuyu(makine){
  const rec = seciliAralikGunlukleri(makine)[0];
  if(!rec) return null;
  const sondajlar = kuyuNolariFromSondaj(rec.sondaj);
  const sonKuyu = sondajlar[sondajlar.length-1];
  if(!sonKuyu) return null;
  return db.kuyular.find(k2 => k2.no === sonKuyu && makineEslesir(k2.makine, makine))
    || { no: sonKuyu, makine, _sadece_gunluk: true };
}

function makineSonDurak(makine){
  return db.duraklamalar ? db.duraklamalar.filter(d => {
    if (!makineEslesir(d.makine, makine) || !d.tarih) return false;
    return (new Date() - new Date(d.tarih)) < 86400000;
  }).length > 0 : false;
}

function ddhMakineDurum(makine, donemKuyu){
  if (!donemKuyu) return 'pasif';
  if (!bugunAyMi()) return 'aktif';
  const gercekAktif = db.kuyular ? db.kuyular.find(k => makineEslesir(k.makine, makine) && isAktifKuyu(k)) : null;
  if (gercekAktif) return 'aktif';
  if (makineSonDurak(makine)) return 'durak';
  return seciliAralikGunlukleri(makine).length ? 'aktif' : 'pasif';
}
// Seçili ayda o makinenin deldiği TÜM kuyu adları (unique, kronolojik)
function ayMakineDedigiKuyular(makine){
  const ayRecs = db.gunluk
    .filter(r => makineEslesir(r.makine, makine) && r.tarih && r.tarih.startsWith(aktifAy))
    .sort((a,b) => a.tarih.localeCompare(b.tarih));
  const liste = [];
  const goruldu = new Set();
  ayRecs.forEach(r => {
    kuyuNolariFromSondaj(r.sondaj).forEach(no => {
      if(!goruldu.has(no)){ goruldu.add(no); liste.push(no); }
    });
  });
  return liste;
}

// Aktif kuyu — mevcut ayda gerçek aktif, geçmiş ayda son delinen
function ayMakineAktifKuyu(makine){
  if(bugunAyMi()){
    return db.kuyular.find(k => makineEslesir(k.makine, makine) && isAktifKuyu(k)) || sonGunlukKuyu(makine);
  }
  return sonGunlukKuyu(makine);
}

function ayDegis(){
  aktifAy = document.getElementById('sel-ay').value;
  seciliAy = aktifAy;
  zamanFiltre = 'ay';
  seciliHafta = null;
  seciliGun = null;
window.aktifMakine = 'GS-200';
  renderAll();
}

// ── SAYFA NAV ───────────────────────────────────────────────
function goPage(id, el){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  el.classList.add('active');
  if(id==='dash') renderDash();
  if(id==='kuyular') renderKuyular();
  if(id==='gunluk'){
    buildMakPages();
    const tumuTab = document.querySelector('#mak-tabs .stab');
    if(tumuTab) goMakTumu(tumuTab);
  }
  if(id==='durak') renderDurak();
  if(id==='ozet'){ loadButce(); renderOzetPage(); }
}

// ── DASHBOARD ───────────────────────────────────────────────
function renderDash(){
  const { label } = zamanFiltreTarihler();
  const ayKayitlar = filtreliGunluk();
  const ayDurak = filtreliDurak();

  // Toplam delgi — hem yeni (s1/s2/s3) hem eski (kuyular[].ilerleme) model
  let toplamDelgi = 0;
  ayKayitlar.forEach(r => {
    toplamDelgi += (parseFloat(r.s1)||0)+(parseFloat(r.s2)||0)+(parseFloat(r.s3)||0);
    (r.kuyular||[]).forEach(k => { toplamDelgi += parseFloat(k.ilerleme)||0; });
  });

  // Aktif kuyu sayısı — SADECE mevcut aydaysa gerçek aktif kuyular
  const aktifSay = bugunAyMi()
    ? aktifKuyular().length
    : 0;
  // Tamamlanan = SEÇİLİ AY içinde bitiş tarihi olan kuyular
  const sayimAy = seciliAy || aktifAy;
  const bittiListe = tamamlananKuyular(sayimAy);
  const bittiSay = bittiListe.length;
  const topDurak = ayDurak.reduce((s,d)=>s+(parseFloat(d.dk)||0),0);

  document.getElementById('d-toplam').innerHTML = toplamDelgi.toFixed(2)+' <span>m</span>';
  document.getElementById('d-aktif').textContent = aktifSay;
  document.getElementById('d-bitti').textContent = bittiSay;
  const bittiDetay = document.getElementById('d-bitti-detay');
  if(bittiDetay){
    bittiDetay.textContent = bittiListe.length ? bittiListe.map(k => (k.no || '?') + ' (' + fmtDate(k.bit) + ')').join(', ') : 'Bu ay bitiş tarihi yok';
    bittiDetay.title = bittiListe.length ? bittiListe.map(k => (k.no || '?') + ' - ' + (k.makine || '-') + ' - ' + (k.bit || '')).join(' | ') : '';
  }
  document.getElementById('d-durak').innerHTML = topDurak+' <span>dk</span>';
  document.getElementById('d-ay').textContent = label;

  // Makine bazlı
  const tbody = document.getElementById('dash-tbody');
  tbody.innerHTML = MAKINELER.map(m => {
    const { bas, bit, ayMod } = zamanFiltreTarihler();
    let mToplam = 0;
    if(ayMod){
      mToplam = makineAyMetraj(m, aktifAy);
    } else {
      mToplam = db.gunluk
        .filter(r => makineEslesir(r.makine, m) && r.tarih && r.tarih >= bas && r.tarih <= bit)
        .reduce((s,r)=>s+(parseFloat(r.s1)||0)+(parseFloat(r.s2)||0)+(parseFloat(r.s3)||0),0);
    }
    const mDurak = ayDurak.filter(d=>makineEslesir(d.makine,m)).reduce((s,d)=>s+(parseFloat(d.dk)||0),0);

    // Mevcut ay → aktif kuyu rozeti | Geçmiş ay → delinen kuyular listesi (rozet yok)
    let durumHtml;
    if(bugunAyMi()){
      const aktifK = db.kuyular.find(k => makineEslesir(k.makine, m) && isAktifKuyu(k));
      if(aktifK){
        durumHtml = `<span class="aktif-badge on">&#x25CF; Aktif &middot; ${esc(aktifK.no)}</span>`;
      } else {
        durumHtml = `<span class="aktif-badge off">Bekliyor</span>`;
      }
    } else {
      // Geçmiş ay: aktif rozeti yok, o ay delinen kuyular listeleniyor
      const kuyular = ayMakineDedigiKuyular(m);
      if(kuyular.length > 0){
        const goster = kuyular.slice(0, 4); // max 4 göster
        const fazla = kuyular.length > 4 ? `<span style="color:var(--text3);font-size:10px">+${kuyular.length-4}</span>` : '';
        durumHtml = goster.map(no =>
          `<span style="display:inline-block;background:var(--bg3);border:1px solid var(--border2);border-radius:4px;padding:1px 7px;font-family:IBM Plex Mono,monospace;font-size:11px;color:var(--text2);margin:1px 2px 1px 0">${esc(no)}</span>`
        ).join('') + fazla;
      } else {
        durumHtml = `<span style="color:var(--text3);font-size:12px">— kayıt yok —</span>`;
      }
    }

    const mRenk = MAKINE_RENK[m] || '#94a3b8';
    return `<tr style="border-left:3px solid ${mRenk}">
      <td><span class="kn" style="font-size:12px;color:${mRenk}">${esc(m)}</span></td>
      <td>${durumHtml}</td>
      <td><span class="nv g">${mToplam.toFixed(2)} m</span></td>
      <td><span class="nv ${mDurak>0?'gold':''}">${mDurak} dk</span></td>
    </tr>`;
  }).join('');

  // Dashboard sütun başlığını güncelle (5 sütun)
  const dashThead = document.querySelector('#dash-tbody').closest('table').querySelector('thead tr');
  if(dashThead && dashThead.children.length === 6){
    dashThead.children[5].remove();
  }

  // ── PASTA GRAFİKLERİ ───────────────────────────────────────
  drawPie();
  drawPieDurak();
  renderVerimlilik();
  renderDurakBolge();
  renderUyarilar();
  renderSondajAnim();
}

// ── SVG DONUT CHART ──────────────────────────────────────────
function makeSvgDonut(data, toplam, centerLabel, centerSub, size){
  if(!size) size = 240;
  const cx = size/2, cy = size/2;
  const R = size/2 - 10;
  const r = R * 0.58;

  if(toplam === 0){
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${cx}" cy="${cy}" r="${(R+r)/2}" fill="none" stroke="var(--bg4)" stroke-width="${R-r}"/>
      <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" fill="var(--text3)" font-size="13" font-family="Inter,sans-serif">Veri yok</text>
    </svg>`;
  }

  let paths = '';
  let startAngle = -Math.PI / 2;
  const GAP = data.length > 1 ? 0.02 : 0;

  data.forEach(d => {
    const pct = d.val / toplam;
    const sliceAngle = Math.max(pct * 2 * Math.PI - GAP, 0.001);
    const endAngle = startAngle + sliceAngle;

    const x1 = cx + R * Math.cos(startAngle + GAP/2);
    const y1 = cy + R * Math.sin(startAngle + GAP/2);
    const x2 = cx + R * Math.cos(endAngle);
    const y2 = cy + R * Math.sin(endAngle);
    const ix1 = cx + r * Math.cos(startAngle + GAP/2);
    const iy1 = cy + r * Math.sin(startAngle + GAP/2);
    const ix2 = cx + r * Math.cos(endAngle);
    const iy2 = cy + r * Math.sin(endAngle);
    const large = sliceAngle > Math.PI ? 1 : 0;

    const pathD = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${r} ${r} 0 ${large} 0 ${ix1} ${iy1} Z`;
    paths += `<path d="${pathD}" fill="${d.color}"><title>${d.label}: ${d.val.toFixed ? d.val.toFixed(2) : d.val} (%${Math.round(pct*100)})</title></path>`;
    startAngle += sliceAngle + GAP;
  });

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${cx}" cy="${cy}" r="${(R+r)/2}" fill="none" stroke="var(--bg4)" stroke-width="${R-r}"/>
    ${paths}
    <text x="${cx}" y="${cy-10}" text-anchor="middle" dominant-baseline="middle" fill="var(--text)" font-size="20" font-weight="700" font-family="Inter,-apple-system,sans-serif">${centerLabel}</text>
    <text x="${cx}" y="${cy+14}" text-anchor="middle" dominant-baseline="middle" fill="var(--text3)" font-size="11" font-family="Inter,-apple-system,sans-serif">${centerSub}</text>
  </svg>`;
}

function makeLegend(data, toplam, unit){
  if(!unit) unit = 'm';
  return data.map(d => {
    const pct = toplam > 0 ? Math.round(d.val/toplam*100) : 0;
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f0f0f2;">
      <div style="width:10px;height:10px;border-radius:50%;background:${d.color};flex-shrink:0"></div>
      <span style="color:#424245;flex:1;font-size:12px;">${d.label}</span>
      <span style="color:#1d1d1f;font-weight:600;font-size:12px;">${typeof d.val === 'number' ? d.val.toFixed(2) : d.val} <span style="color:#86868b;font-weight:400;font-size:11px">${unit}</span></span>
      <span style="color:#86868b;font-size:11px;min-width:30px;text-align:right">%${pct}</span>
    </div>`;
  }).join('');
}


function drawPieDurak(){
  const wrap = document.getElementById('pie-durak-wrap');
  if(!wrap) return;

  const NEDEN_COLORS = {
    'ELEKTRİK KESİNTİSİ': '#fb923c',
    'DUMAN':               '#f87171',
    'SU KESİNTİSİ':        '#60a5fa',
    'TEKNİK ARIZA':        '#a78bfa',
    'BAKIM':               '#4ade80',
    'DİĞER':               '#94a3b8',
  };

  const ayDurak = filtreliDurak();

  const nedenMap = {};
  ayDurak.forEach(d => {
    const n = d.neden || 'DİĞER';
    nedenMap[n] = (nedenMap[n] || 0) + (parseFloat(d.dk) || 0);
  });

  const data = Object.entries(nedenMap)
    .map(([n, dk]) => ({ label: n, val: dk, color: NEDEN_COLORS[n] || '#94a3b8' }))
    .filter(d => d.val > 0)
    .sort((a,b) => b.val - a.val);

  const toplam = data.reduce((s,d) => s+d.val, 0);

  const svg = makeSvgDonut(data, toplam, toplam > 0 ? toplam+'dk' : '—', (toplam/60).toFixed(2)+' saat', 240);

  const legend = data.length > 0 ? data.map(d => {
    const say = ayDurak.filter(r => (r.neden||'DİĞER') === d.label).length;
    const pct = toplam > 0 ? Math.round(d.val/toplam*100) : 0;
    return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #f0f0f0;">
      <div style="width:12px;height:12px;border-radius:50%;background:${d.color};flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,0.15)"></div>
      <span style="color:#424245;flex:1;font-size:11px;font-weight:500">${d.label}</span>
      <span style="color:#1d1d1f;font-weight:700;font-size:12px">${d.val}<span style="color:#86868b;font-weight:400;font-size:10px"> dk</span></span>
      <span style="color:#86868b;font-size:11px;min-width:28px;text-align:right">%${pct}</span>
    </div>`;
  }).join('') : '<p style="color:#86868b;font-size:12px;text-align:center;padding:12px">Bu ay duraklama kaydı yok</p>';

  wrap.innerHTML = svg + `<div style="width:100%;max-width:240px">${legend}</div>`;

  // Duraklama özet tablosunu da güncelle
  const tb = document.getElementById('durak-ozet-tbody');
  if(tb){
    if(data.length === 0){
      tb.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text3)">Bu ay duraklama kaydı yok</td></tr>`;
    } else {
      tb.innerHTML = data.map(d => {
        const say = ayDurak.filter(r => (r.neden||'DİĞER') === d.label).length;
        return `<tr>
          <td><span style="display:inline-flex;align-items:center;gap:8px">
            <span style="width:8px;height:8px;border-radius:50%;background:${d.color};display:inline-block;flex-shrink:0"></span>
            ${d.label}
          </span></td>
          <td class="nv gold">${d.val}</td>
          <td class="nv">${(d.val/60).toFixed(2)}</td>
          <td class="nv">${say}</td>
        </tr>`;
      }).join('') + `<tr style="border-top:2px solid var(--border2)">
        <td style="font-weight:600;color:var(--text)">TOPLAM</td>
        <td class="nv gold" style="font-weight:700">${toplam}</td>
        <td class="nv" style="font-weight:700">${(toplam/60).toFixed(2)}</td>
        <td class="nv">${ayDurak.length}</td>
      </tr>`;
    }
  }
}



// ── HAKEDİŞ — kaldırıldı ────────────────────────────────────
function renderHakedis(){ /* hakedis sayfası kaldırıldı */ }
function drawHakedisTrend(){ }
function drawHakedisMakine(){ }

// ── VARDİYA BAZLI PERFORMANS GRAFİĞİ ────────────────────────
function renderVardiyaPerf(){
  const wrap = document.getElementById('vardiya-perf-wrap');
  if(!wrap) return;

  // Günlük: seçili gün (seciliGun varsa o gün, yoksa bugün)
  const gunTarih = seciliGun || _bugunGun;

  // Aylık: aktifAy bazında her vardiya (s1/s2/s3) toplamı
  const ayRecs = db.gunluk.filter(r => r.tarih && r.tarih.startsWith(aktifAy));

  const rows = MAKINELER.map(m => {
    // Günlük: o makinenin seçili gündeki kaydı
    const gunRec = db.gunluk.find(r => r.makine === m && r.tarih === gunTarih);
    const sg1 = gunRec ? (parseFloat(gunRec.s1)||0) : 0;
    const sg2 = gunRec ? (parseFloat(gunRec.s2)||0) : 0;
    const sg3 = gunRec ? (parseFloat(gunRec.s3)||0) : 0;

    // Aylık: o makinenin aktif aydaki her vardiya toplamı
    const mAyRecs = ayRecs.filter(r => r.makine === m);
    const v1ay = mAyRecs.reduce((s,r) => s+(parseFloat(r.s1)||0), 0);
    const v2ay = mAyRecs.reduce((s,r) => s+(parseFloat(r.s2)||0), 0);
    const v3ay = mAyRecs.reduce((s,r) => s+(parseFloat(r.s3)||0), 0);

    return { m, sg1, sg2, sg3, v1ay, v2ay, v3ay };
  }).filter(r => r.sg1+r.sg2+r.sg3+r.v1ay+r.v2ay+r.v3ay > 0);

  if(!rows.length){
    wrap.innerHTML = '<p style="color:var(--text3);font-size:12px;text-align:center;padding:16px">Bu ay veri yok</p>';
    return;
  }

  const ayLabel = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'][parseInt(aktifAy.split('-')[1])-1] + ' ' + aktifAy.split('-')[0];

  wrap.innerHTML = `
    <div class="sc-lbl" style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--text2);margin-bottom:10px">VARDİYA PERFORMANS TABLOSU</div>
    <div class="tw"><table>
      <thead><tr>
        <th style="min-width:120px">Makine</th>
        <th style="min-width:80px">Vardiya</th>
        <th class="c" style="min-width:100px">${esc(gunTarih)} Metre</th>
        <th class="c" style="min-width:100px">${esc(ayLabel)} Metre</th>
      </tr></thead>
      <tbody>
        ${rows.map(r => {
          const rc = MAKINE_RENK[r.m] || '#94a3b8';
          return [
            `<tr style="border-left:3px solid ${rc}">
              <td rowspan="3"><span class="kn" style="font-size:11px;color:${rc}">${esc(r.m)}</span></td>
              <td><span class="v1-tag" style="font-size:10px">00:00—08:00</span></td>
              <td class="c"><span class="nv" style="font-size:12px">${r.sg1.toFixed(2)}</span></td>
              <td class="c"><span class="nv g" style="font-size:12px">${r.v1ay.toFixed(2)}</span></td>
            </tr>`,
            `<tr>
              <td><span class="v2-tag" style="font-size:10px">08:00—16:00</span></td>
              <td class="c"><span class="nv" style="font-size:12px">${r.sg2.toFixed(2)}</span></td>
              <td class="c"><span class="nv g" style="font-size:12px">${r.v2ay.toFixed(2)}</span></td>
            </tr>`,
            `<tr style="border-bottom:2px solid var(--border2)">
              <td><span class="v3-tag" style="font-size:10px">16:00—00:00</span></td>
              <td class="c"><span class="nv" style="font-size:12px">${r.sg3.toFixed(2)}</span></td>
              <td class="c"><span class="nv g" style="font-size:12px">${r.v3ay.toFixed(2)}</span></td>
            </tr>`
          ].join('');
        }).join('')}
      </tbody>
    </table></div>`;
}

function drawPie(){
  const wrap = document.getElementById('pie-chart-wrap');
  if(!wrap) return;

  const { bas, bit, ayMod } = zamanFiltreTarihler();
  const data = MAKINELER.map(m => {
    let val = 0;
    if(ayMod){
      val = makineAyMetraj(m, aktifAy);
    } else {
      val = db.gunluk
        .filter(r=>r.makine===m && r.tarih && r.tarih>=bas && r.tarih<=bit)
        .reduce((s,r)=>s+(parseFloat(r.s1)||0)+(parseFloat(r.s2)||0)+(parseFloat(r.s3)||0),0);
    }
    return { label: m, val, color: MAKINE_RENK[m] || '#94a3b8' };
  }).filter(d => d.val > 0);

  const toplam = data.reduce((s,d) => s+d.val, 0);

  const svg = makeSvgDonut(data, toplam, toplam.toFixed(2), 'm toplam', 240);
  const legend = makeLegend(data, toplam);

  wrap.innerHTML = svg + `<div style="width:100%;max-width:240px">${legend}</div>`;
}

// ── YERALTI KUYULARI ────────────────────────────────────────
let kuyuSortCol = null;
let kuyuSortDir = 1;
function sortKuyular(col){
  if(kuyuSortCol === col){ kuyuSortDir *= -1; } else { kuyuSortCol = col; kuyuSortDir = 1; }
  // Update icons
  ['no','makine','bas','bit','az','eg','der','bkotu','cap','saha','mevkii','su','bar','durum'].forEach(c => {
    const el = document.getElementById('si-'+c);
    if(el) el.textContent = c===col ? (kuyuSortDir===1?'↑':'↓') : '⇅';
  });
  renderKuyular();
}

function renderKuyular(){
  const q  = (document.getElementById('q-k').value||'').toLowerCase();
  const qm = document.getElementById('q-km').value;
  const qb = document.getElementById('q-kb').value;
  const qd = document.getElementById('q-kd').value;
  const list = db.kuyular.filter(k =>
    (!q  || k.no.toLowerCase().includes(q) || (k.mevkii||'').toLowerCase().includes(q)) &&
    (!qm || makineEslesir(k.makine,qm)) &&
    (!qb || k.saha===qb) &&
    (!qd || (qd==='aktif' ? isAktifKuyu(k) : !isAktifKuyu(k)))
  );
  if(kuyuSortCol){
    list.sort((a,b)=>{
      let va,vb;
      if(kuyuSortCol==='no')     { va=a.no||''; vb=b.no||''; }
      else if(kuyuSortCol==='makine') { va=makineKey(a.makine)||''; vb=makineKey(b.makine)||''; }
      else if(kuyuSortCol==='bas')  { va=a.bas||''; vb=b.bas||''; }
      else if(kuyuSortCol==='bit')  { va=a.bit||''; vb=b.bit||''; }
      else if(kuyuSortCol==='az')   { va=parseFloat(a.az)||0; vb=parseFloat(b.az)||0; return (va-vb)*kuyuSortDir; }
      else if(kuyuSortCol==='eg')   { va=parseFloat(a.eg)||0; vb=parseFloat(b.eg)||0; return (va-vb)*kuyuSortDir; }
      else if(kuyuSortCol==='der')  { va=parseFloat(a.der)||0; vb=parseFloat(b.der)||0; return (va-vb)*kuyuSortDir; }
      else if(kuyuSortCol==='bkotu'){ const fa=hesapBitisKotu(a.z,a.eg,a.der), fb=hesapBitisKotu(b.z,b.eg,b.der); return ((parseFloat(fa)||0)-(parseFloat(fb)||0))*kuyuSortDir; }
      else if(kuyuSortCol==='cap')  { va=a.cap||''; vb=b.cap||''; }
      else if(kuyuSortCol==='saha') { va=a.saha||''; vb=b.saha||''; }
      else if(kuyuSortCol==='mevkii'){va=a.mevkii||'';vb=b.mevkii||'';}
      else if(kuyuSortCol==='su')   { va=parseFloat(a.su)||0; vb=parseFloat(b.su)||0; return (va-vb)*kuyuSortDir; }
      else if(kuyuSortCol==='bar')  { va=parseFloat(a.bar)||0; vb=parseFloat(b.bar)||0; return (va-vb)*kuyuSortDir; }
      else if(kuyuSortCol==='durum'){ va=isAktifKuyu(a)?'aktif':'bitti'; vb=isAktifKuyu(b)?'aktif':'bitti'; }
      else { va=''; vb=''; }
      return va<vb ? -kuyuSortDir : va>vb ? kuyuSortDir : 0;
    });
  }
  document.getElementById('k-count').textContent = `Yeraltı Kuyuları (${list.length})`;
  document.getElementById('k-tbody').innerHTML = list.length
    ? list.map(kuyuRow).join('')
    : `<tr><td colspan="15" style="text-align:center;padding:28px;color:var(--text3)">Kayıt yok</td></tr>`;
}

function kuyuRow(k){
  const isAktif = isAktifKuyu(k);
  const met = aktifMetraj(k.no);
  // Aktif kuyuda mevcut metraj, tamamlananında planlanan derinlik
  const derinlikGoster = isAktif ? (met > 0 ? met : (k.der||0)) : (k.der||0);
  const bitisKotu = hesapBitisKotu(k.z, k.eg, derinlikGoster);
  const bitisKotuGoster = bitisKotu ? parseFloat(bitisKotu).toFixed(2) : '—';
  const pct = k.der > 0 ? Math.min(100, Math.round(met/k.der*100)) : 0;
  const pc = pct>=100?'var(--green)':pct>=50?'var(--warn)':'var(--blue)';

  return `<tr class="${isAktif?'row-active':''}">
    <td class="stk" style="cursor:pointer" onclick="kuyuGecmisi('${esc(k.no)}')" title="Geçmişi görüntüle">
      <div class="kn">${esc(k.no)}</div>
      ${isAktif?`<div style="margin-top:3px"><span class="aktif-badge on">Aktif</span></div>`:''}
    </td>
    <td><span class="mt">${esc(k.makine||'—')}</span></td>
    <td><span class="dv">${fmtDate(k.bas)}</span></td>
    <td>${isAktif?`<span style="color:var(--warn);font-size:11px;font-family:'IBM Plex Mono',monospace">Devam ediyor</span>`:`<span class="dv">${fmtDate(k.bit)}</span>`}</td>
    <td class="nv">${k.az!=null ? parseFloat(k.az).toFixed(2) : '—'}</td>
    <td class="nv">${k.eg!=null ? parseFloat(k.eg).toFixed(2) : '—'}</td>
    <td>
      <div class="mbar">
        <span class="mbar-txt" style="color:var(--text)">${isAktif ? met.toFixed(2)+' m (aktif)' : (k.der!=null ? parseFloat(k.der).toFixed(2)+' m' : '—')}</span>
        ${isAktif && k.der > 0 ? `<div class="mbar-bg"><div class="mbar-fg" style="width:${pct}%;background:${pc}"></div></div><span class="mbar-txt">${pct}% · plan ${k.der!=null ? parseFloat(k.der).toFixed(2) : '—'} m</span>` : '' }
      </div>
    </td>

    <td class="nv">${bitisKotuGoster}</td>
    <td class="nv">${esc(k.cap||'—')}</td>
    <td><span class="mt">${esc(k.saha||'—')}</span></td>
    <td>${esc(k.mevkii||'—')}</td>
    <td class="nv">${k.su||'—'}</td>
    <td class="nv">${k.bar||'—'}</td>
    <td><span class="aktif-badge ${isAktif?'on':'off'}">${isAktif?'Aktif':'Tamamlandı'}</span></td>
    <td>
      <div style="display:flex;gap:3px">
        <button class="btn btn-g" style="padding:3px 7px;font-size:9px" onclick="editKuyu(${k.id})">✎</button>
        <button class="btn btn-d" style="padding:3px 7px;font-size:9px" onclick="delKuyu(${k.id})">✕</button>
      </div>
    </td>
  </tr>`;
}

// ── MAKİNE SAYFALARI ────────────────────────────────────────
function buildMakPages(){
  const wrap = document.getElementById('mak-pages');
  if(wrap.children.length) return;
  wrap.innerHTML = MAKINELER.map((m,i) => `
    <div id="spg-${m.replace(/[^a-z0-9]/gi,'_')}" class="spg ${i===0?'active':''}">
      <div style="display:flex;align-items:center;gap:20px;margin-bottom:14px;padding:10px 16px;background:var(--bg2);border:1px solid var(--border);border-radius:10px;">
          <div>
            <span style="font-size:11px;color:var(--text3)">Aktif Kuyu</span>
            <div class="kn" id="aktif-kuyu-${m.replace(/[^a-z0-9]/gi,'_')}" style="font-size:14px;margin-top:2px">—</div>
          </div>
          <div>
            <span style="font-size:11px;color:var(--text3)">Mevcut Metraj</span>
            <div class="nv g" id="aktif-met-${m.replace(/[^a-z0-9]/gi,'_')}" style="font-size:14px;font-weight:700;margin-top:2px">—</div>
          </div>
      </div>
      <div class="tw"><table>
        <thead><tr>
          <th style="min-width:90px">Tarih</th>
          <th style="min-width:100px">Lokasyon</th>
          <th style="min-width:140px">Sondaj Adı</th>
          <th class="c" style="min-width:90px;color:var(--v1b);border-top:2px solid var(--v1b)">00:00–08:00</th>
          <th class="c" style="min-width:90px;color:var(--v2b);border-top:2px solid var(--v2b)">08:00–16:00</th>
          <th class="c" style="min-width:90px;color:var(--v3b);border-top:2px solid var(--v3b)">16:00–00:00</th>
          <th class="c" style="min-width:90px;color:var(--gold)">Günlük (m)</th>
          <th style="min-width:180px">Durum Notu</th>
          <th style="min-width:40px"></th>
        </tr></thead>
        <tbody id="mak-tbody-${m.replace(/[^a-z0-9]/gi,'_')}"></tbody>
      </table></div>
    </div>`).join('');
}

function goMak(m, el){
  aktifMakine = m;
  window.aktifMakine = m;
  // Tümü gizle, makine sayfasını göster
  document.getElementById('tumu-wrap').innerHTML = '';
  document.getElementById('mak-pages').style.display = '';
  document.getElementById('vardiya-ekle-btn').style.display = '';
  renderVardiyaPerf();
  document.querySelectorAll('#mak-pages .spg').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('#mak-tabs .stab').forEach(t=>t.classList.remove('active'));
  const key = m.replace(/[^a-z0-9]/gi,'_');
  document.getElementById('spg-'+key).classList.add('active');
  el.classList.add('active');
  renderMak(m);
}

function goMakTumu(el){
  // Makine sayfalarını gizle, tumu-wrap göster
  document.getElementById('mak-pages').style.display = 'none';
  document.getElementById('vardiya-ekle-btn').style.display = 'none';
  document.querySelectorAll('#mak-tabs .stab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  renderTumu();
  renderVardiyaPerf();
}

function renderTumu(){
  const wrap = document.getElementById('tumu-wrap');
  if(!wrap) return;

  // Seçili aya ait kayıtlar — tarih ASC (ay başı üstte)
  const ayRecs = db.gunluk
    .filter(r => ayFiltre(r.tarih))
    .slice()
    .sort((a,b) => a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1 : (a.id||0)-(b.id||0));

  if(!ayRecs.length){
    wrap.innerHTML = '<p style="color:var(--text3);font-size:12px;text-align:center;padding:24px">Bu ay kayıt yok</p>';
    return;
  }

  wrap.innerHTML = `<div class="tw"><table>
    <thead><tr>
      <th style="min-width:90px">Tarih</th>
      <th style="min-width:110px">Makine</th>
      <th style="min-width:100px">Lokasyon</th>
      <th style="min-width:140px">Sondaj Adı</th>
      <th class="c" style="min-width:90px;color:var(--v1b);border-top:2px solid var(--v1b)">00:00–08:00</th>
      <th class="c" style="min-width:90px;color:var(--v2b);border-top:2px solid var(--v2b)">08:00–16:00</th>
      <th class="c" style="min-width:90px;color:var(--v3b);border-top:2px solid var(--v3b)">16:00–00:00</th>
      <th class="c" style="min-width:90px;color:var(--gold)">Günlük (m)</th>
    </tr></thead>
    <tbody>
    ${ayRecs.map(r=>{
      const s1=parseFloat(r.s1)||0, s2=parseFloat(r.s2)||0, s3=parseFloat(r.s3)||0;
      const toplam=s1+s2+s3;
      const rc=MAKINE_RENK[r.makine]||'#94a3b8';
      const sondajCell=r.sondaj&&r.sondaj.includes('/')
        ?`<div style="display:flex;flex-direction:column;align-items:flex-start;gap:2px"><div style="display:flex;align-items:center;gap:4px"><span style="font-size:9px;color:#ef4444;font-weight:700" title="Biten kuyu">■</span><span class="kn" style="font-size:11px">${esc(r.sondaj.split('/')[0].trim())}</span></div><div style="padding-left:4px;color:var(--text3);font-size:10px;line-height:1">↓</div><div style="display:flex;align-items:center;gap:4px"><span style="font-size:9px;color:#22c55e;font-weight:700" title="Başlayan kuyu">■</span><span class="kn" style="font-size:11px">${esc(r.sondaj.split('/')[1].trim())}</span></div></div>`
        :`<span class="kn" style="font-size:11px">${esc(r.sondaj||'—')}</span>`;
      const vCell=v=>v>0
        ?`<td class="c"><span style="font-family:IBM Plex Mono,monospace;font-size:12px;font-weight:700;color:var(--text)">${parseFloat(v).toFixed(2)}</span></td>`
        :`<td class="c" style="color:var(--text3)">—</td>`;
      return `<tr>
        <td><span class="dv">${fmtDate(r.tarih)}</span></td>
        <td><span class="kn" style="font-size:11px;color:${rc}">${esc(r.makine)}</span></td>
        <td><span style="color:var(--text2);font-size:11px">${esc(r.Lokasyon||r.llokasyon||'—')}</span></td>
        <td>${sondajCell}</td>
        ${vCell(r.s1)}${vCell(r.s2)}${vCell(r.s3)}
        <td class="c"><span style="font-family:IBM Plex Mono,monospace;font-size:13px;font-weight:700;color:var(--green)">${toplam.toFixed(2)}</span></td>
      </tr>`;
    }).join('')}
    </tbody>
  </table></div>`;
}


function renderMak(m){
  const key = m.replace(/[^a-z0-9]/gi,'_');

  // Aktif kuyu bilgisi — mevcut ayda gerçek aktif, geçmiş ayda delinen son kuyu
  const aktifKEl = document.getElementById('aktif-kuyu-'+key);
  const aktifMEl = document.getElementById('aktif-met-'+key);
  if(bugunAyMi()){
    const aktifK = db.kuyular.find(k => makineEslesir(k.makine, m) && isAktifKuyu(k));
    if(aktifKEl) aktifKEl.textContent = aktifK ? aktifK.no : '—';
    if(aktifMEl){
      if(aktifK){ const met = aktifMetraj(aktifK.no); aktifMEl.textContent = met.toFixed(2)+' m'; }
      else aktifMEl.textContent = '—';
    }
  } else {
    // Geçmiş ay: label'ı değiştir ve delinen kuyuları listele
    const kuyular = ayMakineDedigiKuyular(m);
    if(aktifKEl){
      // Label'ı bul ve değiştir
      const label = aktifKEl.previousElementSibling || aktifKEl.parentElement?.querySelector('.sc-lbl');
      if(label && label.textContent.includes('Aktif')) label.textContent = 'Delinen Kuyular';
      aktifKEl.textContent = kuyular.length ? kuyular.join(' · ') : '—';
    }
    if(aktifMEl){
      const met = kuyular.reduce((s,no) => {
        const ayRecs = db.gunluk.filter(r => r.makine===m && r.tarih && r.tarih.startsWith(aktifAy) &&
          (r.sondaj||'').split('/').map(x=>x.trim()).includes(no));
        return s + ayRecs.reduce((ss,r) => ss+(parseFloat(r.s1)||0)+(parseFloat(r.s2)||0)+(parseFloat(r.s3)||0),0);
      },0);
      aktifMEl.textContent = met.toFixed(2)+' m';
    }
  }

  // Kayıtlar — günlük yapı (s1/s2/s3 yan yana)
  const recs = db.gunluk.filter(r => r.makine===m && r.tarih && r.tarih.startsWith(aktifAy))
    .sort((a,b) => a.tarih > b.tarih ? 1 : a.tarih < b.tarih ? -1 : (a.id||0)-(b.id||0));

  const tbody = document.getElementById('mak-tbody-'+key);
  if(!tbody) return;

  if(!recs.length){
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text3)">Bu ay kayıt yok</td></tr>`;
    return;
  }

  tbody.innerHTML = recs.map(r => {
    const s1 = r.s1 != null ? r.s1 : null;
    const s2 = r.s2 != null ? r.s2 : null;
    const s3 = r.s3 != null ? r.s3 : null;
    const toplam = (s1||0)+(s2||0)+(s3||0);

    function vCell(val, vrdNo){
      const colors = {1:'var(--v1b)',2:'var(--v2b)',3:'var(--v3b)'};
      const labels = {1:'00-08',2:'08-16',3:'16-00'};
      if(val == null || val === 0) return `<td class="c" style="color:var(--text3);font-family:IBM Plex Mono,monospace;font-size:11px">—</td>`;
      return `<td class="c" style="border-top:2px solid ${colors[vrdNo]}20">
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
          <span style="font-family:IBM Plex Mono,monospace;font-size:9px;color:${colors[vrdNo]};letter-spacing:1px;font-weight:700">${labels[vrdNo]}</span>
          <span style="font-family:IBM Plex Mono,monospace;font-size:13px;color:var(--text);font-weight:700;letter-spacing:-0.02em">${parseFloat(val).toFixed(2)}</span>
        </div>
      </td>`;
    }

    // Kuyu değişimi göster: biten kuyu üstte, başlayan kuyu altta
    const sondajCell = r.sondaj && r.sondaj.includes('/')
      ? `<div style="display:flex;flex-direction:column;align-items:flex-start;gap:2px">
           <div style="display:flex;align-items:center;gap:4px">
             <span style="font-size:9px;color:#ef4444;font-weight:700" title="Biten kuyu">■</span>
             <span class="kn" style="font-size:11px">${esc(r.sondaj.split('/')[0].trim())}</span>
           </div>
           <div style="padding-left:4px;color:var(--text3);font-size:10px;line-height:1">↓</div>
           <div style="display:flex;align-items:center;gap:4px">
             <span style="font-size:9px;color:#22c55e;font-weight:700" title="Başlayan kuyu">■</span>
             <span class="kn" style="font-size:11px">${esc(r.sondaj.split('/')[1].trim())}</span>
           </div>
         </div>`
      : `<span class="kn" style="font-size:11px">${esc(r.sondaj||'—')}</span>`;

    return `<tr>
      <td><span class="dv">${fmtDate(r.tarih)}</span></td>
      <td><span style="color:var(--text2);font-size:11px">${esc(r.Lokasyon||r.llokasyon||'—')}</span></td>
      <td>${sondajCell}</td>
      ${vCell(s1,1)}
      ${vCell(s2,2)}
      ${vCell(s3,3)}
      <td class="c"><span style="font-family:IBM Plex Mono,monospace;font-size:13px;font-weight:700;color:var(--green);letter-spacing:-0.02em">${toplam.toFixed(2)}</span></td>
      <td style="color:var(--text3);font-size:11px;max-width:200px;white-space:normal">${esc(r.not||'')}</td>
      <td style="white-space:nowrap">
        <button class="btn" style="padding:3px 7px;font-size:12px;background:none;border:1px solid var(--border2);border-radius:6px;cursor:pointer;margin-right:3px" title="Düzenle" onclick="editVar(${r.id})">✏️</button>
        <button class="btn btn-d" style="padding:3px 7px;font-size:12px;border-radius:6px" title="Sil" onclick="delGunluk(${r.id})">🗑</button>
      </td>
    </tr>`;
  }).join('');
}


// ── DÜZENLEME FONKSİYONLARI ─────────────────────────────────
let editVarId = null;

function editVar(id){
  const r = db.gunluk.find(x=>x.id===id); if(!r) return;
  editVarId = id;
  varMakine = r.makine;
  document.getElementById('m-var-title').textContent = r.makine+' · Düzenle · '+fmtDate(r.tarih);
  document.getElementById('v-tarih').value   = r.tarih||'';
  document.getElementById('v-sondaj').value  = r.sondaj||'';
  document.getElementById('v-lok').value     = r.Lokasyon||'';
  document.getElementById('v-s1').value      = r.s1 != null ? r.s1 : '';
  document.getElementById('v-s2').value      = r.s2 != null ? r.s2 : '';
  document.getElementById('v-s3').value      = r.s3 != null ? r.s3 : '';
  document.getElementById('v-not').value     = r.not||'';
  ['v-old-s1','v-old-s2','v-old-s3','v-new-s1','v-new-s2','v-new-s3'].forEach(x=>{
    const el=document.getElementById(x); if(el) el.value='';
  });
  updateKuyuDegisimPanel(true);
  document.getElementById('m-var').classList.add('open');
}

let editDurakId = null;

function editDurak(id){
  const d = db.duraklamalar.find(x=>x.id===id); if(!d) return;
  editDurakId = id;
  document.getElementById('d-mak').value      = d.makine||'GS-200';
  document.getElementById('d-tarih').value    = d.tarih||'';
  document.getElementById('d-vrd').value      = d.vardiya||1;
  document.getElementById('d-son').value      = d.sondaj||'';
  document.getElementById('d-ned').value      = d.neden||'DİĞER';
  document.getElementById('d-lokasyon').value  = d.lokasyon||'';
  document.getElementById('d-aciklama').value = d.aciklama||'';
  document.getElementById('d-dk').value       = d.dk||'';
  document.getElementById('m-durak').classList.add('open');
}

// ── DURAKLAMALAR ────────────────────────────────────────────
function renderDurak(){
  const qm = document.getElementById('q-dm').value;
  const list = db.duraklamalar.filter(d => ayFiltre(d.tarih) && (!qm||d.makine===qm));
  const topDk = list.reduce((s,d)=>s+(parseFloat(d.dk)||0),0);
  document.getElementById('dur-dk').textContent = topDk;
  document.getElementById('dur-sa').textContent = (topDk/60).toFixed(2);
  document.getElementById('dur-say').textContent = list.length;

  document.getElementById('dur-tbody').innerHTML = list.length
    ? list.slice().sort((a,b)=>a.tarih>b.tarih?-1:1).map(d=>{
        const vc = VRD_CLASS[d.vardiya]||'v1-tag';
        const vl = VRD_LABEL[d.vardiya]||'—';
        return `<tr>
          <td><span class="mt">${esc(d.makine)}</span></td>
          <td><span class="dv">${fmtDate(d.tarih)}</span></td>
          <td><span class="kn" style="font-size:11px">${esc(d.sondaj||'—')}</span></td>
          <td><span class="${vc}">${vl}</span></td>
          <td>${esc(d.neden||'—')}</td>
          <td style="color:var(--text2);font-size:11px">${esc(d.lokasyon||'—')}</td>
          <td style="color:var(--text2);font-size:11px">${esc(d.aciklama||'—')}</td>
          <td class="c"><span class="nv gold">${d.dk||0}</span></td>
          <td style="white-space:nowrap">
            <button class="btn" style="padding:3px 7px;font-size:12px;background:none;border:1px solid var(--border2);border-radius:6px;cursor:pointer;margin-right:3px" title="Düzenle" onclick="editDurak(${d.id})">✏️</button>
            <button class="btn btn-d" style="padding:3px 7px;font-size:12px;border-radius:6px" title="Sil" onclick="delDurak(${d.id})">🗑</button>
          </td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="8" style="text-align:center;padding:28px;color:var(--text3)">Kayıt yok</td></tr>`;
}

// ── AUTO SAHA ────────────────────────────────────────────────
function autoSaha(){
  const no = (document.getElementById('k-no').value||'').trim().toUpperCase();
  const mev = (document.getElementById('k-mev').value||'').trim().toUpperCase();
  let saha = '';
  // Mevkii öncelikli
  if(mev.startsWith('B') || mev.includes('CEP')) saha = 'IR.541';
  else if(mev.startsWith('KAT') || mev.match(/^\d/)) saha = 'IR.64789';
  // Kuyu no fallback
  else if(no.startsWith('B')) saha = 'IR.541';
  const el = document.getElementById('k-saha');
  if(el && saha) el.value = saha;
}

// ── KUYU MODAL ──────────────────────────────────────────────
function openKuyu(){
  editKId = null;
  document.getElementById('m-kuyu-title').textContent = 'Yeni Kuyu Ekle';
  ['k-no','k-az','k-eg','k-der','k-guncel','k-cap','k-y','k-x','k-z','k-mev','k-saha','k-su','k-bar'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('k-bas').value = aktifAy+'-01';
  document.getElementById('k-bit').value = '';
  document.getElementById('m-kuyu').classList.add('open');
}

function editKuyu(id){
  const k = db.kuyular.find(x=>x.id===id); if(!k) return;
  editKId = id;
  document.getElementById('m-kuyu-title').textContent = 'Kuyu Düzenle · '+k.no;
  document.getElementById('k-no').value   = k.no||'';
  document.getElementById('k-mak').value  = k.makine||'GS-200';
  document.getElementById('k-bas').value  = k.bas||'';
  document.getElementById('k-bit').value  = k.bit||'';
  document.getElementById('k-az').value   = k.az||'';
  document.getElementById('k-eg').value   = k.eg||'';
  document.getElementById('k-der').value  = k.der||'';
  document.getElementById('k-guncel').value = k.guncel||'';
  document.getElementById('k-cap').value  = k.cap||'';
  document.getElementById('k-y').value    = k.y||'';
  document.getElementById('k-x').value    = k.x||'';
  document.getElementById('k-z').value    = k.z||'';
  document.getElementById('k-mev').value  = k.mevkii||'';
  document.getElementById('k-saha').value = k.saha||'';
  document.getElementById('k-su').value   = k.su||'';
  document.getElementById('k-bar').value  = k.bar||'';
  document.getElementById('m-kuyu').classList.add('open');
}

function closeKuyu(){ document.getElementById('m-kuyu').classList.remove('open'); }

function saveKuyu(){
  const no = document.getElementById('k-no').value.trim();
  if(!no){ alert('Kuyu No zorunludur.'); return; }
  const data = {
    no, makine: document.getElementById('k-mak').value,
    bas: document.getElementById('k-bas').value,
    bit: document.getElementById('k-bit').value,
    az:  document.getElementById('k-az').value,
    eg:  document.getElementById('k-eg').value,
    der: parseFloat(document.getElementById('k-der').value)||0,
    guncel: parseFloat(document.getElementById('k-guncel').value)||0,
    cap: document.getElementById('k-cap').value.trim(),
    y:   parseFloat(document.getElementById('k-y').value)||0,
    x:   parseFloat(document.getElementById('k-x').value)||0,
    z:   parseFloat(document.getElementById('k-z').value)||0,
    mevkii: document.getElementById('k-mev').value.trim(),
    saha:   document.getElementById('k-saha').value.trim(),
    su:  document.getElementById('k-su').value,
    bar: document.getElementById('k-bar').value,
  };
  if(editKId !== null){
    const idx = db.kuyular.findIndex(x=>x.id===editKId);
    if(idx!==-1) db.kuyular[idx] = {...db.kuyular[idx],...data};
  } else {
    data.id = uid();
    db.kuyular.push(data);
  }
  save(); closeKuyu(); renderKuyular(); renderDash();
}

function delKuyu(id){
  if(!confirm('Bu kuyuyu silmek istiyor musunuz?')) return;
  db.kuyular = db.kuyular.filter(x=>x.id!==id);
  save(); renderKuyular();
}

// ── VARDİYA MODAL ───────────────────────────────────────────
let varMakine = 'GS-200';
let vKuyuSay  = 0;

function sonDepthBul(sondajNo, makine, tarihHaric){
  if(!sondajNo) return null;
  // Kuyu değişimi varsa son kuyuyu al
  const kuyuNo = sondajNo.includes('/') ? sondajNo.split('/').pop().trim() : sondajNo.trim();
  const kayitlar = db.gunluk
    .filter(r => r.makine === makine && r.depth != null &&
      (!tarihHaric || r.tarih < tarihHaric) &&
      (r.sondaj || '').split('/').map(s => s.trim()).includes(kuyuNo))
    .sort((a, b) => a.tarih > b.tarih ? -1 : 1);
  return kayitlar.length ? parseFloat(kayitlar[0].depth) : null;
}

function vardiyaNum(id){
  const el = document.getElementById(id);
  if(!el) return 0;
  const v = parseFloat(el.value);
  return Number.isFinite(v) ? v : 0;
}

function vardiyaCell(v){
  return v > 0 ? parseFloat(v.toFixed(2)) : null;
}

function kuyuDegisimParcalari(){
  const sondaj = (document.getElementById('v-sondaj')?.value || '').trim();
  const parts = sondaj.split('/').map(s=>s.trim()).filter(Boolean);
  return parts.length === 2 ? parts : null;
}

function setKuyuDegisimVal(id, val){
  const el = document.getElementById(id);
  if(el) el.value = val > 0 ? val : '';
}

function applyKuyuDegisimDagitim(){
  const parts = kuyuDegisimParcalari();
  if(!parts) return;
  const bitisVardiya = parseInt(document.getElementById('v-change-end-shift')?.value || '1', 10);
  [1,2,3].forEach(n => {
    const total = vardiyaNum('v-s'+n);
    setKuyuDegisimVal('v-old-s'+n, n <= bitisVardiya ? total : 0);
    setKuyuDegisimVal('v-new-s'+n, n > bitisVardiya ? total : 0);
  });
  updateKuyuDegisimTotals();
}

function updateKuyuDegisimTotals(){
  const sum = ids => ids.reduce((s,id)=>s+vardiyaNum(id),0);
  const vardiyaTop = sum(['v-s1','v-s2','v-s3']);
  const oldTop = sum(['v-old-s1','v-old-s2','v-old-s3']);
  const newTop = sum(['v-new-s1','v-new-s2','v-new-s3']);
  const summary = document.getElementById('v-change-summary');
  if(!summary) return;
  const fark = Math.abs((oldTop + newTop) - vardiyaTop);
  summary.textContent = `Vardiya toplamı ${vardiyaTop.toFixed(2)} m · dağıtılan ${(oldTop+newTop).toFixed(2)} m`;
  summary.className = 'kcp-foot ' + (fark < 0.001 ? 'ok' : 'warn');
}

function updateKuyuDegisimPanel(resetDagitim){
  const parts = kuyuDegisimParcalari();
  const panel = document.getElementById('v-change-panel');
  if(!panel) return;
  if(!parts){
    panel.style.display = 'none';
    return;
  }
  panel.style.display = '';
  const oldEl = document.getElementById('v-old-kuyu');
  const newEl = document.getElementById('v-new-kuyu');
  if(oldEl) oldEl.textContent = parts[0];
  if(newEl) newEl.textContent = parts[1];
  if(resetDagitim) applyKuyuDegisimDagitim();
  else updateKuyuDegisimTotals();
}

function kuyuDegisimSatirlari(tarih, lok, not_){
  const parts = kuyuDegisimParcalari();
  if(!parts) return null;
  const s = [1,2,3].map(n => vardiyaNum('v-s'+n));
  const dagitimTop = [1,2,3].reduce((sum,n) => sum + vardiyaNum('v-old-s'+n) + vardiyaNum('v-new-s'+n), 0);
  if(dagitimTop <= 0 && s.reduce((a,b)=>a+b,0) > 0) applyKuyuDegisimDagitim();
  const oldVals = [1,2,3].map(n => vardiyaNum('v-old-s'+n));
  const newVals = [1,2,3].map(n => vardiyaNum('v-new-s'+n));
  for(let i=0;i<3;i++){
    if(Math.abs((oldVals[i] + newVals[i]) - s[i]) > 0.001){
      alert(`Kuyu değişimi dağılımı hatalı. ${i+1}. vardiyada eski+yeni kuyu toplamı vardiya metrajına eşit olmalı.`);
      return false;
    }
  }
  const oldTop = oldVals.reduce((a,b)=>a+b,0);
  const newTop = newVals.reduce((a,b)=>a+b,0);
  if(oldTop <= 0 || newTop <= 0){
    alert('Kuyu değişiminde biten ve başlayan kuyu için en az bir metraj olmalı.');
    return false;
  }
  const changeNote = `Kuyu değişimi: ${parts[0]} -> ${parts[1]}`;
  return [
    {
      id: uid(), makine: varMakine, tarih, Lokasyon: lok, sondaj: parts[0],
      s1: vardiyaCell(oldVals[0]), s2: vardiyaCell(oldVals[1]), s3: vardiyaCell(oldVals[2]),
      toplam: parseFloat(oldTop.toFixed(2)), depth: null,
      not: not_ ? `${changeNote}. ${not_}` : `${changeNote}. Biten kuyu.`
    },
    {
      id: uid(), makine: varMakine, tarih, Lokasyon: lok, sondaj: parts[1],
      s1: vardiyaCell(newVals[0]), s2: vardiyaCell(newVals[1]), s3: vardiyaCell(newVals[2]),
      toplam: parseFloat(newTop.toFixed(2)), depth: null,
      not: not_ ? `${changeNote}. ${not_}` : `${changeNote}. Başlayan kuyu.`
    }
  ];
}

function upsertGunlukRow(row){
  const existing = db.gunluk.find(r =>
    r.makine === row.makine &&
    r.tarih === row.tarih &&
    r.sondaj === row.sondaj
  );
  if(existing){
    if(row.s1 !== null) existing.s1 = row.s1;
    if(row.s2 !== null) existing.s2 = row.s2;
    if(row.s3 !== null) existing.s3 = row.s3;
    existing.toplam = (existing.s1??0)+(existing.s2??0)+(existing.s3??0);
    if(row.Lokasyon) existing.Lokasyon = row.Lokasyon;
    if(row.not) existing.not = row.not;
  } else {
    db.gunluk.push(row);
  }
}

function openVar(m){
  varMakine = m;
  document.getElementById('m-var-title').textContent = m+' · Günlük Delgi Girişi';
  document.getElementById('v-tarih').value = new Date().toISOString().split('T')[0];
  // Datalist güncelle
  const dl = document.getElementById('vkl');
  if(dl) dl.innerHTML = db.kuyular.filter(k=>k.makine===m).map(k=>`<option value="${esc(k.no)}">`).join('');
  // Aktif kuyuyu otomatik doldur — seçili AYA göre
  const aktifK = ayMakineAktifKuyu(m);
  const sondajNo = aktifK ? aktifK.no : '';
  document.getElementById('v-sondaj').value = sondajNo;
  document.getElementById('v-lok').value    = aktifK ? (aktifK.mevkii||aktifK.Lokasyon||'') : '';
  ['v-s1','v-s2','v-s3','v-not'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  ['v-old-s1','v-old-s2','v-old-s3','v-new-s1','v-new-s2','v-new-s3'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  updateKuyuDegisimPanel(true);
  document.getElementById('m-var').classList.add('open');
}

function addVKuyu(){
  vKuyuSay++;
  const wrap = document.getElementById('v-kuyular-wrap');
  const aktifK = ayMakineAktifKuyu(varMakine);
  const div = document.createElement('div');
  div.id = 'vk-'+vKuyuSay;
  div.style.cssText = 'background:var(--bg3);border:1px solid var(--border2);border-radius:var(--r);padding:12px;margin-bottom:8px;';
  div.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <span style="font-family:IBM Plex Mono,monospace;font-size:10px;font-weight:600;letter-spacing:1.5px;color:var(--text2);text-transform:uppercase">${vKuyuSay>1?'Kuyu Değişimi — ':''}Kuyu ${vKuyuSay}</span>
      ${vKuyuSay>1?`<button class="btn btn-d" style="padding:2px 7px;font-size:9px" onclick="rmVKuyu(${vKuyuSay})">✕</button>`:''}
    </div>
    <div class="fg">
      <div class="ff"><label class="fl">Kuyu No</label>
        <input class="fi" id="vk-no-${vKuyuSay}" value="${aktifK&&vKuyuSay===1?aktifK.no:''}" placeholder="BYA-928" list="kuyu-list">
        <datalist id="kuyu-list">${db.kuyular.map(k=>`<option value="${esc(k.no)}">`).join('')}</datalist>
      </div>
      <div class="ff"><label class="fl">Bu Vardiyada İlerleme (m)</label>
        <input class="fi" type="number" step="0.5" id="vk-ilerleme-${vKuyuSay}" placeholder="0.0">
      </div>
      ${vKuyuSay>1?`<div class="ff full"><label class="fl">Not (Kuyu değişimi açıklaması)</label><input class="fi" id="vk-not-${vKuyuSay}" placeholder="BYA-927 KUYU SONU / BYA-928 KUYU BAŞLANGICI"></div>`:''}
    </div>`;
  wrap.appendChild(div);
}

function rmVKuyu(n){
  const el = document.getElementById('vk-'+n);
  if(el) el.remove();
}

function closeVar(){ document.getElementById('m-var').classList.remove('open'); editVarId=null; }

function saveVar(){
  const tarih  = document.getElementById('v-tarih').value;
  if(!tarih){ alert('Tarih zorunludur.'); return; }
  const sondaj = document.getElementById('v-sondaj').value.trim();
  if(!sondaj){ alert('Sondaj adı zorunludur.'); return; }
  const s1 = parseFloat(document.getElementById('v-s1').value)||null;
  const s2 = parseFloat(document.getElementById('v-s2').value)||null;
  const s3 = parseFloat(document.getElementById('v-s3').value)||null;
  if(!s1 && !s2 && !s3){ alert('En az bir vardiya ilerlemesi girin.'); return; }

  // Depth = o günden önceki son depth + bu vardiya toplamı
  const gunlukToplam = (s1||0)+(s2||0)+(s3||0);
  const sonDepth = sonDepthBul(sondaj, varMakine, tarih);
  const depth = sonDepth != null ? parseFloat((sonDepth + gunlukToplam).toFixed(2)) : parseFloat(gunlukToplam.toFixed(2));
  const lok   = document.getElementById('v-lok').value.trim();
  const not_  = document.getElementById('v-not').value.trim();
  const degisimSatirlari = kuyuDegisimSatirlari(tarih, lok, not_);
  if(degisimSatirlari === false) return;

  // EDIT MODU: ID ile direkt güncelle, asla toplama yapma
  if(editVarId !== null){
    if(degisimSatirlari){
      db.gunluk = db.gunluk.filter(r=>r.id!==editVarId);
      degisimSatirlari.forEach(row => upsertGunlukRow(row));
      editVarId = null;
      save(); closeVar(); renderMak(varMakine); renderDash();
      return;
    }
    const idx = db.gunluk.findIndex(r=>r.id===editVarId);
    if(idx !== -1){
      db.gunluk[idx] = {...db.gunluk[idx],
        tarih, sondaj, Lokasyon: lok,
        s1, s2, s3,
        not: not_,
        toplam: (s1??0)+(s2??0)+(s3??0)
      };
    }
    editVarId = null;
    save(); closeVar(); renderMak(varMakine); renderDash();
    return;
  }

  if(degisimSatirlari){
    degisimSatirlari.forEach(row => upsertGunlukRow(row));
    save(); closeVar(); renderMak(varMakine); renderDash();
    setTimeout(function(){ var r=document.querySelector("#kg-tbody tr"); if(r && typeof ddhAnimateNewRow==="function") ddhAnimateNewRow(r); }, 60);
    return;
  }

  // YENİ KAYIT: Aynı makine+tarih+kuyu varsa vardiyayı doldur, yoksa yeni ekle
  upsertGunlukRow({
    id: uid(), makine: varMakine, tarih,
    Lokasyon: lok, sondaj,
    s1, s2, s3,
    toplam: (s1??0)+(s2??0)+(s3??0),
    depth: null, not: not_
  });

  save(); closeVar(); renderMak(varMakine); renderDash();
  // YENİ KAYIT ANİMASYONU
  setTimeout(function(){ var r=document.querySelector("#kg-tbody tr"); if(r && typeof ddhAnimateNewRow==="function") ddhAnimateNewRow(r); }, 60);
}

function delGunluk(id){
  if(!confirm('Bu kaydı silmek istiyor musunuz?')) return;
  db.gunluk = db.gunluk.filter(r=>r.id!==id);
  save(); renderMak(aktifMakine); renderDash();
}

// ── DURAKLAMA MODAL ─────────────────────────────────────────
function openDurak(){
  editDurakId=null;
  document.getElementById('m-durak').querySelector('.mt2').textContent='Duraklama Ekle';
  ['d-son','d-dk','d-aciklama','d-lokasyon'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('d-tarih').value = new Date().toISOString().split('T')[0];
  document.getElementById('m-durak').classList.add('open');
}

function closeDurak(){ document.getElementById('m-durak').classList.remove('open'); editDurakId=null; }

function saveDurak(){
  const dk = parseFloat(document.getElementById('d-dk').value)||0;
  if(!dk){ alert('Süre giriniz.'); return; }
  const durakData = {
    makine:   document.getElementById('d-mak').value,
    tarih:    document.getElementById('d-tarih').value,
    vardiya:  parseInt(document.getElementById('d-vrd').value),
    sondaj:   document.getElementById('d-son').value.trim(),
    neden:    document.getElementById('d-ned').value,
    lokasyon:  document.getElementById('d-lokasyon').value.trim(),
    aciklama: document.getElementById('d-aciklama').value.trim(),
    dk
  };
  if(editDurakId !== null){
    const idx = db.duraklamalar.findIndex(d=>d.id===editDurakId);
    if(idx !== -1) db.duraklamalar[idx] = {...db.duraklamalar[idx], ...durakData};
    editDurakId = null;
  } else {
    db.duraklamalar.push({id:uid(), ...durakData});
  }
  save(); closeDurak(); renderDurak(); renderDash();
  // YENİ DURAKLAMA ANİMASYONU
  setTimeout(function(){ var r=document.querySelector("#dur-tbody tr"); if(r && typeof ddhAnimateNewRow==="function") ddhAnimateNewRow(r); }, 60);
}

function delDurak(id){
  if(!confirm('Bu kaydı silmek istiyor musunuz?')) return;
  db.duraklamalar = db.duraklamalar.filter(d=>d.id!==id);
  save(); renderDurak();
}

// ── ÖZELLİK 1: KÜMÜLATİF GRAFİK ───────────────────────────
function drawKumulatif(){
  const canvas = document.getElementById('kumul-chart');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const PAD = {top:20, right:20, bottom:30, left:50};
  const CW = W - PAD.left - PAD.right;
  const CH = H - PAD.top - PAD.bottom;

  ctx.clearRect(0,0,W,H);

  const ayRecs = db.gunluk.filter(r => ayFiltre(r.tarih));
  if(!ayRecs.length){
    ctx.fillStyle='#444'; ctx.font='12px IBM Plex Mono,monospace';
    ctx.textAlign='center'; ctx.fillText('Veri yok', W/2, H/2); return;
  }

  // Günlük toplamlar
  const gunMap = {};
  ayRecs.forEach(r => {
    gunMap[r.tarih] = (gunMap[r.tarih]||0) + (parseFloat(r.s1)||0)+(parseFloat(r.s2)||0)+(parseFloat(r.s3)||0);
  });
  const gunler = Object.keys(gunMap).sort();
  let kum = 0;
  const kumData = gunler.map(g => { kum += gunMap[g]; return {tarih:g, kum}; });

  const maxKum = Math.max(...kumData.map(d=>d.kum), 1);
  const ayGun = new Date(aktifAy+'-01');
  const sonGun = new Date(ayGun.getFullYear(), ayGun.getMonth()+1, 0).getDate();

  function xPos(tarih){ const gun = parseInt(tarih.split('-')[2]); return PAD.left + (gun-1)/(sonGun-1)*CW; }
  function yPos(val){ return PAD.top + CH - (val/maxKum)*CH; }

  // Grid
  ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=1;
  for(let i=0;i<=4;i++){
    const y = PAD.top + i*(CH/4);
    ctx.beginPath(); ctx.moveTo(PAD.left,y); ctx.lineTo(PAD.left+CW,y); ctx.stroke();
    ctx.fillStyle='#555'; ctx.font='10px IBM Plex Mono,monospace'; ctx.textAlign='right';
    ctx.fillText(Math.round(maxKum*(1-i/4))+'m', PAD.left-5, y+4);
  }

  // Hedef çizgisi (toplam plan/günler * gün)
  const toplamPlan = db.kuyular.filter(k=>isAktifKuyu(k)||(k.bas&&k.bas.startsWith(aktifAy)))
    .reduce((s,k)=>s+(parseFloat(k.der)||0),0);
  if(toplamPlan>0){
    ctx.strokeStyle='rgba(212,168,32,0.3)'; ctx.lineWidth=1; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(PAD.left, PAD.top+CH); ctx.lineTo(PAD.left+CW, PAD.top); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle='rgba(212,168,32,0.5)'; ctx.font='9px IBM Plex Mono,monospace'; ctx.textAlign='right';
    ctx.fillText('HEDEF', PAD.left+CW-2, PAD.top+12);
  }

  // Gerçekleşen çizgi
  ctx.strokeStyle='#2ecc71'; ctx.lineWidth=2; ctx.setLineDash([]);
  ctx.beginPath();
  kumData.forEach((d,i) => {
    const x=xPos(d.tarih), y=yPos(d.kum);
    i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });
  ctx.stroke();

  // Noktalar
  kumData.forEach(d => {
    ctx.beginPath(); ctx.arc(xPos(d.tarih), yPos(d.kum), 3, 0, 2*Math.PI);
    ctx.fillStyle='#2ecc71'; ctx.fill();
  });

  // X ekseni günler
  ctx.fillStyle='#555'; ctx.font='9px IBM Plex Mono,monospace'; ctx.textAlign='center';
  [1,5,10,15,20,25,sonGun].forEach(g => {
    const x = PAD.left + (g-1)/(sonGun-1)*CW;
    ctx.fillText(g, x, H-8);
  });

  // Son değer etiketi
  if(kumData.length){
    const last = kumData[kumData.length-1];
    ctx.fillStyle='#2ecc71'; ctx.font='bold 11px IBM Plex Mono,monospace'; ctx.textAlign='left';
    ctx.fillText(last.kum.toFixed(2)+'m', xPos(last.tarih)+6, yPos(last.kum)+4);
  }
}

// ── ÖZELLİK 2: VERİMLİLİK ───────────────────────────────────
function renderVerimlilik(){
  const tbody = document.getElementById('verimlilik-tbody');
  if(!tbody) return;
  const ayRecs  = filtreliGunluk();
  const ayDurak = filtreliDurak();

  tbody.innerHTML = MAKINELER.map(m => {
    const mRecs = ayRecs.filter(r=>r.makine===m);
    const gunler = new Set(mRecs.map(r=>r.tarih)).size;
    const toplam = mRecs.reduce((s,r)=>s+(parseFloat(r.s1)||0)+(parseFloat(r.s2)||0)+(parseFloat(r.s3)||0),0);
    const verim  = gunler > 0 ? (toplam/gunler).toFixed(2) : '—';
    const durakDk = ayDurak.filter(d=>d.makine===m).reduce((s,d)=>s+(parseFloat(d.dk)||0),0);
    const calismaGun = gunler * 24 * 60; // toplam dakika
    const durakOran = calismaGun > 0 ? ((durakDk/calismaGun)*100).toFixed(2)+'%' : '—';
    const verimRenk = parseFloat(verim)>20?'var(--green)':parseFloat(verim)>10?'var(--warn)':'var(--red)';

    return `<tr>
      <td><span class="kn" style="font-size:11px">${m}</span></td>
      <td class="nv">${gunler}</td>
      <td class="nv g">${toplam.toFixed(2)}</td>
      <td><span style="font-family:IBM Plex Mono,monospace;font-size:13px;font-weight:700;color:${verimRenk}">${verim}</span></td>
      <td><span style="font-family:IBM Plex Mono,monospace;font-size:12px;color:${durakDk>0?'var(--warn)':'var(--green)'}">${durakOran}</span></td>
    </tr>`;
  }).join('');
}

// ── DURAKLAMA BÖLGE ANALİZİ ─────────────────────────────────
function renderDurakBolge(){
  const wrap = document.getElementById('durak-bolge-wrap');
  if(!wrap) return;

  const ayDurak = filtreliDurak();
  if(!ayDurak.length){
    wrap.innerHTML='<p style="color:var(--text3);font-size:12px;text-align:center;padding:16px">Bu dönem duraklama kaydı yok</p>';
    return;
  }

  // Makine bazlı duraklama
  const makineData = MAKINELER.map(m => {
    const dk = ayDurak.filter(d=>d.makine===m).reduce((s,d)=>s+(parseFloat(d.dk)||0),0);
    return {label:m, val:dk, color:MAKINE_RENK[m]||'#94a3b8'};
  }).filter(d=>d.val>0);

  // Neden bazlı duraklama
  const NEDEN_COLORS={'ELEKTRİK KESİNTİSİ':'#fb923c','DUMAN':'#f87171','SU KESİNTİSİ':'#60a5fa','TEKNİK ARIZA':'#a78bfa','BAKIM':'#4ade80','DİĞER':'#94a3b8'};
  const nedenMap={};
  ayDurak.forEach(d=>{ const n=d.neden||'DİĞER'; nedenMap[n]=(nedenMap[n]||0)+(parseFloat(d.dk)||0); });
  const nedenData = Object.entries(nedenMap).map(([n,dk])=>({label:n,val:dk,color:NEDEN_COLORS[n]||'#94a3b8'})).filter(d=>d.val>0).sort((a,b)=>b.val-a.val);

  function makeSvgBar(data, title, W=380){
    const barH=28, gap=8, PAD_L=130, topPad=10;
    const maxVal=Math.max(...data.map(d=>d.val),1);
    const H=data.length*(barH+gap)+topPad+20;
    let bars='';
    data.forEach((d,i)=>{
      const y=topPad+i*(barH+gap);
      const w=Math.max(4,Math.round((d.val/maxVal)*(W-PAD_L-40)));
      bars+=`<rect x="${PAD_L}" y="${y}" width="${w}" height="${barH}" rx="4" fill="${d.color}" opacity="0.85"><title>${d.label}: ${d.val}dk</title></rect>`;
      bars+=`<text x="${PAD_L-6}" y="${y+barH/2+4}" text-anchor="end" font-size="10" fill="#6b7280" font-weight="500">${d.label.length>16?d.label.slice(0,14)+'…':d.label}</text>`;
      bars+=`<text x="${PAD_L+w+5}" y="${y+barH/2+4}" font-size="10" fill="${d.color}" font-weight="700">${d.val}dk</text>`;
    });
    return `<div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:600;color:var(--text2);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">${title}</div>
      <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>
    </div>`;
  }

  wrap.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;flex-wrap:wrap">
    ${makeSvgBar(makineData,'MAKİNE BAZLI DURAKLAMA (dk)')}
    ${makeSvgBar(nedenData,'NEDEN BAZLI DURAKLAMA (dk)')}
  </div>`;
}


function drawDurakTrend(){
  const canvas = document.getElementById('durak-trend-chart');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const W=canvas.width, H=canvas.height;
  const PAD={top:16,right:20,bottom:28,left:50};
  const CW=W-PAD.left-PAD.right, CH=H-PAD.top-PAD.bottom;

  ctx.clearRect(0,0,W,H);

  const ayDurak = db.duraklamalar.filter(d=>ayFiltre(d.tarih));
  if(!ayDurak.length){
    ctx.fillStyle='#444'; ctx.font='12px IBM Plex Mono,monospace';
    ctx.textAlign='center'; ctx.fillText('Bu ay duraklama kaydı yok', W/2, H/2); return;
  }

  const gunMap = {};
  ayDurak.forEach(d=>{ gunMap[d.tarih]=(gunMap[d.tarih]||0)+(parseFloat(d.dk)||0); });
  const gunler = Object.keys(gunMap).sort();
  const maxDk = Math.max(...Object.values(gunMap),1);
  const ayGun = new Date(aktifAy+'-01');
  const sonGun = new Date(ayGun.getFullYear(), ayGun.getMonth()+1, 0).getDate();

  function xP(t){ return PAD.left+(parseInt(t.split('-')[2])-1)/(sonGun-1)*CW; }
  function yP(v){ return PAD.top+CH-(v/maxDk)*CH; }

  // Grid
  ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=1;
  [0,0.5,1].forEach(r=>{
    const y=PAD.top+CH-r*CH;
    ctx.beginPath(); ctx.moveTo(PAD.left,y); ctx.lineTo(PAD.left+CW,y); ctx.stroke();
    ctx.fillStyle='#555'; ctx.font='9px IBM Plex Mono,monospace'; ctx.textAlign='right';
    ctx.fillText(Math.round(maxDk*r)+'dk', PAD.left-4, y+3);
  });

  // Bar chart
  const barW = Math.max(4, CW/sonGun*0.6);
  gunler.forEach(g=>{
    const x=xP(g), dk=gunMap[g], h=(dk/maxDk)*CH;
    ctx.fillStyle = dk>120?'#e74c3c':dk>60?'#f39c12':'#e67e22';
    ctx.fillRect(x-barW/2, yP(dk), barW, h);
  });

  // X
  ctx.fillStyle='#555'; ctx.font='9px IBM Plex Mono,monospace'; ctx.textAlign='center';
  [1,5,10,15,20,25,sonGun].forEach(g=>{
    ctx.fillText(g, PAD.left+(g-1)/(sonGun-1)*CW, H-8);
  });
}

// ── ÇEYREK ÖZET SAYFASI ──────────────────────────────────────
const CEYREK_AYLAR = {
  'Q1': ['01','02','03'],
  'Q2': ['04','05','06'],
  'Q3': ['07','08','09'],
  'Q4': ['10','11','12'],
};
const CEYREK_LABEL = {'Q1':'1. Çeyrek (Oca-Mar)','Q2':'2. Çeyrek (Nis-Haz)','Q3':'3. Çeyrek','Q4':'4. Çeyrek (Eki-Ara)'};
const CEYREK_RENK  = {'Q1':'#3b82f6','Q2':'#10b981','Q3':'#f97316','Q4':'#8b5cf6'};

function loadButce(){
  // Firebase'den load() ile gelen data içinden çek
  // Bu fonksiyon goPage('ozet') çağrıldığında db.butce varsa inputları doldurur
  const b = db.butce || {};
  ['q1','q2','q3','q4'].forEach(q=>{
    const el = document.getElementById('butce-'+q);
    if(el && b[q] != null) el.value = b[q];
  });
}

function saveButce(){
  const b = {};
  ['q1','q2','q3','q4'].forEach(q=>{ b[q] = parseFloat(document.getElementById('butce-'+q)?.value)||0; });
  db.butce = b;
  save();
  const msg = document.getElementById('butce-save-msg');
  if(msg){ msg.textContent = 'Kaydediliyor...'; setTimeout(()=>msg.textContent='', 2500); }
}

function getCeyrekMetraj(q, yil){
  const ayList = CEYREK_AYLAR[q];
  let toplam=0;
  db.gunluk.forEach(r=>{
    if(!r.tarih) return;
    const [ry,rm]=r.tarih.split('-');
    if(ry===String(yil) && ayList.includes(rm)){
      toplam+=(parseFloat(r.s1)||0)+(parseFloat(r.s2)||0)+(parseFloat(r.s3)||0);
    }
  });
  return toplam;
}

function renderOzetPage(){
  const yil = new Date().getFullYear();
  const butce={};
  ['q1','q2','q3','q4'].forEach(q=>{ butce[q]=parseFloat(document.getElementById('butce-'+q)?.value)||0; });

  // Çeyrek kartları
  const kartWrap=document.getElementById('ceyrek-kartlar');
  if(kartWrap){
    kartWrap.innerHTML=['Q1','Q2','Q3','Q4'].map((q,i)=>{
      const gercek=getCeyrekMetraj(q,yil);
      const hedef=butce['q'+(i+1)];
      const pct=hedef>0?Math.min(100,Math.round(gercek/hedef*100)):0;
      const clr=CEYREK_RENK[q];
      const durum=pct>=100?'var(--green)':pct>=50?'var(--warn)':'var(--text3)';
      return `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);padding:20px;border-top:3px solid ${clr}">
        <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;color:${clr};text-transform:uppercase;margin-bottom:8px">${CEYREK_LABEL[q]}</div>
        <div style="font-family:IBM Plex Mono,monospace;font-size:22px;font-weight:700;color:var(--text);margin-bottom:4px">${gercek.toFixed(1)} <span style="font-size:12px;color:var(--text3)">m</span></div>
        ${hedef>0?`<div style="font-size:11px;color:var(--text3);margin-bottom:8px">Bütçe: ${hedef.toFixed(0)} m</div>
        <div style="background:var(--bg3);border-radius:4px;height:6px;overflow:hidden;margin-bottom:6px">
          <div style="height:100%;width:${pct}%;background:${clr};border-radius:4px;transition:width .4s"></div>
        </div>
        <div style="font-size:11px;color:${durum};font-weight:600">%${pct} tamamlandı</div>`
        :'<div style="font-size:11px;color:var(--text3)">Bütçe girilmedi</div>'}
      </div>`;
    }).join('');
  }

  // Bütçe vs Gerçekleşen SVG bar grafiği
  drawButceGerceklesen(yil, butce);
  drawOzetYillik(yil);
}

// ── Profesyonel SVG bar yardımcısı ──────────────────────────
function _svgChart({W, H, PAD_L=52, PAD_T=16, PAD_B=44, data, maxVal, barW, gap, labels, showVal=true, accent='#3b82f6'}){
  // data: [{x, val, color, label2?}]
  let grid='', yTicks='', bars='';
  const CH = H - PAD_T - PAD_B;
  [0, 0.25, 0.5, 0.75, 1].forEach(r=>{
    const y = PAD_T + CH*(1-r);
    const v = Math.round(maxVal*r);
    grid   += `<line x1="${PAD_L}" y1="${y}" x2="${W-8}" y2="${y}" stroke="var(--bg4)" stroke-width="1"/>`;
    yTicks += `<text x="${PAD_L-6}" y="${y+4}" text-anchor="end" font-size="9" fill="#9ca3af" font-family="IBM Plex Mono,monospace">${v}</text>`;
  });
  data.forEach(d=>{
    const h = Math.max(3, Math.round((d.val/maxVal)*CH));
    const y = PAD_T + CH - h;
    bars += `<rect x="${d.x}" y="${y}" width="${barW}" height="${h}" fill="${d.color}" rx="3"><title>${d.label}: ${d.val.toFixed(1)} m</title></rect>`;
    if(showVal && d.val>0){
      bars += `<text x="${d.x+barW/2}" y="${y-4}" text-anchor="middle" font-size="8.5" fill="${d.color}" font-weight="600" font-family="IBM Plex Mono,monospace">${d.val.toFixed(0)}</text>`;
    }
  });
  const xLabels = labels.map(l=>l.svg).join('');
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${grid}${yTicks}${bars}${xLabels}
  </svg>`;
}

function drawButceGerceklesen(yil, butce){
  const wrap=document.getElementById('butce-gerceklesen-wrap');
  if(!wrap) return;

  const qs=['Q1','Q2','Q3','Q4'];
  const gercekler=qs.map(q=>getCeyrekMetraj(q,yil));
  const hedefler=qs.map((q,i)=>butce['q'+(i+1)]||0);
  const maxVal=Math.max(...gercekler,...hedefler,1);

  const PAD_L=52, PAD_T=16, PAD_B=52, BW=52, GAP=16, GRP_GAP=32;
  const grpW=2*(BW+GAP)+GRP_GAP;
  const W=PAD_L+qs.length*grpW+16;
  const H=PAD_T+180+PAD_B;
  const CH=180;

  let grid='',yTicks='',bars='',xlabels='';
  [0,0.25,0.5,0.75,1].forEach(r=>{
    const y=PAD_T+CH*(1-r);
    grid   +=`<line x1="${PAD_L}" y1="${y}" x2="${W-8}" y2="${y}" stroke="var(--bg4)" stroke-width="1"/>`;
    yTicks +=`<text x="${PAD_L-6}" y="${y+4}" text-anchor="end" font-size="9" fill="#9ca3af" font-family="IBM Plex Mono,monospace">${Math.round(maxVal*r)}</text>`;
  });

  qs.forEach((q,i)=>{
    const gx=PAD_L+i*grpW;
    const clr=CEYREK_RENK[q];
    const G=gercekler[i], HH=hedefler[i];
    const hH=Math.max(3,Math.round((HH/maxVal)*CH));
    const gH=Math.max(3,Math.round((G/maxVal)*CH));

    // Hedef — açık renk
    if(HH>0){
      bars+=`<rect x="${gx}" y="${PAD_T+CH-hH}" width="${BW}" height="${hH}" fill="${clr}" opacity="0.18" rx="3" stroke="${clr}" stroke-width="1" stroke-dasharray="4,3"><title>Bütçe: ${HH.toFixed(0)} m</title></rect>`;
      bars+=`<text x="${gx+BW/2}" y="${PAD_T+CH-hH-4}" text-anchor="middle" font-size="8.5" fill="${clr}" opacity="0.6" font-family="IBM Plex Mono,monospace">${HH.toFixed(0)}</text>`;
    }
    // Gerçekleşen — tam renk
    bars+=`<rect x="${gx+BW+GAP}" y="${PAD_T+CH-gH}" width="${BW}" height="${gH}" fill="${clr}" rx="3"><title>Gerçekleşen: ${G.toFixed(0)} m</title></rect>`;
    if(G>0) bars+=`<text x="${gx+BW+GAP+BW/2}" y="${PAD_T+CH-gH-4}" text-anchor="middle" font-size="8.5" fill="${clr}" font-weight="700" font-family="IBM Plex Mono,monospace">${G.toFixed(0)}</text>`;

    // Karşılaştırma yüzdesi
    const pct=HH>0?Math.round(G/HH*100):null;
    const gcx=gx+BW+GAP/2;
    xlabels+=`<text x="${gcx}" y="${PAD_T+CH+17}" text-anchor="middle" font-size="11" fill="${clr}" font-weight="700">${q}</text>`;
    if(pct!==null) xlabels+=`<text x="${gcx}" y="${PAD_T+CH+32}" text-anchor="middle" font-size="9" fill="${pct>=100?'#059669':pct>=50?'#d97706':'#6b7280'}">%${pct}</text>`;
  });

  const legend=`<div style="display:flex;gap:20px;margin-bottom:14px;font-size:11px;color:#6b7280;flex-wrap:wrap">
    <span style="display:inline-flex;align-items:center;gap:6px"><span style="width:16px;height:10px;border:1.5px dashed #94a3b8;border-radius:2px;display:inline-block"></span>Bütçe</span>
    <span style="display:inline-flex;align-items:center;gap:6px"><span style="width:16px;height:10px;background:#3b82f6;border-radius:2px;display:inline-block"></span>Gerçekleşen</span>
  </div>`;

  wrap.innerHTML=`${legend}<div style="overflow-x:auto"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${grid}${yTicks}${bars}${xlabels}
  </svg></div>`;
}

function drawOzetYillik(yil){
  const wrap=document.getElementById('ozet-yillik-wrap');
  if(!wrap) return;

  const ayAdi=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  const QRENK=['#3b82f6','#3b82f6','#3b82f6','#10b981','#10b981','#10b981','#f97316','#f97316','#f97316','#8b5cf6','#8b5cf6','#8b5cf6'];
  const buAy = `${yil}-${String(new Date().getMonth()+1).padStart(2,'0')}`;

  const aylar=[], totals=[];
  for(let m=1;m<=12;m++){
    const ay=`${yil}-${String(m).padStart(2,'0')}`;
    aylar.push(ay);
    totals.push(db.gunluk.filter(r=>r.tarih&&r.tarih.startsWith(ay)).reduce((s,r)=>s+(parseFloat(r.s1)||0)+(parseFloat(r.s2)||0)+(parseFloat(r.s3)||0),0));
  }

  const maxVal=Math.max(...totals,1);
  const PAD_L=52, PAD_T=16, PAD_B=44, BW=40, GAP=10;
  const W=PAD_L+12*(BW+GAP)+16;
  const H=PAD_T+180+PAD_B;
  const CH=180;

  let grid='',yTicks='',bars='',xlabels='';
  [0,0.25,0.5,0.75,1].forEach(r=>{
    const y=PAD_T+CH*(1-r);
    grid   +=`<line x1="${PAD_L}" y1="${y}" x2="${W-8}" y2="${y}" stroke="var(--bg4)" stroke-width="1"/>`;
    yTicks +=`<text x="${PAD_L-6}" y="${y+4}" text-anchor="end" font-size="9" fill="#9ca3af" font-family="IBM Plex Mono,monospace">${Math.round(maxVal*r)}</text>`;
  });

  aylar.forEach((ay,i)=>{
    const h=Math.max(3,Math.round((totals[i]/maxVal)*CH));
    const x=PAD_L+i*(BW+GAP);
    const cx=x+BW/2;
    const isAktif=ay===buAy;
    const clr=QRENK[i];
    bars+=`<rect x="${x}" y="${PAD_T+CH-h}" width="${BW}" height="${h}" fill="${clr}" opacity="${isAktif?'1':'0.65'}" rx="3"><title>${ayAdi[i]} ${yil}: ${totals[i].toFixed(1)} m</title></rect>`;
    if(totals[i]>0) bars+=`<text x="${cx}" y="${PAD_T+CH-h-4}" text-anchor="middle" font-size="8" fill="${clr}" font-weight="${isAktif?'700':'500'}" font-family="IBM Plex Mono,monospace">${totals[i].toFixed(0)}</text>`;
    xlabels+=`<text x="${cx}" y="${PAD_T+CH+17}" text-anchor="middle" font-size="9.5" fill="${isAktif?clr:'#9ca3af'}" font-weight="${isAktif?'700':'400'}">${ayAdi[i]}</text>`;
  });

  const QLegend=['Q1 (Oca-Mar)','Q2 (Nis-Haz)','Q3 (Tem-Eyl)','Q4 (Eki-Ara)'].map((l,i)=>
    `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:#6b7280"><span style="width:10px;height:10px;border-radius:2px;background:${['#3b82f6','#10b981','#f97316','#8b5cf6'][i]};display:inline-block"></span>${l}</span>`).join('');

  wrap.innerHTML=`<div style="display:flex;gap:16px;margin-bottom:12px;flex-wrap:wrap">${QLegend}</div>
  <div style="overflow-x:auto"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${grid}${yTicks}${bars}${xlabels}
  </svg></div>`;
}

function drawOzetMakCeyrek(yil){
  const wrap=document.getElementById('ozet-mak-ceyrek-wrap');
  if(!wrap) return;

  const qs=['Q1','Q2','Q3','Q4'];
  const mData=MAKINELER.map(m=>({
    m, color:MAKINE_RENK[m]||'#94a3b8',
    vals:qs.map(q=>getCeyrekMetraj(q,yil))
  })).filter(d=>d.vals.some(v=>v>0));

  if(!mData.length){wrap.innerHTML='<p style="color:var(--text3);font-size:12px;padding:16px;text-align:center">Veri yok</p>';return;}

  const allVals=mData.flatMap(d=>d.vals);
  const maxVal=Math.max(...allVals,1);
  const PAD_L=52,PAD_T=16,PAD_B=48,BW=20,GAP=4,GRP_GAP=24;
  const grpW=mData.length*(BW+GAP)+GRP_GAP;
  const W=PAD_L+qs.length*grpW+16;
  const H=PAD_T+180+PAD_B;
  const CH=180;

  let grid='',yTicks='',bars='',xlabels='';
  [0,0.25,0.5,0.75,1].forEach(r=>{
    const y=PAD_T+CH*(1-r);
    grid   +=`<line x1="${PAD_L}" y1="${y}" x2="${W-8}" y2="${y}" stroke="var(--bg4)" stroke-width="1"/>`;
    yTicks +=`<text x="${PAD_L-6}" y="${y+4}" text-anchor="end" font-size="9" fill="#9ca3af" font-family="IBM Plex Mono,monospace">${Math.round(maxVal*r)}</text>`;
  });

  qs.forEach((q,qi)=>{
    const gx=PAD_L+qi*grpW;
    mData.forEach((ds,mi)=>{
      const v=ds.vals[qi];
      const h=Math.max(3,Math.round((v/maxVal)*CH));
      const x=gx+mi*(BW+GAP);
      bars+=`<rect x="${x}" y="${PAD_T+CH-h}" width="${BW}" height="${h}" fill="${ds.color}" rx="3"><title>${ds.m} — ${q}: ${v.toFixed(0)} m</title></rect>`;
      if(v>0&&h>18) bars+=`<text x="${x+BW/2}" y="${PAD_T+CH-h-3}" text-anchor="middle" font-size="7.5" fill="${ds.color}" font-weight="600" font-family="IBM Plex Mono,monospace">${v.toFixed(0)}</text>`;
    });
    const gcx=gx+mData.length*(BW+GAP)/2-GAP/2;
    const clr=CEYREK_RENK[q];
    xlabels+=`<text x="${gcx}" y="${PAD_T+CH+17}" text-anchor="middle" font-size="11" fill="${clr}" font-weight="700">${q}</text>`;
  });

  const legend=mData.map(ds=>`<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:#6b7280"><span style="width:10px;height:10px;border-radius:2px;background:${ds.color};display:inline-block"></span>${ds.m}</span>`).join('');

  wrap.innerHTML=`<div style="display:flex;gap:14px;margin-bottom:12px;flex-wrap:wrap">${legend}</div>
  <div style="overflow-x:auto"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${grid}${yTicks}${bars}${xlabels}
  </svg></div>`;
}


function renderUyarilar(){
  const wrap = document.getElementById('uyari-listesi');
  if(!wrap) return;
  const uyarilar = [];

  db.kuyular.filter(k=>isAktifKuyu(k)).forEach(k=>{
    const plan    = parseFloat(k.der)||0;
    const guncel  = parseFloat(k.guncel)||0;
    if(plan > 0 && guncel > 0){
      const pct = guncel / plan * 100;
      if(guncel >= plan){
        uyarilar.push({tip:'kirmizi', ikon:'⚠', mesaj:`<strong>${k.no}</strong> güncel metraj (${guncel.toFixed(2)} m) planlanan derinliğe (${plan.toFixed(2)} m) ulaştı veya aştı`});
      } else if(pct >= 90){
        uyarilar.push({tip:'kirmizi', ikon:'⚠', mesaj:`<strong>${k.no}</strong> planlanan derinliğe <strong>${(plan-guncel).toFixed(2)} m</strong> kaldı (%${Math.round(pct)})`});
      } else if(pct >= 75){
        uyarilar.push({tip:'sari', ikon:'⚡', mesaj:`<strong>${k.no}</strong> planlanan derinliğin %${Math.round(pct)}'inde (${guncel.toFixed(2)} / ${plan.toFixed(2)} m)`});
      }
    }
  });

  // Uzun süreli duraklama uyarısı
  const ayDurak = db.duraklamalar.filter(d=>ayFiltre(d.tarih));
  MAKINELER.forEach(m=>{
    const mDur = ayDurak.filter(d=>d.makine===m).reduce((s,d)=>s+(parseFloat(d.dk)||0),0);
    if(mDur>480) uyarilar.push({tip:'sari', ikon:'🔧', mesaj:`<strong>${m}</strong> bu ay toplam <strong>${mDur} dk</strong> (${(mDur/60).toFixed(2)} sa) durakladı`});
  });

  if(!uyarilar.length){
    wrap.innerHTML = `<div style="background:rgba(39,174,96,.06);border:1px solid rgba(39,174,96,.15);border-radius:var(--r);padding:12px 16px;font-size:12px;color:var(--green)">✓ Aktif uyarı yok</div>`;
    return;
  }

  wrap.innerHTML = uyarilar.map(u=>{
    const bg = u.tip==='kirmizi'?'rgba(224,82,82,.08)':'rgba(243,156,18,.08)';
    const border = u.tip==='kirmizi'?'rgba(224,82,82,.2)':'rgba(243,156,18,.2)';
    const color = u.tip==='kirmizi'?'var(--red)':'var(--warn)';
    return `<div style="background:${bg};border:1px solid ${border};border-radius:var(--r);padding:12px 16px;font-size:12px;color:${color};margin-bottom:6px">
      ${u.ikon} ${u.mesaj}
    </div>`;
  }).join('');
}

// ── ÖZELLİK 3: KUYU GEÇMİŞİ MODAL ──────────────────────────
function kuyuGecmisi(kuyuNo){
  const k = db.kuyular.find(x=>x.no===kuyuNo);
  if(!k) return;
  const recs = db.gunluk.filter(r => r.sondaj && r.sondaj.split('/').map(s=>s.trim()).includes(kuyuNo))
    .sort((a,b)=>a.tarih>b.tarih?1:-1);
  let kumMet = 0;
  const satirlar = recs.map(r=>{
    const gun=(parseFloat(r.s1)||0)+(parseFloat(r.s2)||0)+(parseFloat(r.s3)||0);
    kumMet+=gun;
    return `<tr>
      <td><span class="dv">${fmtDate(r.tarih)}</span></td>
      <td class="c nv">${r.s1||'—'}</td>
      <td class="c nv">${r.s2||'—'}</td>
      <td class="c nv">${r.s3||'—'}</td>
      <td class="c"><span class="nv g">${gun.toFixed(2)}</span></td>
      <td class="c nv gold">${kumMet.toFixed(2)}</td>
    </tr>`;
  }).join('');

  const bk = hesapBitisKotu(k.z, k.eg, kumMet);
  const modal = document.getElementById('kuyu-gecmis-modal');
  document.getElementById('kg-title').textContent = kuyuNo + ' · Kuyu Geçmişi';
  document.getElementById('kg-ozet').innerHTML = `
    <div class="stat-row" style="margin-bottom:12px">
      <div class="sc"><div class="sc-lbl">Makine</div><div class="sc-val" style="font-size:14px">${k.makine}</div></div>
      <div class="sc"><div class="sc-lbl">Toplam Delgi</div><div class="sc-val green">${kumMet.toFixed(2)} <span>m</span></div></div>
      <div class="sc"><div class="sc-lbl">Planlanan</div><div class="sc-val">${k.der||'—'} <span>m</span></div></div>
      <div class="sc"><div class="sc-lbl">Bitiş Kotu</div><div class="sc-val gold">${bk||'—'} <span>m</span></div></div>
    </div>`;
  document.getElementById('kg-tbody').innerHTML = satirlar || `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3)">Vardiya kaydı yok</td></tr>`;
  modal.classList.add('open');
}

function closeKuyuGecmis(){ document.getElementById('kuyu-gecmis-modal').classList.remove('open'); }
function indir(csv, dosyaAdi){
  const blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = dosyaAdi;
  a.click();
}

function exportAylikRapor(){
  const ayLbl = document.getElementById('sel-ay');
  const ayAdi = ayLbl.options[ayLbl.selectedIndex].text;
  const ayRecs  = db.gunluk.filter(r => ayFiltre(r.tarih));
  const ayDurak = db.duraklamalar.filter(d => ayFiltre(d.tarih));
  let toplamDelgi = 0;
  ayRecs.forEach(r => { toplamDelgi += (parseFloat(r.s1)||0)+(parseFloat(r.s2)||0)+(parseFloat(r.s3)||0); });
  const topDurak = ayDurak.reduce((s,d)=>s+(parseFloat(d.dk)||0),0);
  let csv = `GÜMÜŞTAŞ MADENCİLİK · BOLKAR İŞLETMESİ\nAYLIK SONDAJ RAPORU · ${ayAdi}\nRapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}\n\n`;
  csv += `ÖZET\nToplam Delgi (m),${toplamDelgi.toFixed(2)}\nAktif Kuyu,${db.kuyular.filter(k=>isAktifKuyu(k)).length}\nTamamlanan Kuyu,${db.kuyular.filter(k=>!isAktifKuyu(k)).length}\nToplam Duraklama (dk),${topDurak}\nToplam Duraklama (sa),${(topDurak/60).toFixed(2)}\n\n`;
  csv += `MAKİNE BAZLI PERFORMANS\nMakine,Aktif Kuyu,Aylık Delgi (m),Duraklama (dk)\n`;
  MAKINELER.forEach(m => {
    const mTop = makineAyMetraj(m, aktifAy);
    const mDur = ayDurak.filter(d=>d.makine===m).reduce((s,d)=>s+(parseFloat(d.dk)||0),0);
    const ak = ayMakineAktifKuyu(m);
    csv += `${m},${ak?ak.no:'—'},${mTop.toFixed(2)},${mDur}\n`;
  });
  csv += `\nGÜNLÜK DELGİ\nMakine,Tarih,Sondaj Adı,Lokasyon,00:00-08:00,08:00-16:00,16:00-00:00,Toplam (m),Depth (m)\n`;
  ayRecs.sort((a,b)=>a.tarih>b.tarih?1:-1).forEach(r => {
    csv += `${r.makine},${r.tarih},"${r.sondaj||''}","${r.Lokasyon||''}",${r.s1||''},${r.s2||''},${r.s3||''},${((r.s1||0)+(r.s2||0)+(r.s3||0)).toFixed(2)},"${r.depth||''}"\n`;
  });
  csv += `\nDURAKLAMALAR\nMakine,Tarih,Sondaj No,Neden,Açıklama,Süre (dk)\n`;
  ayDurak.sort((a,b)=>a.tarih>b.tarih?1:-1).forEach(d => {
    csv += `${d.makine},${d.tarih},"${d.sondaj||''}","${d.neden||''}","${d.aciklama||''}",${d.dk||0}\n`;
  });
  indir(csv, `Aylik_Rapor_${aktifAy}.csv`);
}

function exportGunlukOzet(){
  const ayLbl = document.getElementById('sel-ay');
  const ayAdi = ayLbl.options[ayLbl.selectedIndex].text;
  const ayRecs = db.gunluk.filter(r => ayFiltre(r.tarih));
  const tarihler = [...new Set(ayRecs.map(r=>r.tarih))].sort();
  let csv = `GÜMÜŞTAŞ MADENCİLİK · BOLKAR İŞLETMESİ\nGÜNLÜK İLERLEME ÖZETİ · ${ayAdi}\n\n`;
  csv += `Tarih,${MAKINELER.join(',')},Günlük Toplam (m)\n`;
  tarihler.forEach(t => {
    let gunTop = 0;
    const cols = MAKINELER.map(m => {
      const rec = ayRecs.find(r=>r.makine===m && r.tarih===t);
      const val = rec ? (parseFloat(rec.s1)||0)+(parseFloat(rec.s2)||0)+(parseFloat(rec.s3)||0) : 0;
      gunTop += val;
      return val > 0 ? val.toFixed(2) : '';
    });
    csv += `${t},${cols.join(',')},${gunTop.toFixed(2)}\n`;
  });
  let genTop = 0;
  const totals = MAKINELER.map(m => { const t=makineAyMetraj(m,aktifAy); genTop+=t; return t.toFixed(2); });
  csv += `TOPLAM,${totals.join(',')},${genTop.toFixed(2)}\n`;
  indir(csv, `Gunluk_Ozet_${aktifAy}.csv`);
}

function exportKuyuFormu(){
  const ayLbl = document.getElementById('sel-ay');
  const ayAdi = ayLbl.options[ayLbl.selectedIndex].text;
  const kuyular = db.kuyular.filter(k => (k.bas && k.bas.startsWith(aktifAy)) || isAktifKuyu(k));
  let csv = `GÜMÜŞTAŞ MADENCİLİK · BOLKAR İŞLETMESİ\nKUYU TEKNİK VERİ FORMU · ${ayAdi}\n\n`;
  csv += `Kuyu No,Makine,Saha,Mevkii,Başlangıç,Bitiş,Azimut (°),Eğim (°),Planlanan (m),Toplam Delgi (m),Bitiş Kotu (m),Yer Su (m),Su Basıncı (Bar),Durum\n`;
  kuyular.forEach(k => {
    const met = aktifMetraj(k.no);
    const bk = hesapBitisKotu(k.z, k.eg, isAktifKuyu(k) ? met : k.der) || '';
    csv += `${k.no},${k.makine},"${k.saha||''}","${k.mevkii||''}",${k.bas||''},${k.bit||''},${k.az||''},${k.eg||''},${k.der||''},${met.toFixed(2)},${bk},${k.su||''},${k.bar||''},${isAktifKuyu(k)?'Aktif':'Tamamlandı'}\n`;
  });
  indir(csv, `Kuyu_Formu_${aktifAy}.csv`);
}

// ── ŞİFRE KORUMASI ──────────────────────────────────────────
const PWD = 'AramaAAK';
let isAuth = false;
let authExpiry = 0;
let pendingAction = null;

function requireAuth(action){
  if(isAuth && Date.now() < authExpiry){ action(); return; }
  isAuth = false;
  pendingAction = action;
  const el = document.getElementById('pwd-inp');
  const err = document.getElementById('pwd-err');
  el.value = ''; el.classList.remove('error');
  err.textContent = '';
  document.getElementById('pwd-overlay').classList.add('open');
  setTimeout(()=>el.focus(), 100);
}

function checkPwd(){
  const el = document.getElementById('pwd-inp');
  const err = document.getElementById('pwd-err');
  if(el.value === PWD){
    isAuth = true;
    authExpiry = Date.now() + 10 * 60 * 1000; // 10 dakika
    document.getElementById('pwd-overlay').classList.remove('open');
    if(pendingAction){ pendingAction(); pendingAction = null; }
  } else {
    el.classList.add('error');
    err.textContent = 'Şifre yanlış';
    el.value = '';
    setTimeout(()=>el.classList.remove('error'), 400);
  }
}

document.getElementById('pwd-inp').addEventListener('keydown', e=>{
  if(e.key==='Enter') checkPwd();
  if(e.key==='Escape') document.getElementById('pwd-overlay').classList.remove('open');
});

// ── KORUNAN FONKSİYONLAR ────────────────────────────────────
const _openKuyu = openKuyu;
openKuyu = ()=> requireAuth(_openKuyu);

const _editKuyu = editKuyu;
editKuyu = (id)=> requireAuth(()=>_editKuyu(id));

const _delKuyu = delKuyu;
delKuyu = (id)=> requireAuth(()=>_delKuyu(id));

const _openVar = openVar;
openVar = (m)=> requireAuth(()=>_openVar(m));

const _openDurak = openDurak;
openDurak = ()=> requireAuth(_openDurak);

const _editVar = editVar;
window.editVar = (id)=> requireAuth(()=>_editVar(id));
const _editDurak = editDurak;
window.editDurak = (id)=> requireAuth(()=>_editDurak(id));

const _delGunluk = delGunluk;
delGunluk = (id)=> requireAuth(()=>_delGunluk(id));

const _delDurak = delDurak;
delDurak = (id)=> requireAuth(()=>_delDurak(id));

const _yeniAyBaslat = yeniAyBaslat;
yeniAyBaslat = ()=> requireAuth(_yeniAyBaslat);
function exportAy(){
  const ayLbl = document.getElementById('sel-ay');
  const ayAdi = ayLbl.options[ayLbl.selectedIndex].text;
  const ayRecs = db.gunluk.filter(r=>ayFiltre(r.tarih));
  const ayDurak = db.duraklamalar.filter(d=>ayFiltre(d.tarih));

  let csv = `GÜMÜŞTAŞ MADENCİLİK · DDH TAKİP · ${ayAdi} Export\n\n`;
  csv += `GÜNLÜK DELGİ KAYITLARI\n`;
  csv += `Makine,Tarih,Vardiya,Kuyu No,İlerleme (m),Not\n`;
  ayRecs.forEach(r=>{
    (r.kuyular||[]).forEach(k=>{
      csv += `${r.makine},${r.tarih},${VRD_LABEL[r.vardiya]||''},${k.no},${k.ilerleme||0},"${(k.not||r.not||'').replace(/"/g,'""')}"\n`;
    });
  });

  csv += `\nDURAKLAMA KAYITLARI\n`;
  csv += `Makine,Tarih,Vardiya,Sondaj No,Neden,Süre (dk)\n`;
  ayDurak.forEach(d=>{
    csv += `${d.makine},${d.tarih},${VRD_LABEL[d.vardiya]||''},${d.sondaj||''},${d.neden||''},${d.dk||0}\n`;
  });

  const blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `DDH_Takip_${aktifAy}.csv`;
  a.click();
}

// ── YENİ AY BAŞLAT ──────────────────────────────────────────
function yeniAyBaslat(){
  const sel = document.getElementById('sel-ay');
  const curr = sel.value;
  const [yil, ay] = curr.split('-').map(Number);
  let yeniYil = yil, yeniAy = ay + 1;
  if(yeniAy > 12){ yeniAy = 1; yeniYil++; }
  const yeniAyStr = `${yeniYil}-${String(yeniAy).padStart(2,'0')}`;
  const ayAdlari = ['','Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                    'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const yeniAyAdi = `${ayAdlari[yeniAy]} ${yeniYil}`;

  if(!confirm(
    `Yeni ay başlatılacak: ${yeniAyAdi}\n\n` +
    `✓ Yeraltı kuyuları korunacak\n` +
    `✗ Günlük delgi kayıtları temizlenecek\n` +
    `✗ Duraklama kayıtları temizlenecek\n\n` +
    `Önce mevcut ay export edilecek. Devam?`
  )) return;

  exportAy();
  db.gunluk = [];
  db.duraklamalar = [];

  // Seçicide yeni ay yoksa ekle
  let found = false;
  for(let opt of sel.options){ if(opt.value===yeniAyStr){ found=true; break; } }
  if(!found){
    const opt = document.createElement('option');
    opt.value = yeniAyStr;
    opt.textContent = yeniAyAdi;
    sel.insertBefore(opt, sel.firstChild);
  }
  sel.value = yeniAyStr;
  aktifAy = yeniAyStr;

  save();
  document.getElementById('mak-pages').innerHTML = '';
  renderAll();
}

// ── RENDER ALL ──────────────────────────────────────────────
function renderAll(){
  initFiltreBtnLabels();
  renderDash();
  renderKuyular();
  renderVardiyaPerf();
  if(document.getElementById('page-gunluk').classList.contains('active')){
    buildMakPages(); renderMak(aktifMakine);
  }
  if(document.getElementById('page-durak').classList.contains('active')) renderDurak();
}

// ── KLAVYE ──────────────────────────────────────────────────
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){ closeKuyu(); closeVar(); closeDurak(); }
});

// module scope → global (onclick için)
window.goPage       = goPage;
window.goMak        = goMak;
window.goMakTumu    = goMakTumu;
window.toggleDropdown = toggleDropdown;
window.seciAy       = seciAy;
window.seciHafta    = seciHafta;
window.seciGun      = seciGun;
window.kuyuGecmisi    = kuyuGecmisi;
window.closeKuyuGecmis = closeKuyuGecmis;
window.checkPwd       = checkPwd;
window.girisYap       = girisYap;
window.cikisYap       = cikisYap;
window.openKuyu     = openKuyu;
window.editKuyu     = editKuyu;
window.closeKuyu    = closeKuyu;
window.saveKuyu     = saveKuyu;
window.delKuyu      = delKuyu;
window.openVar      = openVar;
window.closeVar     = closeVar;
window.saveVar      = saveVar;
window.updateKuyuDegisimPanel = updateKuyuDegisimPanel;
window.applyKuyuDegisimDagitim = applyKuyuDegisimDagitim;
window.updateKuyuDegisimTotals = updateKuyuDegisimTotals;
window.delGunluk    = delGunluk;
window.openDurak    = openDurak;
window.closeDurak   = closeDurak;
window.saveDurak    = saveDurak;
window.delDurak     = delDurak;
window.renderKuyular = renderKuyular;
window.sortKuyular   = sortKuyular;
window.exportAy         = exportAy;
window.exportAylikRapor = exportAylikRapor;
window.exportGunlukOzet = exportGunlukOzet;
window.exportKuyuFormu  = exportKuyuFormu;
window.yeniAyBaslat     = yeniAyBaslat;
window.ayDegis      = ayDegis;
window.autoSaha     = autoSaha;
window.saveButce    = saveButce;
window.renderOzetPage = renderOzetPage;

// ── INIT ────────────────────────────────────────────────────
// Preloaded data moved to js/data.js


// Her açılışta import verisini yükle (localStorage'ı geç)
db.kuyular = PRELOADED_KUYULAR;
normalizeDbMakineAdlari();
db.gunluk  = PRELOADED_GUNLUK;
normalizeDbMakineAdlari();
nextId = PRELOADED_NEXTID;
ensureNextId();

// Auth durumunu dinle
db.kuyular = PRELOADED_KUYULAR;
normalizeDbMakineAdlari();
ensureNextId();
// sel-ay artık header'dan kaldırıldı; aktifAy ve seciliAy değişkenlerle yönetiliyor
window.aktifMakine = 'GS-200';

onAuthStateChanged(fbAuth, (user) => {
  if(user){
    // Giriş yapıldı
    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('auth-user').textContent = user.email;
    load();
  } else {
    // Çıkış yapıldı
    document.getElementById('auth-overlay').style.display = 'flex';
  }
});

// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// SONDAJ ANİMASYON MOTORU v2 — Canvas Tabanlı, Profesyonel
// ══════════════════════════════════════════════════════════════

const MAKINE_RENKLER_V2 = {
  'GS-200':       '#0071e3',
  'DBC-U6':       '#1a8c45',
  'BATUHAN-600X': '#bf8700',
  'GS-600':       '#6e3ab0',
  'BDU-600':      '#cc0000',
};

// ── CANVAS DRAWING v3 — HIGH DPI ────────────────────────────────
const DDH_W = 110, DDH_H = 125;  // CSS display size
const DDH_DPR = Math.min(window.devicePixelRatio || 2, 3);

function ddh_setupCanvas(canvas) {
  if (canvas._ddhSetup) return;
  canvas._ddhSetup = true;
  canvas.width  = DDH_W * DDH_DPR;
  canvas.height = DDH_H * DDH_DPR;
  canvas.style.width  = DDH_W + 'px';
  canvas.style.height = DDH_H + 'px';
  canvas.style.imageRendering = 'auto';
}

function ddh_roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);
  ctx.arcTo(x+w, y, x+w, y+r, r);
  ctx.lineTo(x+w, y+h-r);
  ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
  ctx.lineTo(x+r, y+h);
  ctx.arcTo(x, y+h, x, y+h-r, r);
  ctx.lineTo(x, y+r);
  ctx.arcTo(x, y, x+r, y, r);
  ctx.closePath();
}

function ddh_drawRig(ctx, rigColor, durum, t) {
  const W = DDH_W, H = DDH_H;
  const PI = Math.PI;
  const dpr = DDH_DPR;

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const isAktif = durum === 'aktif';
  const isDurak = durum === 'durak';
  const c = rigColor;

  // ── ZEMIN ───────────────────────────────────────────
  // Zemin gradyanı
  const grd = ctx.createLinearGradient(0, 97, 0, H);
  grd.addColorStop(0, 'rgba(101,92,80,0.25)');
  grd.addColorStop(1, 'rgba(80,72,62,0.12)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 97, W, H - 97);

  // Zemin çizgisi
  ctx.strokeStyle = 'rgba(120,108,90,0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(0, 97); ctx.lineTo(W, 97); ctx.stroke();

  // Zemin tarama çizgileri
  ctx.strokeStyle = 'rgba(100,88,70,0.15)';
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 4; i++) {
    const yy = 101 + i * 5;
    ctx.beginPath(); ctx.moveTo(8, yy); ctx.lineTo(W-8, yy); ctx.stroke();
  }

  // ── KUYU DELİĞİ ─────────────────────────────────────
  const dashOff = isAktif ? -(t * 10 % 14) : 0;
  ctx.save();
  ctx.strokeStyle = 'rgba(70,60,48,0.55)';
  ctx.lineWidth = 3.5;
  ctx.setLineDash([5, 3.5]);
  ctx.lineDashOffset = dashOff;
  ctx.beginPath(); ctx.moveTo(55, 97); ctx.lineTo(55, H - 3); ctx.stroke();
  ctx.setLineDash([]);
  // Kuyu ağzı halka
  ctx.strokeStyle = 'rgba(100,90,75,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(55, 97, 6, 2.5, 0, 0, PI*2); ctx.stroke();
  ctx.restore();

  // ── PALET/CRAWLER TABAN ─────────────────────────────
  // Alt sac
  ctx.fillStyle = 'rgba(55,60,75,0.92)';
  ddh_roundRect(ctx, 10, 81, 90, 14, 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,130,155,0.25)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Palet dişleri — sol sıra
  const padW = 9, padH = 7, padGap = 1.5;
  const padCount = 7;
  ctx.fillStyle = 'rgba(30,35,48,0.88)';
  for (let i = 0; i < padCount; i++) {
    const px = 12 + i * (padW + padGap);
    ddh_roundRect(ctx, px, 83, padW, padH, 1.5);
    ctx.fill();
    // pad glare
    ctx.fillStyle = 'rgba(200,210,230,0.06)';
    ctx.fillRect(px + 1, 83, padW - 2, 2);
    ctx.fillStyle = 'rgba(30,35,48,0.88)';
  }

  // Çark / tahrik silindiri (her iki uçta)
  [13, 87].forEach(cx2 => {
    ctx.fillStyle = 'rgba(70,78,100,0.9)';
    ctx.beginPath(); ctx.arc(cx2, 88, 5.5, 0, PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(140,150,175,0.3)'; ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.fillStyle = 'rgba(140,150,180,0.35)';
    ctx.beginPath(); ctx.arc(cx2, 88, 2, 0, PI*2); ctx.fill();
  });

  // ── MAKİNE GÖVDESİ ───────────────────────────────────
  // Ana gövde
  const bodyGrd = ctx.createLinearGradient(22, 48, 22, 81);
  bodyGrd.addColorStop(0, 'rgba(88,95,118,0.95)');
  bodyGrd.addColorStop(1, 'rgba(65,72,92,0.95)');
  ctx.fillStyle = bodyGrd;
  ddh_roundRect(ctx, 22, 48, 68, 33, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,170,200,0.18)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Üst kenar highlight
  ctx.strokeStyle = 'rgba(210,218,240,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(29, 48.5); ctx.lineTo(83, 48.5);
  ctx.stroke();

  // Kabin camı
  ctx.fillStyle = 'rgba(20,28,55,0.82)';
  ddh_roundRect(ctx, 25, 52, 22, 14, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(100,140,220,0.3)'; ctx.lineWidth = 0.6; ctx.stroke();
  // Cam parlaması
  ctx.fillStyle = 'rgba(200,225,255,0.1)';
  ctx.beginPath();
  ctx.moveTo(26, 53); ctx.lineTo(38, 53); ctx.lineTo(26, 61); ctx.closePath();
  ctx.fill();
  // Cam çerçeve
  ctx.strokeStyle = 'rgba(80,110,180,0.25)'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(36, 52.5); ctx.lineTo(36, 65.5); ctx.stroke();

  // Aksanlı panel (renk)
  ctx.fillStyle = c; ctx.globalAlpha = 0.7;
  ddh_roundRect(ctx, 52, 52, 20, 10, 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // Panel highlight
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(53, 52.5, 18, 2);

  // Motor havalandırma ızgarası
  ctx.strokeStyle = 'rgba(160,168,195,0.35)';
  ctx.lineWidth = 0.75;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(75, 54 + i*3.5); ctx.lineTo(87, 54 + i*3.5); ctx.stroke();
  }
  // Egzoz borusu
  ctx.fillStyle = 'rgba(60,65,80,0.8)';
  ddh_roundRect(ctx, 83, 44, 5, 10, 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,148,170,0.2)'; ctx.lineWidth = 0.6; ctx.stroke();

  // ── KULE / MAST ───────────────────────────────────────
  ctx.save();
  ctx.lineCap = 'round';

  // Ana bacaklar - şerit gölge
  ctx.strokeStyle = 'rgba(60,68,88,0.4)';
  ctx.lineWidth = 4.5;
  ctx.beginPath(); ctx.moveTo(47.5, 5); ctx.lineTo(38.5, 50); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(62.5, 5); ctx.lineTo(71.5, 50); ctx.stroke();

  // Ana bacaklar
  ctx.strokeStyle = 'rgba(110,118,145,0.92)';
  ctx.lineWidth = 2.8;
  ctx.beginPath(); ctx.moveTo(47, 5); ctx.lineTo(38, 50); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(63, 5); ctx.lineTo(72, 50); ctx.stroke();

  // Yatay payandalar
  const braceYs = [43, 32, 19];
  braceYs.forEach((by, idx) => {
    const frac = (by - 5) / 45;
    const lx = 47 - 9 * frac;
    const rx = 63 + 9 * frac;
    // Gölge
    ctx.strokeStyle = 'rgba(60,68,88,0.3)';
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(lx, by + 0.5); ctx.lineTo(rx, by + 0.5); ctx.stroke();
    // Asıl çizgi
    ctx.strokeStyle = 'rgba(130,138,165,0.75)';
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(lx, by); ctx.lineTo(rx, by); ctx.stroke();

    // Çapraz payanda (X şeklinde)
    ctx.strokeStyle = 'rgba(130,138,165,0.28)';
    ctx.lineWidth = 0.7;
    if (idx < 2) {
      const by2 = braceYs[idx + 1];
      const frac2 = (by2 - 5) / 45;
      const lx2 = 47 - 9 * frac2;
      const rx2 = 63 + 9 * frac2;
      ctx.beginPath(); ctx.moveTo(lx, by); ctx.lineTo(rx2, by2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rx, by); ctx.lineTo(lx2, by2); ctx.stroke();
    }
  });

  // Kule uç üçgeni
  ctx.fillStyle = c;
  ctx.beginPath(); ctx.moveTo(55, 2); ctx.lineTo(50, 9); ctx.lineTo(60, 9); ctx.closePath();
  ctx.fill();
  // Üçgen kenar highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 0.7;
  ctx.stroke();

  // Beacon ışığı (aktif: titriyor)
  if (isAktif) {
    const bAlpha = 0.5 + Math.sin(t * 3.5) * 0.4;
    ctx.fillStyle = '#fbbf24';
    ctx.globalAlpha = bAlpha;
    ctx.beginPath(); ctx.arc(55, 2.5, 3, 0, PI*2); ctx.fill();
    // Halo
    ctx.globalAlpha = bAlpha * 0.2;
    ctx.beginPath(); ctx.arc(55, 2.5, 7, 0, PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = 'rgba(180,180,185,0.3)';
    ctx.beginPath(); ctx.arc(55, 2.5, 2.5, 0, PI*2); ctx.fill();
  }

  ctx.restore();

  // ── HALAT / KABLO ─────────────────────────────────────
  ctx.save();
  ctx.strokeStyle = 'rgba(130,138,160,0.4)';
  ctx.lineWidth = 0.9;
  ctx.setLineDash([3.5, 2.5]);
  ctx.beginPath(); ctx.moveTo(55, 9); ctx.lineTo(55, 50); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // ── ROTARY HEAD ───────────────────────────────────────
  ctx.save();
  ctx.translate(55, 50);
  const rotAngle = isAktif ? t * 4.8 : (isDurak ? Math.sin(t * 0.7) * 0.06 : 0);
  ctx.rotate(rotAngle);

  // Dış gölge
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 4;

  // Dış halka
  ctx.strokeStyle = c;
  ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, PI*2); ctx.stroke();
  ctx.shadowBlur = 0;

  // İç disk
  ctx.fillStyle = 'rgba(35,40,55,0.9)';
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, PI*2); ctx.fill();

  // Haç
  ctx.strokeStyle = c;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(0, 7); ctx.stroke();

  // Merkez nokta
  ctx.fillStyle = '#fff';
  ctx.globalAlpha = 0.8;
  ctx.beginPath(); ctx.arc(0, 0, 2, 0, PI*2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  // ── SONDAJ ÇUBUĞU (Drill String) ─────────────────────
  const bY = isAktif ? Math.sin(t * 5.8) * 2 : 0;
  ctx.save();

  // Gölge
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = 1;

  // Ana çubuk
  const rodGrd = ctx.createLinearGradient(52, 0, 58, 0);
  rodGrd.addColorStop(0, 'rgba(35,42,58,0.95)');
  rodGrd.addColorStop(0.4, 'rgba(75,82,105,0.9)');
  rodGrd.addColorStop(1, 'rgba(35,42,58,0.95)');
  ctx.fillStyle = rodGrd;
  ddh_roundRect(ctx, 52, 57 + bY, 6, 42, 3);
  ctx.fill();
  ctx.shadowBlur = 0; ctx.shadowOffsetX = 0;

  // Eklemler (boru bağlantıları)
  [68, 82].forEach(jy => {
    const jGrd = ctx.createLinearGradient(50, 0, 60, 0);
    jGrd.addColorStop(0, 'rgba(70,80,108,0.9)');
    jGrd.addColorStop(0.5, 'rgba(120,130,160,0.85)');
    jGrd.addColorStop(1, 'rgba(70,80,108,0.9)');
    ctx.fillStyle = jGrd;
    ddh_roundRect(ctx, 49.5, jy + bY, 11, 5, 2.5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(180,190,220,0.15)'; ctx.lineWidth = 0.5; ctx.stroke();
    // Eklem çizgisi
    ctx.strokeStyle = 'rgba(100,110,140,0.4)'; ctx.lineWidth = 0.4;
    ctx.beginPath(); ctx.moveTo(49.5, jy + bY + 2.5); ctx.lineTo(60.5, jy + bY + 2.5); ctx.stroke();
  });

  ctx.restore();

  // ── TRİCONE MATKAP UCU ───────────────────────────────
  ctx.save();
  ctx.translate(55, 97 + bY);
  const bitRot = isAktif ? t * 6 : 0;
  ctx.rotate(bitRot);

  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 5;

  // Dış koni gövdesi
  const bitColor = isAktif ? '#ef4444' : 'rgba(100,108,128,0.8)';
  const bitDark  = isAktif ? '#b91c1c' : 'rgba(70,78,98,0.8)';
  ctx.fillStyle = bitColor;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.bezierCurveTo(-4, -4, -7, 0, -5, 9);
  ctx.lineTo(5, 9);
  ctx.bezierCurveTo(7, 0, 4, -4, 0, -8);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;

  // İç koni (daha koyu)
  ctx.fillStyle = bitDark;
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.bezierCurveTo(-2.5, -2, -4.5, 2, -3, 8);
  ctx.lineTo(3, 8);
  ctx.bezierCurveTo(4.5, 2, 2.5, -2, 0, -6);
  ctx.closePath();
  ctx.fill();

  // Kesme dişleri
  if (isAktif) {
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 0.8;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-5.5, -1); ctx.lineTo(-3, 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -7.5); ctx.lineTo(0, 8.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5.5, -1); ctx.lineTo(3, 8); ctx.stroke();
    // Yatay kesme çizgileri
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 0.5;
    [-3, 1, 5].forEach(ry => {
      ctx.beginPath(); ctx.moveTo(-5, ry); ctx.lineTo(5, ry); ctx.stroke();
    });
  }

  // Üst bağlantı flanşı
  ctx.fillStyle = isAktif ? 'rgba(180,50,50,0.9)' : 'rgba(90,95,118,0.8)';
  ddh_roundRect(ctx, -5, -10, 10, 4, 2);
  ctx.fill();

  ctx.restore();

  // ── DELME EFEKTLERİ (sadece aktif) ───────────────────
  if (isAktif) {
    // Zemin tozu — çoklu katman
    const dustT = t * 1.6;
    const dustR1 = 9 + Math.sin(dustT) * 3.5;
    const dustR2 = 14 + Math.sin(dustT * 0.7 + 1) * 4;
    const dustA1 = (Math.sin(dustT * 1.3) + 1) / 2 * 0.28 + 0.05;
    const dustA2 = (Math.cos(dustT * 0.9) + 1) / 2 * 0.15 + 0.02;

    ctx.save();
    // İç toz
    ctx.fillStyle = `rgba(175,158,130,${dustA1})`;
    ctx.beginPath(); ctx.ellipse(55, 97, dustR1, dustR1 * 0.4, 0, 0, PI*2); ctx.fill();
    // Dış toz
    ctx.fillStyle = `rgba(150,135,110,${dustA2})`;
    ctx.beginPath(); ctx.ellipse(55, 97, dustR2, dustR2 * 0.35, 0, 0, PI*2); ctx.fill();
    ctx.restore();

    // Kaya kırıntıları — 3 parçacık
    const chips = [
      { phase: t * 1.9,     dx: -1,  dy: -1.1, r: 2.5 },
      { phase: t * 1.5+1.2, dx:  1,  dy: -1.2, r: 1.8 },
      { phase: t * 2.2+0.7, dx: -0.7, dy: -0.8, r: 1.5 },
    ];
    chips.forEach(ch => {
      const p = (ch.phase % (PI * 2));
      const progress = (Math.abs(Math.sin(p)) );
      const cx2 = 55 + ch.dx * progress * 14;
      const cy2 = 97 + ch.dy * progress * 12;
      const alpha = (1 - progress) * 0.7;
      if (alpha > 0.05) {
        ctx.fillStyle = `rgba(115,100,80,${alpha})`;
        ctx.beginPath(); ctx.arc(cx2, cy2, ch.r * (0.5 + progress * 0.5), 0, PI*2); ctx.fill();
      }
    });

    // Boru titreşim ışıması (subtle glow around drill string)
    const glowA = (Math.sin(t * 5.8) + 1) / 2 * 0.12;
    ctx.save();
    ctx.strokeStyle = `rgba(${parseInt(c.slice(1,3),16)},${parseInt(c.slice(3,5),16)},${parseInt(c.slice(5,7),16)},${glowA})`;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(55, 60 + bY); ctx.lineTo(55, 95 + bY); ctx.stroke();
    ctx.restore();
  }

  // ── DURAK İKONU ──────────────────────────────────────
  if (isDurak) {
    ctx.save();
    // Arka plan
    ctx.fillStyle = 'rgba(178,80,0,0.14)';
    ctx.beginPath(); ctx.arc(84, 20, 11, 0, PI*2); ctx.fill();
    ctx.strokeStyle = '#b25000'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(84, 20, 11, 0, PI*2); ctx.stroke();
    // Pause çubukları
    ctx.fillStyle = '#b25000';
    ddh_roundRect(ctx, 80.5, 14, 3.5, 12, 1.5); ctx.fill();
    ddh_roundRect(ctx, 86, 14, 3.5, 12, 1.5); ctx.fill();
    ctx.restore();
  }

  // ── STANDBY (pasif) ──────────────────────────────────
  if (!isAktif && !isDurak) {
    ctx.save();
    ctx.fillStyle = 'rgba(135,140,155,0.1)';
    ctx.beginPath(); ctx.arc(84, 20, 9, 0, PI*2); ctx.fill();
    // Daire çizgisi
    ctx.strokeStyle = 'rgba(135,140,155,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(84, 20, 9, 0, PI*2); ctx.stroke();
    // İç nokta
    ctx.fillStyle = 'rgba(135,140,155,0.5)';
    ctx.beginPath(); ctx.arc(84, 20, 3.5, 0, PI*2); ctx.fill();
    ctx.restore();
  }

  ctx.restore(); // main setTransform restore
}

// renderSondajAnim içinde canvas setup
function ddh_initCanvas(canvas) {
  ddh_setupCanvas(canvas);
  return canvas.getContext('2d');
}

// ── PANEL RENDER ──────────────────────────────────────────────
function renderSondajAnim() {
  const grid = document.getElementById('ddh-anim-grid');
  if (!grid) return;

  const tsEl = document.getElementById('anim-ts');
  if (tsEl) {
    const now = new Date();
    const h = String(now.getHours()).padStart(2,'0');
    const m2 = String(now.getMinutes()).padStart(2,'0');
    const s = String(now.getSeconds()).padStart(2,'0');
    const { label: filtreLbl } = zamanFiltreTarihler();
    tsEl.textContent = filtreLbl + ' · ' + h + ':' + m2 + ':' + s;
  }

  // Her çağrıda yeniden render — filtre değişimlerinde güncel veri gösterilsin
  {
    grid.innerHTML = '';
    MAKINELER.forEach(makine => {
      const renk = MAKINE_RENKLER_V2[makine] || '#64748b';

      // Filtre duyarlı kuyu: bugünün ayıysa gerçek aktif, geçmiş/gelecek aydaysa
      // o dönemde delinen son kuyu — ayMakineAktifKuyu() zaten bunu yapıyor
      const donemKuyu = ayMakineAktifKuyu(makine);

      // Durum: sadece bugünün ayında gerçek aktif/durak göster
      // Geçmiş ay seçiliyse "tamamlandı" mantığı
      let durum = ddhMakineDurum(makine, donemKuyu);

      // Kuyu ve derinlik bilgisi
      let kuyuNo = null, hedef = 0, derinlik = 0;
      if (donemKuyu) {
        kuyuNo = donemKuyu.no || null;
        hedef = parseFloat(donemKuyu.hd) || 0;

        if (bugunAyMi()) {
          // Bugünün ayı: gerçek kümülatif derinlik (tüm zamanlar)
          const basDerinlik = parseFloat(donemKuyu.bm) || 0;
          const tumDelgi = db.gunluk
            ? db.gunluk.filter(r => makineEslesir(r.makine, makine) && kuyuNolariFromSondaj(r.sondaj).includes(kuyuNo))
                .reduce((s,r) => s+(parseFloat(r.s1)||0)+(parseFloat(r.s2)||0)+(parseFloat(r.s3)||0), 0)
            : 0;
          derinlik = basDerinlik + tumDelgi;
        } else {
          // Geçmiş ay: o ayın sonundaki toplam derinlik
          // = başlangıç + o aya kadar olan tüm delgi
          const basDerinlik = parseFloat(donemKuyu.bm) || 0;
          const { bas } = zamanFiltreTarihler();
          const donemSonuna = db.gunluk
            ? db.gunluk.filter(r =>
                makineEslesir(r.makine, makine) && kuyuNolariFromSondaj(r.sondaj).includes(kuyuNo) &&
                r.tarih && r.tarih <= (bas.substring(0,7) + '-31')
              ).reduce((s,r) => s+(parseFloat(r.s1)||0)+(parseFloat(r.s2)||0)+(parseFloat(r.s3)||0), 0)
            : 0;
          derinlik = basDerinlik + donemSonuna;
        }
        if (!hedef) hedef = derinlik + 50;
      }

      const pct = hedef > 0 ? Math.min(100, Math.round(derinlik / hedef * 100)) : 0;

      // Filtre duyarlı dönem metrajı (o makinenin seçili dönemdeki delgisi)
      const filtreKayitlar = filtreliGunluk().filter(r => makineEslesir(r.makine, makine));
      const donemMetraj = filtreKayitlar.reduce((s,r) =>
        s+gunlukMetraj(r), 0);
      const donemLbl = zamanFiltre === 'gun' ? 'Gün' : zamanFiltre === 'hafta' ? 'Hafta' : 'Ay';

      // Rozet metni
      const badgeTxt = !donemKuyu ? '◌ Bekliyor'
        : !bugunAyMi() ? '✓ Tamamlandı'
        : durum === 'aktif' ? '● Aktif'
        : durum === 'durak' ? '⏸ Durak'
        : '◌ Bekliyor';
      const cid = 'ddhc-' + makine.replace(/[^a-zA-Z0-9]/g,'');

      const card = document.createElement('div');
      card.className = 'ddh-rig-card rig-' + durum;
      card.dataset.rig = makine;
      card.innerHTML =
        '<div class="ddh-rig-strip" style="background:' + renk + '"></div>' +
        '<div class="ddh-rig-body">' +
          '<div class="ddh-rig-header">' +
            '<div class="ddh-rig-name" style="color:' + renk + '">' + makine + '</div>' +
            '<div class="ddh-rig-badge ' + (donemKuyu && !bugunAyMi() ? 'tamam' : durum) + '">' + badgeTxt + '</div>' +
          '</div>' +
          '<div class="ddh-kuyu-tag">' + (kuyuNo ? '⬡ ' + kuyuNo : '— atanmış kuyu yok —') + '</div>' +
          '<div class="ddh-canvas-zone">' +
            '<canvas class="ddh-rig-canvas" id="' + cid + '"></canvas>' +
          '</div>' +
          '<div class="ddh-depth-row">' +
            '<span class="ddh-depth-lbl">Derinlik</span>' +
            '<span class="ddh-depth-val" id="ddhdv-' + makine.replace(/[^a-zA-Z0-9]/g,'') + '">' + derinlik.toFixed(1) + ' <span>m</span></span>' +
          '</div>' +
          '<div class="ddh-progress-wrap">' +
            '<div class="ddh-progress-bar" id="ddhpb-' + makine.replace(/[^a-zA-Z0-9]/g,'') + '" style="width:' + pct + '%;background:' + renk + '"></div>' +
          '</div>' +
          '<div class="ddh-rig-meta">' +
            '<span>' + donemLbl + ': <strong>' + donemMetraj.toFixed(1) + ' m</strong></span>' +

          '</div>' +
        '</div>';
      grid.appendChild(card);
    });
  }
}

// ── ANIMATION LOOP ─────────────────────────────────────────────
let _ddhAnimStart = null;
let _ddhDepthCache = {};

function _ddhLoop(ts) {
  if (!_ddhAnimStart) _ddhAnimStart = ts;
  const t = (ts - _ddhAnimStart) / 1000;

  // Only draw if dashboard is active
  if (document.getElementById('page-dash') &&
      document.getElementById('page-dash').classList.contains('active')) {

    MAKINELER.forEach(makine => {
      const cid = 'ddhc-' + makine.replace(/[^a-zA-Z0-9]/g,'');
      const canvas = document.getElementById(cid);
      if (!canvas) return;
      const ctx = ddh_initCanvas(canvas);
      const donemKuyu = ayMakineAktifKuyu(makine);
      const durum = ddhMakineDurum(makine, donemKuyu);
      const renk = MAKINE_RENKLER_V2[makine] || '#64748b';
      ddh_drawRig(ctx, renk, durum, t);
    });

  }

  requestAnimationFrame(_ddhLoop);
}

// ── STAT CARD COUNT-UP ANIMASYONU ─────────────────────────────
function ddhAnimateStatCards() {
  ['d-toplam','d-aktif','d-bitti','d-durak'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const parent = el.closest('.sc-val');
    if (!parent) return;
    parent.classList.remove('ddh-animating');
    void parent.offsetWidth;
    parent.classList.add('ddh-animating');
    setTimeout(() => parent.classList.remove('ddh-animating'), 600);
  });
}

// ── TABLO SATIRI ANIMASYONU ────────────────────────────────────
window.ddhAnimateNewRow = function(rowEl) {
  if (!rowEl) return;
  rowEl.classList.add('ddh-row-new');
  setTimeout(() => rowEl.classList.remove('ddh-row-new'), 500);
};

// ── UZUN DURAKLAMA PULSE ──────────────────────────────────────
function ddhCheckLongBreaks() {
  const rows = document.querySelectorAll('#durak-tbody tr, #durak-all-tbody tr');
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (!cells.length) return;
    const dkCell = cells[1];
    if (!dkCell) return;
    const dk = parseInt(dkCell.textContent) || 0;
    if (dk > 480) {
      row.classList.add('ddh-warn-pulse');
    } else {
      row.classList.remove('ddh-warn-pulse');
    }
  });
}

// ── TIMER & HOOKS ──────────────────────────────────────────────
let _ddhPanelTimer = null;

function startAnimTimer() {
  if (_ddhPanelTimer) clearInterval(_ddhPanelTimer);
  _ddhPanelTimer = setInterval(() => {
    if (document.getElementById('page-dash') &&
        document.getElementById('page-dash').classList.contains('active')) {
      renderSondajAnim();
      const tsEl = document.getElementById('anim-ts');
      if (tsEl) {
        const now = new Date();
        const h = String(now.getHours()).padStart(2,'0');
        const m = String(now.getMinutes()).padStart(2,'0');
        const s = String(now.getSeconds()).padStart(2,'0');
        tsEl.textContent = h + ':' + m + ':' + s;
      }
    }
    ddhCheckLongBreaks();
  }, 30000);
}

const _origGoPage = window.goPage;
window.goPage = function(id, el) {
  if (_origGoPage) _origGoPage(id, el);
  if (id === 'dash') {
    renderSondajAnim();
    ddhAnimateStatCards();
    startAnimTimer();
  }
  if (id === 'durak') {
    setTimeout(ddhCheckLongBreaks, 400);
  }
};

// Start canvas loop
requestAnimationFrame(_ddhLoop);
startAnimTimer();

// Stat cards animasyonu — renderDash'den sonra çağrılır (zaten eklendi)
// DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  startAnimTimer();
});
