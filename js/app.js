import { PRELOADED_KUYULAR, PRELOADED_GUNLUK, PRELOADED_DURAKLAMALAR, PRELOADED_NEXTID } from './data.js';
import { RigAnim } from './ddhRigAnim.js?v=rig-v2-1-4';
// ── SABITLER ────────────────────────────────────────────────
const MAKINELER = ['GS-200','DBC-U6','BATUHAN-600X','GS-600','BDU-600'];
const MAKINE_RENK = {
  'GS-200':       '#e9cd53',
  'DBC-U6':       '#4f7d32',
  'BATUHAN-600X': '#f47721',
  'GS-600':       '#1d4f8f',
  'BDU-600':      '#231f20',
};
const VRD_LABEL = {1:'00:00—08:00', 2:'08:00—16:00', 3:'16:00—00:00'};
const VRD_CLASS = {1:'v1-tag', 2:'v2-tag', 3:'v3-tag'};
const VRD_CLR   = {1:'var(--v1b)', 2:'var(--v2b)', 3:'var(--v3b)'};
const VARDIYA_MAX_METRAJ = {'GS-200':60, 'DBC-U6':60, 'BATUHAN-600X':60, 'GS-600':60, 'BDU-600':60};
const GECMIS_DUZENLEME_KILIT_GUN = 7;

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
  const text = String(msg || '');
  const lower = text.toLocaleLowerCase('tr-TR');
  let state = ok ? 'ok' : 'warn';
  if(lower.includes('hata')) state = 'error';
  if(lower.includes('kaydediliyor') || lower.includes('bağlan') || lower.includes('baglan')) state = 'busy';
  if(lower.includes('yerel')) state = ok ? 'ok' : 'warn';
  if(el){
    el.className = 'save-ind state-' + state;
    el.textContent = text.replace(/^●\s*/, '');
  }
  updateDataHealth(state, text);
}

function updateDataHealth(state, msg){
  const firebaseEl = document.getElementById('dh-firebase');
  const localEl = document.getElementById('dh-local');
  const lastEl = document.getElementById('dh-last');
  const modeEl = document.getElementById('dh-mode');
  const noteEl = document.getElementById('dh-note');
  if(!firebaseEl || !localEl || !lastEl || !modeEl || !noteEl) return;
  const text = String(msg || '');
  const lower = text.toLocaleLowerCase('tr-TR');
  localEl.textContent = 'Güncel';
  if(state === 'ok'){
    firebaseEl.textContent = lower.includes('yerel') ? 'Bekliyor' : 'Bağlı';
    modeEl.textContent = lower.includes('yerel') ? 'Yerel' : 'Canlı';
    noteEl.textContent = lower.includes('yerel') ? 'Veriler bu tarayıcıdaki yerel yedekten açıldı.' : 'Veriler Firebase ile eşitlendi.';
    lastEl.textContent = new Date().toLocaleTimeString('tr-TR');
  } else if(state === 'busy'){
    firebaseEl.textContent = 'İşleniyor';
    modeEl.textContent = 'Senkron';
    noteEl.textContent = text.replace(/^●\s*/, '');
  } else if(state === 'error'){
    firebaseEl.textContent = 'Hata';
    modeEl.textContent = 'Yerel';
    noteEl.textContent = 'Firebase yazmadı; veri yerel yedekte tutuluyor.';
    lastEl.textContent = new Date().toLocaleTimeString('tr-TR');
  } else {
    firebaseEl.textContent = lower.includes('yerel') ? 'Bağlanamadı' : 'Bekliyor';
    modeEl.textContent = 'Yerel';
    noteEl.textContent = text.replace(/^●\s*/, '') || 'Kayıt durumu bekleniyor.';
  }
}

