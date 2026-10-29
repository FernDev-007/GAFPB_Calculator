/*
 * USAFA GAFPB Score Calculator
 * ------------------------------------------------------------
 * All standards live in CONFIG below. To update a standard,
 * change the number here; the logic further down reads from it.
 */
'use strict';

const CONFIG = {
  age: { min: 17, max: 65, bonusFrom: 36, bonusPerYear: 0.005 },

  // Event scores have no maximum: beating the 500-point mark keeps
  // earning points at the same rate, matching the grading spreadsheet.
  // To cap event scores again, set this to a number (e.g. 500).
  eventCap: null,

  // 11 x 10 m sprint: 60 s = 100 pts, +15 pts per second faster.
  // (Same as the spreadsheet's 1000 - 15 x time.) Exact time counts.
  sprint: { maxPass: 60, pointsPerSecond: 15 },

  // Flexed-arm hang: 5 s = 100 pts, +5 pts per additional second.
  // (Same as the spreadsheet's time x 5 + 75.) Exact time counts.
  hang: { minPass: 5, pointsPerSecond: 5 },

  // 1000 m run: 6:30 (390 s) = 100 pts, every 55 s faster = +100 pts.
  run: { maxPass: 390, secondsPer100: 55 },

  // Female bonus, as a share of basic points.
  femaleBonus: { sprint: 0.15, hang: 0.40, run: 0.15 },

  // BFT average needed for each level.
  bft: { bronze: 200, silver: 300, gold: 400 },

  // P-ES-6 pistol: hits out of 10.
  pistol: { maxHits: 10, bronze: 7, silver: 8, gold: 9 },

  // Ruck march with 15 kg pack. level: 1 Bronze, 2 Silver, 3 Gold.
  ruck: {
    '6':  { km: 6,  maxSeconds: 3600, level: 1 },
    '9':  { km: 9,  maxSeconds: 5400, level: 2 },
    '12': { km: 12, maxSeconds: 7200, level: 3 }
  }
};

const LEVEL_NAMES = ['No Badge', 'Bronze', 'Silver', 'Gold'];
const EPS = 1e-9;

/* ---------------- Parsing ---------------- */

// "41.3" -> 41.3 ; "" -> null ; bad input -> NaN
function parseSeconds(str) {
  const s = String(str == null ? '' : str).trim().replace(',', '.');
  if (s === '') return null;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return NaN;
  return parseFloat(s);
}

// "3:52" or "3.52" -> 232 seconds
function parseMinSec(str) {
  const s = String(str == null ? '' : str).trim();
  if (s === '') return null;
  const m = s.match(/^(\d{1,2})[:.,](\d{2})$/);
  if (!m) return NaN;
  const min = +m[1], sec = +m[2];
  if (sec > 59) return NaN;
  return min * 60 + sec;
}

// "1:52:30" or "112:30" -> seconds
function parseDuration(str) {
  const s = String(str == null ? '' : str).trim();
  if (s === '') return null;
  let m = s.match(/^(\d{1,2})[:.,](\d{2})[:.,](\d{2})$/);
  if (m) {
    const h = +m[1], mi = +m[2], se = +m[3];
    if (mi > 59 || se > 59) return NaN;
    return h * 3600 + mi * 60 + se;
  }
  m = s.match(/^(\d{1,3})[:.,](\d{2})$/);
  if (m) {
    const mi = +m[1], se = +m[2];
    if (se > 59) return NaN;
    return mi * 60 + se;
  }
  return NaN;
}

function formatMinSec(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m + ':' + String(s).padStart(2, '0');
}

function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

/* ---------------- Scoring ---------------- */

/*
 * Rounding matches the official spreadsheet:
 *  - basic points are NOT rounded (exact times, decimals kept)
 *  - each event score (basic + bonuses) is rounded to a whole number
 *  - the BFT average is rounded to a whole number
 * Excel rounds half away from zero and works to 15 significant digits;
 * roundExcel does the same so results match the spreadsheet exactly.
 */
function roundExcel(x) {
  const v = Number(x.toPrecision(15));
  return Math.sign(v) * Math.round(Math.abs(v));
}

// Sprint: exact time, 100 pts at 60 s, +15 per second faster.
function sprintBasic(t) {
  return 100 + (CONFIG.sprint.maxPass - t) * CONFIG.sprint.pointsPerSecond;
}

// Hang: exact time, 100 pts at 5 s, +5 per additional second.
function hangBasic(t) {
  return 100 + (t - CONFIG.hang.minPass) * CONFIG.hang.pointsPerSecond;
}

// Run: whole seconds, 100 pts at 6:30, +100 per 55 s faster.
function runBasic(sec) {
  return 100 + (CONFIG.run.maxPass - sec) / (CONFIG.run.secondsPer100 / 100);
}

