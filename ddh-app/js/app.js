import { PRELOADED_KUYULAR, PRELOADED_GUNLUK, PRELOADED_NEXTID } from './data.js';
import { RigAnim } from './ddhRigAnim.js?v=project-theme-5';
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