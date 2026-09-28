'use strict';
/* ========== Utilitaires ========== */
const K = 'habitude.v1';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const P = s => new Date(s + 'T12:00:00');
const add = (s, n) => { const d = P(s); d.setDate(d.getDate() + n); return iso(d); };
const dow = s => (P(s).getDay() + 6) % 7;                 // 0 = lundi
const mon = s => add(s, -dow(s));
const fmt = (s, o) => P(s).toLocaleDateString('fr-FR', o);
const dim = (y, m) => new Date(y, m + 1, 0).getDate();
const pad = n => String(n).padStart(2, '0');
const wkNum = s => { const d = P(s); d.setDate(d.getDate() + 3 - dow(s)); const y = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d - y) / 864e5 - 3 + (y.getDay() + 6) % 7) / 7); };
const shiftM = (m, k) => { const [y, mo] = m.split('-').map(Number), t = y * 12 + mo - 1 + k; return `${Math.floor(t / 12)}-${pad(t % 12 + 1)}`; };
const mb = m => { const [y, mo] = m.split('-').map(Number); return [m + '-01', `${m}-${pad(dim(y, mo - 1))}`]; };
let tt; function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 3200); }

/* ========== Données ========== */
const CATS = ['🧘 Bien-être', '🏋️ Sport', '🥗 Santé', '💧 Hydratation', '📚 Études', '💼 Travail', '🧴 Beauté', '🧹 Maison', '💰 Finances', '🧠 Développement perso', '🌱 Lifestyle'];
const blank = () => ({ habits: [], logs: {}, notes: {}, cats: [...CATS], rewards: [], goals: [], end: '2027-10-31' });
let S = (() => { try { const s = JSON.parse(localStorage.getItem(K)); if (s && Array.isArray(s.habits)) return { ...blank(), ...s }; } catch (e) { } return blank(); })();
function save() { try { localStorage.setItem(K, JSON.stringify(S)); } catch (e) { toast('Sauvegarde impossible : le stockage du navigateur est plein ou bloqué.'); } }

const D0 = '2026-09-28', D1 = S.end;                      // période de suivi (fin modifiable dans « Données »)
const TODAY = (t => t < D0 ? D0 : t > D1 ? D1 : t)(iso(new Date()));
const MOM = [['matin', '🌅 Matin'], ['journee', '☀️ Journée'], ['midi', '🍽️ Midi'], ['soir', '🌙 Soir']];
const TABS = [['today', '🌸', "Aujourd'hui"], ['cal', '🗓️', 'Calendrier'], ['stats', '📈', 'Stats'], ['habits', '🌿', 'Habitudes'], ['goals', '🎯', 'Objectifs'], ['data', '💾', 'Données']];
const V = { tab: 'today', day: TODAY, month: TODAY.slice(0, 7), pop: null };

/* ========== Calculs ========== */
const active = (h, d) => !h.paused && d >= h.start && (!h.end || d <= h.end);
const due = (h, d) => active(h, d) && (h.type === 'd' || (h.type === 'w' && h.days.includes(dow(d))) ||
  (h.type === 'm' && +d.slice(8) === Math.min(h.dom, dim(+d.slice(0, 4), +d.slice(5, 7) - 1))));
