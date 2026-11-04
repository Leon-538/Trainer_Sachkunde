(function(){
"use strict";
const QS = window.QUESTIONS || [];
const QMAP = Object.fromEntries(QS.map(q => [q.id, q]));
const SEC = {A:'Verhalten', B:'Gesundheit', C:'Rechtliches'};
const SECS = ['A','B','C'];
const TOTAL = QS.length;
const KEY = 'lhundg-sachkunde-trainer-v1';
const ST_LABEL = {neu:'Neu', falsch:'Zuletzt falsch', unsicher:'1× richtig', sicher:'Sicher'};
const ST_CLASS = {neu:'neu', falsch:'bad', unsicher:'warn', sicher:'good'};

/* ---------- Zustand ---------- */
function fresh(){ return {v:1, updatedAt:0, stats:{}, exams:[], settings:{examN:30, passPct:80}}; }
function normalize(o){
  if(!o || typeof o !== 'object') return null;
  const s = fresh();
  s.updatedAt = Number(o.updatedAt) || 0;
  if(o.stats && typeof o.stats === 'object'){
    for(const id in o.stats){
      if(!QMAP[id]) continue;
      const x = o.stats[id] || {};
      s.stats[id] = {n:+x.n||0, c:+x.c||0, h:Array.isArray(x.h)?x.h.map(v=>v?1:0).slice(-6):[], t:+x.t||0};
    }
  }
  if(Array.isArray(o.exams)) s.exams = o.exams.filter(e => e && typeof e.pct === 'number').slice(-50);
  if(o.settings){
    if([20,30,50,114].includes(+o.settings.examN)) s.settings.examN = +o.settings.examN;
    if([70,75,80,90].includes(+o.settings.passPct)) s.settings.passPct = +o.settings.passPct;
  }
  return s;
}
function loadLocal(){ try{ const r = localStorage.getItem(KEY); return r ? normalize(JSON.parse(r)) : null; }catch(e){ return null; } }
let S = loadLocal() || fresh();

let storageOk = true;
function persist(){
  S.updatedAt = Date.now();
  try{ localStorage.setItem(KEY, JSON.stringify(S)); storageOk = true; }catch(e){ storageOk = false; }
}
function storeBadge(){
  return storageOk
    ? '<span class="store ok" id="storeState"><i></i>Dein Fortschritt wird auf diesem Gerät gespeichert.</span>'
    : '<span class="store" id="storeState"><i></i>Speichern ist in diesem Browser blockiert (z. B. privater Modus). Nutze den Sicherungscode.</span>';
}
/* Laufende Prüfung übersteht Neuladen und App-Wechsel (iOS beendet Hintergrund-Tabs gern) */
const SESSION_KEY = KEY + '-exam';
function saveExam(){ try{ if(E) localStorage.setItem(SESSION_KEY, JSON.stringify(E)); else localStorage.removeItem(SESSION_KEY); }catch(e){} }
function loadExam(){
  try{
    const o = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if(o && Array.isArray(o.ids) && o.ids.every(id => QMAP[id]) && Date.now() - o.start < 24*3600e3){ o.confirm = false; o.cancelAsk = false; return o; }
  }catch(e){}
  return null;
}
/* Safari löscht Website-Daten sonst evtl. nach längerer Nichtnutzung */
try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist(); }catch(e){}

/* ---------- Auswertung ---------- */
function record(id, ok){
  const s = S.stats[id] || (S.stats[id] = {n:0, c:0, h:[], t:0});
  s.n++; if(ok) s.c++;
  s.h.push(ok ? 1 : 0); if(s.h.length > 6) s.h.shift();
  s.t = Date.now();
}
function status(id){
  const s = S.stats[id];
  if(!s || !s.n || !s.h.length) return 'neu';
  const h = s.h;
  if(!h[h.length-1]) return 'falsch';
  if(h.length >= 2 && h[h.length-2]) return 'sicher';
  return 'unsicher';
}
function counts(ids){
  const c = {neu:0, falsch:0, unsicher:0, sicher:0};
  ids.forEach(id => c[status(id)]++);
  return c;
}
const idsOf = sec => QS.filter(q => sec === 'all' || q.sec === sec).map(q => q.id);
function readiness(){
  const all = counts(idsOf('all'));
  const seen = TOTAL - all.neu;
  const lastOk = all.unsicher + all.sicher;
  const per = {};
  SECS.forEach(s => { const ids = idsOf(s); const c = counts(ids); per[s] = {c, n:ids.length, ok:(c.unsicher + c.sicher)/ids.length}; });
  const pass = S.settings.passPct;
  const last3 = S.exams.slice(-3);
  const examAvg = last3.length ? last3.reduce((a,e) => a + e.pct, 0)/last3.length : 0;
  const passed3 = last3.filter(e => e.pct >= pass).length;
  const score = Math.round(100*(0.45*lastOk/TOTAL + 0.25*all.sicher/TOTAL + 0.30*examAvg/100));
  const weakest = SECS.slice().sort((a,b) => per[a].ok - per[b].ok)[0];
  const crit = [
    {ok: seen === TOTAL, label:'Alle 114 Fragen mindestens einmal bearbeitet', val: seen + ' / ' + TOTAL},
    {ok: lastOk/TOTAL >= 0.9, label:'Mindestens 90 % der Fragen zuletzt richtig', val: pct(lastOk/TOTAL)},
    {ok: SECS.every(s => per[s].ok >= 0.85), label:'Jeder Abschnitt mindestens 85 % zuletzt richtig', val: SECS.map(s => s + ' ' + pct(per[s].ok)).join(' · ')},
    {ok: last3.length >= 3 && passed3 === 3, label:'Die letzten 3 Prüfungssimulationen bestanden (ab ' + pass + ' %)', val: passed3 + ' von 3'}
  ];
  const okCount = crit.filter(c => c.ok).length;
  const level = okCount === 4 ? 'ready' : (okCount >= 2 && score >= 70 ? 'almost' : 'notyet');
  return {all, seen, lastOk, per, score, crit, okCount, level, last3, examAvg, weakest, pass};
}
function pct(x){ return Math.round(x*100) + ' %'; }
function backupCode(){ return btoa(unescape(encodeURIComponent(JSON.stringify(S)))); }
function nextStep(r){
  if(r.seen < TOTAL) return {text:'Es sind noch ' + (TOTAL - r.seen) + ' Fragen unbearbeitet. Arbeite sie im Lernmodus einmal durch.', btn:'Neue Fragen lernen', act:'go-learn', a:'all', p:'neu'};
  const wrong = r.all.falsch;
  if(wrong > 0 && r.lastOk/TOTAL < 0.9) return {text:'Du hast ' + wrong + ' Fragen zuletzt falsch beantwortet. Wiederhole sie, bis sie sitzen.', btn:'Fehler wiederholen', act:'go-learn', a:'all', p:'falsch'};
  if(r.per[r.weakest].ok < 0.85) return {text:'Abschnitt ' + r.weakest + ' (' + SEC[r.weakest] + ') ist mit ' + pct(r.per[r.weakest].ok) + ' dein schwächster Bereich.', btn:'Abschnitt ' + r.weakest + ' üben', act:'go-learn', a:r.weakest, p:'offen'};
  if(r.all.unsicher > 0 && r.all.sicher/TOTAL < 0.8) return {text:r.all.unsicher + ' Fragen hast du erst einmal richtig beantwortet. Ein zweites Mal macht sie sicher.', btn:'Unsichere festigen', act:'go-learn', a:'all', p:'offen'};
  if(r.level !== 'ready') return {text:'Dein Wissen sitzt. Jetzt zählt die Prüfungssituation: Bestehe drei Simulationen in Folge.', btn:'Prüfung simulieren', act:'go-exam'};
  return {text:'Alle Kriterien erfüllt. Halte das Niveau mit einer Simulation kurz vor dem Termin.', btn:'Prüfung simulieren', act:'go-exam'};
}

/* ---------- Antworten ---------- */
function isCorrect(q, a){
  if(q.type === 'multi'){
    const s = new Set(a || []);
    return s.size === q.answer.length && q.answer.every(x => s.has(x));
  }
  return !!a && q.items.every(([k]) => a[k] === q.answer[k]);
}
function isAnswered(q, a){
  if(q.type === 'multi') return !!a && a.length > 0;
  return !!a && q.items.every(([k]) => a[k]);
}
function answerText(q, a){
  if(q.type === 'multi'){
    if(!a || !a.length) return '– keine Antwort –';
    return q.opts.filter(o => a.includes(o[0])).map(o => o[0] + ') ' + o[1]).join('\n');
  }
  return q.items.map(([k,t]) => k + ') ' + t + ' → ' + ((a && a[k]) ? labelTarget(q, a[k]) : '–')).join('\n');
}
function labelTarget(q, v){ const t = q.targets.find(x => x[0] === v); return q.img ? 'Abbildung ' + v : v + ') ' + (t ? t[1] : ''); }
function solutionText(q){
  if(q.type === 'multi') return answerText(q, q.answer);
  return answerText(q, q.answer);
}

/* ---------- Hilfen ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nl = s => esc(s).replace(/\n/g, '<br>');
function shuffle(a){ a = a.slice(); for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random()*(i+1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function say(t){ const l = document.getElementById('live'); l.textContent = ''; setTimeout(() => l.textContent = t, 30); }
function fmtTime(ms){ const s = Math.max(0, Math.round(ms/1000)); return Math.floor(s/60) + ':' + String(s%60).padStart(2,'0'); }
function fmtDate(t){ try{ return new Date(t).toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit'}) + ' ' + new Date(t).toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'}); }catch(e){ return ''; } }

/* ---------- Ansichten ---------- */
let view = 'dash';
const app = document.getElementById('app');
let L = null;          // Lernsitzung
let E = null;          // Prüfungssitzung
let ER = null;         // letztes Prüfungsergebnis (Anzeige)
let learnCfg = {sec:'all', pool:'offen', order:'cat'};
let timerInt = null;

function setView(v){
  view = v;
  document.querySelectorAll('nav button').forEach(b => b.setAttribute('aria-current', b.dataset.view === v ? 'page' : 'false'));
  render();
  window.scrollTo(0, 0);
}
function render(){
  clearInterval(timerInt);
  if(view === 'dash') app.innerHTML = viewDash();
  else if(view === 'learn'){ if(!L) startLearn(); app.innerHTML = viewLearn(); }
  else if(view === 'exam'){ app.innerHTML = viewExam(); if(E && !E.done) startTimer(); }
  else if(view === 'cat') app.innerHTML = viewCat();
  bindChart();
  saveExam();
}

/* Auswertung */
function ring(score, level){
  const r = 62, c = 2*Math.PI*r, col = level === 'ready' ? 'var(--good)' : level === 'almost' ? 'var(--warn)' : 'var(--bad)';
  return '<div class="ring" role="img" aria-label="Bereitschaft ' + score + ' von 100"><svg viewBox="0 0 150 150"><circle cx="75" cy="75" r="' + r + '" fill="none" stroke="var(--line)" stroke-width="12"/>' + (score > 0 ? '<circle cx="75" cy="75" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + (c*score/100).toFixed(1) + ' ' + c.toFixed(1) + '"/>' : '') + '</svg><div class="num"><b>' + score + '</b><span>von 100</span></div></div>';
}
function viewDash(){
  const r = readiness();
  const head = {ready:'Prüfungsbereit', almost:'Fast bereit', notyet:'Noch nicht bereit'}[r.level];
  const sub = {
    ready:'Du erfüllst alle vier Kriterien. Mit diesem Stand solltest du die Sachkundeprüfung sicher bestehen.',
    almost:'Du bist auf einem guten Weg. ' + (4 - r.okCount) + ' von 4 Kriterien fehlen noch.',
    notyet: S.exams.length || r.seen ? 'Es fehlen noch ' + (4 - r.okCount) + ' von 4 Kriterien. Der nächste Schritt steht unten.' : 'Du hast noch nicht angefangen. Beantworte Fragen im Lernmodus, dann wächst diese Auswertung mit.'
  }[r.level];
  const n = nextStep(r);
  let h = '<section class="card verdict ' + r.level + '">' + ring(r.score, r.level) +
    '<div><span class="small muted">Bist du bereit für die Prüfung?</span><h2>' + head + '</h2><p style="margin:0">' + sub + '</p>' +
    '<ul class="crit">' + r.crit.map(c => '<li><span class="ic ' + (c.ok ? 'ok' : 'no') + '" aria-label="' + (c.ok ? 'erfüllt' : 'offen') + '">' + (c.ok ? '✓' : '✕') + '</span><span>' + esc(c.label) + '</span><span class="val">' + esc(c.val) + '</span></li>').join('') + '</ul>' +
    '<div class="next"><p><b>Nächster Schritt:</b> ' + esc(n.text) + '</p><button class="btn primary" data-act="' + n.act + '"' + (n.a ? ' data-a="' + n.a + '" data-p="' + n.p + '"' : '') + '>' + esc(n.btn) + ' →</button></div>' +
    '</div></section>';

  h += '<div class="grid2"><section class="card"><h3 style="margin-bottom:14px">Wissensstand je Abschnitt</h3><div class="secs">' +
    SECS.map(s => { const p = r.per[s], c = p.c;
      return '<div><div class="sec-h"><b>' + s + ' · ' + SEC[s] + '</b><span>' + pct(p.ok) + ' zuletzt richtig · ' + p.n + ' Fragen</span></div>' +
        '<div class="stack" role="img" aria-label="' + c.sicher + ' sicher, ' + c.unsicher + ' einmal richtig, ' + c.falsch + ' falsch, ' + c.neu + ' neu">' +
        ['sicher','unsicher','falsch','neu'].filter(k => c[k]).map(k => '<i class="s-' + k + '" style="flex:' + c[k] + '" title="' + ST_LABEL[k] + ': ' + c[k] + '"></i>').join('') + '</div></div>';
    }).join('') + '</div>' +
    '<div class="legend" style="margin-top:14px"><span><i class="s-sicher"></i>Sicher (2× in Folge richtig) ' + r.all.sicher + '</span><span><i class="s-unsicher"></i>1× richtig ' + r.all.unsicher + '</span><span><i class="s-falsch"></i>Zuletzt falsch ' + r.all.falsch + '</span><span><i class="s-neu"></i>Neu ' + r.all.neu + '</span></div></section>';

  h += '<section class="card"><div class="row" style="justify-content:space-between;margin-bottom:10px"><h3>Prüfungssimulationen</h3><button class="btn" data-act="go-exam">Neue Simulation</button></div>' + examChart() + '</section></div>';

  const weak = QS.map(q => ({q, s:S.stats[q.id], st:status(q.id)})).filter(x => x.st === 'falsch' || (x.s && x.s.n - x.s.c >= 2))
    .sort((a,b) => ((b.st === 'falsch') - (a.st === 'falsch')) || ((b.s.n - b.s.c) - (a.s.n - a.s.c))).slice(0, 8);
  h += '<div class="grid2"><section class="card"><h3 style="margin-bottom:10px">Deine Problemfragen</h3>' +
    (weak.length ? '<ul class="weak">' + weak.map(x => '<li><button data-act="open-q" data-id="' + x.q.id + '"><span class="qid">' + x.q.id + '</span><span>' + esc(x.q.q.length > 80 ? x.q.q.slice(0, 78) + '…' : x.q.q) + '</span><span class="pill ' + ST_CLASS[x.st] + '">' + (x.s.n - x.s.c) + '× falsch</span></button></li>').join('') + '</ul>' +
      '<div style="margin-top:12px"><button class="btn" data-act="go-learn" data-a="all" data-p="falsch">Alle Fehler wiederholen</button></div>'
      : '<div class="empty">Noch keine Problemfragen. Fragen, die du falsch beantwortest, erscheinen hier.</div>') + '</section>';
  h += '<section class="card"><h3 style="margin-bottom:10px">So wird ausgewertet</h3><p class="small" style="margin-top:0">Eine Frage zählt nur als richtig, wenn <b>alle</b> richtigen Antworten angekreuzt sind und keine falsche. Bei Zuordnungsfragen müssen alle Zuordnungen stimmen. Diese strenge Wertung ist bei Sachkundeprüfungen üblich, so übst du auf der sicheren Seite.</p>' +
    '<p class="small">Die Bereitschaftszahl setzt sich zusammen aus: zuletzt richtig beantworteten Fragen (45 %), sicher beherrschten Fragen (25 %) und dem Schnitt deiner letzten 3 Simulationen (30 %).</p>' +
    '<p class="small muted" style="margin-bottom:0">Die Bestehensgrenze der echten Prüfung legt dein Veterinäramt fest. Stelle sie unter „Prüfung“ passend ein (Standard 80 %).</p></section></div>';

  h += '<section class="card"><details><summary>Fortschritt sichern oder übertragen</summary><div style="margin-top:12px;display:flex;flex-direction:column;gap:10px">' + storeBadge() +
    '<p class="small" style="margin:0">Dein Stand liegt nur auf diesem Gerät, in diesem Browser. Mit dem Sicherungscode überträgst du ihn auf ein anderes Gerät oder stellst ihn wieder her. Tipp fürs iPhone: Füge die App zum Home-Bildschirm hinzu, dann bleibt der Stand zuverlässiger erhalten.</p>' +
    '<div class="row">' + (navigator.share ? '<button class="btn" data-act="share-backup">Sicherung teilen (z. B. in Notizen)</button>' : '') + '<button class="btn" data-act="copy-backup">Sicherungscode kopieren</button><button class="btn" data-act="show-import">Code einfügen</button><button class="btn ghost danger" data-act="reset">Fortschritt zurücksetzen</button></div>' +
    '<div id="dataBox"></div></div></details></section>';
  return h;
}
function examChart(){
  const ex = S.exams.slice(-12);
  if(!ex.length) return '<div class="empty">Noch keine Simulation. Starte eine, sobald du die Fragen einmal durchgearbeitet hast.</div>';
  const W = 440, H = 190, pl = 34, pr = 8, pt = 10, pb = 26, ih = H - pt - pb, iw = W - pl - pr;
  const bw = Math.min(28, iw/ex.length - 6), step = iw/ex.length;
  const y = v => pt + ih - ih*v/100;
  let s = '<div class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Ergebnisse der letzten ' + ex.length + ' Simulationen in Prozent">';
  [0,25,50,75,100].forEach(v => { s += '<line class="grid" x1="' + pl + '" x2="' + (W-pr) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="axis" x="' + (pl-6) + '" y="' + (y(v)+4) + '" text-anchor="end">' + v + '</text>'; });
  ex.forEach((e, i) => {
    const x = pl + step*i + (step - bw)/2, top = y(e.pct), hh = Math.max(2, y(0) - top);
    const r = Math.min(4, bw/2, hh);
    const d = 'M' + x + ',' + y(0) + 'V' + (top + r) + 'Q' + x + ',' + top + ' ' + (x + r) + ',' + top + 'H' + (x + bw - r) + 'Q' + (x + bw) + ',' + top + ' ' + (x + bw) + ',' + (top + r) + 'V' + y(0) + 'Z';
    const tip = fmtDate(e.t) + ' · ' + e.ok + '/' + e.n + ' richtig · ' + e.pct + ' % · ' + (e.pct >= S.settings.passPct ? 'bestanden' : 'nicht bestanden');
    s += '<rect class="hit" x="' + (pl + step*i) + '" y="' + pt + '" width="' + step + '" height="' + ih + '" data-tip="' + esc(tip) + '" data-i="' + i + '"/>';
    s += '<path class="bar' + (e.pct >= S.settings.passPct ? '' : ' fail') + '" id="bar' + i + '" d="' + d + '"/>';
    s += '<text class="axis" x="' + (x + bw/2) + '" y="' + (H - 8) + '" text-anchor="middle">' + (S.exams.length - ex.length + i + 1) + '</text>';
  });
  const tp = S.settings.passPct;
  s += '<line class="thr" x1="' + pl + '" x2="' + (W-pr) + '" y1="' + y(tp) + '" y2="' + y(tp) + '"/><text class="axis" x="' + (W-pr) + '" y="' + (y(tp)-5) + '" text-anchor="end" style="fill:var(--ink)">Grenze ' + tp + ' %</text>';
  s += '</svg><div class="tip" id="tip"></div></div>';
  const last = ex[ex.length-1];
  s += '<div class="legend"><span><i style="background:var(--accent)"></i>bestanden</span><span><i style="background:var(--neu)"></i>nicht bestanden</span><span>Letzte: <b style="color:var(--ink)">' + last.pct + ' %</b> (' + last.ok + '/' + last.n + ')</span></div>';
  return s;
}
function bindChart(){
  const tip = document.getElementById('tip'); if(!tip) return;
  const box = tip.parentElement;
  box.querySelectorAll('.hit').forEach(h => {
    h.addEventListener('mouseenter', () => { tip.textContent = h.dataset.tip; tip.style.display = 'block'; const bar = document.getElementById('bar' + h.dataset.i); bar && bar.classList.add('hl');
      const br = box.getBoundingClientRect(), hr = h.getBoundingClientRect(), b2 = bar.getBoundingClientRect();
      tip.style.left = Math.min(Math.max(hr.left - br.left + hr.width/2, 90), br.width - 90) + 'px'; tip.style.top = (b2.top - br.top) + 'px'; });
    h.addEventListener('mouseleave', () => { tip.style.display = 'none'; const bar = document.getElementById('bar' + h.dataset.i); bar && bar.classList.remove('hl'); });
  });
}

/* Lernen */
function poolIds(cfg){
  let ids = idsOf(cfg.sec);
  if(cfg.pool === 'offen') ids = ids.filter(id => status(id) !== 'sicher');
  else if(cfg.pool === 'falsch') ids = ids.filter(id => status(id) === 'falsch');
  else if(cfg.pool === 'neu') ids = ids.filter(id => status(id) === 'neu');
  return cfg.order === 'rand' ? shuffle(ids) : ids;
}
function startLearn(ids, label){
  const list = ids || poolIds(learnCfg);
  L = {ids:list, i:0, a:null, revealed:false, ok:0, done:0, label:label || null};
}
const POOL_LABEL = {alle:'Alle', offen:'Noch nicht sicher', falsch:'Nur Fehler', neu:'Nur neue'};
function seg(name, opts, cur){
  return '<div class="seg" role="group">' + opts.map(([v,t]) => '<button data-act="cfg" data-k="' + name + '" data-v="' + v + '" aria-pressed="' + (cur === v) + '">' + esc(t) + '</button>').join('') + '</div>';
}
function viewLearn(){
  let h = '<section class="card"><div class="toolbar">' +
    '<div class="field"><span>Abschnitt</span>' + seg('sec', [['all','Alle'],['A','A Verhalten'],['B','B Gesundheit'],['C','C Recht']], learnCfg.sec) + '</div>' +
    '<div class="field"><span>Fragen</span>' + seg('pool', [['alle','Alle'],['offen','Nicht sicher'],['falsch','Fehler'],['neu','Neue']], learnCfg.pool) + '</div>' +
    '<div class="field"><span>Reihenfolge</span>' + seg('order', [['cat','Katalog'],['rand','Zufall']], learnCfg.order) + '</div>' +
    '</div>' + (L.label ? '<p class="small muted" style="margin:12px 0 0">Aktuelle Auswahl: ' + esc(L.label) + ' · <button class="btn ghost small" style="padding:2px 6px" data-act="cfg-reset">zurück zu den Filtern</button></p>' : '') + '</section>';
  if(!L.ids.length){
    return h + '<section class="card"><div class="empty">' + (learnCfg.pool === 'falsch' ? 'Keine falsch beantworteten Fragen in dieser Auswahl. Gut so!' : learnCfg.pool === 'neu' ? 'Alle Fragen dieser Auswahl hast du schon bearbeitet.' : 'In dieser Auswahl ist jede Frage sicher. Wähle „Alle“, um trotzdem zu üben.') + '</div></section>';
  }
  if(L.i >= L.ids.length){
    const p = L.done ? L.ok/L.done : 0;
    return h + '<section class="card result ' + (p >= S.settings.passPct/100 ? 'pass' : 'fail') + '"><div class="big">' + L.ok + '/' + L.done + '</div><div><h2>Runde geschafft</h2><p>' + pct(p) + ' richtig in dieser Runde.</p><div class="row"><button class="btn primary" data-act="learn-restart">Neue Runde mit diesen Filtern</button><button class="btn" data-act="nav" data-view="dash">Zur Auswertung</button></div></div></section>';
  }
  const q = QMAP[L.ids[L.i]];
  const st = status(q.id), s = S.stats[q.id];
  h += '<section class="card"><div class="progress" aria-hidden="true"><i style="width:' + (100*L.i/L.ids.length) + '%"></i></div>' +
    '<div class="row small muted" style="justify-content:space-between;margin:8px 0 14px"><span>Frage ' + (L.i+1) + ' von ' + L.ids.length + '</span><span>Diese Runde: ' + L.ok + ' von ' + L.done + ' richtig</span></div>' +
    '<div class="qhead"><span class="qid">' + q.id + '</span><span class="pill">' + q.sec + ' · ' + SEC[q.sec] + '</span><span class="pill ' + ST_CLASS[st] + '">' + ST_LABEL[st] + '</span>' + (s && s.n ? '<span class="small muted">' + s.c + ' von ' + s.n + '× richtig</span>' : '') + '</div>' +
    questionBody(q, L.a, L.revealed, 'learn');
  if(L.revealed){
    const ok = isCorrect(q, L.a);
    h += '<div class="feedback ' + (ok ? 'ok' : 'bad') + '" role="status">' + (ok ? '✓ Richtig!' : '✕ Leider falsch. ' + (q.type === 'multi' ? 'Richtig ist: ' + q.answer.join(', ') : 'Die richtigen Zuordnungen sind markiert.')) + '</div>';
  }
  h += '<div class="actions"><button class="btn ghost" data-act="learn-prev"' + (L.i === 0 ? ' disabled' : '') + '>← Zurück</button>' +
    '<span class="kbd">Tasten: a–i ankreuzen · Enter prüfen/weiter</span>' +
    (L.revealed ? '<button class="btn primary" data-act="learn-next">' + (L.i + 1 < L.ids.length ? 'Nächste Frage →' : 'Runde abschließen') + '</button>'
      : '<div class="row"><button class="btn ghost" data-act="learn-skip">Überspringen</button><button class="btn primary" data-act="learn-check"' + (isAnswered(q, L.a) ? '' : ' disabled') + '>Antwort prüfen</button></div>') +
    '</div></section>';
  return h;
}
function questionBody(q, a, revealed, ctx){
  let h = '<p class="qtext">' + esc(q.q) + '</p>';
  if(q.type === 'multi'){
    h += '<p class="hint">' + (ctx === 'review' ? '' : 'Kreuze alle zutreffenden Antworten an. Es können eine oder mehrere richtig sein.') + '</p>';
    if(q.img) h += '<div class="figure small"><img src="' + q.img + '" alt="Abbildung zu Frage ' + q.id + ': Kopf eines Hundes mit gefletschten Zähnen und angelegten Ohren"></div>';
    h += '<div class="opts">' + q.opts.map(([k,t]) => {
      const on = !!a && a.includes(k), right = q.answer.includes(k);
      let cls = '', note = '';
      if(revealed){
        if(on && right){ cls = 'r-hit'; note = 'richtig angekreuzt'; }
        else if(!on && right){ cls = 'r-miss'; note = 'hätte angekreuzt werden müssen'; }
        else if(on && !right){ cls = 'r-wrong'; note = 'falsch angekreuzt'; }
      }
      return '<button class="opt ' + cls + (revealed ? ' locked' : '') + '" data-act="toggle" data-k="' + k + '" aria-pressed="' + on + '"' + (revealed ? ' aria-disabled="true"' : '') + '><span class="box">' + (revealed ? (on && right ? '✓' : on ? '✕' : '') : (on ? '✓' : '')) + '</span><span class="ol">' + k + ')</span><span class="ot">' + esc(t) + '</span>' + (note ? '<span class="note">' + note + '</span>' : '') + '</button>';
    }).join('') + '</div>';
  } else {
    h += '<p class="hint">Ordne jedem Begriff die passende Nummer zu.</p>';
    if(q.img) h += '<div class="figure"><img src="' + q.img + '" alt="Nummerierte Zeichnungen von Hunden zu Frage ' + q.id + '"></div>';
    else h += '<ol class="targets">' + q.targets.map(([v,t]) => '<li><b>' + v + '</b><span>' + esc(t) + '</span></li>').join('') + '</ol>';
    h += '<div class="mrows">' + q.items.map(([k,t]) => {
      const cur = a && a[k], right = q.answer[k];
      const cls = revealed ? (cur === right ? 'ok' : 'bad') : '';
      return '<div class="mrow ' + cls + '"><div><b class="muted">' + k + ')</b> ' + esc(t) + '</div><div class="seg" role="group" aria-label="Nummer für ' + esc(t) + '">' +
        q.targets.map(([v]) => '<button data-act="pick" data-k="' + k + '" data-v="' + v + '" aria-pressed="' + (cur === v) + '"' + (revealed ? ' disabled' : '') + '>' + v + '</button>').join('') + '</div>' +
        (revealed ? '<div class="mres">' + (cur === right ? '✓ richtig' : '✕ richtig wäre ' + right + (q.img ? '' : ') ' + esc(q.targets.find(x => x[0] === right)[1]))) + '</div>' : '') + '</div>';
    }).join('') + '</div>';
  }
  return h;
}

/* Prüfung */
function buildExam(n){
  if(n >= TOTAL) return shuffle(QS.map(q => q.id));
  const per = {}; let sum = 0;
  SECS.forEach(s => { per[s] = Math.round(n * idsOf(s).length / TOTAL); sum += per[s]; });
  per.A += n - sum;
  return shuffle(SECS.flatMap(s => shuffle(idsOf(s)).slice(0, per[s])));
}
function viewExam(){
  if(ER && !E) return viewExamResult(ER);
  if(!E){
    const r = readiness();
    return '<section class="card"><h2 style="margin-bottom:6px">Prüfungssimulation</h2><p class="muted" style="margin-top:0;max-width:62ch">Zufällige Fragen aus allen drei Abschnitten, anteilig wie im Katalog. Du siehst erst nach der Abgabe, was richtig war. Jede Antwort fließt in deine Auswertung ein.</p>' +
      '<div class="toolbar" style="margin:16px 0">' +
      '<div class="field"><span>Anzahl Fragen</span>' + seg('examN', [['20','20'],['30','30'],['50','50'],['114','Alle 114']], String(S.settings.examN)) + '</div>' +
      '<div class="field"><span>Bestanden ab</span>' + seg('passPct', [['70','70 %'],['75','75 %'],['80','80 %'],['90','90 %']], String(S.settings.passPct)) + '</div></div>' +
      '<p class="small muted">Verteilung bei ' + S.settings.examN + ' Fragen: ' + (() => { const ids = buildExam(S.settings.examN); return SECS.map(s => ids.filter(id => QMAP[id].sec === s).length + '× ' + s).join(', '); })() + '. Zum Bestehen brauchst du mindestens ' + Math.ceil(S.settings.examN * S.settings.passPct / 100) + ' richtige Antworten.</p>' +
      (r.seen < TOTAL ? '<p class="small" style="color:var(--warn)">Tipp: ' + (TOTAL - r.seen) + ' Fragen hast du noch nie gesehen. Eine Simulation geht trotzdem.</p>' : '') +
      '<button class="btn primary" data-act="exam-start">Simulation starten →</button></section>' +
      (S.exams.length ? '<section class="card"><h3 style="margin-bottom:10px">Bisherige Simulationen</h3><div style="overflow-x:auto"><table><thead><tr><th>#</th><th>Datum</th><th>Ergebnis</th><th>A</th><th>B</th><th>C</th><th>Dauer</th><th></th></tr></thead><tbody>' +
        S.exams.slice().reverse().slice(0, 10).map((e, i) => '<tr><td>' + (S.exams.length - i) + '</td><td>' + fmtDate(e.t) + '</td><td><b>' + e.pct + ' %</b> (' + e.ok + '/' + e.n + ')</td>' + SECS.map(s => '<td>' + (e.sec && e.sec[s] ? e.sec[s][0] + '/' + e.sec[s][1] : '–') + '</td>').join('') + '<td>' + (e.dur ? fmtTime(e.dur) : '–') + '</td><td><span class="pill ' + (e.pct >= (e.pass || S.settings.passPct) ? 'good' : 'bad') + '">' + (e.pct >= (e.pass || S.settings.passPct) ? 'bestanden' : 'nicht bestanden') + '</span></td></tr>').join('') +
        '</tbody></table></div></section>' : '');
  }
  const q = QMAP[E.ids[E.i]];
  const answered = E.ids.filter(id => isAnswered(QMAP[id], E.ans[id])).length;
  let h = '<section class="card"><div class="row" style="justify-content:space-between;margin-bottom:10px"><b>Prüfungssimulation · ' + E.ids.length + ' Fragen</b><span class="row small"><span>Beantwortet: ' + answered + '/' + E.ids.length + '</span><span class="timer" id="timer">' + fmtTime(Date.now() - E.start) + '</span></span></div>' +
    '<div class="dots" aria-label="Fragenübersicht">' + E.ids.map((id, i) => '<button data-act="exam-go" data-i="' + i + '" class="' + (isAnswered(QMAP[id], E.ans[id]) ? 'done' : '') + '" aria-current="' + (i === E.i) + '" aria-label="Frage ' + (i+1) + '">' + (i+1) + '</button>').join('') + '</div></section>';
  h += '<section class="card"><div class="qhead"><span class="qid">Frage ' + (E.i+1) + '</span><span class="pill">' + q.sec + ' · ' + SEC[q.sec] + '</span><span class="small muted">' + q.id + '</span></div>' + questionBody(q, E.ans[q.id], false, 'exam') +
    '<div class="actions"><button class="btn ghost" data-act="exam-prev"' + (E.i === 0 ? ' disabled' : '') + '>← Zurück</button>' +
    (E.i + 1 < E.ids.length ? '<button class="btn primary" data-act="exam-next">Weiter →</button>' : '<button class="btn primary" data-act="exam-submit">Abgeben</button>') + '</div></section>';
  const open = E.ids.length - answered;
  h += '<section class="card row" style="justify-content:space-between"><span class="small muted">' + (E.confirm ? '<b style="color:var(--warn)">Noch ' + open + ' Fragen offen. Offene Fragen zählen als falsch.</b>' : 'Du kannst jederzeit abgeben.') + '</span><div class="row"><button class="btn ghost danger" data-act="exam-cancel">Abbrechen</button><button class="btn" data-act="exam-submit">' + (E.confirm ? 'Trotzdem abgeben' : 'Jetzt abgeben') + '</button></div></section>';
  return h;
}
function startTimer(){ timerInt = setInterval(() => { const t = document.getElementById('timer'); if(t && E) t.textContent = fmtTime(Date.now() - E.start); }, 1000); }
function submitExam(){
  const ids = E.ids, sec = {};
  let ok = 0; const wrong = [];
  ids.forEach(id => { const q = QMAP[id], c = isCorrect(q, E.ans[id]); if(c) ok++; else wrong.push(id);
    sec[q.sec] = sec[q.sec] || [0,0]; sec[q.sec][1]++; if(c) sec[q.sec][0]++; record(id, c); });
  const res = {t:Date.now(), n:ids.length, ok, pct:Math.round(100*ok/ids.length), pass:S.settings.passPct, sec, wrong, dur:Date.now() - E.start};
  S.exams.push(res); if(S.exams.length > 50) S.exams.shift();
  persist();
  ER = {res, ans:E.ans};
  E = null;
  render(); window.scrollTo(0,0);
  say(res.pct >= res.pass ? 'Bestanden mit ' + res.pct + ' Prozent' : 'Nicht bestanden, ' + res.pct + ' Prozent');
}
function viewExamResult({res, ans}){
  const pass = res.pct >= res.pass, need = Math.ceil(res.n * res.pass / 100);
  let h = '<section class="card result ' + (pass ? 'pass' : 'fail') + '"><div class="big">' + res.pct + ' %</div><div><h2>' + (pass ? 'Bestanden' : 'Nicht bestanden') + '</h2><p style="margin:4px 0 10px">' + res.ok + ' von ' + res.n + ' Fragen richtig, nötig waren ' + need + '. Dauer ' + fmtTime(res.dur) + '.</p>' +
    '<table style="max-width:420px"><thead><tr><th>Abschnitt</th><th>richtig</th><th>Quote</th></tr></thead><tbody>' + SECS.filter(s => res.sec[s]).map(s => '<tr><td>' + s + ' · ' + SEC[s] + '</td><td>' + res.sec[s][0] + '/' + res.sec[s][1] + '</td><td>' + pct(res.sec[s][0]/res.sec[s][1]) + '</td></tr>').join('') + '</tbody></table>' +
    '<div class="row" style="margin-top:14px">' + (res.wrong.length ? '<button class="btn primary" data-act="learn-wrong">Die ' + res.wrong.length + ' falschen jetzt lernen</button>' : '') + '<button class="btn" data-act="exam-new">Neue Simulation</button><button class="btn" data-act="nav" data-view="dash">Zur Auswertung</button></div></div></section>';
  if(res.wrong.length){
    h += '<section class="card"><h3 style="margin-bottom:12px">Falsch beantwortet</h3><div class="review">' + res.wrong.map(id => { const q = QMAP[id];
      return '<div class="rv"><p><span class="qid">' + q.id + '</span> <b>' + esc(q.q) + '</b></p><span class="lbl">Deine Antwort</span><p class="yours">' + nl(answerText(q, ans[id])) + '</p><span class="lbl">Richtig</span><p class="right">' + nl(solutionText(q)) + '</p></div>'; }).join('') + '</div></section>';
  }
  return h;
}

/* Katalog */
function viewCat(){
  const all = counts(idsOf('all'));
  return '<section class="card"><h2 style="margin-bottom:6px">Alle 114 Fragen</h2><p class="muted" style="margin-top:0">Farbe zeigt deinen Stand. Tippe eine Frage an, um sie im Lernmodus zu öffnen.</p><div class="legend"><span><i class="s-sicher"></i>Sicher ' + all.sicher + '</span><span><i class="s-unsicher"></i>1× richtig ' + all.unsicher + '</span><span><i class="s-falsch"></i>Zuletzt falsch ' + all.falsch + '</span><span><i class="s-neu"></i>Neu ' + all.neu + '</span></div></section>' +
    SECS.map(s => '<section class="card"><h3 style="margin-bottom:12px">' + s + ' · ' + SEC[s] + ' <span class="small muted">(' + idsOf(s).length + ' Fragen)</span></h3><div class="tiles">' +
      idsOf(s).map(id => { const st = status(id); return '<button class="tile t-' + st + '" data-act="open-q" data-id="' + id + '" title="' + id + ': ' + ST_LABEL[st] + '">' + id + '</button>'; }).join('') + '</div></section>').join('');
}

/* ---------- Ereignisse ---------- */
function toggleOpt(k){
  if(view === 'learn' && L && !L.revealed){
    const q = QMAP[L.ids[L.i]]; if(q.type !== 'multi' || !q.opts.some(o => o[0] === k)) return;
    L.a = L.a ? L.a.slice() : [];
    L.a = L.a.includes(k) ? L.a.filter(x => x !== k) : L.a.concat(k).sort();
    render();
  } else if(view === 'exam' && E){
    const q = QMAP[E.ids[E.i]]; if(q.type !== 'multi' || !q.opts.some(o => o[0] === k)) return;
    let a = E.ans[q.id] ? E.ans[q.id].slice() : [];
    a = a.includes(k) ? a.filter(x => x !== k) : a.concat(k).sort();
    E.ans[q.id] = a; E.confirm = false; render();
  }
}
function learnCheck(){
  const q = QMAP[L.ids[L.i]];
  if(L.revealed || !isAnswered(q, L.a)) return;
  const ok = isCorrect(q, L.a);
  L.revealed = true; L.done++; if(ok) L.ok++;
  record(q.id, ok); persist();
  render(); say(ok ? 'Richtig' : 'Falsch');
}
function learnNext(){ L.i++; L.a = null; L.revealed = false; render(); window.scrollTo(0, 0); }

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if(!b || b.disabled) return;
  const act = b.dataset.act;
  switch(act){
    case 'nav': setView(b.dataset.view); break;
    case 'go-learn':
      learnCfg = {sec:b.dataset.a || 'all', pool:b.dataset.p || 'offen', order:'cat'};
      L = null; setView('learn'); break;
    case 'go-exam': ER = null; setView('exam'); break;
    case 'open-q': {
      const id = b.dataset.id, sec = QMAP[id].sec, ids = idsOf(sec);
      learnCfg = {sec, pool:'alle', order:'cat'};
      L = null; startLearn(ids); L.i = ids.indexOf(id); setView('learn'); break; }
    case 'cfg': {
      const k = b.dataset.k, v = b.dataset.v;
      if(k === 'examN' || k === 'passPct'){ S.settings[k] = +v; persist(); render(); break; }
      learnCfg[k] = v; L = null; render(); break; }
    case 'cfg-reset': L = null; render(); break;
    case 'toggle': toggleOpt(b.dataset.k); break;
    case 'pick': {
      if(view === 'learn' && L && !L.revealed){ L.a = Object.assign({}, L.a || {}); L.a[b.dataset.k] = b.dataset.v; render(); }
      else if(view === 'exam' && E){ const id = E.ids[E.i]; E.ans[id] = Object.assign({}, E.ans[id] || {}); E.ans[id][b.dataset.k] = b.dataset.v; E.confirm = false; render(); }
      break; }
    case 'learn-check': learnCheck(); break;
    case 'learn-next': learnNext(); break;
    case 'learn-skip': L.i++; L.a = null; L.revealed = false; if(L.i >= L.ids.length) L.i = L.ids.length; render(); break;
    case 'learn-prev': if(L.i > 0){ L.i--; L.a = null; L.revealed = false; render(); } break;
    case 'learn-restart': L = null; render(); break;
    case 'learn-wrong': { const ids = ER.res.wrong.slice(); L = null; startLearn(ids, 'Falsche Fragen der letzten Simulation'); setView('learn'); break; }
    case 'exam-start': ER = null; E = {ids:buildExam(S.settings.examN), i:0, ans:{}, start:Date.now(), confirm:false}; render(); window.scrollTo(0,0); break;
    case 'exam-go': E.i = +b.dataset.i; render(); break;
    case 'exam-next': if(E.i + 1 < E.ids.length){ E.i++; render(); window.scrollTo(0,0); } break;
    case 'exam-prev': if(E.i > 0){ E.i--; render(); } break;
    case 'exam-submit': {
      const open = E.ids.filter(id => !isAnswered(QMAP[id], E.ans[id])).length;
      if(open && !E.confirm){ E.confirm = true; render(); window.scrollTo(0, document.body.scrollHeight); say('Noch ' + open + ' Fragen offen'); break; }
      submitExam(); break; }
    case 'exam-cancel': if(E && E.cancelAsk){ E = null; render(); } else if(E){ E.cancelAsk = true; b.textContent = 'Wirklich abbrechen?'; } break;
    case 'exam-new': ER = null; render(); break;
    case 'copy-backup': {
      const code = backupCode();
      const box = document.getElementById('dataBox');
      box.innerHTML = '<textarea id="bk" readonly aria-label="Sicherungscode">' + code + '</textarea><p class="small muted" id="bkmsg"></p>';
      const ta = document.getElementById('bk');
      const msg = t => { document.getElementById('bkmsg').textContent = t; };
      const fallback = () => {
        ta.focus(); ta.setSelectionRange(0, code.length);
        let ok = false; try{ ok = document.execCommand('copy'); }catch(err){}
        msg(ok ? 'In die Zwischenablage kopiert.' : 'Markiere den Code und kopiere ihn selbst.');
      };
      if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(() => msg('In die Zwischenablage kopiert.'), fallback);
      else fallback();
      break; }
    case 'share-backup': {
      const code = backupCode();
      navigator.share({title:'Sachkunde-Trainer Sicherung', text:code}).catch(() => {});
      break; }
    case 'show-import':
      document.getElementById('dataBox').innerHTML = '<label for="imp" class="small"><b>Sicherungscode einfügen</b></label><textarea id="imp"></textarea><div class="row"><button class="btn primary" data-act="do-import">Übernehmen</button><span class="small" id="impmsg"></span></div>';
      document.getElementById('imp').focus(); break;
    case 'do-import': {
      const msg = document.getElementById('impmsg');
      try{
        const obj = normalize(JSON.parse(decodeURIComponent(escape(atob(document.getElementById('imp').value.trim())))));
        if(!obj) throw 0;
        S = obj; persist(); render();
      }catch(err){ msg.style.color = 'var(--bad)'; msg.textContent = 'Der Code ist ungültig. Kopiere ihn vollständig und versuche es erneut.'; }
      break; }
    case 'reset':
      if(b.dataset.sure){ S = fresh(); S.settings = {examN:30, passPct:80}; L = null; E = null; ER = null; persist(); render(); }
      else { b.dataset.sure = '1'; b.textContent = 'Wirklich alles löschen?'; }
      break;
  }
});
document.addEventListener('keydown', e => {
  if(e.target.closest('textarea,input') || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if(view === 'learn' && L && L.i < L.ids.length){
    if(/^[a-i]$/.test(k)){ toggleOpt(k); e.preventDefault(); }
    else if(k === 'enter'){ if(L.revealed) learnNext(); else learnCheck(); e.preventDefault(); }
  } else if(view === 'exam' && E){
    if(/^[a-i]$/.test(k)){ toggleOpt(k); e.preventDefault(); }
    else if(k === 'enter' && E.i + 1 < E.ids.length){ E.i++; render(); e.preventDefault(); }
  }
});

E = loadExam();
setView(E ? 'exam' : 'dash');

if('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')){
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
})();