function ageRate(age) {
  if (age < CONFIG.age.bonusFrom) return 0;
  return (age - (CONFIG.age.bonusFrom - 1)) * CONFIG.age.bonusPerYear;
}

function eventScore(basic, age, gender, key) {
  const ageBonus = basic * ageRate(age);
  const genderBonus = gender === 'F' ? basic * CONFIG.femaleBonus[key] : 0;
  const rounded = roundExcel(basic + ageBonus + genderBonus);
  return {
    basic: basic,
    ageBonus: ageBonus,
    genderBonus: genderBonus,
    rounded: rounded,
    total: CONFIG.eventCap ? Math.min(CONFIG.eventCap, rounded) : rounded,
    capped: !!CONFIG.eventCap && rounded > CONFIG.eventCap
  };
}

// BFT average of the three event scores, rounded to a whole number.
function bftAverage(a, b, c) {
  return roundExcel((a + b + c) / 3);
}

function bftLevel(avg) {
  if (avg >= CONFIG.bft.gold) return 3;
  if (avg >= CONFIG.bft.silver) return 2;
  if (avg >= CONFIG.bft.bronze) return 1;
  return 0;
}

function pistolLevel(hits) {
  if (hits >= CONFIG.pistol.gold) return 3;
  if (hits >= CONFIG.pistol.silver) return 2;
  if (hits >= CONFIG.pistol.bronze) return 1;
  return 0;
}

/*
 * compute(raw) takes the raw form values and returns everything
 * the page needs to render: field messages, event scores, final badge.
 */
function compute(raw) {
  const fields = {};
  const missing = [];
  const err = (k, msg) => { fields[k] = { type: 'error', msg: msg }; };
  const warn = (k, msg) => { fields[k] = { type: 'warn', msg: msg }; };

  // Age
  let age = null;
  const ageStr = String(raw.age == null ? '' : raw.age).trim();
  if (ageStr === '') {
    missing.push('Age');
  } else if (!/^\d{1,3}$/.test(ageStr) || +ageStr < CONFIG.age.min || +ageStr > CONFIG.age.max) {
    err('age', 'Enter an age from ' + CONFIG.age.min + ' to ' + CONFIG.age.max + '.');
    missing.push('Age');
  } else {
    age = +ageStr;
  }

  // Gender
  const gender = (raw.gender === 'M' || raw.gender === 'F') ? raw.gender : null;
  if (!gender) missing.push('Gender');

  // Sprint
  const sprint = parseSeconds(raw.sprint);
  if (sprint === null) missing.push('Sprint');
  else if (Number.isNaN(sprint)) { err('sprint', 'Enter seconds, e.g. 41.3'); missing.push('Sprint'); }
  else if (sprint > CONFIG.sprint.maxPass + EPS) warn('sprint', 'Slower than 60.0 sec. BFT minimum not met.');

  // Hang
  const hang = parseSeconds(raw.hang);
  if (hang === null) missing.push('Flexed-arm hang');
  else if (Number.isNaN(hang)) { err('hang', 'Enter seconds, e.g. 52.7'); missing.push('Flexed-arm hang'); }
  else if (hang < CONFIG.hang.minPass - EPS) warn('hang', 'Under 5.0 sec. BFT minimum not met.');

  // Run
  const run = parseMinSec(raw.run);
  if (run === null) missing.push('1000 m run');
  else if (Number.isNaN(run)) { err('run', 'Enter minutes:seconds, e.g. 3:52'); missing.push('1000 m run'); }
  else if (run > CONFIG.run.maxPass) warn('run', 'Slower than 6:30. BFT minimum not met.');

  // Pistol
  let hits = null;
  const hitsStr = String(raw.pistol == null ? '' : raw.pistol).trim();
  if (hitsStr === '') missing.push('Pistol hits');
  else if (!/^\d{1,2}$/.test(hitsStr) || +hitsStr > CONFIG.pistol.maxHits) {
    err('pistol', 'Enter hits from 0 to ' + CONFIG.pistol.maxHits + '.');
    missing.push('Pistol hits');
  } else {
    hits = +hitsStr;
    if (hits < CONFIG.pistol.bronze) warn('pistol', 'Fewer than ' + CONFIG.pistol.bronze + ' hits. Below Bronze.');
  }

  // Ruck
  const ruckStd = CONFIG.ruck[raw.ruckDist] || null;
  if (!ruckStd) missing.push('Ruck distance');
  const ruckTime = parseDuration(raw.ruckTime);
  if (ruckTime === null) missing.push('Ruck time');
  else if (Number.isNaN(ruckTime)) { err('ruckTime', 'Enter time as h:mm:ss or mm:ss, e.g. 1:52:30'); missing.push('Ruck time'); }
  else if (ruckStd && ruckTime > ruckStd.maxSeconds) {
    warn('ruckTime', 'Over the ' + formatDuration(ruckStd.maxSeconds) + ' limit for ' + ruckStd.km + ' km.');
  }

  if (missing.length) return { complete: false, fields: fields, missing: missing };

  /* ---- Everything entered: score it ---- */
  const reasons = [];

  const sprintFail = sprint > CONFIG.sprint.maxPass + EPS;
  const hangFail = hang < CONFIG.hang.minPass - EPS;
  const runFail = run > CONFIG.run.maxPass;

  const events = {
    sprint: { time: sprint, fail: sprintFail, score: sprintFail ? null : eventScore(sprintBasic(sprint), age, gender, 'sprint') },
    hang:   { time: hang,   fail: hangFail,   score: hangFail ? null : eventScore(hangBasic(hang), age, gender, 'hang') },
    run:    { time: run,    fail: runFail,    score: runFail ? null : eventScore(runBasic(run), age, gender, 'run') }
  };

  let avg = null;
  let bftLvl = 0;
  const failedMins = [];
  if (sprintFail) failedMins.push('sprint');
  if (hangFail) failedMins.push('hang');
  if (runFail) failedMins.push('run');

  if (failedMins.length) {
    reasons.push('BFT minimum not met (' + failedMins.join(', ') + ')');
  } else {
    avg = bftAverage(events.sprint.score.total, events.hang.score.total, events.run.score.total);
    bftLvl = bftLevel(avg);
    if (!bftLvl) reasons.push('BFT average below ' + CONFIG.bft.bronze);
  }

  // Pass / fail events
  const passFail = [
    { key: 'firstAid', name: 'First aid (CLS)', pass: !!raw.firstAid },
    { key: 'nbc', name: 'NBC / MOPP4', pass: !!raw.nbc },
    { key: 'swim', name: '100 m swim', pass: !!raw.swim }
  ];
  passFail.forEach(p => { if (!p.pass) reasons.push(p.name + ' not passed'); });
  const pfLvl = passFail.every(p => p.pass) ? 3 : 0;

  // Pistol
  const pistolLvl = pistolLevel(hits);
  if (!pistolLvl) reasons.push('Pistol below ' + CONFIG.pistol.bronze + ' hits');

  // Ruck
  const ruckLvl = ruckTime <= ruckStd.maxSeconds ? ruckStd.level : 0;
  if (!ruckLvl) reasons.push('Ruck march over time limit');

  const final = Math.min(bftLvl, pfLvl, pistolLvl, ruckLvl);

  let limitedBy = [];
  if (final === 0) {
    limitedBy = reasons;
  } else if (final < 3) {
    limitedBy = [['BFT', bftLvl], ['Pistol', pistolLvl], ['Ruck march', ruckLvl]]
      .filter(x => x[1] === final)
      .map(x => x[0]);
  }

  return {
    complete: true,
    fields: fields,
    final: final,
    avg: avg,
    bftLvl: bftLvl,
    events: events,
    passFail: passFail,
    pistol: { hits: hits, level: pistolLvl },
    ruck: { km: ruckStd.km, time: ruckTime, max: ruckStd.maxSeconds, level: ruckLvl },
    limitedBy: limitedBy,
    reasons: reasons
  };
}