const done = (h, d) => !!(S.logs[d] && S.logs[d][h.id]);
function dayStat(d) { const l = S.habits.filter(h => due(h, d)), n = l.filter(h => done(h, d)).length; return { t: l.length, n, p: l.length ? n / l.length : null }; }
function count(h, a, b) { let c = 0; for (let d = a; d <= b; d = add(d, 1)) if (done(h, d)) c++; return c; }
function tot(a, b, cap) { const e = cap && b > TODAY ? TODAY : b; let n = 0, t = 0; for (let d = a; d <= e; d = add(d, 1)) { const s = dayStat(d); n += s.n; t += s.t; } return { n, t, p: t ? Math.round(n / t * 100) : null }; }
function gs(upto, from = D0) { let cur = 0, best = 0; for (let d = from; d <= upto; d = add(d, 1)) { const s = dayStat(d); if (!s.t) continue; if (s.n === s.t) best = Math.max(best, ++cur); else if (d !== upto) cur = 0; } return [cur, best]; }
function hs(h, upto) { let cur = 0, best = 0; for (let d = h.start > D0 ? h.start : D0; d <= upto; d = add(d, 1)) { if (!due(h, d)) continue; if (done(h, d)) best = Math.max(best, ++cur); else if (d !== upto) cur = 0; } return [cur, best]; }
const months = () => { const r = []; for (let m = D0.slice(0, 7); m <= D1.slice(0, 7); m = shiftM(m, 1)) r.push(m); return r; };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ========== Vues ========== */
const empty = t => `<p class="empty">${t}</p>`;
const bar = p => `<div class="bar"><i style="width:${p}%"></i></div>`;
const gp = g => { const n = g.hids.reduce((s, id) => { const h = S.habits.find(x => x.id === id); return s + (h ? count(h, D0, D1) : 0); }, 0); return [n, Math.min(100, Math.round(n / g.target * 100))]; };
const goalCard = (g, del) => { const [n, p] = gp(g); return `<div class="gl"><div><b>🎯 ${esc(g.name)}</b><small>${n} / ${g.target}</small></div>${bar(p)}${del ? `<button class="ic" data-a="delg" data-id="${g.id}" title="Supprimer">🗑</button>` : ''}</div>`; };