function showToast(title, detail){
  let el = document.getElementById('app-toast');
  if(!el){
    el = document.createElement('div');
    el.id = 'app-toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.innerHTML = `${esc(title)}${detail ? `<small>${esc(detail)}</small>` : ''}`;
  el.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(()=>el.classList.remove('show'), 2600);
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
    durakResetV:     db.durakResetV || 0,
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

function mergePreloadedDuraklamalar(savedDuraklamalar){
  const saved = Array.isArray(savedDuraklamalar) ? savedDuraklamalar : [];
  const keyOf = d => [
    d.makine || '',
    d.tarih || '',
    String(d.vardiya || ''),
    d.sondaj || '',
    d.neden || '',
    d.basSaat || d.bas_saat || '',
    d.bitSaat || d.bit_saat || '',
    String(parseFloat(d.dk) || 0)
  ].join('|');
  const keys = new Set(saved.map(keyOf));
  const eksik = PRELOADED_DURAKLAMALAR.filter(d => !keys.has(keyOf(d)));
  return [...eksik, ...saved];
}

function normalizeDuraklamaNedeni(neden){
  const raw = String(neden || '').trim();
  const ascii = raw
    .toLocaleUpperCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[?]/g, 'I');
  if(ascii.includes('SU KES')) return 'SU KESİNTİSİ';
  if(ascii.includes('SU SEV') || ascii.includes('YUKSEL') || ascii.includes('YIKSEL')) return 'SU SEVİYESİ YÜKSELMESİ';
  if(ascii.includes('PATLAT')) return 'PATLATMA';
  if(ascii.includes('DUMAN')) return 'DUMAN';
  if(ascii.includes('ELEK')) return 'ELEKTRİK KESİNTİSİ';
  return raw;
}

function normalizeDuraklamaNedenleri(){
  const seen = new Set();
  db.duraklamalar = (db.duraklamalar || [])
    .map(d => ({...d, neden: normalizeDuraklamaNedeni(d.neden), aciklama: temizDuraklamaAciklama(d.aciklama)}))
    .filter(d => {
      const key = [
        d.makine || '',
        d.tarih || '',
        String(d.vardiya || ''),
        d.sondaj || '',
        d.neden || '',
        d.basSaat || d.bas_saat || '',
        d.bitSaat || d.bit_saat || '',
        String(parseFloat(d.dk) || 0)
      ].join('|');
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function temizDuraklamaAciklama(aciklama){
  const raw = String(aciklama || '').trim();
  if(!raw) return '';
  if(raw.startsWith('Kaynak:')) return '';
  return raw;
}

// Duraklama verisini bir kez seed'e (Excel'den import edilen kayıtlara) sıfırlamak için sürüm bayrağı.
// Firebase'de saklanır → tüm cihazlarda yalnızca BİR kez çalışır; eski Firebase verisini atıp
// seed'i kalıcı yazar. (v1: tümünü sil — boş seed. v2: Excel importu seed'e yüklendi.)
// Yeni bir global sıfırlama/import gerekirse bu sürümü artır.
const DURAK_RESET_V = 2;
function applyDurakResetIfNeeded(){
  if((db.durakResetV || 0) >= DURAK_RESET_V) return false;
  // Eski Firebase duraklama verisini at; yalnızca seed'deki (import edilen) kayıtlar kalsın.
  db.duraklamalar = [...PRELOADED_DURAKLAMALAR];
  db.durakResetV = DURAK_RESET_V;
  return true;
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
  db.duraklamalar = mergePreloadedDuraklamalar(data.duraklamalar);
  normalizeDuraklamaNedenleri();
  normalizeDbMakineAdlari();
  db.butce = data.butce || db.butce || {};
  db.durakResetV = data.durakResetV || 0;
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
  backfillDurakLokasyon();
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

function getWithTimeout(dbRef, ms = 8000){
  return Promise.race([
    get(dbRef),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase timeout')), ms))
  ]);
}

function load(){
  setStatus(false, '● Bağlanıyor...');
  const local = readLocalBackup();
  if(local){
    applySavedData(local);
    setStatus(false, '● Yerel yedek yüklendi · Firebase bekleniyor');
  } else {
    db.kuyular = [...PRELOADED_KUYULAR];
    db.gunluk = [...PRELOADED_GUNLUK];
    db.duraklamalar = db.duraklamalar || [];
    normalizeDbMakineAdlari();
    ensureNextId();
    setStatus(false, '● Yerel veri yüklendi · Firebase bekleniyor');
  }
  renderAll();

  getWithTimeout(dbRef).then(snapshot => {
    const data = snapshot.val();
    if(data){
      const chosen = newerData(data, local);
      applySavedData(chosen);
      if(applyDurakResetIfNeeded()) save(); else saveLocalBackup(chosen);
    } else {
      if(local){
        applySavedData(local);
        if(applyDurakResetIfNeeded()) save();
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

function bugunStr(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function tarihGunFarki(tarih){
  if(!tarih) return 0;
  const t = new Date(tarih+'T00:00:00');
  const b = new Date(bugunStr()+'T00:00:00');
  return Math.floor((b - t) / 86400000);
}

function isGelecekTarih(tarih){
  return !!tarih && tarih > bugunStr();
}

function sondajParcalari(sondaj){
  return String(sondaj || '').split('/').map(s=>s.trim()).filter(Boolean);
}

function normalizeKuyuNo(no){
  return String(no || '').trim().toLocaleUpperCase('tr-TR');
}

function ayniKuyu(a, b){
  return normalizeKuyuNo(a) === normalizeKuyuNo(b);
}

function kuyuBul(no, makine){
  const n = normalizeKuyuNo(no);
  return (db.kuyular || []).find(k => normalizeKuyuNo(k.no) === n && (!makine || makineEslesir(k.makine, makine)))
    || (db.kuyular || []).find(k => normalizeKuyuNo(k.no) === n);
}

function kuyuLokasyon(k){
  return k ? (k.mevkii || k.Lokasyon || k.lokasyon || k.saha || '') : '';
}

function setVardiyaLokasyonFromKuyu(){
  const sondajEl = document.getElementById('v-sondaj');
  const lokEl = document.getElementById('v-lok');
  if(!sondajEl || !lokEl) return;
  const kuyular = sondajParcalari(sondajEl.value).map(no => kuyuBul(no, varMakine)).filter(Boolean);
  const loklar = [...new Set(kuyular.map(kuyuLokasyon).filter(Boolean))];
  if(loklar.length) lokEl.value = loklar.join(' / ');
}

// Yükleme anında: lokasyonu boş olan duraklamaları ilgili kuyunun mevkii'sinden doldur.
// (Firebase'deki eski lokasyonsuz kayıtlar için de çalışır; db.kuyular set edildikten SONRA çağrılmalı.)
function backfillDurakLokasyon(){
  (db.duraklamalar || []).forEach(d => {
    if(d && !d.lokasyon){
      const lok = kuyuLokasyon(kuyuBul(d.sondaj, d.makine));
      if(lok) d.lokasyon = lok;
    }
  });
}

// Duraklama formunda: girilen sondaj(lar)a göre lokasyonu ilgili kuyunun mevkii'sinden doldur
function setDurakLokasyonFromKuyu(){
  const sonEl = document.getElementById('d-son');
  const lokEl = document.getElementById('d-lokasyon');
  const makEl = document.getElementById('d-mak');
  if(!sonEl || !lokEl) return;
  const makine = makEl ? makEl.value : '';
  const kuyular = sondajParcalari(sonEl.value).map(no => kuyuBul(no, makine)).filter(Boolean);
  const loklar = [...new Set(kuyular.map(kuyuLokasyon).filter(Boolean))];
  if(loklar.length) lokEl.value = loklar.join(' / ');
}

function vardiyaDegerleri(){
  return [1,2,3].map(n => {
    const el = document.getElementById('v-s'+n);
    const raw = el ? String(el.value || '').trim() : '';
    const val = raw === '' ? null : parseFloat(raw);
    return {n, raw, val};
  });
}

function rowVardiyaDolu(row, n){
  const v = row ? row['s'+n] : null;
  return v !== null && v !== undefined && v !== '';
}

function rowKuyular(row){
  return sondajParcalari(row?.sondaj);
}

function validateGecmisDuzenleme(tarih){
  if(editVarId === null) return true;
  if(tarihGunFarki(tarih) <= GECMIS_DUZENLEME_KILIT_GUN) return true;
  if(isAuth && Date.now() < authExpiry) return true;
  alert(`${GECMIS_DUZENLEME_KILIT_GUN} gunden eski kayitlar sadece yetkili kullanici tarafindan duzenlenebilir.`);
  return false;
}

function validateVardiyaKaydi(tarih, sondaj, vals){
  if(isGelecekTarih(tarih)){ alert('Gelecek tarihli vardiya kaydi girilemez.'); return false; }
  if(!validateGecmisDuzenleme(tarih)) return false;

  const girilenler = vals.filter(x => x.raw !== '');
  const negatif = girilenler.find(x => Number.isFinite(x.val) && x.val < 0);
  if(negatif){ alert(`${negatif.n}. vardiya metraji negatif olamaz.`); return false; }
  if(girilenler.some(x => !Number.isFinite(x.val))){ alert('Vardiya metrajlari sayisal olmalidir.'); return false; }

  const limit = VARDIYA_MAX_METRAJ[makineKey(varMakine)] || 60;
  const asimlar = girilenler.filter(x => x.val > limit);
  if(asimlar.length){
    const detay = asimlar.map(x => `V${x.n}: ${x.val} m`).join(', ');
    if(!confirm(`${varMakine} icin tek vardiyada ${limit} m uzeri girildi (${detay}). Emin misiniz?`)) return false;
  }

  const secilenKuyular = sondajParcalari(sondaj);
  if(!secilenKuyular.length){ alert('Kuyu secilmeden vardiya kaydi kaydedilemez.'); return false; }
  for(const no of secilenKuyular){
    const k = kuyuBul(no, varMakine);
    if(!k){ alert(`${no} kuyusu ${varMakine} makinesine atanmis kuyu listesinde bulunamadi.`); return false; }
    if(!makineEslesir(k.makine, varMakine)){ alert(`${no} kuyusu ${k.makine || '-'} makinesine atanmis. ${varMakine} icin kaydedilemez.`); return false; }
    if(!isAktifKuyu(k)){ alert(`${no} tamamlanmis durumda. Yeni ilerleme girmek icin once kuyuyu yeniden aktif edin.`); return false; }
  }

  for(const v of girilenler){
    const cakisanlar = (db.gunluk || []).filter(r =>
      r.id !== editVarId &&
      makineEslesir(r.makine, varMakine) &&
      r.tarih === tarih &&
      rowVardiyaDolu(r, v.n)
    );
    for(const r of cakisanlar){
      const mevcutKuyular = rowKuyular(r);
      const ayniKuyuVar = mevcutKuyular.some(m => secilenKuyular.some(s => ayniKuyu(m, s)));
      if(ayniKuyuVar){ alert(`${varMakine} / ${tarih} / V${v.n} icin ayni kuyuya ait kayit zaten var.`); return false; }
      alert(`${varMakine} ayni tarih ve V${v.n} vardiyasinda baska bir kuyuda calisiyor: ${mevcutKuyular.join('/') || '-'}`);
      return false;
    }
  }
  return true;
}

function saatDakika(s){
  if(!s) return null;
  const m = String(s).match(/^(\d{1,2}):(\d{2})$/);
  if(!m) return null;
  return parseInt(m[1],10) * 60 + parseInt(m[2],10);
}

function duraklamaAraligi(d){
  const bas = saatDakika(d.basSaat || d.bas_saat);
  const bit = saatDakika(d.bitSaat || d.bit_saat);
  if(bas == null || bit == null) return null;
  return bit <= bas ? {bas, bit: bit + 1440} : {bas, bit};
}

function araliklarCakisiyor(a, b){
  if(!a || !b) return false;
  const adaylar = [b, {bas:b.bas+1440, bit:b.bit+1440}, {bas:b.bas-1440, bit:b.bit-1440}];
  return adaylar.some(x => a.bas < x.bit && x.bas < a.bit);
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
  // Aktif kuyu yoksa (ör. kuyu sonlandırıldıysa) animasyon durur — geçmiş günlük kayıtları "aktif" yapmaz
  return 'pasif';
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

// Aktif kuyu — mevcut ayda gerçek aktif (yoksa atanmış kuyu yok), geçmiş ayda son delinen
function ayMakineAktifKuyu(makine){
  if(bugunAyMi()){
    // Bu ay: yalnızca gerçekten aktif (tamamlanmamış) kuyu. Tamamlandıysa atanmış kuyu gösterme.
    return db.kuyular.find(k => makineEslesir(k.makine, makine) && isAktifKuyu(k)) || null;
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
  if(id==='hakedis') renderHakedis();
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
  const aktifDetay = document.getElementById('d-aktif-detay');
  if(aktifDetay){
    const aktifListe = bugunAyMi() ? aktifKuyular() : [];
    aktifDetay.innerHTML = aktifListe.length
      ? aktifListe.slice(0,4).map(k => `<span class="mini-pill">${esc(k.no || '?')}</span>`).join('') + (aktifListe.length > 4 ? `<span class="mini-pill">+${aktifListe.length-4}</span>` : '')
      : 'Bu dönem için aktif kuyu gösterimi yok';
    aktifDetay.title = aktifListe.map(k => `${k.no || '?'} - ${k.makine || '-'}`).join(' | ');
  }
  document.getElementById('d-bitti').textContent = bittiSay;
  const bittiDetay = document.getElementById('d-bitti-detay');
  if(bittiDetay){
    bittiDetay.innerHTML = bittiListe.length
      ? bittiListe.slice(0,3).map(k => `<span class="mini-pill">${esc(k.no || '?')} · ${fmtDate(k.bit)}</span>`).join('') + (bittiListe.length > 3 ? `<span class="mini-pill">+${bittiListe.length-3}</span>` : '')
      : 'Bu ay bitiş tarihi yok';
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

    const mRenk = MAKINE_RENK[m] || '#96999b';
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
      <span style="color:#231f20;font-weight:600;font-size:12px;">${typeof d.val === 'number' ? d.val.toFixed(2) : d.val} <span style="color:#606363;font-weight:400;font-size:11px">${unit}</span></span>
      <span style="color:#606363;font-size:11px;min-width:30px;text-align:right">%${pct}</span>
    </div>`;
  }).join('');
}


function drawPieDurak(){
  const wrap = document.getElementById('pie-durak-wrap');
  if(!wrap) return;

  const NEDEN_COLORS = {
    'SU KESİNTİSİ':             '#1d4f8f',
    'SU SEVİYESİ YÜKSELMESİ':   '#0d9488',
    'PATLATMA':                 '#b91c1c',
    'DUMAN':                    '#231f20',
    'ELEKTRİK KESİNTİSİ':       '#f47721',
    'DİĞER':                    '#96999b',
  };

  const ayDurak = filtreliDurak();

  const nedenMap = {};
  ayDurak.forEach(d => {
    const n = normalizeDuraklamaNedeni(d.neden) || 'DİĞER';
    nedenMap[n] = (nedenMap[n] || 0) + (parseFloat(d.dk) || 0);
  });

  const data = Object.entries(nedenMap)
    .map(([n, dk]) => ({ label: n, val: dk, color: NEDEN_COLORS[n] || '#96999b' }))
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
      <span style="color:#231f20;font-weight:700;font-size:12px">${d.val}<span style="color:#606363;font-weight:400;font-size:10px"> dk</span></span>
      <span style="color:#606363;font-size:11px;min-width:28px;text-align:right">%${pct}</span>
    </div>`;
  }).join('') : '<p style="color:#606363;font-size:12px;text-align:center;padding:12px">Bu ay duraklama kaydı yok</p>';

  wrap.innerHTML = svg + `<div style="width:100%;max-width:240px">${legend}</div>`;

  // Duraklama özet tablosunu da güncelle
  const tb = document.getElementById('durak-ozet-tbody');
  if(tb){
    if(data.length === 0){
      tb.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text3)">Bu ay duraklama kaydı yok</td></tr>`;
    } else {
      tb.innerHTML = data.map(d => {
        const say = ayDurak.filter(r => (r.neden||'DİĞER') === d.label).length;
        const neden = normalizeDuraklamaNedeni(d.neden);
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



// ── HAKEDİŞ — renderHakedis() aşağıda tanımlıdır ─────────────
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
          const rc = MAKINE_RENK[r.m] || '#96999b';
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
    return { label: m, val, color: MAKINE_RENK[m] || '#96999b' };
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
  // Hem aktif hem tamamlanan kuyuda fiili delgi metrajı; delgi yoksa plan derinliğe düş
  const derinlikGoster = met > 0 ? met : (k.der||0);
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
        <span class="mbar-txt" style="color:var(--text)">${isAktif ? met.toFixed(2)+' m (aktif)' : (met > 0 ? met.toFixed(2)+' m' : (k.der!=null ? parseFloat(k.der).toFixed(2)+' m' : '—'))}</span>
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
      const rc=MAKINE_RENK[r.makine]||'#96999b';
      const sondajCell=r.sondaj&&r.sondaj.includes('/')
        ?`<div style="display:flex;flex-direction:column;align-items:flex-start;gap:2px"><div style="display:flex;align-items:center;gap:4px"><span style="font-size:9px;color:#231f20;font-weight:700" title="Biten kuyu">■</span><span class="kn" style="font-size:11px">${esc(r.sondaj.split('/')[0].trim())}</span></div><div style="padding-left:4px;color:var(--text3);font-size:10px;line-height:1">↓</div><div style="display:flex;align-items:center;gap:4px"><span style="font-size:9px;color:#606363;font-weight:700" title="Başlayan kuyu">■</span><span class="kn" style="font-size:11px">${esc(r.sondaj.split('/')[1].trim())}</span></div></div>`
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
             <span style="font-size:9px;color:#231f20;font-weight:700" title="Biten kuyu">■</span>
             <span class="kn" style="font-size:11px">${esc(r.sondaj.split('/')[0].trim())}</span>
           </div>
           <div style="padding-left:4px;color:var(--text3);font-size:10px;line-height:1">↓</div>
           <div style="display:flex;align-items:center;gap:4px">
             <span style="font-size:9px;color:#606363;font-weight:700" title="Başlayan kuyu">■</span>
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
  const basSaatEl = document.getElementById('d-bas-saat');
  const bitSaatEl = document.getElementById('d-bit-saat');
  if(basSaatEl) basSaatEl.value = d.basSaat || d.bas_saat || '';
  if(bitSaatEl) bitSaatEl.value = d.bitSaat || d.bit_saat || '';
  document.getElementById('d-son').value      = d.sondaj||'';
  document.getElementById('d-ned').value      = d.neden||'DİĞER';
  document.getElementById('d-lokasyon').value  = d.lokasyon||'';
  document.getElementById('d-aciklama').value = temizDuraklamaAciklama(d.aciklama);
  document.getElementById('d-dk').value       = d.dk||'';
  document.getElementById('m-durak').classList.add('open');
}

// ── DURAKLAMALAR ────────────────────────────────────────────
let durakSort = { key: 'tarih', dir: 'asc' };
const DURAK_SORT_VAL = {
  makine:   d => d.makine || '',
  tarih:    d => d.tarih || '',
  sondaj:   d => d.sondaj || '',
  vardiya:  d => parseInt(d.vardiya, 10) || 0,
  neden:    d => normalizeDuraklamaNedeni(d.neden) || '',
  lokasyon: d => d.lokasyon || '',
  aciklama: d => temizDuraklamaAciklama(d.aciklama) || '',
  dk:       d => parseFloat(d.dk) || 0,
};

function sortDurak(key){
  if(durakSort.key === key) durakSort.dir = durakSort.dir === 'asc' ? 'desc' : 'asc';
  else { durakSort.key = key; durakSort.dir = 'asc'; }
  renderDurak();
}

function renderDurak(){
  const qm = document.getElementById('q-dm').value;
  const list = (db.duraklamalar || []).filter(d => ayFiltre(d.tarih) && (!qm||d.makine===qm));
  const dir = durakSort.dir === 'desc' ? -1 : 1;
  const getVal = DURAK_SORT_VAL[durakSort.key] || DURAK_SORT_VAL.tarih;
  const sortedList = list.slice().sort((a,b) => {
    const va = getVal(a), vb = getVal(b);
    let cmp = (typeof va === 'number') ? (va - vb) : String(va).localeCompare(String(vb), 'tr');
    if(cmp) return cmp * dir;
    // İkincil: tarih → vardiya → başlangıç saati
    const tarih = (a.tarih || '').localeCompare(b.tarih || '');
    if(tarih) return tarih;
    const vardiya = (parseInt(a.vardiya,10) || 0) - (parseInt(b.vardiya,10) || 0);
    if(vardiya) return vardiya;
    return (a.basSaat || a.bas_saat || '').localeCompare(b.basSaat || b.bas_saat || '');
  });
  const topDk = list.reduce((s,d)=>s+(parseFloat(d.dk)||0),0);
  document.getElementById('dur-dk').textContent = topDk;
  document.getElementById('dur-sa').textContent = (topDk/60).toFixed(2);
  document.getElementById('dur-say').textContent = list.length;

  const rows = sortedList.map(d=>{
        const vc = VRD_CLASS[d.vardiya]||'v1-tag';
        const vl = VRD_LABEL[d.vardiya]||'—';
        const neden = normalizeDuraklamaNedeni(d.neden);
        const aciklama = temizDuraklamaAciklama(d.aciklama);
        return `<tr>
          <td><span class="mt">${esc(d.makine)}</span></td>
          <td><span class="dv">${fmtDate(d.tarih)}</span></td>
          <td><span class="kn" style="font-size:11px">${esc(d.sondaj||'—')}</span></td>
          <td><span class="${vc}">${vl}</span></td>
          <td>${esc(neden||'—')}</td>
          <td style="color:var(--text2);font-size:11px">${esc(d.lokasyon||'—')}</td>
          <td style="color:var(--text2);font-size:11px">${esc(aciklama||'—')}</td>
          <td class="c"><span class="nv gold">${d.dk||0}</span></td>
          <td style="white-space:nowrap">
            <button class="btn" style="padding:3px 7px;font-size:12px;background:none;border:1px solid var(--border2);border-radius:6px;cursor:pointer;margin-right:3px" title="Düzenle" onclick="editDurak(${d.id})">✏️</button>
            <button class="btn btn-d" style="padding:3px 7px;font-size:12px;border-radius:6px" title="Sil" onclick="delDurak(${d.id})">🗑</button>
          </td>
        </tr>`;
      }).join('');

  document.getElementById('dur-tbody').innerHTML = rows || `<tr><td colspan="9" style="text-align:center;padding:28px;color:var(--text3)">Kayıt yok</td></tr>`;

  document.querySelectorAll('#page-durak .sort-ind').forEach(el => {
    el.textContent = el.dataset.sk === durakSort.key ? (durakSort.dir === 'asc' ? ' ↑' : ' ↓') : ' ⇅';
  });
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
function removeKuyuGuncelField(){
  const el = document.getElementById('k-guncel');
  const wrap = el ? el.closest('.ff') : null;
  if(wrap) wrap.remove();
}

function openKuyu(){
  editKId = null;
  document.getElementById('m-kuyu-title').textContent = 'Yeni Kuyu Ekle';
  removeKuyuGuncelField();
  ['k-no','k-az','k-eg','k-der','k-cap','k-y','k-x','k-z','k-mev','k-saha','k-su','k-bar'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('k-bas').value = aktifAy+'-01';
  document.getElementById('k-bit').value = '';
  document.getElementById('m-kuyu').classList.add('open');
}

function editKuyu(id){
  const k = db.kuyular.find(x=>x.id===id); if(!k) return;
  removeKuyuGuncelField();
  editKId = id;
  document.getElementById('m-kuyu-title').textContent = 'Kuyu Düzenle · '+k.no;
  document.getElementById('k-no').value   = k.no||'';
  document.getElementById('k-mak').value  = k.makine||'GS-200';
  document.getElementById('k-bas').value  = k.bas||'';
  document.getElementById('k-bit').value  = k.bit||'';
  document.getElementById('k-az').value   = k.az||'';
  document.getElementById('k-eg').value   = k.eg||'';
  document.getElementById('k-der').value  = k.der||'';
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
    showToast('Kuyu güncellendi', no);
  } else {
    data.id = uid();
    db.kuyular.push(data);
    showToast('Yeni kuyu eklendi', no);
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
  const preview = document.getElementById('v-change-preview');
  const fark = Math.abs((oldTop + newTop) - vardiyaTop);
  if(summary){
    summary.textContent = fark < 0.001
      ? `Hazır: ${vardiyaTop.toFixed(2)} m iki kuyuya dağıtıldı.`
      : `Kontrol gerekli: vardiya ${vardiyaTop.toFixed(2)} m, dağıtılan ${(oldTop+newTop).toFixed(2)} m`;
    summary.className = 'kcp-foot ' + (fark < 0.001 ? 'ok' : 'warn');
  }
  if(preview){
    const parts = kuyuDegisimParcalari() || ['Biten kuyu','Başlayan kuyu'];
    const oldShift = [1,2,3].filter(n => vardiyaNum('v-old-s'+n) > 0).map(n => `V${n}`).join(', ') || '-';
    const newShift = [1,2,3].filter(n => vardiyaNum('v-new-s'+n) > 0).map(n => `V${n}`).join(', ') || '-';
    preview.innerHTML = `
      <div class="kcp-card">
        <div class="kcp-card-title">Oluşacak kayıt 1</div>
        <div class="kcp-card-val">${esc(parts[0])} · ${oldTop.toFixed(2)} m</div>
        <small>${esc(oldShift)}</small>
      </div>
      <div class="kcp-card">
        <div class="kcp-card-title">Oluşacak kayıt 2</div>
        <div class="kcp-card-val">${esc(parts[1])} · ${newTop.toFixed(2)} m</div>
        <small>${esc(newShift)}</small>
      </div>`;
  }
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
    if(oldVals[i] > 0 && newVals[i] > 0){
      alert(`Ayni makine ayni vardiyada iki farkli kuyuda calisamaz. V${i+1} metrajini tek kuyuya yazin.`);
      return false;
    }
    if(Math.abs((oldVals[i] + newVals[i]) - s[i]) > 0.001){
      alert(`Kuyu değişimi dağılımı hatalı. ${i+1}. vardiyada eski+yeni kuyu toplamı vardiya metrajına eşit olmalı.`);
      return false;
    }
  }
  const oldTop = oldVals.reduce((a,b)=>a+b,0);
  const newTop = newVals.reduce((a,b)=>a+b,0);
  // Biten kuyu o vardiyada 0 metraj olabilir (delgiye başlamadan kuyu bitiş kararı çıkabilir).
  // Yalnızca toplam dağıtım sıfırsa engelle.
  if(oldTop + newTop <= 0){
    alert('Kuyu değişiminde en az bir vardiyada metraj girilmeli.');
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
  if(dl) dl.innerHTML = db.kuyular.filter(k=>makineEslesir(k.makine,m) && isAktifKuyu(k)).map(k=>`<option value="${esc(k.no)}">`).join('');
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
  setVardiyaLokasyonFromKuyu();
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
  const vals = vardiyaDegerleri();
  if(!validateVardiyaKaydi(tarih, sondaj, vals)) return;
  const s1 = vals[0].raw === '' ? null : vals[0].val;
  const s2 = vals[1].raw === '' ? null : vals[1].val;
  const s3 = vals[2].raw === '' ? null : vals[2].val;
  if(s1 === null && s2 === null && s3 === null){ alert('En az bir vardiya ilerlemesi girin.'); return; }

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
      showToast('Kuyu değişimi güncellendi', `${degisimSatirlari[0].sondaj} -> ${degisimSatirlari[1].sondaj}`);
      save(); closeVar(); renderMak(varMakine); renderDash();
      return;
    }
    const idx = db.gunluk.findIndex(r=>r.id===editVarId);
    if(idx !== -1){
      db.gunluk[idx] = {...db.gunluk[idx],
        tarih, sondaj, Lokasyon: lok,
        s1, s2, s3,
        not: not_,
        toplam: (s1??0)+(s2??0)+(s3??0),
        basDepth: sonDepth != null ? sonDepth : 0,
        depth
      };
    }
    editVarId = null;
    showToast('Vardiya güncellendi', `${varMakine} · ${sondaj}`);
    save(); closeVar(); renderMak(varMakine); renderDash();
    return;
  }

  if(degisimSatirlari){
    degisimSatirlari.forEach(row => upsertGunlukRow(row));
    showToast('Kuyu değişimi kaydedildi', `${degisimSatirlari[0].sondaj} -> ${degisimSatirlari[1].sondaj}`);
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
    basDepth: sonDepth != null ? sonDepth : 0,
    depth, not: not_
  });
  showToast('Vardiya kaydedildi', `${varMakine} · ${sondaj}`);

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
  ['d-son','d-dk','d-aciklama','d-lokasyon','d-bas-saat','d-bit-saat'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('d-tarih').value = new Date().toISOString().split('T')[0];
  document.getElementById('m-durak').classList.add('open');
}

function closeDurak(){ document.getElementById('m-durak').classList.remove('open'); editDurakId=null; }

function validateDuraklamaKaydi(data){
  if(!data.tarih){ alert('Tarih zorunludur.'); return false; }
  if(isGelecekTarih(data.tarih)){ alert('Gelecek tarihli duraklama kaydi girilemez.'); return false; }
  const yeniAralik = duraklamaAraligi(data);
  if((data.basSaat || data.bitSaat) && !yeniAralik){
    alert('Duraklama baslangic ve bitis saatini HH:MM formatinda girin.');
    return false;
  }
  if(yeniAralik){
    const cakisan = (db.duraklamalar || []).find(d =>
      d.id !== editDurakId &&
      makineEslesir(d.makine, data.makine) &&
      d.tarih === data.tarih &&
      parseInt(d.vardiya,10) === parseInt(data.vardiya,10) &&
      araliklarCakisiyor(yeniAralik, duraklamaAraligi(d))
    );
    if(cakisan){
      alert(`Ayni vardiyada cakisan duraklama var: ${cakisan.basSaat || '-'}-${cakisan.bitSaat || '-'}`);
      return false;
    }
  }
  return true;
}

function saveDurak(){
  const dk = parseFloat(document.getElementById('d-dk').value)||0;
  if(!dk){ alert('Süre giriniz.'); return; }
  const durakData = {
    makine:   document.getElementById('d-mak').value,
    tarih:    document.getElementById('d-tarih').value,
    vardiya:  parseInt(document.getElementById('d-vrd').value),
    basSaat:  document.getElementById('d-bas-saat')?.value || '',
    bitSaat:  document.getElementById('d-bit-saat')?.value || '',
    sondaj:   document.getElementById('d-son').value.trim(),
    neden:    document.getElementById('d-ned').value,
    lokasyon:  document.getElementById('d-lokasyon').value.trim(),
    aciklama: document.getElementById('d-aciklama').value.trim(),
    dk
  };
  // Lokasyon boşsa ilgili kuyunun mevkii'sinden doldur
  if(!durakData.lokasyon){
    const kuyular = sondajParcalari(durakData.sondaj).map(no => kuyuBul(no, durakData.makine)).filter(Boolean);
    durakData.lokasyon = [...new Set(kuyular.map(kuyuLokasyon).filter(Boolean))].join(' / ');
  }
  if(!validateDuraklamaKaydi(durakData)) return;
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
  ctx.strokeStyle='#606363'; ctx.lineWidth=2; ctx.setLineDash([]);
  ctx.beginPath();
  kumData.forEach((d,i) => {
    const x=xPos(d.tarih), y=yPos(d.kum);
    i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });
  ctx.stroke();

  // Noktalar
  kumData.forEach(d => {
    ctx.beginPath(); ctx.arc(xPos(d.tarih), yPos(d.kum), 3, 0, 2*Math.PI);
    ctx.fillStyle='#606363'; ctx.fill();
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
    ctx.fillStyle='#606363'; ctx.font='bold 11px IBM Plex Mono,monospace'; ctx.textAlign='left';
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
    return {label:m, val:dk, color:MAKINE_RENK[m]||'#96999b'};
  }).filter(d=>d.val>0);

  // Neden bazlı duraklama
  const NEDEN_COLORS={'SU KESİNTİSİ':'#1d4f8f','SU SEVİYESİ YÜKSELMESİ':'#0d9488','PATLATMA':'#b91c1c','DUMAN':'#231f20','ELEKTRİK KESİNTİSİ':'#f47721','DİĞER':'#96999b'};
  const nedenMap={};
  ayDurak.forEach(d=>{ const n=normalizeDuraklamaNedeni(d.neden)||'DİĞER'; nedenMap[n]=(nedenMap[n]||0)+(parseFloat(d.dk)||0); });
  const nedenData = Object.entries(nedenMap).map(([n,dk])=>({label:n,val:dk,color:NEDEN_COLORS[n]||'#96999b'})).filter(d=>d.val>0).sort((a,b)=>b.val-a.val);

  function makeSvgBar(data, title, W=380){
    const barH=28, gap=8, PAD_L=130, topPad=10;
    const maxVal=Math.max(...data.map(d=>d.val),1);
    const H=data.length*(barH+gap)+topPad+20;
    let bars='';
    data.forEach((d,i)=>{
      const y=topPad+i*(barH+gap);
      const w=Math.max(4,Math.round((d.val/maxVal)*(W-PAD_L-40)));
      bars+=`<rect x="${PAD_L}" y="${y}" width="${w}" height="${barH}" rx="4" fill="${d.color}" opacity="0.85"><title>${d.label}: ${d.val}dk</title></rect>`;
      bars+=`<text x="${PAD_L-6}" y="${y+barH/2+4}" text-anchor="end" font-size="10" fill="#606363" font-weight="500">${d.label.length>16?d.label.slice(0,14)+'…':d.label}</text>`;
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
    ctx.fillStyle = dk>120?'#231f20':dk>60?'#f47721':'#6f6045';
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
const CEYREK_LABEL = {'Q1':'1. Çeyrek (Ocak-Mart)','Q2':'2. Çeyrek (Nisan-Haziran)','Q3':'3. Çeyrek (Temmuz-Eylül)','Q4':'4. Çeyrek (Ekim-Aralık)'};
const CEYREK_RENK  = {'Q1':'#e9cd53','Q2':'#4f7d32','Q3':'#f47721','Q4':'#1d4f8f'};

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

function ozetFmt(n, digits=0){
  const val = Number(n) || 0;
  return val.toLocaleString('tr-TR', {minimumFractionDigits:digits, maximumFractionDigits:digits});
}

function ozetAyLabel(ay){
  const ad = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const p = String(ay || '').split('-');
  const idx = Math.max(0, (parseInt(p[1],10)||1)-1);
  return `${ad[idx]} ${p[0] || new Date().getFullYear()}`;
}

let ozetFilterMode = 'ay';
let ozetRangeBas = '';
let ozetRangeBit = '';

function ozetGetAy(){
  const sel = document.getElementById('ozet-ay-sec');
  return (sel && sel.value) || aktifAy || seciliAy || `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
}

function ozetBuildAySelect(yil){
  const sel = document.getElementById('ozet-ay-sec');
  if(!sel) return;
  const mevcut = sel.value || aktifAy || seciliAy;
  const ad = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  sel.innerHTML = ad.map((a,i) => {
    const v = `${yil}-${String(i+1).padStart(2,'0')}`;
    return `<option value="${v}">${a} ${yil}</option>`;
  }).join('');
  sel.value = mevcut && mevcut.startsWith(String(yil)) ? mevcut : `${yil}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
}

function ozetDefaultRange(){
  const ay = ozetGetAy();
  const [y, m] = ay.split('-').map(Number);
  const sonGun = new Date(y, m, 0).getDate();
  return {bas:`${ay}-01`, bit:`${ay}-${String(sonGun).padStart(2,'0')}`};
}

function ozetRangeMonths(bas, bit){
  const months = [];
  let [y, m] = bas.slice(0, 7).split('-').map(Number);
  const end = bit.slice(0, 7);
  while(`${y}-${String(m).padStart(2,'0')}` <= end){
    months.push(`${y}-${String(m).padStart(2,'0')}`);
    m += 1;
    if(m > 12){ m = 1; y += 1; }
  }
  return months;
}

function ozetSyncRangeInputs(){
  const basEl = document.getElementById('ozet-bas');
  const bitEl = document.getElementById('ozet-bit');
  if(!basEl || !bitEl) return;
  if(!ozetRangeBas || !ozetRangeBit){
    const def = ozetDefaultRange();
    ozetRangeBas = ozetRangeBas || def.bas;
    ozetRangeBit = ozetRangeBit || def.bit;
  }
  basEl.value = ozetRangeBas;
  bitEl.value = ozetRangeBit;
}

function ozetPeriod(yil){
  ozetSyncRangeInputs();
  if(ozetFilterMode === 'aralik'){
    let bas = ozetRangeBas;
    let bit = ozetRangeBit;
    if(bas && bit && bas > bit) [bas, bit] = [bit, bas];
    return {
      mode:'aralik',
      label:`${fmtDate(bas)} - ${fmtDate(bit)}`,
      months:ozetRangeMonths(bas, bit),
      bas,
      bit,
      budgetKeys:[]
    };
  }
  const ay = ozetGetAy();
  if(ozetFilterMode === 'ay'){
    return {mode:'ay', label:ozetAyLabel(ay), months:[ay], budgetKeys:[]};
  }
  if(CEYREK_AYLAR[ozetFilterMode]){
    return {
      mode:ozetFilterMode,
      label:CEYREK_LABEL[ozetFilterMode],
      months:CEYREK_AYLAR[ozetFilterMode].map(m => `${yil}-${m}`),
      budgetKeys:['q'+(['Q1','Q2','Q3','Q4'].indexOf(ozetFilterMode)+1)]
    };
  }
  return {
    mode:'yil',
    label:`${yil} Yıl Toplamı`,
    months:Array.from({length:12},(_,i)=>`${yil}-${String(i+1).padStart(2,'0')}`),
    budgetKeys:['q1','q2','q3','q4']
  };
}

function ozetInPeriod(tarih, period){
  if(period && period.mode === 'aralik'){
    return !!tarih && tarih >= period.bas && tarih <= period.bit;
  }
  return !!tarih && period.months.some(m => tarih.startsWith(m));
}

function setOzetFilter(mode){
  ozetFilterMode = mode || 'ay';
  if(ozetFilterMode === 'aralik') ozetSyncRangeInputs();
  document.querySelectorAll('[data-ozet-filter]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.ozetFilter === ozetFilterMode);
  });
  renderOzetPage();
}

function setOzetRange(){
  const basEl = document.getElementById('ozet-bas');
  const bitEl = document.getElementById('ozet-bit');
  ozetRangeBas = basEl && basEl.value ? basEl.value : ozetRangeBas;
  ozetRangeBit = bitEl && bitEl.value ? bitEl.value : ozetRangeBit;
  if(!ozetRangeBas || !ozetRangeBit) return;
  setOzetFilter('aralik');
}

function ozetGunlukMetraj(r){
  let toplam = (parseFloat(r.s1)||0)+(parseFloat(r.s2)||0)+(parseFloat(r.s3)||0);
  (r.kuyular||[]).forEach(k => { toplam += parseFloat(k.ilerleme)||0; });
  return toplam;
}

const OPEX_WAIT_USD_PER_HOUR = 38;
const OPEX_TARIFFS = {
  steep: {
    label: 'Karotlu',
    note: 'Eğim -45 altı',
    rates: [{from:0,to:200,rate:60},{from:200,to:400,rate:64},{from:400,to:600,rate:73}]
  },
  neg45: {
    label: '0/-45 derece',
    note: 'Eğim 0 ile -45',
    rates: [{from:0,to:200,rate:68},{from:200,to:400,rate:70},{from:400,to:600,rate:75}]
  },
  pos45: {
    label: '0/+45 derece',
    note: 'Pozitif eğim',
    rates: [{from:0,to:200,rate:71},{from:200,to:400,rate:74},{from:400,to:600,rate:74}]
  }
};

function opexFmtUsd(n){
  return '$' + (Math.round(n || 0)).toLocaleString('tr-TR');
}

function opexFindKuyu(no){
  const clean = String(no || '').trim();
  if(!clean || clean === '-') return null;
  return (db.kuyular || []).find(k => String(k.no || '').trim() === clean)
    || (db.kuyular || []).find(k => String(k.no || '').replace(/[^0-9]/g,'') === clean.replace(/[^0-9]/g,''));
}

function opexTariffKey(egim){
  const eg = parseFloat(egim);
  if(Number.isNaN(eg)) return 'steep';
  if(eg > 0) return 'pos45';
  if(eg >= -45) return 'neg45';
  return 'steep';
}

function opexRateAtDepth(tariff, depth){
  const bands = tariff.rates;
  return (bands.find(b => depth >= b.from && depth < b.to) || bands[bands.length - 1]).rate;
}

function opexDepthBandLabel(band, isLast){
  if(isLast || !band.to) return `${band.from}+ m`;
  return `${band.from}-${band.to} m`;
}

function opexDrillingParts(metre, startDepth, tariff){
  let left = Math.max(0, parseFloat(metre) || 0);
  let depth = Math.max(0, parseFloat(startDepth) || 0);
  const parts = [];
  while(left > 0.0001){
    let bandIndex = tariff.rates.findIndex(b => depth >= b.from && depth < b.to);
    if(bandIndex < 0) bandIndex = tariff.rates.length - 1;
    const band = tariff.rates[bandIndex];
    const next = band.to && depth < band.to ? band.to : depth + left;
    const part = Math.min(left, next - depth);
    const rate = opexRateAtDepth(tariff, depth);
    parts.push({bandIndex, metre:part, rate, cost:part * rate});
    depth += part;
    left -= part;
  }
  return parts;
}

function opexDrillingCost(metre, startDepth, tariff){
  let cost = 0;
  opexDrillingParts(metre, startDepth, tariff).forEach(p => { cost += p.cost; });
  return cost;
}

function opexGunlukKuyuEntries(r){
  const entries = [];
  if(Array.isArray(r.kuyular) && r.kuyular.length){
    r.kuyular.forEach(k => {
      const metre = parseFloat(k.ilerleme) || 0;
      if(metre > 0) entries.push({no:k.no, metre});
    });
    return entries;
  }
  const metre = (parseFloat(r.s1)||0)+(parseFloat(r.s2)||0)+(parseFloat(r.s3)||0);
  if(metre <= 0) return entries;
  const nos = kuyuNolariFromSondaj(r.sondaj).filter(Boolean);
  if(!nos.length) return entries;
  const share = metre / nos.length;
  nos.forEach(no => entries.push({no, metre:share}));
  return entries;
}

function ozetOpexSummary(period){
  const allRows = (db.gunluk || [])
    .slice()
    .sort((a,b) => String(a.tarih || '').localeCompare(String(b.tarih || '')) || ((a.id||0) - (b.id||0)));
  const depthByKuyu = {};
  const byTariff = {};
  const byMachine = {};
  let drilling = 0;
  let metres = 0;
  let missing = 0;

  Object.keys(OPEX_TARIFFS).forEach(k => {
    byTariff[k] = {
      key:k,
      label:OPEX_TARIFFS[k].label,
      note:OPEX_TARIFFS[k].note,
      metres:0,
      cost:0,
      bands:OPEX_TARIFFS[k].rates.map((b,i,arr) => ({
        label:opexDepthBandLabel(b, i === arr.length - 1),
        rate:b.rate,
        metres:0,
        cost:0
      }))
    };
  });

  allRows.forEach(r => {
    opexGunlukKuyuEntries(r).forEach(e => {
      const kuyu = opexFindKuyu(e.no);
      if(!kuyu) missing += ozetInPeriod(r.tarih, period) ? e.metre : 0;
      const key = opexTariffKey(kuyu && kuyu.eg);
      const tariff = OPEX_TARIFFS[key];
      const start = depthByKuyu[e.no] || parseFloat(kuyu && (kuyu.bm || kuyu.guncelBaslangic)) || 0;
      const parts = opexDrillingParts(e.metre, start, tariff);
      const cost = parts.reduce((s,p) => s + p.cost, 0);
      depthByKuyu[e.no] = start + e.metre;
      if(!ozetInPeriod(r.tarih, period)) return;
      drilling += cost;
      metres += e.metre;
      byTariff[key].metres += e.metre;
      byTariff[key].cost += cost;
      parts.forEach(p => {
        const band = byTariff[key].bands[p.bandIndex];
        if(!band) return;
        band.metres += p.metre;
        band.cost += p.cost;
      });
      const machine = r.makine || 'Makine yok';
      byMachine[machine] = byMachine[machine] || {machine, metres:0, cost:0};
      byMachine[machine].metres += e.metre;
      byMachine[machine].cost += cost;
    });
  });

  const waitMinutes = (db.duraklamalar || [])
    .filter(d => ozetInPeriod(d.tarih, period))
    .reduce((s,d) => s + (parseFloat(d.dk)||0), 0);
  const waiting = waitMinutes / 60 * OPEX_WAIT_USD_PER_HOUR;
  return {
    metres,
    drilling,
    waitMinutes,
    waiting,
    total: drilling + waiting,
    avg: metres ? drilling / metres : 0,
    missing,
    byTariff: Object.values(byTariff).filter(x => x.metres || x.cost),
    byMachine: Object.values(byMachine).sort((a,b)=>b.cost-a.cost)
  };
}

function renderOzetOpex(period){
  const wrap = document.getElementById('ozet-opex-wrap');
  if(!wrap) return;
  const s = ozetOpexSummary(period);
  if(!s.metres && !s.waitMinutes){
    wrap.innerHTML = '<div class="ozet-empty">Seçili dönem için OPEX hesaplanacak metraj veya duraklama verisi yok.</div>';
    return;
  }
  const maxTariff = Math.max(1, ...s.byTariff.map(x=>x.cost));
  const maxMachine = Math.max(1, ...s.byMachine.map(x=>x.cost));
  wrap.innerHTML = `
    <div class="ozet-opex-cards">
      <div><span>Toplam OPEX</span><strong>${opexFmtUsd(s.total)}</strong><small>Delgi + bekleme</small></div>
      <div><span>Delgi Maliyeti</span><strong>${opexFmtUsd(s.drilling)}</strong><small>${ozetFmt(s.metres,1)} m</small></div>
      <div><span>Bekleme</span><strong>${opexFmtUsd(s.waiting)}</strong><small>${ozetFmt(s.waitMinutes,0)} dk x $${OPEX_WAIT_USD_PER_HOUR}/sa</small></div>
      <div><span>Ortalama Birim</span><strong>$${ozetFmt(s.avg,1)}</strong><small>metre başı delgi</small></div>
    </div>
    <div class="ozet-opex-grid">
      <div>
        <div class="ozet-opex-title">Eğim ve derinlik tarifesi</div>
        <div class="ozet-opex-bars">${s.byTariff.map(x => `
          <div class="ozet-opex-row" style="--w:${Math.round(x.cost/maxTariff*100)}%">
            <div>
              <strong>${esc(x.label)}</strong>
              <span>${esc(x.note)} · ${ozetFmt(x.metres,1)} m</span>
              <div class="ozet-rate-chips">${x.bands.filter(b => b.metres > 0).map(b => `<em>${esc(b.label)} · $${b.rate}/m · ${ozetFmt(b.metres,1)} m</em>`).join('') || '<em>Derinlik verisi yok</em>'}</div>
            </div>
            <i></i>
            <b>${opexFmtUsd(x.cost)}</b>
          </div>`).join('')}</div>
      </div>
      <div>
        <div class="ozet-opex-title">Makine maliyet sıralaması</div>
        <div class="ozet-opex-bars">${s.byMachine.slice(0,5).map(x => `
          <div class="ozet-opex-row machine" style="--w:${Math.round(x.cost/maxMachine*100)}%">
            <div><strong>${esc(x.machine)}</strong><span>${ozetFmt(x.metres,1)} m</span></div>
            <i></i>
            <b>${opexFmtUsd(x.cost)}</b>
          </div>`).join('')}</div>
      </div>
    </div>
    ${s.missing ? `<div class="ozet-opex-note">Not: ${ozetFmt(s.missing,1)} m için kuyu teknik bilgisi bulunamadı; varsayılan karotlu tarife kullanıldı.</div>` : ''}`;
}

// ══════════════════════════════════════════════════════════════
// HAKEDİŞ — kuyu bazlı OPEX / hakediş
// (Mevcut OPEX tarife ve hesap yardımcıları yeniden kullanılır.)
// ══════════════════════════════════════════════════════════════
let hakedisSelectedKuyular = [];      // [] = Tüm Kuyular; tek eleman = detay; >1 = çoklu
let hakedisLocationFilter = '';       // '' = Tüm Lokasyonlar
const hakedisStatusMap = {};          // kuyuNo -> hakediş durumu (local state)
const hakedisMetaMap = {};            // kuyuNo -> {onaylayan, onayTarihi, revizeNot, faturaTarihi, odemeTarihi}
const hakedisOpenDetails = new Set();  // çoklu görünümde açık detay satırları
let hakedisStatusLoaded = false;
const HAKEDIS_STORE_KEY = 'hakedis_durum_v1';
const HAKEDIS_DEFAULT_DURUM = 'Taslak';

// ── Finansal sabitler (merkezi; ileride değiştirilebilir) ──
const HAKEDIS_KDV_ORANI = 0.20;       // KDV %20
const HAKEDIS_TEVKIFAT_ORANI = 0.40;  // Tevkifat 4/10
let hakedisKur = 0;                    // Manuel USD/TL kuru (0 = girilmedi)
const hakedisKesintiMap = {};          // kuyuNo -> {elektrik, motorin, servis} (TL) — tek kuyu
const hakedisTopluKesinti = { elektrik:0, motorin:0, servis:0 }; // çoklu görünümde tek kalem kesinti (TL)

// Lokasyon/kuyu adından grup belirleyen güvenli helper
function getLocationGroup(value){
  const normalized = (value == null ? '' : String(value)).trim().toUpperCase();
  if(normalized.startsWith('KAT')) return 'Bolkar 2';
  if(normalized.startsWith('B1'))  return 'B1';
  if(normalized.startsWith('BYA')) return 'Bolkar 1';
  if(normalized.startsWith('GS'))  return 'Bolkar 1';
  return 'Tanımsız';
}

// Önce location alanı (mevkii), yoksa/uymuyorsa kuyu adı üzerinden grupla
function hakedisLocationGroup(kuyu){
  const byLoc = getLocationGroup(kuyu && (kuyu.mevkii || kuyu.lokasyon || kuyu.location));
  if(byLoc !== 'Tanımsız') return byLoc;
  return getLocationGroup(kuyu && kuyu.no);
}

function hakedisLoadStatus(){
  try{
    const raw = localStorage.getItem(HAKEDIS_STORE_KEY);
    if(!raw) return;
    const obj = JSON.parse(raw) || {};
    if(obj.durum) Object.assign(hakedisStatusMap, obj.durum);
    if(obj.meta)  Object.assign(hakedisMetaMap, obj.meta);
    if(obj.kesinti) Object.assign(hakedisKesintiMap, obj.kesinti);
    if(obj.topluKesinti) Object.assign(hakedisTopluKesinti, obj.topluKesinti);
    if(typeof obj.kur === 'number' && isFinite(obj.kur) && obj.kur > 0) hakedisKur = obj.kur;
  }catch(e){ /* güvenli yut */ }
}

function hakedisSaveStatus(){
  try{ localStorage.setItem(HAKEDIS_STORE_KEY, JSON.stringify({durum:hakedisStatusMap, meta:hakedisMetaMap, kesinti:hakedisKesintiMap, topluKesinti:hakedisTopluKesinti, kur:hakedisKur})); }catch(e){ /* yut */ }
}

// "32,5" / "32.5" / "1.234,56" gibi girişleri güvenli parse et; negatif/0/NaN -> 0
function hakedisParseNum(str){
  if(str == null) return 0;
  let s = String(str).trim().replace(/\s/g,'');
  if(!s) return 0;
  if(s.indexOf(',') >= 0 && s.indexOf('.') >= 0){
    s = s.replace(/\./g,'').replace(',', '.');   // nokta binlik, virgül ondalık
  }else{
    s = s.replace(',', '.');
  }
  const v = parseFloat(s);
  return (isFinite(v) && v > 0) ? v : 0;
}

function hakedisFmtTl(n){
  const v = Number(n);
  if(!isFinite(v)) return '-';
  return '₺' + v.toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2});
}

function hakedisFmtKur(n){
  const v = Number(n);
  if(!isFinite(v) || v <= 0) return '-';
  return v.toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2});
}

// Bir kuyunun TL kesinti kalemleri
function hakedisKesintiOf(no){
  const k = hakedisKesintiMap[no] || {};
  const elektrik = Math.max(0, parseFloat(k.elektrik) || 0);
  const motorin  = Math.max(0, parseFloat(k.motorin)  || 0);
  const servis   = Math.max(0, parseFloat(k.servis)   || 0);
  return { elektrik, motorin, servis, toplam: elektrik + motorin + servis };
}

// USD brüt + TL kesinti + kur -> tüm TL finansal alanlar (güvenli)
function hakedisFinans(brutUsd, kesintiTl, kur){
  const hakedisUsd = Number(brutUsd) || 0;
  const kes = Number(kesintiTl) || 0;
  const valid = isFinite(kur) && kur > 0;
  if(!valid){
    return { valid:false, hakedisUsd, kur:0, kesintiTl:kes,
      hakedisTl:NaN, netHakedisTl:NaN, kdvTl:NaN, tevkifatliKdvTl:NaN, netOdenecekTl:NaN };
  }
  const hakedisTl = hakedisUsd * kur;
  const netHakedisTl = hakedisTl - kes;
  const kdvTl = netHakedisTl * HAKEDIS_KDV_ORANI;
  const tevkifatliKdvTl = kdvTl * HAKEDIS_TEVKIFAT_ORANI;
  const netOdenecekTl = netHakedisTl + kdvTl - tevkifatliKdvTl;
  return { valid:true, hakedisUsd, kur, kesintiTl:kes, hakedisTl, netHakedisTl, kdvTl, tevkifatliKdvTl, netOdenecekTl };
}

function hakedisFinansForRec(rec){
  return hakedisFinans(rec.brut, hakedisKesintiOf(rec.no).toplam, hakedisKur);
}

function hakedisFinansForRows(rows){
  const brutUsd = rows.reduce((s,r)=>s + (Number(r.brut)||0), 0);
  const kesintiTl = rows.reduce((s,r)=>s + hakedisKesintiOf(r.no).toplam, 0);
  return hakedisFinans(brutUsd, kesintiTl, hakedisKur);
}

// Çoklu görünüm: kesinti tek kalem (hakedisTopluKesinti) olarak uygulanır
function hakedisTopluKesintiToplam(){
  const elektrik = Math.max(0, parseFloat(hakedisTopluKesinti.elektrik) || 0);
  const motorin  = Math.max(0, parseFloat(hakedisTopluKesinti.motorin)  || 0);
  const servis   = Math.max(0, parseFloat(hakedisTopluKesinti.servis)   || 0);
  return { elektrik, motorin, servis, toplam: elektrik + motorin + servis };
}

function hakedisFinansForRowsGroup(rows){
  const brutUsd = rows.reduce((s,r)=>s + (Number(r.brut)||0), 0);
  return hakedisFinans(brutUsd, hakedisTopluKesintiToplam().toplam, hakedisKur);
}

function setHakedisTopluKesinti(field, val){
  hakedisTopluKesinti[field] = hakedisParseNum(val);
  hakedisSaveStatus();
  renderHakedis();
}

function hakedisKesintiEditable(durum){
  return durum === 'Taslak' || durum === 'Revize İstendi';
}

function setHakedisKur(val){
  hakedisKur = hakedisParseNum(val);
  hakedisSaveStatus();
  renderHakedis();
}

function setHakedisKesinti(no, field, val){
  const durum = hakedisStatusMap[no] || HAKEDIS_DEFAULT_DURUM;
  if(!hakedisKesintiEditable(durum)) return; // Onaylı/faturalı/ödendi durumunda kilitli
  const cur = Object.assign({}, hakedisKesintiMap[no] || {});
  cur[field] = hakedisParseNum(val);
  hakedisKesintiMap[no] = cur;
  hakedisSaveStatus();
  renderHakedis();
}

function hakedisSafe(v, fallback='-'){
  if(v === undefined || v === null) return fallback;
  const s = String(v).trim();
  return s === '' ? fallback : s;
}

function hakedisFmtDate(d){
  const s = hakedisSafe(d, '');
  return s ? fmtDate(s) : '-';
}

// Delgi verisi olan kuyuların listesi (metraj > 0)
function hakedisKuyuList(){
  const map = {};
  (db.gunluk || []).forEach(r => {
    opexGunlukKuyuEntries(r).forEach(e => {
      const no = String(e.no || '').trim();
      if(!no || no === '-') return;
      map[no] = (map[no] || 0) + (parseFloat(e.metre) || 0);
    });
  });
  return Object.keys(map).filter(no => map[no] > 0).sort((a,b)=>a.localeCompare(b,'tr'));
}

// Her kuyu için kademeli (derinlik aralığı bazlı) OPEX / hakediş kaydı üretir
function hakedisBuildRecords(){
  const metrajByKuyu = {};
  const gunlerByKuyu = {};
  (db.gunluk || []).forEach(r => {
    opexGunlukKuyuEntries(r).forEach(e => {
      const no = String(e.no || '').trim();
      if(!no || no === '-') return;
      metrajByKuyu[no] = (metrajByKuyu[no] || 0) + (parseFloat(e.metre) || 0);
      if(r.tarih){ (gunlerByKuyu[no] = gunlerByKuyu[no] || new Set()).add(r.tarih); }
    });
  });

  // Duraklama ilişkilendirme: sondaj alanı bir kuyuya eşleşiyorsa o kuyuya yazılır
  const durakByKuyu = {};
  (db.duraklamalar || []).forEach(d => {
    const kuyu = opexFindKuyu(d.sondaj);
    if(!kuyu) return;
    const no = String(kuyu.no || '').trim();
    if(!no) return;
    durakByKuyu[no] = (durakByKuyu[no] || 0) + (parseFloat(d.dk) || 0);
  });

  return Object.keys(metrajByKuyu).map(no => {
    const kuyu = opexFindKuyu(no) || {};
    const tariffKey = opexTariffKey(kuyu.eg);
    const tariff = OPEX_TARIFFS[tariffKey];
    const startDepth = parseFloat(kuyu.bm || kuyu.guncelBaslangic) || 0;
    const metraj = metrajByKuyu[no] || 0;
    const parts = opexDrillingParts(metraj, startDepth, tariff);
    // parts -> derinlik aralıklı satırlar (kademeli tarife)
    let d = startDepth;
    const bands = parts.map(p => {
      const from = d;
      const to = d + p.metre;
      d = to;
      const tier = tariff.rates[p.bandIndex] || tariff.rates[tariff.rates.length - 1];
      const tierLabel = opexDepthBandLabel(tier, p.bandIndex === tariff.rates.length - 1);
      return { from, to, metre:p.metre, rate:p.rate, cost:p.cost, tierLabel };
    });
    const drilling = bands.reduce((s,b)=>s+b.cost,0);
    const durakMin = durakByKuyu[no] || 0;
    const waiting = durakMin / 60 * OPEX_WAIT_USD_PER_HOUR;
    const kesinti = 0; // Veri modeli kesintiyi desteklemiyor; ileride girilebilir
    const brut = drilling + waiting;
    const net = brut - kesinti;
    const avg = metraj ? drilling / metraj : 0;
    const gunSay = gunlerByKuyu[no] ? gunlerByKuyu[no].size : 0;
    const verim = gunSay ? metraj / gunSay : 0;
    const locGroup = hakedisLocationGroup({no, mevkii: kuyu.mevkii, lokasyon: kuyu.lokasyon, location: kuyu.location});
    return {
      no,
      makine: hakedisSafe(kuyu.makine),
      firma: hakedisSafe(kuyu.firma || kuyu.ekip),
      mevkii: hakedisSafe(kuyu.mevkii),
      locGroup,
      bas: kuyu.bas || '',
      bit: kuyu.bit || '',
      egim: (kuyu.eg !== undefined && kuyu.eg !== null && kuyu.eg !== '') ? kuyu.eg : null,
      tariffKey, tariffLabel: tariff.label,
      startDepth, metraj, bands, drilling,
      durakMin, waiting, kesinti, brut, net, avg, verim,
      durum: hakedisStatusMap[no] || HAKEDIS_DEFAULT_DURUM,
      meta: hakedisMetaMap[no] || {}
    };
  }).sort((a,b)=>String(a.no).localeCompare(String(b.no),'tr'));
}

function hakedisEgimText(rec){
  return rec.egim === null ? '-' : `${ozetFmt(rec.egim,0)}°`;
}

function hakedisStatusClass(durum){
  if(durum === 'Onaylandı' || durum === 'Faturaya Aktarıldı' || durum === 'Ödendi') return 'good';
  if(durum === 'Revize İstendi') return 'warn';
  return 'idle';
}

function hakedisBadge(durum){
  return `<span class="ozet-status ${hakedisStatusClass(durum)}">${esc(durum)}</span>`;
}

// Lokasyon filtresine göre kayıtları süz
function hakedisRecordsForLocation(records){
  if(!hakedisLocationFilter) return records;
  return records.filter(r => r.locGroup === hakedisLocationFilter);
}

// Çoklu seçim dropdown menüsünü ve buton etiketini kur
function hakedisBuildKuyuMenu(records){
  const btn = document.getElementById('hakedis-kuyu-btn');
  const menu = document.getElementById('hakedis-kuyu-menu');
  if(!btn || !menu) return;
  const list = hakedisRecordsForLocation(records).map(r => r.no);
  const n = hakedisSelectedKuyular.length;
  btn.textContent = n === 0 ? 'Tüm Kuyular' : (n === 1 ? hakedisSelectedKuyular[0] : `${n} kuyu seçili`);
  const items = list.map(no => {
    const chk = hakedisSelectedKuyular.includes(no) ? 'checked' : '';
    return `<div class="hakedis-ms-item" onclick="hakedisToggleKuyu('${esc(no)}',event)"><input type="checkbox" ${chk}><span>${esc(no)}</span></div>`;
  }).join('') || '<div class="hakedis-ms-item" style="color:var(--text3)">Kuyu bulunamadı</div>';
  menu.innerHTML =
    `<div class="hakedis-ms-item" onclick="hakedisPickAll(event)"><input type="checkbox" ${n===0?'checked':''}><span>Tüm Kuyular</span></div>` +
    `<div class="hakedis-ms-sep"></div>` + items;
}

function toggleHakedisKuyuMenu(e){
  if(e) e.stopPropagation();
  const menu = document.getElementById('hakedis-kuyu-menu');
  if(menu) menu.classList.toggle('open');
}

function hakedisOutsideClick(e){
  const ms = document.getElementById('hakedis-kuyu-ms');
  const menu = document.getElementById('hakedis-kuyu-menu');
  if(menu && menu.classList.contains('open') && ms && !ms.contains(e.target)) menu.classList.remove('open');
}

function hakedisPickAll(e){
  if(e) e.stopPropagation();
  hakedisSelectedKuyular = [];
  renderHakedis();
}

function hakedisToggleKuyu(no, e){
  if(e) e.stopPropagation();
  const i = hakedisSelectedKuyular.indexOf(no);
  if(i >= 0) hakedisSelectedKuyular.splice(i, 1); else hakedisSelectedKuyular.push(no);
  renderHakedis();
}

function setHakedisLocation(val){
  hakedisLocationFilter = val || '';
  // Yeni lokasyona uymayan seçili kuyuları güvenli şekilde temizle
  const records = hakedisBuildRecords();
  const allowed = new Set(hakedisRecordsForLocation(records).map(r => r.no));
  hakedisSelectedKuyular = hakedisSelectedKuyular.filter(no => allowed.has(no));
  renderHakedis();
}

// ── HAKEDİŞ ONAY AKIŞI ──────────────────────────────────────
// durum -> [ [buton etiketi, hedef durum, buton stili] ]
function hakedisFlow(durum){
  switch(durum){
    case 'Taslak':             return [['Kontrole Gönder','Kontrol Bekliyor','p']];
    case 'Kontrol Bekliyor':   return [['Onayla','Onaylandı','p'], ['Revize İste','Revize İstendi','g']];
    case 'Revize İstendi':     return [['Taslağa Al','Taslak','g']];
    case 'Onaylandı':          return [['Faturaya Aktar','Faturaya Aktarıldı','p']];
    case 'Faturaya Aktarıldı': return [['Ödendi İşaretle','Ödendi','p']];
    default:                   return [];
  }
}

// Her durumun bir önceki adımı (yanlışlıkla ilerletince geri dönmek için)
const HAKEDIS_PREV = {
  'Kontrol Bekliyor':   'Taslak',
  'Onaylandı':          'Kontrol Bekliyor',
  'Revize İstendi':     'Kontrol Bekliyor',
  'Faturaya Aktarıldı': 'Onaylandı',
  'Ödendi':             'Faturaya Aktarıldı'
};

function hakedisActionButtons(no, durum){
  const flow = hakedisFlow(durum);
  const fwd = flow.map(f => `<button class="btn btn-${f[2]} hakedis-act" onclick="hakedisAction('${esc(no)}','${f[1]}')">${f[0]}</button>`).join('');
  const prev = HAKEDIS_PREV[durum];
  const back = prev ? `<button class="btn btn-d hakedis-act" onclick="hakedisUndo('${esc(no)}')" title="Bir önceki adıma dön: ${esc(prev)}">↶ Geri Al</button>` : '';
  return fwd + back;
}

function hakedisActionsHtml(no, durum){
  const btns = hakedisActionButtons(no, durum);
  return `${hakedisBadge(durum)}${btns ? ' ' + btns : ' <span style="font-size:11px;color:var(--text3);font-weight:700">Süreç tamamlandı</span>'}`;
}

function hakedisAction(no, toDurum){
  const user = ((document.getElementById('auth-user')?.textContent) || '').trim() || '-';
  const bugun = new Date().toISOString().slice(0,10);
  const meta = Object.assign({}, hakedisMetaMap[no] || {});
  if(toDurum === 'Revize İstendi'){
    const note = window.prompt('Revizyon notu (opsiyonel):', meta.revizeNot || '');
    if(note === null) return; // iptal edildi
    meta.revizeNot = note.trim();
  }
  if(toDurum === 'Onaylandı'){ meta.onaylayan = user; meta.onayTarihi = bugun; }
  if(toDurum === 'Faturaya Aktarıldı'){ meta.faturaTarihi = bugun; }
  if(toDurum === 'Ödendi'){ meta.odemeTarihi = bugun; }
  hakedisStatusMap[no] = toDurum;
  hakedisMetaMap[no] = meta;
  hakedisSaveStatus();
  renderHakedis();
}

function hakedisUndo(no){
  const cur = hakedisStatusMap[no] || HAKEDIS_DEFAULT_DURUM;
  const prev = HAKEDIS_PREV[cur];
  if(!prev) return;
  // Geri alınan adıma ait meta bilgisini temizle
  const meta = Object.assign({}, hakedisMetaMap[no] || {});
  if(cur === 'Onaylandı'){ delete meta.onaylayan; delete meta.onayTarihi; }
  if(cur === 'Faturaya Aktarıldı'){ delete meta.faturaTarihi; }
  if(cur === 'Ödendi'){ delete meta.odemeTarihi; }
  if(cur === 'Revize İstendi'){ delete meta.revizeNot; }
  hakedisStatusMap[no] = prev;
  hakedisMetaMap[no] = meta;
  hakedisSaveStatus();
  renderHakedis();
}

function hakedisBulkKontrol(){
  let changed = false;
  hakedisSelectedKuyular.forEach(no => {
    const cur = hakedisStatusMap[no] || HAKEDIS_DEFAULT_DURUM;
    if(cur === 'Taslak'){ hakedisStatusMap[no] = 'Kontrol Bekliyor'; changed = true; }
  });
  if(changed){ hakedisSaveStatus(); renderHakedis(); }
}

function hakedisToggleDetail(no){
  if(hakedisOpenDetails.has(no)) hakedisOpenDetails.delete(no); else hakedisOpenDetails.add(no);
  renderHakedis();
}

function hakedisKpiCards(items){
  const wrap = document.getElementById('hakedis-kpi-band');
  if(!wrap) return;
  wrap.innerHTML = items.map(i => `<div class="ozet-kpi" style="--kpi-color:${i[4]}">
    <div class="k-lbl">${i[0]}</div>
    <div class="k-val">${i[1]}${i[2] ? ` <span>${i[2]}</span>` : ''}</div>
    <div class="k-note">${i[3]}</div>
  </div>`).join('');
}

function renderHakedisKpisAll(rows){
  const brutUsd = rows.reduce((s,r)=>s+r.brut,0);
  const f = hakedisFinansForRows(rows);
  const tl = (v)=> f.valid ? hakedisFmtTl(v) : '-';
  const note = f.valid ? '' : 'Kur giriniz';
  hakedisKpiCards([
    ['Toplam Hakediş USD', opexFmtUsd(brutUsd), '', `${rows.length} kuyu`, 'var(--gold)'],
    ['Dolar Kuru', hakedisFmtKur(hakedisKur), 'USD/TL', hakedisKur > 0 ? 'manuel' : 'girilmedi', 'var(--blue)'],
    ['Toplam Hakediş TL', tl(f.hakedisTl), '', note || 'Brüt USD × kur', 'var(--gold)'],
    ['Toplam Kesinti TL', hakedisFmtTl(f.kesintiTl), '', 'Elektrik+Motorin+Servis', 'var(--warn)'],
    ['Net Hakediş TL', tl(f.netHakedisTl), '', note || 'Hakediş − kesinti', 'var(--green)'],
    ['Net Ödenecek Tutar TL', tl(f.netOdenecekTl), '', note || 'Net + KDV − tevkifat', 'var(--green)']
  ]);
}

function renderHakedisKpisSingle(rec){
  if(!rec){
    hakedisKpiCards([
      ['Seçili Kuyu Toplam Metrajı','0','m','Veri yok','var(--gold)'],
      ['Delgi Tutarı','$0','','Veri yok','var(--green)'],
      ['Duraklama/Bekleme Tutarı','$0','','Veri yok','var(--warn)'],
      ['Kesinti','$0','','Veri yok','var(--warn)'],
      ['Net Hakediş','$0','','Veri yok','var(--green)'],
      ['Ortalama $/m','$0','','Veri yok','var(--purple)']
    ]);
    return;
  }
  hakedisKpiCards([
    ['Seçili Kuyu Toplam Metrajı', ozetFmt(rec.metraj,1), 'm', esc(rec.no), 'var(--gold)'],
    ['Delgi Tutarı', opexFmtUsd(rec.drilling), '', `${rec.bands.length} derinlik kademesi`, 'var(--green)'],
    ['Duraklama/Bekleme Tutarı', opexFmtUsd(rec.waiting), '', `${ozetFmt(rec.durakMin,0)} dk`, 'var(--warn)'],
    ['Kesinti', opexFmtUsd(rec.kesinti), '', 'Kayıtlı kesinti', 'var(--warn)'],
    ['Net Hakediş', opexFmtUsd(rec.net), '', 'Brüt − kesinti', 'var(--green)'],
    ['Ortalama $/m', `$${ozetFmt(rec.avg,1)}`, '', 'metre başı delgi', 'var(--purple)']
  ]);
}

function renderHakedisInfo(rec){
  const wrap = document.getElementById('hakedis-info-wrap');
  if(!wrap) return;
  if(!rec){ wrap.innerHTML = ''; return; }
  wrap.innerHTML = `<div class="ozet-panel" style="margin-bottom:16px">
    <div class="ozet-panel-head">
      <div><span>KUYU BİLGİSİ</span><strong>${esc(rec.no)}</strong></div>
      <small>Seçili kuyu özeti</small>
    </div>
    <div class="stat-row">
      <div class="sc"><div class="sc-lbl">Kuyu</div><div class="sc-val">${esc(rec.no)}</div></div>
      <div class="sc"><div class="sc-lbl">Makine</div><div class="sc-val">${esc(rec.makine)}</div></div>
      <div class="sc"><div class="sc-lbl">Firma/Ekip</div><div class="sc-val">${esc(rec.firma)}</div></div>
      <div class="sc"><div class="sc-lbl">Başlangıç</div><div class="sc-val">${hakedisFmtDate(rec.bas)}</div></div>
      <div class="sc"><div class="sc-lbl">Bitiş</div><div class="sc-val">${hakedisFmtDate(rec.bit)}</div></div>
      <div class="sc"><div class="sc-lbl">Toplam Metraj</div><div class="sc-val gold">${ozetFmt(rec.metraj,1)} <span>m</span></div></div>
      <div class="sc"><div class="sc-lbl">Ortalama Verim</div><div class="sc-val">${ozetFmt(rec.verim,1)} <span>m/gün</span></div></div>
      <div class="sc"><div class="sc-lbl">Toplam Duraklama</div><div class="sc-val">${ozetFmt(rec.durakMin,0)} <span>dk</span></div></div>
      <div class="sc"><div class="sc-lbl">Hakediş Durumu</div><div class="sc-val">${hakedisBadge(rec.durum)}</div></div>
    </div>
    <div class="hakedis-acts" style="margin-top:12px">${hakedisActionsHtml(rec.no, rec.durum)}</div>
    ${hakedisMetaHtml(rec.meta)}
  </div>`;
}

function hakedisMetaHtml(meta){
  const m = meta || {};
  const parts = [];
  if(m.onaylayan) parts.push(`Onaylayan: ${esc(m.onaylayan)}`);
  if(m.onayTarihi) parts.push(`Onay: ${hakedisFmtDate(m.onayTarihi)}`);
  if(m.revizeNot) parts.push(`Revizyon notu: ${esc(m.revizeNot)}`);
  if(m.faturaTarihi) parts.push(`Faturaya aktarma: ${hakedisFmtDate(m.faturaTarihi)}`);
  if(m.odemeTarihi) parts.push(`Ödeme: ${hakedisFmtDate(m.odemeTarihi)}`);
  if(!parts.length) return '';
  return `<div style="margin-top:8px;font-size:11px;color:var(--text3);font-weight:700">${parts.join(' · ')}</div>`;
}

function renderHakedisSummaryTable(rows){
  const wrap = document.getElementById('hakedis-table-wrap');
  if(!wrap) return;
  if(!rows.length){
    wrap.innerHTML = '<div class="ozet-empty">Hakediş hesaplanacak kuyu verisi bulunamadı.</div>';
    return;
  }
  const tlCell = (f, key)=> f.valid ? hakedisFmtTl(f[key]) : '<span style="color:var(--text3)">-</span>';
  const body = rows.map(r => {
    const acts = hakedisActionButtons(r.no, r.durum);
    const f = hakedisFinansForRec(r);
    const kes = hakedisKesintiOf(r.no);
    return `<tr>
    <td>${esc(r.no)}</td>
    <td>${esc(r.locGroup)}</td>
    <td>${esc(r.makine)}</td>
    <td class="c">${ozetFmt(r.metraj,1)}</td>
    <td class="c">${opexFmtUsd(r.brut)}</td>
    <td class="c">${tlCell(f,'hakedisTl')}</td>
    <td class="c">${hakedisFmtTl(kes.toplam)}</td>
    <td class="c">${tlCell(f,'netHakedisTl')}</td>
    <td class="c">${tlCell(f,'kdvTl')}</td>
    <td class="c">${tlCell(f,'tevkifatliKdvTl')}</td>
    <td class="c">${tlCell(f,'netOdenecekTl')}</td>
    <td>${hakedisBadge(r.durum)}</td>
    <td>${acts ? `<div class="hakedis-acts">${acts}</div>` : '<span style="font-size:11px;color:var(--text3);font-weight:700">—</span>'}</td>
  </tr>`;
  }).join('');
  const metrajT = rows.reduce((s,r)=>s+r.metraj,0);
  const brutUsd = rows.reduce((s,r)=>s+r.brut,0);
  const kesToplam = rows.reduce((s,r)=>s+hakedisKesintiOf(r.no).toplam,0);
  const ft = hakedisFinansForRows(rows);
  const tlFoot = (key)=> ft.valid ? hakedisFmtTl(ft[key]) : '-';
  wrap.innerHTML = `<div class="tw"><table>
    <thead><tr>
      <th style="min-width:90px">Kuyu</th>
      <th style="min-width:90px">Lokasyon</th>
      <th style="min-width:110px">Makine</th>
      <th class="c" style="min-width:100px">Toplam Metraj</th>
      <th class="c" style="min-width:110px">Hakediş USD</th>
      <th class="c" style="min-width:120px">Hakediş TL</th>
      <th class="c" style="min-width:120px">Toplam Kesinti TL</th>
      <th class="c" style="min-width:130px">Net Hakediş TL</th>
      <th class="c" style="min-width:110px">KDV TL</th>
      <th class="c" style="min-width:130px">Tevkifatlı KDV TL</th>
      <th class="c" style="min-width:140px">Net Ödenecek TL</th>
      <th style="min-width:110px">Hakediş Durumu</th>
      <th style="min-width:180px">İşlem</th>
    </tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr style="font-weight:900;border-top:2px solid var(--border2)">
      <td>TOPLAM</td><td></td><td></td>
      <td class="c">${ozetFmt(metrajT,1)}</td>
      <td class="c">${opexFmtUsd(brutUsd)}</td>
      <td class="c">${tlFoot('hakedisTl')}</td>
      <td class="c">${hakedisFmtTl(kesToplam)}</td>
      <td class="c">${tlFoot('netHakedisTl')}</td>
      <td class="c">${tlFoot('kdvTl')}</td>
      <td class="c">${tlFoot('tevkifatliKdvTl')}</td>
      <td class="c">${tlFoot('netOdenecekTl')}</td>
      <td></td>
      <td></td>
    </tr></tfoot>
  </table></div>`;
}

function renderHakedisDetailTable(rec){
  const wrap = document.getElementById('hakedis-table-wrap');
  if(!wrap) return;
  if(!rec){
    wrap.innerHTML = '<div class="ozet-empty">Seçili kuyu için hakediş verisi bulunamadı.</div>';
    return;
  }
  wrap.innerHTML = hakedisDetailTableHtml(rec);
}

function hakedisDetailTableHtml(rec){
  if(!rec) return '<div class="ozet-empty">Kuyu verisi bulunamadı.</div>';
  const drillTip = `${esc(rec.tariffLabel)} / ${hakedisEgimText(rec)}`;
  const bandRows = rec.bands.length ? rec.bands.map(b => `<tr>
    <td>${esc(rec.no)}</td>
    <td>${esc(rec.makine)}</td>
    <td>${esc(rec.firma)}</td>
    <td>${drillTip}</td>
    <td class="c">${ozetFmt(b.from,0)}</td>
    <td class="c">${ozetFmt(b.to,0)}</td>
    <td class="c">${esc(b.tierLabel)}</td>
    <td class="c">${ozetFmt(b.metre,1)}</td>
    <td class="c">$${ozetFmt(b.rate,0)}/m</td>
    <td class="c">${opexFmtUsd(b.cost)}</td>
    <td class="c">—</td>
    <td class="c">—</td>
    <td class="c">—</td>
    <td class="c">${opexFmtUsd(0)}</td>
    <td class="c">${opexFmtUsd(b.cost)}</td>
    <td class="c">${opexFmtUsd(b.cost)}</td>
    <td>Delgi</td>
    <td>${hakedisBadge(rec.durum)}</td>
  </tr>`).join('') : `<tr><td colspan="18" style="text-align:center;padding:16px;color:var(--text3)">Derinlik kademesi verisi yok</td></tr>`;

  const durakRow = `<tr>
    <td>${esc(rec.no)}</td>
    <td>${esc(rec.makine)}</td>
    <td>${esc(rec.firma)}</td>
    <td>Bekleme / Duraklama</td>
    <td class="c">—</td>
    <td class="c">—</td>
    <td class="c">—</td>
    <td class="c">—</td>
    <td class="c">—</td>
    <td class="c">—</td>
    <td class="c">${ozetFmt(rec.durakMin,0)} dk</td>
    <td class="c">$${OPEX_WAIT_USD_PER_HOUR}/sa</td>
    <td class="c">${opexFmtUsd(rec.waiting)}</td>
    <td class="c">${opexFmtUsd(0)}</td>
    <td class="c">${opexFmtUsd(rec.waiting)}</td>
    <td class="c">${opexFmtUsd(rec.waiting)}</td>
    <td>${rec.durakMin > 0 ? 'Kuyu bazlı duraklama' : 'Duraklama kaydı yok'}</td>
    <td>${hakedisBadge(rec.durum)}</td>
  </tr>`;

  return `<div class="tw"><table>
    <thead><tr>
      <th style="min-width:90px">Kuyu</th>
      <th style="min-width:110px">Makine</th>
      <th style="min-width:100px">Firma/Ekip</th>
      <th style="min-width:130px">Delgi Tipi / Eğim</th>
      <th class="c" style="min-width:90px">Derinlik Başlangıç</th>
      <th class="c" style="min-width:90px">Derinlik Bitiş</th>
      <th class="c" style="min-width:110px">Derinlik Aralığı</th>
      <th class="c" style="min-width:80px">Metraj</th>
      <th class="c" style="min-width:90px">Birim Fiyat</th>
      <th class="c" style="min-width:100px">Delgi Tutarı</th>
      <th class="c" style="min-width:100px">Duraklama Süresi</th>
      <th class="c" style="min-width:120px">Duraklama Birim Fiyatı</th>
      <th class="c" style="min-width:100px">Duraklama Tutarı</th>
      <th class="c" style="min-width:90px">Kesinti</th>
      <th class="c" style="min-width:110px">Brüt Hakediş</th>
      <th class="c" style="min-width:110px">Net Hakediş</th>
      <th style="min-width:130px">Açıklama</th>
      <th style="min-width:110px">Durum</th>
    </tr></thead>
    <tbody>${bandRows}${durakRow}</tbody>
    <tfoot><tr style="font-weight:900;border-top:2px solid var(--border2)">
      <td>TOPLAM</td><td></td><td></td><td></td><td></td><td></td><td></td>
      <td class="c">${ozetFmt(rec.metraj,1)}</td><td></td>
      <td class="c">${opexFmtUsd(rec.drilling)}</td>
      <td class="c">${ozetFmt(rec.durakMin,0)} dk</td><td></td>
      <td class="c">${opexFmtUsd(rec.waiting)}</td>
      <td class="c">${opexFmtUsd(rec.kesinti)}</td>
      <td class="c">${opexFmtUsd(rec.brut)}</td>
      <td class="c">${opexFmtUsd(rec.net)}</td>
      <td></td>
      <td>${hakedisBadge(rec.durum)}</td>
    </tr></tfoot>
  </table></div>`;
}

function renderHakedisKpisMulti(rows){
  const f = hakedisFinansForRowsGroup(rows);
  const tl = (v)=> f.valid ? hakedisFmtTl(v) : '-';
  const note = f.valid ? '' : 'Kur giriniz';
  hakedisKpiCards([
    ['Seçili Kuyu Sayısı', ozetFmt(rows.length,0), 'kuyu', 'Çoklu seçim', 'var(--blue)'],
    ['Toplam Hakediş TL', tl(f.hakedisTl), '', note || 'Brüt USD × kur', 'var(--gold)'],
    ['Toplam Kesinti TL', hakedisFmtTl(f.kesintiTl), '', 'Elektrik+Motorin+Servis', 'var(--warn)'],
    ['Net Hakediş Tutarı TL', tl(f.netHakedisTl), '', note || 'Hakediş − kesinti', 'var(--green)'],
    ['KDV (%20) TL', tl(f.kdvTl), '', note || 'Net × 0,20', 'var(--purple)'],
    ['Net Ödenecek Tutar TL', tl(f.netOdenecekTl), '', note || 'Net + KDV − tevkifat', 'var(--green)']
  ]);
}

function renderHakedisMultiTable(rows){
  const wrap = document.getElementById('hakedis-table-wrap');
  if(!wrap) return;
  if(!rows.length){
    wrap.innerHTML = '<div class="ozet-empty">Seçili kuyu bulunamadı.</div>';
    return;
  }
  const COLS = 9;
  const tlCell = (f, key)=> f.valid ? hakedisFmtTl(f[key]) : '<span style="color:var(--text3)">-</span>';
  const body = rows.map(r => {
    const open = hakedisOpenDetails.has(r.no);
    const acts = hakedisActionButtons(r.no, r.durum);
    const f = hakedisFinansForRec(r);
    const main = `<tr>
      <td>${esc(r.no)}</td>
      <td>${esc(r.locGroup)}</td>
      <td>${esc(r.makine)}</td>
      <td class="c">${ozetFmt(r.metraj,1)}</td>
      <td class="c">${opexFmtUsd(r.brut)}</td>
      <td class="c">${hakedisFmtKur(hakedisKur)}</td>
      <td class="c">${tlCell(f,'hakedisTl')}</td>
      <td>${hakedisBadge(r.durum)}</td>
      <td><div class="hakedis-acts">
        <button class="btn btn-g hakedis-act" onclick="hakedisToggleDetail('${esc(r.no)}')">${open ? 'Detay Kapat' : 'Detay Aç'}</button>
        ${acts}
      </div></td>
    </tr>`;
    const detail = open ? `<tr class="hakedis-detail-row"><td colspan="${COLS}"><div class="hakedis-detail-wrap">${hakedisDetailTableHtml(r)}</div></td></tr>` : '';
    return main + detail;
  }).join('');
  const ft = hakedisFinansForRowsGroup(rows);
  const brutUsd = rows.reduce((s,r)=>s+r.brut,0);
  const metrajT = rows.reduce((s,r)=>s+r.metraj,0);
  const tlFoot = (key)=> ft.valid ? hakedisFmtTl(ft[key]) : '-';
  wrap.innerHTML = `
    <div style="margin-bottom:10px"><button class="btn btn-g hakedis-act" onclick="hakedisBulkKontrol()">Seçili Kuyuları Kontrole Gönder</button></div>
    <div class="tw"><table>
      <thead><tr>
        <th style="min-width:90px">Kuyu</th>
        <th style="min-width:90px">Lokasyon</th>
        <th style="min-width:110px">Makine</th>
        <th class="c" style="min-width:100px">Toplam Metraj</th>
        <th class="c" style="min-width:110px">Hakediş USD</th>
        <th class="c" style="min-width:80px">Dolar Kuru</th>
        <th class="c" style="min-width:120px">Hakediş TL</th>
        <th style="min-width:120px">Hakediş Durumu</th>
        <th style="min-width:200px">İşlem</th>
      </tr></thead>
      <tbody>${body}</tbody>
      <tfoot><tr style="font-weight:900;border-top:2px solid var(--border2)">
        <td>TOPLAM</td><td></td><td></td>
        <td class="c">${ozetFmt(metrajT,1)}</td>
        <td class="c">${opexFmtUsd(brutUsd)}</td>
        <td class="c">${hakedisFmtKur(hakedisKur)}</td>
        <td class="c">${tlFoot('hakedisTl')}</td>
        <td></td><td></td>
      </tr></tfoot>
    </table></div>`;
}

// ── FİNANSAL HAKEDİŞ ÖZETİ BLOĞU ────────────────────────────
function hakedisFinansRow(label, value, strong){
  return `<div class="hakedis-finans-row${strong ? ' hakedis-finans-total' : ''}"><span>${esc(label)}</span><b>${value}</b></div>`;
}

function hakedisFinansBlockHtml(f, opts){
  const o = opts || {};
  const kes = o.kesinti || {elektrik:0, motorin:0, servis:0, toplam:0};
  const tl = (v)=> f.valid ? hakedisFmtTl(v) : '<span style="color:var(--text3)">Kur giriniz</span>';
  const kInput = (field, val)=> o.editable
    ? `<input class="fi hakedis-kesinti-inp" type="text" inputmode="decimal" autocomplete="off" autocorrect="off" spellcheck="false" value="${val > 0 ? String(val).replace('.', ',') : ''}" placeholder="0" onchange="${o.group ? `setHakedisTopluKesinti('${field}',this.value)` : `setHakedisKesinti('${esc(o.no)}','${field}',this.value)`}">`
    : hakedisFmtTl(val);
  return `<div class="hakedis-finans">
    ${hakedisFinansRow('Hakediş Tutarı USD', opexFmtUsd(f.hakedisUsd))}
    ${hakedisFinansRow('Dolar Kuru (USD/TL)', hakedisFmtKur(hakedisKur))}
    ${hakedisFinansRow('Hakediş Tutarı TL', tl(f.hakedisTl))}
    <div class="hakedis-finans-sep"></div>
    ${hakedisFinansRow('Kesinti (Elektrik) TL', kInput('elektrik', kes.elektrik))}
    ${hakedisFinansRow('Kesinti (Motorin) TL', kInput('motorin', kes.motorin))}
    ${hakedisFinansRow('Kesinti (Servis) TL', kInput('servis', kes.servis))}
    ${hakedisFinansRow('Toplam Kesinti TL', hakedisFmtTl(kes.toplam))}
    <div class="hakedis-finans-sep"></div>
    ${hakedisFinansRow('Net Hakediş Tutarı TL', tl(f.netHakedisTl))}
    ${hakedisFinansRow('KDV (%20) TL', tl(f.kdvTl))}
    ${hakedisFinansRow('Tevkifat 4/10 TL', tl(f.tevkifatliKdvTl))}
    ${hakedisFinansRow('Tevkifatlı KDV TL', tl(f.tevkifatliKdvTl))}
    ${hakedisFinansRow('Net Ödenecek Tutar TL', tl(f.netOdenecekTl), true)}
  </div>`;
}

function renderHakedisFinans(mode, data){
  const wrap = document.getElementById('hakedis-finans-wrap');
  if(!wrap) return;
  if(mode === 'single'){
    const rec = data;
    if(!rec){ wrap.innerHTML = ''; return; }
    const f = hakedisFinansForRec(rec);
    const kes = hakedisKesintiOf(rec.no);
    const editable = hakedisKesintiEditable(rec.durum);
    wrap.innerHTML = `<div class="ozet-panel" style="margin-top:16px">
      <div class="ozet-panel-head">
        <div><span>FİNANSAL HAKEDİŞ ÖZETİ</span><strong>${esc(rec.no)}</strong></div>
        <small>${editable ? 'Kesinti kalemleri düzenlenebilir' : 'Onay sonrası kilitli'} · TL bazlı ödeme özeti</small>
      </div>
      ${hakedisFinansBlockHtml(f, {no:rec.no, durum:rec.durum, kesinti:kes, editable})}
    </div>`;
    return;
  }
  const rows = data || [];
  if(mode === 'multi'){
    // Çoklu görünüm: kesinti tek kalem olarak buradan girilir
    const f = hakedisFinansForRowsGroup(rows);
    const kes = hakedisTopluKesintiToplam();
    wrap.innerHTML = `<div class="ozet-panel" style="margin-top:16px">
      <div class="ozet-panel-head">
        <div><span>FİNANSAL HAKEDİŞ ÖZETİ</span><strong>${rows.length} kuyu seçili</strong></div>
        <small>Kesinti seçili kuyular için tek kalem girilir · TL bazlı ödeme özeti</small>
      </div>
      ${hakedisFinansBlockHtml(f, {kesinti:kes, editable:true, group:true})}
    </div>`;
    return;
  }
  // Tüm kuyular: kuyu bazlı kesinti toplamı (salt-okunur)
  const f = hakedisFinansForRows(rows);
  const kesTop = {
    elektrik: rows.reduce((s,r)=>s+hakedisKesintiOf(r.no).elektrik,0),
    motorin:  rows.reduce((s,r)=>s+hakedisKesintiOf(r.no).motorin,0),
    servis:   rows.reduce((s,r)=>s+hakedisKesintiOf(r.no).servis,0)
  };
  kesTop.toplam = kesTop.elektrik + kesTop.motorin + kesTop.servis;
  wrap.innerHTML = `<div class="ozet-panel" style="margin-top:16px">
    <div class="ozet-panel-head">
      <div><span>FİNANSAL HAKEDİŞ ÖZETİ</span><strong>${esc(hakedisLocationFilter || 'Filtrelenmiş kuyular')}</strong></div>
      <small>TL bazlı toplam ödeme özeti</small>
    </div>
    ${hakedisFinansBlockHtml(f, {kesinti:kesTop, editable:false})}
  </div>`;
}

function renderHakedis(){
  if(!hakedisStatusLoaded){ hakedisLoadStatus(); hakedisStatusLoaded = true; }
  const kurInp = document.getElementById('hakedis-kur');
  if(kurInp && document.activeElement !== kurInp){
    kurInp.value = hakedisKur > 0 ? String(hakedisKur).replace('.', ',') : '';
  }
  const records = hakedisBuildRecords();
  hakedisBuildKuyuMenu(records);
  const locSel = document.getElementById('hakedis-loc-sec');
  if(locSel && locSel.value !== hakedisLocationFilter) locSel.value = hakedisLocationFilter;
  const kicker = document.getElementById('hakedis-table-kicker');
  const title = document.getElementById('hakedis-table-title');
  const info = document.getElementById('hakedis-info-wrap');
  // Geçersiz seçimleri güvenli şekilde ele
  const sel = hakedisSelectedKuyular.filter(no => records.some(r => r.no === no));

  if(sel.length === 1){
    const rec = records.find(r => r.no === sel[0]);
    if(kicker) kicker.textContent = 'DETAYLI OPEX MALİYET TABLOSU';
    if(title) title.textContent = sel[0];
    renderHakedisKpisSingle(rec);
    renderHakedisInfo(rec);
    renderHakedisDetailTable(rec);
    renderHakedisFinans('single', rec);
  } else if(sel.length > 1){
    const rows = records.filter(r => sel.includes(r.no));
    if(kicker) kicker.textContent = 'ÇOKLU KUYU HAKEDİŞ ÖZETİ';
    if(title) title.textContent = `${rows.length} kuyu seçili`;
    renderHakedisKpisMulti(rows);
    if(info) info.innerHTML = '';
    renderHakedisMultiTable(rows);
    renderHakedisFinans('multi', rows);
  } else {
    let rows = hakedisRecordsForLocation(records);
    const mak = document.getElementById('hakedis-mak-sec');
    const makVal = mak ? mak.value : '';
    if(makVal) rows = rows.filter(r => makineEslesir(r.makine, makVal));
    const durEl = document.getElementById('hakedis-durum-sec');
    const durVal = durEl ? durEl.value : '';
    if(durVal) rows = rows.filter(r => r.durum === durVal);
    if(kicker) kicker.textContent = 'KUYU BAZLI HAKEDİŞ ÖZETİ';
    if(title) title.textContent = hakedisLocationFilter || (makVal || 'Tüm kuyular');
    renderHakedisKpisAll(rows);
    if(info) info.innerHTML = '';
    renderHakedisSummaryTable(rows);
    renderHakedisFinans('all', rows);
  }
}

function hakedisDetailCsv(rec){
  let csv = `Kuyu,Lokasyon,Makine,Firma/Ekip,Delgi Tipi / Eğim,Derinlik Başlangıç,Derinlik Bitiş,Derinlik Aralığı,Metraj (m),Birim Fiyat ($/m),Delgi Tutarı ($),Duraklama Süresi (dk),Duraklama Birim Fiyatı ($/sa),Duraklama Tutarı ($),Kesinti ($),Brüt Hakediş ($),Net Hakediş ($),Açıklama,Durum\n`;
  const tip = `${rec.tariffLabel} / ${rec.egim===null?'-':rec.egim+'°'}`;
  rec.bands.forEach(b => {
    csv += `${rec.no},"${rec.locGroup}","${rec.makine}","${rec.firma}","${tip}",${Math.round(b.from)},${Math.round(b.to)},"${b.tierLabel}",${b.metre.toFixed(1)},${b.rate},${Math.round(b.cost)},,,,0,${Math.round(b.cost)},${Math.round(b.cost)},Delgi,${rec.durum}\n`;
  });
  csv += `${rec.no},"${rec.locGroup}","${rec.makine}","${rec.firma}","Bekleme / Duraklama",,,,,,,${Math.round(rec.durakMin)},${OPEX_WAIT_USD_PER_HOUR},${Math.round(rec.waiting)},0,${Math.round(rec.waiting)},${Math.round(rec.waiting)},"${rec.durakMin>0?'Kuyu bazlı duraklama':'Duraklama kaydı yok'}",${rec.durum}\n`;
  csv += `TOPLAM,,,,,,,,${rec.metraj.toFixed(1)},,${Math.round(rec.drilling)},${Math.round(rec.durakMin)},,${Math.round(rec.waiting)},${Math.round(rec.kesinti)},${Math.round(rec.brut)},${Math.round(rec.net)},,${rec.durum}\n`;
  // Finansal Hakediş Özeti (TL bazlı)
  const f = hakedisFinansForRec(rec);
  const kes = hakedisKesintiOf(rec.no);
  csv += `\nFİNANSAL HAKEDİŞ ÖZETİ\nAlan,Değer\n`;
  csv += `Hakediş Tutarı USD,${Math.round(f.hakedisUsd)}\n`;
  csv += `Dolar Kuru,${hakedisKur > 0 ? hakedisKur.toFixed(2) : ''}\n`;
  csv += `Hakediş Tutarı TL,${hakedisCsvTl(f.hakedisTl,f.valid)}\n`;
  csv += `Kesinti (Elektrik) TL,${kes.elektrik.toFixed(2)}\n`;
  csv += `Kesinti (Motorin) TL,${kes.motorin.toFixed(2)}\n`;
  csv += `Kesinti (Servis) TL,${kes.servis.toFixed(2)}\n`;
  csv += `Toplam Kesinti TL,${kes.toplam.toFixed(2)}\n`;
  csv += `Net Hakediş Tutarı TL,${hakedisCsvTl(f.netHakedisTl,f.valid)}\n`;
  csv += `KDV (%20) TL,${hakedisCsvTl(f.kdvTl,f.valid)}\n`;
  csv += `Tevkifat 4/10 TL,${hakedisCsvTl(f.tevkifatliKdvTl,f.valid)}\n`;
  csv += `Tevkifatlı KDV TL,${hakedisCsvTl(f.tevkifatliKdvTl,f.valid)}\n`;
  csv += `Net Ödenecek Tutar TL,${hakedisCsvTl(f.netOdenecekTl,f.valid)}\n`;
  return csv;
}

function hakedisCsvTl(v, valid){ return valid ? (Number(v)||0).toFixed(2) : ''; }

function hakedisSummaryCsv(rows){
  const kurStr = hakedisKur > 0 ? hakedisKur.toFixed(2) : '';
  let csv = `Lokasyon,Kuyu,Makine,Firma/Ekip,Toplam Metraj (m),Delgi Tutarı USD,Duraklama/Bekleme USD,Hakediş Tutarı USD,Dolar Kuru,Hakediş Tutarı TL,Kesinti (Elektrik) TL,Kesinti (Motorin) TL,Kesinti (Servis) TL,Toplam Kesinti TL,Net Hakediş TL,KDV (%20) TL,Tevkifat 4/10 TL,Tevkifatlı KDV TL,Net Ödenecek TL,Hakediş Durumu\n`;
  rows.forEach(r => {
    const f = hakedisFinansForRec(r);
    const kes = hakedisKesintiOf(r.no);
    csv += `"${r.locGroup}",${r.no},"${r.makine}","${r.firma}",${r.metraj.toFixed(1)},${Math.round(r.drilling)},${Math.round(r.waiting)},${Math.round(r.brut)},${kurStr},${hakedisCsvTl(f.hakedisTl,f.valid)},${kes.elektrik.toFixed(2)},${kes.motorin.toFixed(2)},${kes.servis.toFixed(2)},${kes.toplam.toFixed(2)},${hakedisCsvTl(f.netHakedisTl,f.valid)},${hakedisCsvTl(f.kdvTl,f.valid)},${hakedisCsvTl(f.tevkifatliKdvTl,f.valid)},${hakedisCsvTl(f.tevkifatliKdvTl,f.valid)},${hakedisCsvTl(f.netOdenecekTl,f.valid)},${r.durum}\n`;
  });
  const ft = hakedisFinansForRows(rows);
  const kt = { elektrik:0, motorin:0, servis:0, toplam:0 };
  rows.forEach(r => { const k = hakedisKesintiOf(r.no); kt.elektrik+=k.elektrik; kt.motorin+=k.motorin; kt.servis+=k.servis; kt.toplam+=k.toplam; });
  const metrajT = rows.reduce((s,r)=>s+r.metraj,0);
  const drillT = rows.reduce((s,r)=>s+r.drilling,0);
  const waitT = rows.reduce((s,r)=>s+r.waiting,0);
  const brutT = rows.reduce((s,r)=>s+r.brut,0);
  csv += `TOPLAM,,,,${metrajT.toFixed(1)},${Math.round(drillT)},${Math.round(waitT)},${Math.round(brutT)},${kurStr},${hakedisCsvTl(ft.hakedisTl,ft.valid)},${kt.elektrik.toFixed(2)},${kt.motorin.toFixed(2)},${kt.servis.toFixed(2)},${kt.toplam.toFixed(2)},${hakedisCsvTl(ft.netHakedisTl,ft.valid)},${hakedisCsvTl(ft.kdvTl,ft.valid)},${hakedisCsvTl(ft.tevkifatliKdvTl,ft.valid)},${hakedisCsvTl(ft.tevkifatliKdvTl,ft.valid)},${hakedisCsvTl(ft.netOdenecekTl,ft.valid)},\n`;
  return csv;
}

function exportHakedis(){
  const records = hakedisBuildRecords();
  const stamp = new Date().toLocaleDateString('tr-TR');
  const kurLine = `Dolar Kuru (USD/TL): ${hakedisKur > 0 ? hakedisFmtKur(hakedisKur) : 'girilmedi'}`;
  const head = `GÜMÜŞTAŞ MADENCİLİK · BOLKAR İŞLETMESİ`;
  const sel = hakedisSelectedKuyular.filter(no => records.some(r => r.no === no));

  // A) Tek kuyu → detaylı OPEX maliyet tablosu
  if(sel.length === 1){
    const rec = records.find(r => r.no === sel[0]);
    if(!rec){ indir(`Kuyu verisi bulunamadı\n`, `Hakedis_${sel[0]}.csv`); return; }
    const csv = `${head}\nHAKEDİŞ · DETAYLI OPEX MALİYET TABLOSU · ${rec.no}\nRapor Tarihi: ${stamp}\n${kurLine}\n\n` + hakedisDetailCsv(rec);
    indir(csv, `Hakedis_${rec.no}.csv`);
    return;
  }

  // C) Çoklu kuyu → seçili kuyuların özeti + tek kalem kesinti ile ödeme özeti
  if(sel.length > 1){
    const rows = records.filter(r => sel.includes(r.no));
    let csv = `${head}\nHAKEDİŞ · SEÇİLİ KUYULAR (${rows.length}) HAKEDİŞ ÖZETİ\nRapor Tarihi: ${stamp}\n${kurLine}\n\n`;
    csv += `Lokasyon,Kuyu,Makine,Toplam Metraj (m),Hakediş USD,Hakediş TL,Hakediş Durumu\n`;
    rows.forEach(r => {
      const rf = hakedisFinansForRec(r);
      csv += `"${r.locGroup}",${r.no},"${r.makine}",${r.metraj.toFixed(1)},${Math.round(r.brut)},${hakedisCsvTl(rf.hakedisTl,rf.valid)},${r.durum}\n`;
    });
    const gf = hakedisFinansForRowsGroup(rows);
    const gk = hakedisTopluKesintiToplam();
    csv += `\nFİNANSAL HAKEDİŞ ÖZETİ (TEK KALEM KESİNTİ)\nAlan,Değer\n`;
    csv += `Hakediş Tutarı USD,${Math.round(gf.hakedisUsd)}\n`;
    csv += `Dolar Kuru,${hakedisKur > 0 ? hakedisKur.toFixed(2) : ''}\n`;
    csv += `Hakediş Tutarı TL,${hakedisCsvTl(gf.hakedisTl,gf.valid)}\n`;
    csv += `Kesinti (Elektrik) TL,${gk.elektrik.toFixed(2)}\n`;
    csv += `Kesinti (Motorin) TL,${gk.motorin.toFixed(2)}\n`;
    csv += `Kesinti (Servis) TL,${gk.servis.toFixed(2)}\n`;
    csv += `Toplam Kesinti TL,${gk.toplam.toFixed(2)}\n`;
    csv += `Net Hakediş Tutarı TL,${hakedisCsvTl(gf.netHakedisTl,gf.valid)}\n`;
    csv += `KDV (%20) TL,${hakedisCsvTl(gf.kdvTl,gf.valid)}\n`;
    csv += `Tevkifat 4/10 TL,${hakedisCsvTl(gf.tevkifatliKdvTl,gf.valid)}\n`;
    csv += `Tevkifatlı KDV TL,${hakedisCsvTl(gf.tevkifatliKdvTl,gf.valid)}\n`;
    csv += `Net Ödenecek Tutar TL,${hakedisCsvTl(gf.netOdenecekTl,gf.valid)}\n`;
    rows.forEach(r => { csv += `\nDETAY · ${r.no}\n` + hakedisDetailCsv(r); });
    indir(csv, `Hakedis_Secili_${rows.length}_kuyu.csv`);
    return;
  }

  // B) Tüm Kuyular → filtrelenmiş genel özet tablosu
  let rows = hakedisRecordsForLocation(records);
  const mak = document.getElementById('hakedis-mak-sec');
  const makVal = mak ? mak.value : '';
  if(makVal) rows = rows.filter(r => makineEslesir(r.makine, makVal));
  const durEl = document.getElementById('hakedis-durum-sec');
  const durVal = durEl ? durEl.value : '';
  if(durVal) rows = rows.filter(r => r.durum === durVal);
  const etiket = [hakedisLocationFilter, makVal, durVal].filter(Boolean).join(' · ');
  const csv = `${head}\nHAKEDİŞ · KUYU BAZLI HAKEDİŞ ÖZETİ${etiket?(' · '+etiket):''}\nRapor Tarihi: ${stamp}\n${kurLine}\n\n` + hakedisSummaryCsv(rows);
  const ekName = [hakedisLocationFilter, makVal, durVal].filter(Boolean).join('_').replace(/\s+/g,'');
  indir(csv, `Hakedis_Ozet${ekName?('_'+ekName):''}.csv`);
}

function ozetMakineRows(period){
  const ayRecs = (db.gunluk || []).filter(r => ozetInPeriod(r.tarih, period));
  const ayDurak = (db.duraklamalar || []).filter(d => ozetInPeriod(d.tarih, period));
  return MAKINELER.map(m => {
    const recs = ayRecs.filter(r => makineEslesir(r.makine, m));
    const metraj = recs.reduce((s,r) => s + ozetGunlukMetraj(r), 0);
    const gun = new Set(recs.map(r => r.tarih).filter(Boolean)).size;
    const durak = ayDurak.filter(d => makineEslesir(d.makine, m)).reduce((s,d) => s + (parseFloat(d.dk)||0), 0);
    const verim = gun ? metraj / gun : 0;
    const aktif = (db.kuyular || []).filter(k => makineEslesir(k.makine, m) && isAktifKuyu(k)).length;
    const tamam = (db.kuyular || []).filter(k => makineEslesir(k.makine, m) && ozetInPeriod(k.bit, period)).length;
    return {m, metraj, gun, durak, verim, aktif, tamam, color: MAKINE_RENK[m] || '#606363'};
  });
}

function renderOzetKpis(rows, period, yil, butce){
  const wrap = document.getElementById('ozet-kpi-band');
  if(!wrap) return;
  const ayMetraj = rows.reduce((s,r)=>s+r.metraj,0);
  const ayDurak = rows.reduce((s,r)=>s+r.durak,0);
  const calismaGunu = new Set((db.gunluk || []).filter(r => ozetInPeriod(r.tarih, period)).map(r=>r.tarih)).size;
  const verim = calismaGunu ? ayMetraj / calismaGunu : 0;
  const yilMetraj = ['Q1','Q2','Q3','Q4'].reduce((s,q)=>s+getCeyrekMetraj(q,yil),0);
  const toplamButce = ['q1','q2','q3','q4'].reduce((s,q)=>s+(butce[q]||0),0);
  const butcePct = toplamButce ? Math.round(yilMetraj/toplamButce*100) : 0;
  const donemButce = period.budgetKeys.reduce((s,k)=>s+(butce[k]||0),0);
  const donemPct = donemButce ? Math.round(ayMetraj/donemButce*100) : null;
  const tamamKuyu = (db.kuyular || []).filter(k => ozetInPeriod(k.bit, period)).length;
  const items = [
    ['Toplam Delgi', ozetFmt(ayMetraj,1), 'm', `${period.label} seçili dönem`, 'var(--gold)'],
    ['Bütçe Gerçekleşme', donemPct !== null ? `%${donemPct}` : (toplamButce ? `%${butcePct}` : '—'), '', donemPct !== null ? `${ozetFmt(ayMetraj,0)} / ${ozetFmt(donemButce,0)} m` : (toplamButce ? `Yıl: ${ozetFmt(yilMetraj,0)} / ${ozetFmt(toplamButce,0)} m` : 'Bütçe girilmedi'), 'var(--purple)'],
    ['Duraklama Etkisi', ozetFmt(ayDurak,0), 'dk', `${ozetFmt(ayDurak/60,1)} saat operasyon kaybı`, 'var(--warn)'],
    ['Ortalama Verim', ozetFmt(verim,1), 'm/gün', `${calismaGunu || 0} çalışma günü · ${tamamKuyu} kuyu tamamlandı`, 'var(--green)']
  ];
  wrap.innerHTML = items.map(i => `<div class="ozet-kpi" style="--kpi-color:${i[4]}">
    <div class="k-lbl">${i[0]}</div>
    <div class="k-val">${i[1]}${i[2] ? ` <span>${i[2]}</span>` : ''}</div>
    <div class="k-note">${i[3]}</div>
  </div>`).join('');
}

function renderOzetMakine(rows){
  const wrap = document.getElementById('ozet-makine-wrap');
  if(!wrap) return;
  const maxMetraj = Math.max(...rows.map(r=>r.metraj), 1);
  const sorted = rows.slice().sort((a,b)=>b.metraj-a.metraj);
  if(!sorted.some(r=>r.metraj || r.durak || r.aktif || r.tamam)){
    wrap.innerHTML = '<div class="ozet-empty">Seçili dönem için makine performans verisi yok.</div>';
    return;
  }
  wrap.innerHTML = `<div class="ozet-machine-list">${sorted.map(r => {
    const pct = Math.round((r.metraj/maxMetraj)*100);
    const status = r.durak > 180 ? ['warn','Duraklama'] : r.verim >= 35 ? ['good','İyi'] : r.metraj > 0 ? ['idle','Takip'] : ['idle','Veri yok'];
    return `<div class="ozet-machine-row" style="--m-color:${r.color}">
      <div>
        <div class="ozet-machine-name">${esc(r.m)}</div>
        <div class="ozet-machine-state">${r.aktif} aktif / ${r.tamam} tamamlanan</div>
      </div>
      <div>
        <div class="ozet-meter"><i style="width:${pct}%"></i></div>
        <div class="ozet-meter-note">Makine içi karşılaştırma: %${pct}</div>
      </div>
      <div class="ozet-metric"><strong>${ozetFmt(r.metraj,1)}</strong><span>metraj</span></div>
      <div class="ozet-metric"><strong>${ozetFmt(r.durak,0)}</strong><span>durak dk</span></div>
      <div class="ozet-metric"><strong>${ozetFmt(r.verim,1)}</strong><span>m/gün</span></div>
      <div class="ozet-status ${status[0]}">${status[1]}</div>
    </div>`;
  }).join('')}</div>`;
}

function renderOzetMetrajChart(rows){
  const wrap = document.getElementById('ozet-metraj-chart-wrap');
  if(!wrap) return;
  const sorted = rows.slice().sort((a,b)=>b.metraj-a.metraj);
  const max = Math.max(...sorted.map(r=>r.metraj), 1);
  if(!sorted.some(r=>r.metraj)){
    wrap.innerHTML = '<div class="ozet-empty">Seçili dönem için metraj grafiği oluşturacak veri yok.</div>';
    return;
  }
  wrap.innerHTML = `<div class="ozet-machine-chart">${sorted.map(r => {
    const w = Math.max(r.metraj ? 4 : 0, Math.round(r.metraj / max * 100));
    return `<div class="ozet-machine-chart-row" style="--row-color:${r.color};--w:${w}%">
      <div class="ozet-machine-chart-name">${esc(r.m)}</div>
      <div class="ozet-machine-chart-track"><i></i></div>
      <div class="ozet-machine-chart-val">${ozetFmt(r.metraj,1)} m</div>
    </div>`;
  }).join('')}</div>`;
}

function renderOzetInsights(rows, period){
  const wrap = document.getElementById('ozet-insights');
  if(!wrap) return;
  const byMetraj = rows.slice().sort((a,b)=>b.metraj-a.metraj)[0];
  const byVerim = rows.slice().sort((a,b)=>b.verim-a.verim)[0];
  const byDurak = rows.slice().sort((a,b)=>b.durak-a.durak)[0];
  const ayDurak = (db.duraklamalar || []).filter(d => ozetInPeriod(d.tarih, period));
  const nedenMap = {};
  ayDurak.forEach(d => { const n = normalizeDuraklamaNedeni(d.neden) || 'DİĞER'; nedenMap[n] = (nedenMap[n] || 0) + (parseFloat(d.dk)||0); });
  const kritik = Object.entries(nedenMap).sort((a,b)=>b[1]-a[1])[0];
  const items = [
    ['En yüksek metraj', byMetraj && byMetraj.metraj ? `${byMetraj.m} · ${ozetFmt(byMetraj.metraj,1)} m` : 'Veri yok', 'Seçili dönemde toplam delgi lideri'],
    ['En verimli makine', byVerim && byVerim.verim ? `${byVerim.m} · ${ozetFmt(byVerim.verim,1)} m/gün` : 'Veri yok', 'Çalışma günü başına ortalama ilerleme'],
    ['En yüksek duraklama', byDurak && byDurak.durak ? `${byDurak.m} · ${ozetFmt(byDurak.durak,0)} dk` : 'Duraklama yok', 'Öncelikli operasyon takibi'],
    ['Kritik neden', kritik ? `${kritik[0]} · ${ozetFmt(kritik[1],0)} dk` : 'Duraklama kaydı yok', 'Neden bazlı en yüksek kayıp']
  ];
  wrap.innerHTML = items.map(i => `<div class="ozet-insight"><span>${i[0]}</span><strong>${esc(i[1])}</strong><small>${i[2]}</small></div>`).join('');
}

function renderOzetDurak(period){
  const wrap = document.getElementById('ozet-durak-wrap');
  if(!wrap) return;
  const colors = {'SU KESİNTİSİ':'#1d4f8f','SU SEVİYESİ YÜKSELMESİ':'#0d9488','PATLATMA':'#b91c1c','DUMAN':'#231f20','ELEKTRİK KESİNTİSİ':'#f47721','DİĞER':'#96999b'};
  const map = {};
  (db.duraklamalar || []).filter(d => ozetInPeriod(d.tarih, period)).forEach(d => {
    const n = normalizeDuraklamaNedeni(d.neden) || 'DİĞER';
    map[n] = (map[n] || 0) + (parseFloat(d.dk)||0);
  });
  const data = Object.entries(map).map(([label,val]) => ({label, val, color:colors[label] || '#96999b'})).sort((a,b)=>b.val-a.val);
  if(!data.length){
    wrap.innerHTML = '<div class="ozet-empty">Bu dönem duraklama kaydı yok.</div>';
    return;
  }
  const max = Math.max(...data.map(d=>d.val), 1);
  wrap.innerHTML = `<div class="ozet-bar-list">${data.map(d => `<div class="ozet-bar-row" style="--bar-color:${d.color}" title="${esc(d.label)} · ${ozetFmt(d.val,0)} dk">
    <div class="ozet-bar-label">${esc(d.label)}</div>
    <div class="ozet-bar-track"><i style="width:${Math.round(d.val/max*100)}%"></i></div>
    <div class="ozet-bar-val">${ozetFmt(d.val,0)} dk</div>
  </div>`).join('')}</div>`;
}

function renderOzetPage(){
  const yil = new Date().getFullYear();
  ozetBuildAySelect(yil);
  const butce={};
  ['q1','q2','q3','q4'].forEach(q=>{ butce[q]=parseFloat(document.getElementById('butce-'+q)?.value)||0; });
  const period = ozetPeriod(yil);
  const rows = ozetMakineRows(period);
  const lbl = document.getElementById('ozet-donem-label');
  if(lbl) lbl.textContent = `${period.label} · ${yil} yıllık karşılaştırma`;

  renderOzetKpis(rows, period, yil, butce);
  renderOzetMakine(rows);
  renderOzetMetrajChart(rows);
  renderOzetInsights(rows, period);
  renderOzetDurak(period);

  const kartWrap=document.getElementById('ceyrek-kartlar');
  if(kartWrap){
    kartWrap.innerHTML=['Q1','Q2','Q3','Q4'].map((q,i)=>{
      const gercek=getCeyrekMetraj(q,yil);
      const hedef=butce['q'+(i+1)];
      const pct=hedef>0?Math.round(gercek/hedef*100):0;
      const clr=CEYREK_RENK[q];
      const durum=pct>=100?'var(--green)':pct>=50?'var(--warn)':'var(--text3)';
      const kalan = hedef ? hedef - gercek : 0;
      return `<div class="ozet-quarter" style="--q-color:${clr}">
        <div class="q-head"><span>${CEYREK_LABEL[q]}</span><b style="color:${durum}">${hedef ? `%${pct}` : '—'}</b></div>
        <div class="q-val">${ozetFmt(gercek,1)} <span style="font-size:11px;color:var(--text3)">m</span></div>
        <div class="q-sub">${hedef ? `Hedef ${ozetFmt(hedef,0)} m · ${kalan>=0?'Kalan':'Aşım'} ${ozetFmt(Math.abs(kalan),0)} m` : 'Bütçe girilmedi'}</div>
      </div>`;
    }).join('');
  }

  drawButceGerceklesen(yil, butce);
  drawOzetYillik(yil);
}

// ── Profesyonel SVG bar yardımcısı ──────────────────────────
function _svgChart({W, H, PAD_L=52, PAD_T=16, PAD_B=44, data, maxVal, barW, gap, labels, showVal=true, accent='#e9cd53'}){
  // data: [{x, val, color, label2?}]
  let grid='', yTicks='', bars='';
  const CH = H - PAD_T - PAD_B;
  [0, 0.25, 0.5, 0.75, 1].forEach(r=>{
    const y = PAD_T + CH*(1-r);
    const v = Math.round(maxVal*r);
    grid   += `<line x1="${PAD_L}" y1="${y}" x2="${W-8}" y2="${y}" stroke="var(--bg4)" stroke-width="1"/>`;
    yTicks += `<text x="${PAD_L-6}" y="${y+4}" text-anchor="end" font-size="9" fill="#96999b" font-family="IBM Plex Mono,monospace">${v}</text>`;
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
  const data = qs.map((q,i) => {
    const gercek = getCeyrekMetraj(q,yil);
    const hedef = butce['q'+(i+1)] || 0;
    const pct = hedef ? Math.round(gercek/hedef*100) : 0;
    const sapma = hedef ? gercek - hedef : 0;
    return {q, gercek, hedef, pct, sapma, color:CEYREK_RENK[q]};
  });
  wrap.innerHTML = `<div class="ozet-chart-legend">
    <span><i class="ozet-real-box"></i>Hedefe göre gerçekleşme oranı</span>
  </div>
  <div class="ozet-budget-chart">${data.map(d => {
    const gercekPct = d.hedef ? Math.min(100, Math.round(d.gercek / d.hedef * 100)) : 0;
    const sapmaCls = !d.hedef ? 'neutral' : d.sapma >= 0 ? 'good' : 'warn';
    const sapmaText = !d.hedef ? 'Bütçe yok' : d.sapma >= 0 ? `+${ozetFmt(d.sapma,0)} m aşım` : `${ozetFmt(Math.abs(d.sapma),0)} m kaldı`;
    return `<div class="ozet-budget-row" style="--row-color:${d.color};--actual:${gercekPct}%">
      <div class="ozet-budget-q">
        <strong>${d.q}</strong>
        <span>${CEYREK_LABEL[d.q].replace(d.q,'').replace(/[()]/g,'').trim()}</span>
      </div>
      <div class="ozet-budget-bar">
        <b class="actual"></b>
        <span>${d.hedef ? `%${d.pct}` : 'Bütçe Yok'}</span>
      </div>
      <div class="ozet-budget-num">
        <strong>${ozetFmt(d.gercek,1)} m</strong>
        <span>Gerçekleşen</span>
      </div>
      <div class="ozet-budget-num">
        <strong>${d.hedef ? ozetFmt(d.hedef,0) : '—'} m</strong>
        <span>Hedef</span>
      </div>
      <div class="ozet-budget-dev ${sapmaCls}">
        ${sapmaText}
        <span>${d.hedef ? 'Sapma' : ''}</span>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function drawOzetYillik(yil){
  const wrap=document.getElementById('ozet-yillik-wrap');
  if(!wrap) return;

  const ayAdi=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const QRENK=['#e9cd53','#e9cd53','#e9cd53','#4f7d32','#4f7d32','#4f7d32','#f47721','#f47721','#f47721','#1d4f8f','#1d4f8f','#1d4f8f'];
  const secili = ozetPeriod(yil);

  const months=[];
  for(let m=1;m<=12;m++){
    const ay=`${yil}-${String(m).padStart(2,'0')}`;
    const val = (db.gunluk || []).filter(r=>r.tarih&&r.tarih.startsWith(ay)).reduce((s,r)=>s+ozetGunlukMetraj(r),0);
    months.push({ay, label:ayAdi[m-1], val, color:QRENK[m-1], active:secili.months.includes(ay)});
  }

  const maxVal=Math.max(...months.map(m=>m.val),1);
  const QLegend=['Q1','Q2','Q3','Q4'].map((l,i)=>
    `<span><i class="ozet-real-box" style="--row-color:${['#e9cd53','#4f7d32','#f47721','#1d4f8f'][i]}"></i>${l}</span>`).join('');

  wrap.innerHTML=`<div class="ozet-chart-legend">${QLegend}</div>
  <div class="ozet-year-chart">${months.map(m => {
    const h = Math.max(m.val ? 8 : 2, Math.round(m.val / maxVal * 100));
    return `<div class="ozet-year-col ${m.active?'active':''}" style="--row-color:${m.color};--h:${h}%">
      <div class="ozet-year-val">${m.val ? ozetFmt(m.val,0) : ''}</div>
      <div class="ozet-year-track"><i></i></div>
      <div class="ozet-year-label">${m.label.slice(0,3)}</div>
    </div>`;
  }).join('')}</div>`;
}

function drawOzetMakCeyrek(yil){
  const wrap=document.getElementById('ozet-mak-ceyrek-wrap');
  if(!wrap) return;

  const qs=['Q1','Q2','Q3','Q4'];
  const mData=MAKINELER.map(m=>({
    m, color:MAKINE_RENK[m]||'#96999b',
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
    yTicks +=`<text x="${PAD_L-6}" y="${y+4}" text-anchor="end" font-size="9" fill="#96999b" font-family="IBM Plex Mono,monospace">${Math.round(maxVal*r)}</text>`;
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

  const legend=mData.map(ds=>`<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:#606363"><span style="width:10px;height:10px;border-radius:2px;background:${ds.color};display:inline-block"></span>${ds.m}</span>`).join('');

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
    wrap.innerHTML = `<div style="background:rgba(79,125,50,.06);border:1px solid rgba(79,125,50,.15);border-radius:var(--r);padding:12px 16px;font-size:12px;color:var(--green)">✓ Aktif uyarı yok</div>`;
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
    csv += `${d.makine},${d.tarih},"${d.sondaj||''}","${d.neden||''}","${temizDuraklamaAciklama(d.aciklama)}",${d.dk||0}\n`;
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
window.setVardiyaLokasyonFromKuyu = setVardiyaLokasyonFromKuyu;
window.setDurakLokasyonFromKuyu = setDurakLokasyonFromKuyu;
window.updateKuyuDegisimPanel = updateKuyuDegisimPanel;
window.applyKuyuDegisimDagitim = applyKuyuDegisimDagitim;
window.updateKuyuDegisimTotals = updateKuyuDegisimTotals;
window.delGunluk    = delGunluk;
window.openDurak    = openDurak;
window.closeDurak   = closeDurak;
window.saveDurak    = saveDurak;
window.delDurak     = delDurak;
window.sortDurak    = sortDurak;
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
window.setOzetFilter = setOzetFilter;
window.setOzetRange = setOzetRange;
window.renderHakedis = renderHakedis;
window.exportHakedis = exportHakedis;
window.setHakedisLocation = setHakedisLocation;
window.toggleHakedisKuyuMenu = toggleHakedisKuyuMenu;
window.hakedisPickAll = hakedisPickAll;
window.hakedisToggleKuyu = hakedisToggleKuyu;
window.hakedisToggleDetail = hakedisToggleDetail;
window.hakedisAction = hakedisAction;
window.hakedisUndo = hakedisUndo;
window.hakedisBulkKontrol = hakedisBulkKontrol;
window.setHakedisKur = setHakedisKur;
window.setHakedisKesinti = setHakedisKesinti;
window.setHakedisTopluKesinti = setHakedisTopluKesinti;
document.addEventListener('click', hakedisOutsideClick);

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
  'GS-200':       '#e9cd53',
  'DBC-U6':       '#4f7d32',
  'BATUHAN-600X': '#f47721',
  'GS-600':       '#1d4f8f',
  'BDU-600':      '#231f20',
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

function ddh_drawRigLegacy(ctx, rigColor, durum, t) {
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
    ctx.fillStyle = '#e9cd53';
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
  const bitColor = isAktif ? '#231f20' : 'rgba(100,108,128,0.8)';
  const bitDark  = isAktif ? '#231f20' : 'rgba(70,78,98,0.8)';
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
    ctx.fillStyle = 'rgba(138,119,83,0.14)';
    ctx.beginPath(); ctx.arc(84, 20, 11, 0, PI*2); ctx.fill();
    ctx.strokeStyle = '#8a7753'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(84, 20, 11, 0, PI*2); ctx.stroke();
    // Pause çubukları
    ctx.fillStyle = '#8a7753';
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
function ddh_hexToRgb(hex) {
  const clean = String(hex || '#606363').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(ch => ch + ch).join('') : clean;
  return {
    r: parseInt(full.slice(0, 2), 16) || 100,
    g: parseInt(full.slice(2, 4), 16) || 116,
    b: parseInt(full.slice(4, 6), 16) || 139,
  };
}

// Rig visual engine v4. This later declaration overrides the older drawer above.
function ddh_drawRig(ctx, rigColor, durum, t) {
  const W = DDH_W, H = DDH_H;
  const PI = Math.PI;
  const dpr = DDH_DPR;
  const isAktif = durum === 'aktif';
  const isDurak = durum === 'durak';
  const rgb = ddh_hexToRgb(rigColor);
  const pulse = isAktif ? (Math.sin(t * 5.4) + 1) / 2 : 0;
  const shake = isAktif ? Math.sin(t * 32) * .65 : 0;
  const feed = isAktif ? Math.sin(t * 4.6) * 1.8 : 0;

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const sky = ctx.createLinearGradient(0, 0, 0, 98);
  sky.addColorStop(0, 'rgba(255,255,255,.95)');
  sky.addColorStop(1, 'rgba(235,239,246,.92)');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, 98);

  ctx.fillStyle = 'rgba(65,74,90,.07)';
  ctx.beginPath();
  ctx.ellipse(55, 91, 44, 10, 0, 0, PI * 2);
  ctx.fill();

  const ground = ctx.createLinearGradient(0, 94, 0, H);
  ground.addColorStop(0, 'rgba(127,111,88,.33)');
  ground.addColorStop(.55, 'rgba(103,88,69,.22)');
  ground.addColorStop(1, 'rgba(83,70,55,.14)');
  ctx.fillStyle = ground;
  ctx.fillRect(0, 94, W, H - 94);

  ctx.strokeStyle = 'rgba(109,95,75,.42)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 94.5);
  ctx.bezierCurveTo(24, 92.5, 42, 96.5, 62, 94.5);
  ctx.bezierCurveTo(80, 92.5, 94, 93.5, W, 95);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(92,79,61,.14)';
  ctx.lineWidth = .7;
  for (let i = 0; i < 5; i++) {
    const y = 100 + i * 5;
    ctx.beginPath();
    ctx.moveTo(8, y);
    ctx.lineTo(W - 8, y + Math.sin(i) * 1.4);
    ctx.stroke();
  }

  const boreGlow = isAktif ? .24 + pulse * .22 : .08;
  ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${boreGlow})`;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(55 + shake * .25, 91);
  ctx.lineTo(55 + shake * .2, H - 2);
  ctx.stroke();

  ctx.save();
  ctx.strokeStyle = 'rgba(50,43,36,.62)';
  ctx.lineWidth = 3.5;
  ctx.setLineDash([4, 4]);
  ctx.lineDashOffset = isAktif ? -((t * 18) % 8) : 0;
  ctx.beginPath();
  ctx.moveTo(55 + shake * .25, 94);
  ctx.lineTo(55 + shake * .2, H - 2);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = 'rgba(44,50,64,.18)';
  ctx.beginPath();
  ctx.ellipse(55, 94, 10, 3.2, 0, 0, PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(78,68,55,.52)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.ellipse(55, 94, 8.2, 2.5, 0, 0, PI * 2);
  ctx.stroke();

  if (isAktif) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    for (let i = 0; i < 9; i++) {
      const phase = (t * (1.2 + i * .13) + i * .71) % 1;
      const side = i % 2 ? 1 : -1;
      const x = 55 + side * (5 + phase * (10 + i % 3 * 3));
      const y = 94 - Math.sin(phase * PI) * (5 + i % 4);
      const a = (1 - phase) * .34;
      ctx.fillStyle = `rgba(126,105,76,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.1 + (i % 3) * .35, 0, PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.fillStyle = `rgba(153,132,98,${.16 + pulse * .14})`;
    ctx.beginPath();
    ctx.ellipse(55, 95, 13 + pulse * 4, 4.2 + pulse * 1.2, 0, 0, PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(shake * .35, 0);

  const track = ctx.createLinearGradient(9, 80, 9, 94);
  track.addColorStop(0, 'rgba(73,80,96,.96)');
  track.addColorStop(1, 'rgba(34,40,53,.98)');
  ctx.fillStyle = track;
  ddh_roundRect(ctx, 9, 80, 92, 15, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.16)';
  ctx.lineWidth = .8;
  ctx.stroke();

  for (let i = 0; i < 9; i++) {
    const x = 13 + i * 9.2;
    ctx.fillStyle = i % 2 ? 'rgba(18,23,34,.72)' : 'rgba(28,34,47,.82)';
    ddh_roundRect(ctx, x, 83, 7.8, 7.2, 2);
    ctx.fill();
  }
  [18, 91].forEach(x => {
    ctx.fillStyle = 'rgba(96,106,128,.86)';
    ctx.beginPath();
    ctx.arc(x, 87.5, 5.5, 0, PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(221,226,238,.22)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(29,35,48,.7)';
    ctx.beginPath();
    ctx.arc(x, 87.5, 2.1, 0, PI * 2);
    ctx.fill();
  });

  const body = ctx.createLinearGradient(20, 48, 88, 82);
  body.addColorStop(0, 'rgba(96,105,127,.98)');
  body.addColorStop(.58, 'rgba(57,66,87,.98)');
  body.addColorStop(1, 'rgba(43,51,68,.98)');
  ctx.fillStyle = body;
  ddh_roundRect(ctx, 20, 47, 70, 34, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.15)';
  ctx.stroke();

  ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},.82)`;
  ddh_roundRect(ctx, 50, 52, 22, 10, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ctx.fillRect(52, 53, 18, 2);

  const glass = ctx.createLinearGradient(25, 51, 47, 66);
  glass.addColorStop(0, 'rgba(74,111,166,.86)');
  glass.addColorStop(1, 'rgba(15,25,48,.94)');
  ctx.fillStyle = glass;
  ddh_roundRect(ctx, 25, 51, 22, 15, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(214,232,255,.24)';
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.16)';
  ctx.beginPath();
  ctx.moveTo(27, 53);
  ctx.lineTo(39, 53);
  ctx.lineTo(27, 62);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(177,188,211,.34)';
  ctx.lineWidth = .8;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(75, 54 + i * 3.6);
    ctx.lineTo(87, 54 + i * 3.6);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(47,53,68,.9)';
  ddh_roundRect(ctx, 84, 40, 5, 12, 2);
  ctx.fill();
  if (isAktif) {
    ctx.fillStyle = `rgba(90,96,110,${.08 + pulse * .12})`;
    ctx.beginPath();
    ctx.ellipse(90, 36 - pulse * 2, 5 + pulse * 3, 2.5 + pulse, -.2, 0, PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(55 + shake * .15, 0);
  ctx.strokeStyle = 'rgba(40,48,66,.34)';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-8, 7); ctx.lineTo(-18, 50); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8, 7); ctx.lineTo(18, 50); ctx.stroke();

  ctx.strokeStyle = 'rgba(111,122,151,.96)';
  ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(-8, 7); ctx.lineTo(-18, 50); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8, 7); ctx.lineTo(18, 50); ctx.stroke();

  ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},.62)`;
  ctx.lineWidth = 1.1;
  [-14, -5, 5, 14].forEach(y => {
    const yy = y + 28;
    const span = 5 + (yy - 7) * .28;
    ctx.beginPath();
    ctx.moveTo(-span, yy);
    ctx.lineTo(span, yy);
    ctx.stroke();
  });

  ctx.strokeStyle = 'rgba(115,126,153,.34)';
  ctx.lineWidth = .8;
  ctx.beginPath(); ctx.moveTo(-6, 18); ctx.lineTo(10, 33); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, 18); ctx.lineTo(-10, 33); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-11, 33); ctx.lineTo(15, 45); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(11, 33); ctx.lineTo(-15, 45); ctx.stroke();

  ctx.fillStyle = rigColor;
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(-5.5, 10);
  ctx.lineTo(5.5, 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = isAktif ? `rgba(251,191,36,${.45 + pulse * .45})` : 'rgba(150,155,165,.35)';
  ctx.beginPath();
  ctx.arc(0, 2.2, isAktif ? 3 + pulse * 1.2 : 2.5, 0, PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(71,82,104,.46)';
  ctx.lineWidth = .9;
  ctx.setLineDash([4, 2.5]);
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.lineTo(0, 49 + feed);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  ctx.save();
  ctx.translate(55 + shake * .18, 50 + feed);
  ctx.rotate(isAktif ? t * 5.8 : (isDurak ? Math.sin(t * 1.1) * .07 : 0));
  ctx.shadowColor = 'rgba(0,0,0,.24)';
  ctx.shadowBlur = 5;
  ctx.strokeStyle = rigColor;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(0, 0, 10.5, 0, PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(31,38,54,.95)';
  ctx.beginPath();
  ctx.arc(0, 0, 7.8, 0, PI * 2);
  ctx.fill();
  ctx.strokeStyle = rigColor;
  ctx.lineWidth = 2.1;
  ctx.beginPath(); ctx.moveTo(-6.5, 0); ctx.lineTo(6.5, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -6.5); ctx.lineTo(0, 6.5); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.82)';
  ctx.beginPath(); ctx.arc(0, 0, 1.8, 0, PI * 2); ctx.fill();
  ctx.restore();

  const rodX = 55 + shake * .2;
  const rodY = 58 + feed;
  const rodGrad = ctx.createLinearGradient(rodX - 5, 0, rodX + 5, 0);
  rodGrad.addColorStop(0, 'rgba(32,38,52,.98)');
  rodGrad.addColorStop(.48, 'rgba(118,128,154,.95)');
  rodGrad.addColorStop(1, 'rgba(32,38,52,.98)');
  ctx.fillStyle = rodGrad;
  ddh_roundRect(ctx, rodX - 3, rodY, 6, 36, 3);
  ctx.fill();

  [69, 81].forEach(y => {
    ctx.fillStyle = 'rgba(92,102,126,.95)';
    ddh_roundRect(ctx, rodX - 6, y + feed, 12, 4.8, 2.4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(235,240,250,.16)';
    ctx.lineWidth = .6;
    ctx.stroke();
  });

  ctx.save();
  ctx.translate(rodX, 94 + feed);
  ctx.rotate(isAktif ? t * 8.2 : 0);
  ctx.shadowColor = 'rgba(0,0,0,.3)';
  ctx.shadowBlur = 4;
  ctx.fillStyle = isAktif ? '#231f20' : 'rgba(91,98,118,.88)';
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.bezierCurveTo(-5, -4, -7, 2, -4.8, 9);
  ctx.lineTo(4.8, 9);
  ctx.bezierCurveTo(7, 2, 5, -4, 0, -8);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(20,24,32,.45)';
  ctx.lineWidth = .8;
  ctx.beginPath(); ctx.moveTo(-5, -1); ctx.lineTo(-2.7, 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(0, 8.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(5, -1); ctx.lineTo(2.7, 8); ctx.stroke();
  ctx.fillStyle = isAktif ? '#231f20' : 'rgba(58,65,84,.86)';
  ddh_roundRect(ctx, -5.2, -10.5, 10.4, 4.2, 2);
  ctx.fill();
  ctx.restore();

  if (isDurak || !isAktif) {
    const x = 86, y = 20;
    ctx.fillStyle = isDurak ? 'rgba(138,119,83,.13)' : 'rgba(100,108,128,.10)';
    ctx.beginPath(); ctx.arc(x, y, 11, 0, PI * 2); ctx.fill();
    ctx.strokeStyle = isDurak ? '#8a7753' : 'rgba(100,108,128,.42)';
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(x, y, 11, 0, PI * 2); ctx.stroke();
    ctx.fillStyle = isDurak ? '#8a7753' : 'rgba(100,108,128,.58)';
    if (isDurak) {
      ddh_roundRect(ctx, x - 4.2, y - 5.8, 3.2, 11.6, 1.3); ctx.fill();
      ddh_roundRect(ctx, x + 1.2, y - 5.8, 3.2, 11.6, 1.3); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(x, y, 3.4, 0, PI * 2); ctx.fill();
    }
  }

  ctx.restore();
  ctx.restore();
}

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
    ddhDestroyRigControllers();
    grid.innerHTML = '';
    MAKINELER.forEach(makine => {
      const temaRenk = MAKINE_RENKLER_V2[makine] || '#606363';
      const rigRenk = temaRenk;

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
        '<div class="ddh-rig-strip" style="background:' + temaRenk + '"></div>' +
        '<div class="ddh-rig-body">' +
          '<div class="ddh-rig-header">' +
            '<div class="ddh-rig-name" style="color:' + temaRenk + '">' + makine + '</div>' +
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
            '<div class="ddh-progress-bar" id="ddhpb-' + makine.replace(/[^a-zA-Z0-9]/g,'') + '" style="width:' + pct + '%;background:' + temaRenk + '"></div>' +
          '</div>' +
          '<div class="ddh-rig-meta">' +
            '<span>' + donemLbl + ': <strong>' + donemMetraj.toFixed(1) + ' m</strong></span>' +

          '</div>' +
        '</div>';
      grid.appendChild(card);
      const canvas = document.getElementById(cid);
      if (canvas) {
        const rigStatus = durum === 'durak' ? 'durak' : durum === 'aktif' ? 'aktif' : 'pasif';
        const ctrl = RigAnim.mount(canvas, {
          status: rigStatus,
          machineName: makine,
          color: rigRenk,
          showDepth: false,
          initialDepth: derinlik
        });
        canvas._ddhRigController = ctrl;
        _ddhRigControllers.set(cid, ctrl);
      }
    });
  }
}

// ── ANIMATION LOOP ─────────────────────────────────────────────
let _ddhAnimStart = null;
let _ddhDepthCache = {};
let _ddhRigControllers = new Map();

function ddhDestroyRigControllers() {
  _ddhRigControllers.forEach(ctrl => ctrl.destroy());
  _ddhRigControllers.clear();
}

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
      if (canvas._ddhRigController) return;
      const ctx = ddh_initCanvas(canvas);
      const donemKuyu = ayMakineAktifKuyu(makine);
      const durum = ddhMakineDurum(makine, donemKuyu);
      const renk = MAKINE_RENKLER_V2[makine] || '#606363';
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