/* ---------------- Page wiring ---------------- */

function fmtPts(x) {
  const r = Math.round(x * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
}

// 41 -> "41.0", 42.17 -> "42.17"
function fmtSec(t) {
  return Number.isInteger(t * 10) ? t.toFixed(1) : t.toFixed(2);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function tagHtml(kind) {
  // kind: 'pass' | 'fail' | 0..3
  if (kind === 'pass') return '<span class="tag tag-pass">Pass</span>';
  if (kind === 'fail') return '<span class="tag tag-fail">Fail</span>';
  if (kind === 0) return '<span class="tag tag-fail">No Badge</span>';
  return '<span class="tag tag-' + kind + '">' + LEVEL_NAMES[kind] + '</span>';
}

function rowHtml(name, value, sub, kind) {
  return '<li><span class="name">' + escapeHtml(name) + '</span>' +
    '<span class="val">' + escapeHtml(value) + '</span>' + tagHtml(kind) +
    (sub ? '<span class="sub">' + escapeHtml(sub) + '</span>' : '') + '</li>';
}

function bftRow(name, ev, timeText, minText) {
  if (ev.fail) return rowHtml(name, 'Fail', timeText + ' · minimum is ' + minText, 'fail');
  const sc = ev.score;
  let sub = timeText + ' · basic ' + fmtPts(sc.basic);
  if (sc.ageBonus) sub += ' + ' + fmtPts(sc.ageBonus) + ' age';
  if (sc.genderBonus) sub += ' + ' + fmtPts(sc.genderBonus) + ' gender';
  if (sc.capped) sub += ' = ' + sc.rounded + ', capped at ' + CONFIG.eventCap;
  return rowHtml(name, fmtPts(sc.total), sub, 'pass');
}

function init() {
  const form = document.getElementById('calc');
  if (!form) return;

  const $ = id => document.getElementById(id);
  const fieldIds = ['age', 'gender', 'sprint', 'hang', 'run', 'pistol', 'ruckDist', 'ruckTime'];

  const badge = $('badge');
  const badgeText = $('badge-text');
  const summary = $('summary');
  const statAvg = $('stat-avg');
  const statLimit = $('stat-limit');
  const breakdown = $('breakdown');
  const breakdownTitle = $('breakdown-title');
  const chip = $('chip');
  const chipText = $('chip-text');

  function read() {
    return {
      age: $('age').value,
      gender: $('gender').value,
      sprint: $('sprint').value,
      hang: $('hang').value,
      run: $('run').value,
      firstAid: $('firstAid').checked,
      nbc: $('nbc').checked,
      swim: $('swim').checked,
      pistol: $('pistol').value,
      ruckDist: $('ruckDist').value,
      ruckTime: $('ruckTime').value
    };
  }

  function renderFields(fields) {
    fieldIds.forEach(id => {
      const input = $(id);
      const wrap = input.closest('.field');
      const msg = $(id + '-msg');
      const f = fields[id];
      wrap.classList.toggle('field--error', !!f && f.type === 'error');
      wrap.classList.toggle('field--warn', !!f && f.type === 'warn');
      msg.textContent = f ? f.msg : '';
      if (f && f.type === 'error') input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    });
  }

  function render() {
    const r = compute(read());
    renderFields(r.fields);

    if (!r.complete) {
      badge.className = 'badge pending';
      badgeText.textContent = 'Awaiting results';
      summary.textContent = 'Still needed: ' + r.missing.join(', ') + '.';
      statAvg.textContent = '—';
      statLimit.textContent = '—';
      breakdown.innerHTML = '';
      breakdownTitle.hidden = true;
      chipText.textContent = 'Awaiting results';
      chip.dataset.level = 'pending';
      return;
    }

    const lvl = r.final;
    badge.className = 'badge level-' + lvl;
    badgeText.textContent = LEVEL_NAMES[lvl];
    chipText.textContent = LEVEL_NAMES[lvl];
    chip.dataset.level = String(lvl);

    if (lvl === 3) summary.textContent = 'Gold badge earned. Every event met the Gold standard.';
    else if (lvl > 0) summary.textContent = LEVEL_NAMES[lvl] + ' badge earned.';
    else summary.textContent = 'No badge earned. See the reasons below.';

    statAvg.textContent = r.avg === null ? 'Not scored' : String(r.avg);
    statLimit.textContent = lvl === 3 ? 'Nothing. All Gold' : r.limitedBy.join('; ');

    const ev = r.events;
    let html = '';
    html += bftRow('Sprint', ev.sprint, fmtSec(ev.sprint.time) + ' s', '60.0 s');
    html += bftRow('Flexed-arm hang', ev.hang, fmtSec(ev.hang.time) + ' s', '5.0 s');
    html += bftRow('1000 m run', ev.run, formatMinSec(ev.run.time), '6:30');
    html += rowHtml('BFT average', r.avg === null ? '—' : String(r.avg),
      r.avg === null ? 'All three BFT minimums must be met' : 'Average of the three event scores, rounded', r.bftLvl);
    r.passFail.forEach(p => { html += rowHtml(p.name, p.pass ? 'Pass' : 'Fail', '', p.pass ? 'pass' : 'fail'); });
    html += rowHtml('Pistol (P-ES-6)', r.pistol.hits + ' / ' + CONFIG.pistol.maxHits, '9–10 Gold · 8 Silver · 7 Bronze', r.pistol.level);
    html += rowHtml('Ruck march', formatDuration(r.ruck.time),
      r.ruck.km + ' km · limit ' + formatDuration(r.ruck.max), r.ruck.level);

    breakdown.innerHTML = html;
    breakdownTitle.hidden = false;
  }

  form.addEventListener('input', render);
  form.addEventListener('change', render);
  form.addEventListener('submit', e => e.preventDefault());

  $('reset').addEventListener('click', () => {
    form.reset();
    render();
    $('age').focus();
  });

  // Mobile result chip: hide it while the results panel is on screen.
  const results = $('results');
  chip.addEventListener('click', () => results.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      chip.classList.toggle('chip--hidden', entries[0].isIntersecting);
    }, { threshold: 0.15 }).observe(results);
  }

  render();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CONFIG, compute, sprintBasic, hangBasic, runBasic, eventScore,
    roundExcel, bftAverage, parseSeconds, parseMinSec, parseDuration
  };
}