function vToday() {
  const d = V.day, l = S.habits.filter(h => due(h, d)), st = dayStat(d), pct = st.t ? Math.round(st.p * 100) : 0;
  const wa = mon(d), wb = add(wa, 6), m = d.slice(0, 7), [m1, m2] = mb(m), [p1, p2] = mb(shiftM(m, -1));
  const wr = tot(wa, wb, 1), wt = tot(wa, wb), mr = tot(m1, m2, 1), pr = tot(p1, p2, 1), [cs, bs] = gs(d > TODAY ? TODAY : d);
  let full = 0; for (let x = m1; x <= m2 && x <= TODAY; x = add(x, 1)) { const s = dayStat(x); if (s.t && s.n === s.t) full++; }
  const wg = S.habits.filter(h => h.type === 'w' && active(h, wb)), wm = wg.filter(h => count(h, wa, wb) >= h.target).length;
  const diff = mr.p != null && pr.p != null ? mr.p - pr.p : null;
  const row = h => {
    const ok = done(h, d); let meta = '';
    if (h.type === 'w') { const c = count(h, wa, wb); meta = `<span class="${c >= h.target ? 'ok' : ''}">${c} / ${h.target} sem.</span>`; }
    else if (h.type === 'm') { const c = count(h, m1, m2); meta = `<span class="${c >= h.target ? 'ok' : ''}">${c} / ${h.target} mois</span>`; }
    else { const s = hs(h, d)[0]; if (s > 1) meta = `🔥 ${s}`; }
    return `<button class="hab ${ok ? 'on' : ''} ${V.pop === h.id ? 'pop' : ''}" data-a="toggle" data-id="${h.id}"><span class="ck">${ok ? '✓' : ''}</span><span>${esc(h.emoji)}</span><span class="nm">${esc(h.name)}</span><small>${meta}</small></button>`;
  };
  const sec = MOM.map(([k, t]) => { const x = l.filter(h => h.moment === k); return x.length ? `<h3 class="mom">${t}</h3><div class="list">${x.map(row).join('')}</div>` : ''; }).join('');
  const dots = [...Array(7)].map((_, i) => { const x = add(wa, i), s = dayStat(x); const c = !s.t || x > TODAY ? '' : s.n === s.t ? 'full' : s.n ? 'part' : 'zero'; const sym = !s.t ? '·' : x > TODAY ? '○' : s.n === s.t ? '✓' : s.n ? '◐' : '✗'; return `<div class="${x === d ? 'now' : ''}">${'LMMJVSD'[i]}<span class="${c}">${sym}</span></div>`; }).join('');
  const nt = S.notes[d] || {};
  const body = !S.habits.length ? empty('Aucune habitude pour l’instant 🌱<br><br><button class="pri" data-a="newh">Créer ma première habitude</button>')
    : !l.length ? empty('Rien de prévu ce jour-là 🌿') : sec;
  return `<header class="top"><div><p class="mut">Semaine ${wkNum(d)}${d === TODAY ? " · aujourd'hui" : ''}</p><h1 class="serif">${fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })}</h1></div>
  <div class="daynav"><button data-a="day" data-v="-1" ${d <= D0 ? 'disabled' : ''}>‹ Hier</button><button data-a="now">Aujourd'hui</button><button data-a="day" data-v="1" ${d >= D1 ? 'disabled' : ''}>Demain ›</button></div></header>
  <div class="cols"><div class="col"><section class="card"><div class="ch"><h3>Ma journée</h3><button class="pri s" data-a="newh">+ Habitude</button></div>
  ${st.t ? `<div class="big">${pct} %</div>${bar(pct)}<small>${st.n} sur ${st.t} faites</small>` : ''}${body}</section></div>
  <div class="col"><section class="card"><h3>Semaine ${wkNum(d)}</h3><div class="big">${wr.p ?? 0} %</div>${bar(wr.p ?? 0)}<div class="week">${dots}</div>
  <div class="kpi"><div><b>${wt.n}</b><small>réalisées</small></div><div><b>${wt.t - wt.n}</b><small>restantes</small></div><div><b>${wm}/${wg.length}</b><small>objectifs hebdo</small></div><div><b>🔥 ${cs}</b><small>série (record ${bs})</small></div></div></section>
  <section class="card"><h3>${cap(fmt(m1, { month: 'long' }))}</h3><div class="big">${mr.p ?? 0} %</div>${bar(mr.p ?? 0)}
  <div class="kpi"><div><b>${mr.n}/${mr.t}</b><small>complétées / prévues</small></div><div><b>${full}</b><small>jours réussis</small></div><div><b>${gs(m2 > TODAY ? TODAY : m2, m1)[1]}</b><small>meilleure série</small></div><div><b>${diff == null ? '–' : (diff > 0 ? '+' : '') + diff + ' pt'}</b><small>vs mois précédent</small></div></div></section>
  ${S.goals.length ? `<section class="card"><h3>Objectifs</h3>${S.goals.slice(0, 3).map(g => goalCard(g)).join('')}</section>` : ''}
  <section class="card"><h3>Journal du jour</h3><div class="moods">${['😞', '😕', '😐', '🙂', '😄'].map((e, i) => `<button class="${nt.mood == i + 1 ? 'sel' : ''}" data-a="mood" data-v="${i + 1}">${e}</button>`).join('')}</div>
  <div class="row2"><label>Énergie<select data-n="energy"><option value="">–</option>${[1, 2, 3, 4, 5].map(i => `<option ${nt.energy == i ? 'selected' : ''}>${i}</option>`).join('')}</select></label>
  <label>Sommeil (h)<input type="number" min="0" max="24" step="0.5" data-n="sleep" value="${esc(nt.sleep)}"></label></div>
  <textarea data-n="text" placeholder="Une petite note sur ta journée…">${esc(nt.text)}</textarea></section></div></div>`;
}

function vCal() {
  const m = V.month, [a, b] = mb(m); let cells = '';
  for (let i = 0; i < dow(a); i++) cells += '<i></i>';
  for (let d = a; d <= b; d = add(d, 1)) { const s = dayStat(d), c = d > TODAY ? 'fut' : !s.t ? 'none' : s.n === s.t ? 'full' : s.n ? 'part' : 'zero'; cells += `<button class="cd ${c} ${d === V.day ? 'sel' : ''}" data-a="pick" data-d="${d}" title="${s.t ? s.n + '/' + s.t : 'rien de prévu'}">${+d.slice(8)}</button>`; }
  return `<header class="top"><h1 class="serif">${fmt(a, { month: 'long', year: 'numeric' })}</h1><div class="daynav"><button data-a="month" data-v="-1" ${m <= D0.slice(0, 7) ? 'disabled' : ''}>‹</button><button data-a="month" data-v="0">Ce mois-ci</button><button data-a="month" data-v="1" ${m >= D1.slice(0, 7) ? 'disabled' : ''}>›</button></div></header>
  <section class="card"><div class="cal">${[...'LMMJVSD'].map(x => `<span>${x}</span>`).join('')}${cells}</div>
  <div class="legend"><span><i style="background:var(--sage)"></i>Complet</span><span><i style="background:var(--peach)"></i>Partiel</span><span><i style="background:var(--pink)"></i>Non réalisé</span><span><i style="background:#f6f0f3"></i>Rien de prévu</span></div></section>
  <p class="mut" style="margin-top:14px">Clique sur un jour pour voir et cocher ses habitudes.</p>`;
}

function vStats() {
  const m = V.month, [a, b] = mb(m), pts = [], dm = +b.slice(8);
  for (let d = a; d <= b && d <= TODAY; d = add(d, 1)) { const s = dayStat(d); if (s.t) pts.push([+d.slice(8), Math.round(s.p * 100), d]); }
  const X = n => 34 + (n - 1) / Math.max(dm - 1, 1) * 590, Y = p => 170 - p * 1.5;
  const path = pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]) + ' ' + Y(p[1])).join('');
  const chart = pts.length < 2 ? empty('Pas encore assez de données ce mois-ci.') :
    `<svg class="chart" viewBox="0 0 640 200">${[0, 50, 100].map(v => `<line x1="34" x2="630" y1="${Y(v)}" y2="${Y(v)}" stroke="#f1e5eb"/><text x="0" y="${Y(v) + 4}">${v}%</text>`).join('')}
    <path d="${path}L${X(pts[pts.length - 1][0])} 170L${X(pts[0][0])} 170Z" fill="#e3daf7" opacity=".5"/><path d="${path}" fill="none" stroke="#c48ad0" stroke-width="3" stroke-linejoin="round"/>
    ${pts.map(p => `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="5" fill="#fff" stroke="#c48ad0" stroke-width="2.5"><title>${fmt(p[2], { day: 'numeric', month: 'long' })} : ${p[1]} %</title></circle>`).join('')}</svg>`;
  let tracked = 0, comp = 0, bestD = null, bestW = null;
  for (let d = D0; d <= TODAY; d = add(d, 1)) { const s = dayStat(d); if (!s.t) continue; tracked++; comp += s.n; if (!bestD || s.p > bestD.p || (s.p === bestD.p && s.t >= bestD.t)) bestD = { ...s, d }; }
  for (let w = mon(D0); w <= TODAY; w = add(w, 7)) { const r = tot(w, add(w, 6), 1); if (r.t && (!bestW || r.p >= bestW.p)) bestW = { ...r, w }; }
  const t = tot(D0, TODAY, 1), wr = tot(mon(TODAY), add(mon(TODAY), 6), 1), mr = tot(...mb(TODAY.slice(0, 7)), 1), dr = dayStat(TODAY);
  const ms = months().map(x => ({ x, p: tot(...mb(x), 1).p }));
  let heat = '';
  for (let w = mon(D0); w <= D1; w = add(w, 7)) for (let i = 0; i < 7; i++) {
    const d = add(w, i), s = dayStat(d), inside = d >= D0 && d <= D1;
    const l = !inside ? 'x' : d > TODAY || !s.t ? 'l0' : s.p === 1 ? 'l4' : s.p >= .66 ? 'l3' : s.p >= .33 ? 'l2' : 'l1';
    heat += `<i class="hm ${l}" title="${fmt(d, { day: 'numeric', month: 'short' })}${s.t ? ' · ' + s.n + '/' + s.t : ''}"></i>`;
  }
  const tile = (v, l) => `<div class="tile"><b>${v}</b><small>${l}</small></div>`;
  return `<header class="top"><h1 class="serif">Statistiques</h1></header>
  <div class="tiles">${tile((dr.p != null ? Math.round(dr.p * 100) : '–') + ' %', 'réussite du jour')}${tile((wr.p ?? '–') + ' %', 'réussite de la semaine')}${tile((mr.p ?? '–') + ' %', 'réussite du mois')}${tile((t.p ?? '–') + ' %', 'depuis le début')}
  ${tile(bestD ? Math.round(bestD.p * 100) + ' %' : '–', 'meilleure journée' + (bestD ? ' · ' + fmt(bestD.d, { day: 'numeric', month: 'short' }) : ''))}${tile(bestW ? bestW.p + ' %' : '–', 'meilleure semaine' + (bestW ? ' · S' + wkNum(bestW.w) : ''))}${tile('🔥 ' + gs(TODAY)[1], 'meilleure série')}${tile(comp, 'habitudes complétées')}${tile(tracked, 'jours suivis')}</div>
  <section class="card"><div class="ch"><h3>Courbe de ${fmt(a, { month: 'long', year: 'numeric' })}</h3><div class="daynav"><button data-a="month" data-v="-1" ${m <= D0.slice(0, 7) ? 'disabled' : ''}>‹</button><button data-a="month" data-v="1" ${m >= D1.slice(0, 7) ? 'disabled' : ''}>›</button></div></div>${chart}</section>
  <section class="card" style="margin-top:20px"><h3 style="margin-bottom:14px">Comparaison des mois</h3><div class="bars">${ms.map(o => `<div>${o.p ?? ''}<i style="height:${(o.p ?? 0) * 1.1}px"></i>${fmt(o.x + '-01', { month: 'short' }).replace('.', '')}</div>`).join('')}</div></section>
  <section class="card" style="margin-top:20px"><h3 style="margin-bottom:14px">Toute la période</h3><div class="heat">${heat}</div></section>`;
}

function vHabits() {
  const lab = h => h.type === 'd' ? 'Quotidienne' : h.type === 'w' ? `${h.target}×/sem · ${h.days.map(i => 'LMMJVSD'[i]).join(' ')}` : `${h.target}×/mois · le ${h.dom}`;
  const list = S.habits.map((h, i) => { const [c, b] = hs(h, TODAY), n = count(h, D0, D1);
    return `<div class="item ${h.paused ? 'off' : ''}"><span style="font-size:1.4rem">${esc(h.emoji)}</span><div><b>${esc(h.name)}</b> ${h.paused ? '<span class="pill">en pause</span>' : ''}<br><span class="pill">${lab(h)}</span>${h.cat ? `<span class="pill">${esc(h.cat)}</span>` : ''}<small>${h.type === 'd' ? `🔥 ${c} · record ${b} · ` : ''}${n} réalisation${n > 1 ? 's' : ''}</small></div>
    <button class="ic" data-a="up" data-id="${h.id}" ${i ? '' : 'disabled'}>↑</button><button class="ic" data-a="down" data-id="${h.id}" ${i < S.habits.length - 1 ? '' : 'disabled'}>↓</button><button class="ic" data-a="edit" data-id="${h.id}">✎</button><button class="ic" data-a="pause" data-id="${h.id}">${h.paused ? '▶' : '⏸'}</button><button class="ic" data-a="del" data-id="${h.id}">🗑</button></div>`; }).join('');
  return `<header class="top"><h1 class="serif">Mes habitudes</h1><button class="pri" data-a="newh">+ Nouvelle habitude</button></header><section class="card">${list || empty('Aucune habitude pour l’instant 🌱')}</section>`;
}

function rwCard(r) {
  const h = S.habits.find(x => x.id === r.hid); let c = 0, b = 0;
  if (r.kind === 't') b = c = h ? count(h, D0, D1) : tot(D0, D1).n; else { [c, b] = h ? hs(h, TODAY) : gs(TODAY); }
  const ok = b >= r.n;
  return `<div class="rw ${ok ? 'ok' : ''}"><span class="tro">${ok ? '🏆' : '🔒'}</span><div><b>${esc(r.text)}</b><small>${h ? esc(h.name) + ' · ' : ''}${b} / ${r.n} ${r.kind === 't' ? 'réalisations' : 'jours consécutifs'}${ok ? ' · débloquée ✨' : ''}</small>${bar(Math.min(100, Math.round(b / r.n * 100)))}</div><button class="ic" data-a="delr" data-id="${r.id}">🗑</button></div>`;
}
function vGoals() {
  return `<header class="top"><h1 class="serif">Objectifs & récompenses</h1></header><div class="cols">
  <section class="card"><div class="ch"><h3>🎯 Objectifs</h3><button class="pri s" data-a="newg">+ Objectif</button></div>${S.goals.length ? S.goals.map(g => goalCard(g, 1)).join('') : empty('Aucun objectif pour l’instant.')}</section>
  <section class="card"><div class="ch"><h3>🏆 Récompenses</h3><button class="pri s" data-a="newr">+ Récompense</button></div>${S.rewards.length ? S.rewards.map(rwCard).join('') : empty('Choisis une série à atteindre et la récompense que tu t’offriras.')}</section></div>`;
}

function vData() {
  const nl = Object.values(S.logs).reduce((s, o) => s + Object.keys(o).length, 0);
  return `<header class="top"><h1 class="serif">Données</h1></header><div class="col">
  <section class="card"><h3>Sauvegarde</h3><p class="mut">${S.habits.length} habitude(s) · ${nl} cochage(s). Tout est stocké uniquement dans ce navigateur, sur cet ordinateur. Fais un export de temps en temps.</p>
  <div class="btns"><button data-a="ejson">⬇ Export JSON</button><button data-a="ecsv">⬇ Export CSV</button><label class="btn">⬆ Importer une sauvegarde<input id="imp" type="file" accept=".json" hidden></label></div></section>
  <section class="card"><h3>Période de suivi</h3><p class="mut">Du ${fmt(D0, { day: 'numeric', month: 'long', year: 'numeric' })} au ${fmt(D1, { day: 'numeric', month: 'long', year: 'numeric' })}.</p><br><label>Nouvelle date de fin<input type="date" id="endd" value="${D1}" min="${TODAY}"></label><button class="pri s" data-a="end">Modifier la fin</button></section>
  <section class="card danger"><h3>Zone sensible</h3><button data-a="reset">Tout effacer</button></section></div>`;
}

function render() {
  try {
    $('#nav').innerHTML = `<div class="logo serif">habitude ✿</div>` + TABS.map(([k, i, l]) => `<button class="${V.tab === k ? 'on' : ''}" data-a="tab" data-v="${k}"><b>${i}</b><span>${l}</span></button>`).join('');
    $('#app').innerHTML = ({ today: vToday, cal: vCal, stats: vStats, habits: vHabits, goals: vGoals, data: vData })[V.tab]();
  } catch (e) { console.error(e); $('#app').innerHTML = empty('Oups, une erreur est survenue. Recharge la page ; tes données sont intactes.'); }
  V.pop = null;
}

/* ========== Formulaires ========== */
function dlg(html, submit) {
  const d = $('#dlg'); d.className = '';
  d.innerHTML = `<form>${html}<p class="err"></p><div class="acts"><button type="button" data-x>Annuler</button><button class="pri">Enregistrer</button></div></form>`;
  const f = d.firstChild;
  f.onsubmit = e => { e.preventDefault(); const err = submit(new FormData(f)); if (err) f.querySelector('.err').textContent = err; else { d.close(); render(); } };
  f.querySelector('[data-x]').onclick = () => d.close();
  d.showModal();
}
const opt = (v, l, c) => `<option value="${v}" ${c == v ? 'selected' : ''}>${l}</option>`;

function editHabit(id) {
  const h = S.habits.find(x => x.id === id) || { type: 'd', emoji: '✨', moment: 'matin', days: [], target: 1, dom: 1, start: TODAY, end: '', name: '', cat: '', desc: '' };
  dlg(`<h2>${id ? 'Modifier' : 'Nouvelle'} habitude</h2>
  <div class="row2"><label>Emoji<input name="emoji" value="${esc(h.emoji)}" maxlength="4"></label><label>Nom<input name="name" value="${esc(h.name)}" required></label></div>
  <div class="row2"><label>Type<select name="type" id="ty">${opt('d', 'Quotidienne', h.type)}${opt('w', 'Hebdomadaire', h.type)}${opt('m', 'Mensuelle', h.type)}</select></label>
  <label>Moment<select name="moment">${MOM.map(([k, t]) => opt(k, t, h.moment)).join('')}</select></label></div>
  <div class="tw tm"><label>Objectif (nombre de fois)<input type="number" name="target" min="1" max="31" value="${h.target}"></label></div>
  <div class="tw"><small>Jour(s) où elle s’affiche</small><div class="chips">${[...'LMMJVSD'].map((l, i) => `<label><input type="checkbox" name="days" value="${i}" ${h.days.includes(i) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
  <div class="tm"><label>Jour du mois où elle s’affiche<input type="number" name="dom" min="1" max="31" value="${h.dom}"></label></div>
  <label>Catégorie<input name="cat" list="cl" value="${esc(h.cat)}" placeholder="Choisis ou crée la tienne"><datalist id="cl">${S.cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist></label>
  <label>Description<input name="desc" value="${esc(h.desc)}"></label>
  <div class="row2"><label>Début<input type="date" name="start" value="${h.start}"></label><label>Fin (facultatif)<input type="date" name="end" value="${h.end || ''}"></label></div>`,
    fd => {
      const g = k => (fd.get(k) || '').toString().trim(), type = g('type'), days = fd.getAll('days').map(Number);
      if (!g('name')) return 'Donne un nom à ton habitude.';
      if (type === 'w' && !days.length) return 'Choisis au moins un jour de la semaine.';
      if (g('end') && g('end') < (g('start') || TODAY)) return 'La date de fin doit être après la date de début.';
      const cat = g('cat'); if (cat && !S.cats.includes(cat)) S.cats.push(cat);
      const n = { id: h.id || 'h' + Date.now().toString(36), name: g('name'), emoji: g('emoji') || '✨', type, target: type === 'd' ? 1 : Math.max(1, +g('target') || 1), days: type === 'w' ? days : [], dom: Math.min(31, Math.max(1, +g('dom') || 1)), moment: g('moment'), cat, desc: g('desc'), start: g('start') || TODAY, end: g('end'), paused: !!h.paused };
      if (id) S.habits[S.habits.findIndex(x => x.id === id)] = n; else S.habits.push(n);
      save();
    });
  const sel = $('#ty'), upd = () => { $('#dlg').className = 't-' + sel.value; };
  sel.onchange = upd; upd();
}

function newGoal() {
  if (!S.habits.length) return toast('Crée d’abord une habitude à lier à ton objectif.');
  dlg(`<h2>Nouvel objectif</h2><label>Objectif<input name="name" placeholder="Ex. Faire 100 séances de sport" required></label><label>Nombre de réalisations à atteindre<input type="number" name="target" min="1" value="10"></label>
  <small>Habitude(s) liée(s)</small>${S.habits.map(h => `<label style="flex-direction:row;gap:8px;margin:6px 0"><input type="checkbox" name="hids" value="${h.id}" style="width:auto"> ${esc(h.emoji)} ${esc(h.name)}</label>`).join('')}`,
    fd => {
      const hids = fd.getAll('hids'), name = (fd.get('name') || '').trim();
      if (!name) return 'Donne un nom à ton objectif.'; if (!hids.length) return 'Lie au moins une habitude.';
      S.goals.push({ id: 'g' + Date.now().toString(36), name, target: Math.max(1, +fd.get('target') || 1), hids }); save();
    });
}
function newReward() {
  dlg(`<h2>Nouvelle récompense</h2><div class="row2"><label>Condition<select name="kind">${opt('s', 'jours consécutifs', 's')}${opt('t', 'réalisations au total', 's')}</select></label><label>Combien ?<input type="number" name="n" min="1" value="7"></label></div>
  <label>Pour<select name="hid">${opt('', 'Toutes mes habitudes', '')}${S.habits.map(h => opt(h.id, esc(h.emoji + ' ' + h.name), '')).join('')}</select></label>
  <label>Ma récompense<input name="text" placeholder="Ex. Un massage, un nouveau livre…" required></label>`,
    fd => {
      const text = (fd.get('text') || '').trim(); if (!text) return 'Choisis ta récompense.';
      S.rewards.push({ id: 'r' + Date.now().toString(36), kind: fd.get('kind'), n: Math.max(1, +fd.get('n') || 1), hid: fd.get('hid'), text }); save();
    });
}

/* ========== Actions ========== */
function download(name, type, text) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
const clampDay = d => d < D0 ? D0 : d > D1 ? D1 : d;

document.addEventListener('click', e => {
  const t = e.target.closest('[data-a]'); if (!t) return;
  const a = t.dataset.a, id = t.dataset.id, v = t.dataset.v, hi = S.habits.findIndex(x => x.id === id);
  switch (a) {
    case 'tab': V.tab = v; break;
    case 'toggle': { const l = S.logs[V.day] = S.logs[V.day] || {}; if (l[id]) delete l[id]; else { l[id] = 1; V.pop = id; } if (!Object.keys(l).length) delete S.logs[V.day]; save(); break; }
    case 'day': V.day = clampDay(add(V.day, +v)); break;
    case 'now': V.day = TODAY; break;
    case 'mood': S.notes[V.day] = { ...S.notes[V.day], mood: +v }; save(); break;
    case 'month': { const m = v === '0' ? TODAY.slice(0, 7) : shiftM(V.month, +v); if (m >= D0.slice(0, 7) && m <= D1.slice(0, 7)) V.month = m; break; }
    case 'pick': V.day = t.dataset.d; V.tab = 'today'; break;
    case 'newh': editHabit(); return;
    case 'edit': editHabit(id); return;
    case 'pause': S.habits[hi].paused = !S.habits[hi].paused; save(); break;
    case 'del': if (!confirm(`Supprimer « ${S.habits[hi].name} » et tout son historique ? Cette action est définitive.`)) return;
      Object.values(S.logs).forEach(l => delete l[id]); S.habits.splice(hi, 1); S.goals.forEach(g => g.hids = g.hids.filter(x => x !== id)); save(); break;
    case 'up': case 'down': { const j = hi + (a === 'up' ? -1 : 1); if (j < 0 || j >= S.habits.length) return; [S.habits[hi], S.habits[j]] = [S.habits[j], S.habits[hi]]; save(); break; }
    case 'newg': newGoal(); return;
    case 'newr': newReward(); return;
    case 'delg': if (!confirm('Supprimer cet objectif ?')) return; S.goals = S.goals.filter(g => g.id !== id); save(); break;
    case 'delr': if (!confirm('Supprimer cette récompense ?')) return; S.rewards = S.rewards.filter(r => r.id !== id); save(); break;
    case 'ejson': download(`habitude-${iso(new Date())}.json`, 'application/json', JSON.stringify(S, null, 2)); return;
    case 'ecsv': { const q = s => `"${String(s).replace(/"/g, '""')}"`, rows = ['date;habitude;categorie'];
      Object.keys(S.logs).sort().forEach(d => Object.keys(S.logs[d]).forEach(hid => { const h = S.habits.find(x => x.id === hid); if (h) rows.push([d, q(h.name), q(h.cat)].join(';')); }));
      download(`habitude-${iso(new Date())}.csv`, 'text/csv', '\ufeff' + rows.join('\n')); return; }
    case 'end': { const x = $('#endd').value; if (!x || x < TODAY) return toast('Choisis une date de fin valide.'); S.end = x; save(); location.reload(); return; }
    case 'reset': if (!confirm('Effacer TOUTES tes données ? Pense à exporter une sauvegarde avant.')) return; S = blank(); save(); break;
  }
  render();
});
document.addEventListener('input', e => { const k = e.target.dataset.n; if (!k) return; S.notes[V.day] = { ...S.notes[V.day], [k]: e.target.value }; save(); });
document.addEventListener('change', e => {
  if (e.target.id !== 'imp' || !e.target.files[0]) return;
  e.target.files[0].text().then(t => {
    const o = JSON.parse(t); if (!Array.isArray(o.habits) || typeof o.logs !== 'object') throw 0;
    if (!confirm('Remplacer toutes tes données actuelles par cette sauvegarde ?')) return;
    S = { ...blank(), ...o }; save(); location.reload();
  }).catch(() => toast('Fichier invalide : choisis une sauvegarde JSON exportée depuis Habitude.'));
});

render();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
