/* =========================================================================
   SAUC ANTIMICROBIAL GUIDE — navigation & view rendering
   Single-page app, stack + push()/pop(), wired to the real History API so
   Android hardware back navigates within the app instead of closing it.
   ========================================================================= */

let stack = [{type:'root', label:'SAUC Guide'}];

function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function nl2p(s){
  if(!s) return '';
  return s.split('\n').map(line=>{
    line = line.trim();
    if(!line) return '';
    if(line.startsWith('•')) return '<li>'+esc(line.slice(1).trim())+'</li>';
    return '<p>'+esc(line)+'</p>';
  }).join('');
}
function wrapBullets(html){
  // wrap consecutive <li> in <ul>
  return html.replace(/(<li>.*?<\/li>)(?=(<li>|$))/gs, m=>m).replace(/(<li>[\s\S]*?<\/li>(?:\s*<li>[\s\S]*?<\/li>)*)/g, '<ul>$1</ul>');
}
function block(s){ return wrapBullets(nl2p(s)); }

function awareBadge(key){
  const label = AWARE[key] || 'N/A';
  return `<span class="badge ${key}">${label}</span>`;
}

function push(view){
  stack.push(view);
  history.pushState({depth:stack.length}, '', '');
  recordRecentIfDetail(view);
  render();
}
function pop(){
  if(stack.length>1){ stack.pop(); }
  render();
}
window.addEventListener('popstate', ()=>{
  if(stack.length>1){ stack.pop(); render(); }
});

/* ---------------- Favorites & Recent (real, via localStorage) ----------------
   This is a downloadable standalone file meant to be hosted and installed as
   a PWA — not a Claude.ai in-chat artifact — so persistent localStorage is
   appropriate here and mirrors the reference app's real star/recent feature. */
const LS_FAV = 'sauc_favorites_v1';
const LS_RECENT = 'sauc_recent_v1';
const DETAIL_TYPES = ['uti-detail','surg-detail','std-detail','candid-detail','drug-detail'];
function lsGet(key){ try{ return JSON.parse(localStorage.getItem(key)||'[]'); }catch(e){ return []; } }
function lsSet(key,val){ try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){} }
function detailKey(view){ return view.type+':'+(view.type==='drug-detail'?view.name:view.id); }
function detailInfo(view){
  switch(view.type){
    case 'uti-detail': { const d=UTI_CONDITIONS.find(x=>x.id===view.id); return {title:d?d.title:'Condition', sub:'Urinary Tract Infections'}; }
    case 'surg-detail': { const d=SURG_ENTRIES.find(x=>x.id===view.id); return {title:d?d.title:'Procedure', sub:'Surgical Prophylaxis'}; }
    case 'std-detail': { const d=STD_CONDITIONS.find(x=>x.id===view.id); return {title:d?d.title:'Condition', sub:'Sexually Transmitted Diseases'}; }
    case 'candid-detail': { const d=CANDID_CONDITIONS.find(x=>x.id===view.id); return {title:d?d.title:'Condition', sub:'Candiduria'}; }
    case 'drug-detail': return {title:view.name, sub:'Antimicrobial Information'};
    default: return {title:'Item', sub:''};
  }
}
function isFavorited(view){ return lsGet(LS_FAV).some(f=>f.key===detailKey(view)); }
function toggleFavorite(view){
  const k = detailKey(view);
  let favs = lsGet(LS_FAV);
  const idx = favs.findIndex(f=>f.key===k);
  if(idx>=0){ favs.splice(idx,1); }
  else {
    const info = detailInfo(view);
    favs.unshift({key:k, view:{type:view.type,id:view.id,name:view.name}, title:info.title, sub:info.sub});
  }
  lsSet(LS_FAV, favs.slice(0,150));
}
function recordRecentIfDetail(view){
  if(!DETAIL_TYPES.includes(view.type)) return;
  const k = detailKey(view);
  let recent = lsGet(LS_RECENT).filter(r=>r.key!==k);
  const info = detailInfo(view);
  recent.unshift({key:k, view:{type:view.type,id:view.id,name:view.name}, title:info.title, sub:info.sub, t:Date.now()});
  lsSet(LS_RECENT, recent.slice(0,25));
}
function favButtonHtml(view){
  const fav = isFavorited(view);
  return `<button id="favBtn" class="favbtn ${fav?'active':''}" aria-label="Toggle favorite">${fav?'★':'☆'}</button>`;
}
function wireFavButton(c, view){
  const btn = c.querySelector('#favBtn');
  if(!btn) return;
  btn.onclick = ()=>{
    toggleFavorite(view);
    const fav = isFavorited(view);
    btn.classList.toggle('active', fav);
    btn.textContent = fav ? '★' : '☆';
  };
}

document.getElementById('backBtn').addEventListener('click', ()=>{ history.back(); });
document.getElementById('searchBtn').addEventListener('click', ()=>{ push({type:'search', title:'Search'}); });

/* ---------------- offline banner ---------------- */
function updateOnlineStatus(){
  document.getElementById('offlineBar').style.display = navigator.onLine ? 'none' : 'block';
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

/* ---------------- install prompt ---------------- */
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = document.getElementById('installBtn');
  if(btn) btn.classList.add('show');
});

function setTop(title){
  document.getElementById('topTitle').textContent = title;
  document.getElementById('backBtn').style.visibility = stack.length>1 ? 'visible' : 'hidden';
}
function setCrumb(parts){
  const el = document.getElementById('crumb');
  if(!parts || parts.length<2){ el.style.display='none'; el.innerHTML=''; return; }
  el.style.display='block';
  el.innerHTML = parts.map(p=>`<span>${esc(p)}</span>`).join('');
}

function render(){
  const view = stack[stack.length-1];
  const c = document.getElementById('content');
  c.innerHTML = '';
  c.scrollTop = 0;
  window.scrollTo(0,0);
  const r = RENDERERS[view.type];
  if(r) r(c, view);
  setTop(view.title || 'SAUC Guide');
  setCrumb(stack.map(v=>v.crumb || v.title || 'Home'));
}

/* ---------------------------- shared bits ---------------------------- */
function conditionCard(cond, accentVar, view){
  let html = `<div class="card accent" style="border-left-color:var(${accentVar})">`;
  html += `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">`;
  html += `<h2 style="margin:0;">${esc(cond.title)}${cond.subtitle ? ' <span style="font-weight:400;color:var(--muted);font-size:12px;">— '+esc(cond.subtitle)+'</span>' : ''}</h2>`;
  if(view) html += favButtonHtml(view);
  html += `</div>`;
  if(cond.organisms){
    html += `<div class="field-label">Common organisms</div><div class="field-value">${esc(cond.organisms)}</div>`;
  }
  if(cond.first){
    html += `<div class="field-label">1st choice</div><div class="dosebox">${block(cond.first)}</div>`;
  }
  if(cond.second){
    html += `<div class="field-label">2nd choice</div><div class="dosebox">${block(cond.second)}</div>`;
  }
  if(cond.duration){
    html += `<div class="field-label">Duration</div><div class="field-value">${esc(cond.duration)}</div>`;
  }
  if(cond.remarks){
    html += `<div class="remarknote"><b>Remarks:</b><br>${block(cond.remarks)}</div>`;
  }
  if(cond.subtable){
    cond.subtable.forEach(s=>{
      html += `<h3>${esc(s.h)}</h3>`;
      if(s.organisms) html += `<div class="field-label">Organisms</div><div class="field-value">${esc(s.organisms)}</div>`;
      html += `<div class="dosebox">${block(s.body)}</div>`;
      if(s.remark) html += `<div class="remarknote">${block(s.remark)}</div>`;
    });
  }
  html += `</div>`;
  return html;
}

/* ============================== RENDERERS ============================== */
const RENDERERS = {};

RENDERERS.root = function(c){
  c.innerHTML = `
    <div class="herowrap">
      <img src="icon-192.png" alt="SAUC logo">
      <div>
        <div class="herotag">Sabah Al-Ahmad Urology Center</div>
        <h1 class="pagetitle" style="margin:0;">Antimicrobial Guide</h1>
      </div>
    </div>
    <p class="pagesub">Point-of-care prescribing guidance, dosing reference, and stewardship rules for SAUC — works offline once loaded.</p>
    <button class="installbtn" id="installBtn">Install app</button>
    <div class="banner">
      <button class="pill green" id="btnGeneral">✓ General Principles
        <small>De-escalate daily · IV → PO ASAP · Shortest effective course</small>
      </button>
      <button class="pill red" id="btnReserved">⚠ Reserved Antimicrobials (Stewardship Approval Required)
        <small>LINEZOLID · TIGECYCLINE · COLISTIN · CEFTAZIDIME-AVIBACTAM · CEFTOLOZANE-TAZOBACTAM · CASPOFUNGIN · LIPOSOMAL AMPHOTERICIN B</small>
      </button>
    </div>
    <div class="grid">
      <button class="tile" id="t1"><div class="emoji">📖</div><div class="label">Guidelines</div><div class="desc">UTIs, surgical prophylaxis, STDs, candiduria</div></button>
      <button class="tile" id="t2"><div class="emoji">🛡️</div><div class="label">Prescribing Principles</div><div class="desc">Core rules, reserved list, screening</div></button>
      <button class="tile" id="t3"><div class="emoji">🧮</div><div class="label">Calculators</div><div class="desc">Renal function, dosing, severity scores</div></button>
      <button class="tile" id="t4"><div class="emoji">⭐</div><div class="label">Favorites & Recent</div><div class="desc">Starred items and what you've viewed lately</div></button>
      <button class="tile" id="t5"><div class="emoji">⚠️</div><div class="label">Drug Interaction Checker</div><div class="desc">Scoped, not exhaustive</div></button>
      <button class="tile" id="t6"><div class="emoji">💊</div><div class="label">Antimicrobial Information</div><div class="desc">Dosing, AWaRe, monitoring</div></button>
    </div>
    <div class="flagnote"><b>Structure note:</b> SAUC's policy is a single-specialty urology document with no body-system chapters and no dedicated pediatric section. "Guidelines" below is organized around the document's own condition groupings rather than a generic multi-specialty template.</div>
    <div class="card" style="margin-top:18px;">
      <h3 style="margin-top:0;">About this app</h3>
      <p>Independent, no-cost point-of-care companion to the SAUC Antibiotic Policy 2025 (created 4 May 2025). Installable, works offline once loaded. Covers empirical therapy for urological infections, surgical prophylaxis by procedure, STDs, candiduria, dosing regimens, TDM, and reference calculators.</p>
      <p>Does not replace clinical judgement, the full written policy, or an infectious diseases/microbiology consult. Some calculators (severity scores, organ-function scores, diagnostic criteria) are general published clinical tools included for reference alongside SAUC's own content — see the note on the Calculators screen for which is which.</p>
    </div>
    <div class="disclaimer">Clinical reference only — does not replace clinical judgment. Not for use outside SAUC without institutional review.</div>
  `;
  c.querySelector('#btnGeneral').onclick = ()=>push({type:'principles-detail', id:'general', title:'General Principles'});
  c.querySelector('#btnReserved').onclick = ()=>push({type:'principles-detail', id:'reserved', title:'Reserved Antimicrobials'});
  c.querySelector('#t1').onclick = ()=>push({type:'guidelines', title:'Guidelines'});
  c.querySelector('#t2').onclick = ()=>push({type:'principles', title:'Prescribing Principles'});
  c.querySelector('#t3').onclick = ()=>push({type:'calculators', title:'Calculators'});
  c.querySelector('#t4').onclick = ()=>push({type:'favorites', title:'Favorites & Recent'});
  c.querySelector('#t5').onclick = ()=>push({type:'interactions', title:'Drug Interaction Checker'});
  c.querySelector('#t6').onclick = ()=>push({type:'drugs-list', title:'Antimicrobial Information'});
  const installBtn = c.querySelector('#installBtn');
  if(deferredInstallPrompt) installBtn.classList.add('show');
  installBtn.onclick = async ()=>{
    if(!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installBtn.classList.remove('show');
  };
};

/* ---------------- Global search ---------------- */
function searchIndex(){
  const items = [];
  UTI_CONDITIONS.forEach(d=>items.push({type:'uti-detail', id:d.id, title:d.title, sub:'Urinary Tract Infections', accent:'--uti'}));
  SURG_ENTRIES.forEach(d=>items.push({type:'surg-detail', id:d.id, title:d.title, sub:'Surgical Prophylaxis', accent:'--surg'}));
  STD_CONDITIONS.forEach(d=>items.push({type:'std-detail', id:d.id, title:d.title, sub:'Sexually Transmitted Diseases', accent:'--std'}));
  CANDID_CONDITIONS.forEach(d=>items.push({type:'candid-detail', id:d.id, title:d.title, sub:'Candiduria', accent:'--candid'}));
  DRUGS.forEach(d=>items.push({type:'drug-detail', name:d.n, title:d.n, sub:'Antimicrobial Information · '+d.cls, accent:'--navy'}));
  return items;
}
RENDERERS.search = function(c){
  const idx = searchIndex();
  c.innerHTML = `<input class="search-overlay-input" id="q" placeholder="Search drug, condition, or procedure…" autofocus>
  <div class="search-clear"><button id="clearQ">Clear</button></div>
  <div id="results"></div>`;
  const input = c.querySelector('#q');
  const results = c.querySelector('#results');
  function draw(q){
    q = (q||'').trim().toLowerCase();
    if(!q){ results.innerHTML = `<div class="empty-state"><div class="big">🔍</div><p>Start typing to search across Guidelines and Antimicrobial Information.</p></div>`; return; }
    const matches = idx.filter(i=>i.title.toLowerCase().includes(q) || i.sub.toLowerCase().includes(q));
    if(matches.length===0){ results.innerHTML = `<div class="empty-state"><div class="big">✕</div><p><b>No matches</b></p><p>Try a different drug, pathogen, or condition name.</p></div>`; return; }
    results.innerHTML = matches.map(m=>`<button class="rowlink" style="border-left-color:var(${m.accent})" data-t="${m.type}" data-i="${esc(m.id||m.name||'')}">
      <div class="rt">${esc(m.title)}</div><div class="rs">${esc(m.sub)}</div>
    </button>`).join('');
    results.querySelectorAll('.rowlink').forEach(b=>{
      b.onclick = ()=>{
        const t = b.dataset.t;
        const v = t==='drug-detail' ? {type:t, name:b.dataset.i, title:'Drug Info', crumb:b.dataset.i}
                                     : {type:t, id:b.dataset.i, title:'Result', crumb:'Result'};
        push(v);
      };
    });
  }
  draw('');
  input.addEventListener('input', ()=>draw(input.value));
  c.querySelector('#clearQ').onclick = ()=>{ input.value=''; draw(''); input.focus(); };
};

/* ---------------- Guidelines top level ---------------- */
RENDERERS.guidelines = function(c){
  c.innerHTML = `
    <h1 class="pagetitle">Guidelines</h1>
    <p class="pagesub">Organized by SAUC's own condition groupings (no body-system chapters or pediatric track exist in the source document).</p>
    <div class="grid">
      <button class="tile" id="g1"><div class="emoji">💧</div><div class="label">Urinary Tract Infections</div><div class="desc">ASB, cystitis, pyelonephritis, recurrent UTI</div></button>
      <button class="tile" id="g2"><div class="emoji">🔪</div><div class="label">Surgical Prophylaxis</div><div class="desc">Urologic procedures, dosing & timing</div></button>
      <button class="tile" id="g3"><div class="emoji">🩺</div><div class="label">Sexually Transmitted Diseases</div><div class="desc">Urethritis, genital ulcer, prostatitis</div></button>
      <button class="tile" id="g4"><div class="emoji">🍄</div><div class="label">Candiduria</div><div class="desc">Asymptomatic candiduria, Candida UTI</div></button>
    </div>`;
  c.querySelector('#g1').onclick = ()=>push({type:'uti-list', title:'Urinary Tract Infections', crumb:'UTIs'});
  c.querySelector('#g2').onclick = ()=>push({type:'surg-list', title:'Surgical Prophylaxis', crumb:'Surgical Prophylaxis'});
  c.querySelector('#g3').onclick = ()=>push({type:'std-list', title:'Sexually Transmitted Diseases', crumb:'STDs'});
  c.querySelector('#g4').onclick = ()=>push({type:'candid-list', title:'Candiduria', crumb:'Candiduria'});
};

/* ---------------- UTI ---------------- */
RENDERERS['uti-list'] = function(c){
  let html = `<h1 class="pagetitle">Urinary Tract Infections</h1><p class="pagesub">Empirical therapy for common urological infections.</p>`;
  UTI_CONDITIONS.forEach(cond=>{
    html += `<button class="rowlink" style="border-left-color:var(--uti)" data-id="${cond.id}">
      <div class="rt">${esc(cond.title)}</div>
      <div class="rs">${esc(cond.subtitle||cond.organisms.slice(0,60)+'…')}</div>
    </button>`;
  });
  html += `<button class="rowlink" style="border-left-color:var(--uti)" id="durRow">
      <div class="rt">Recommended Duration of Therapy</div>
      <div class="rs">Reference table — all UTI diagnoses</div>
    </button>`;
  c.innerHTML = html;
  c.querySelectorAll('.rowlink[data-id]').forEach(b=>{
    b.onclick = ()=>push({type:'uti-detail', id:b.dataset.id, title:'UTI', crumb:'Condition'});
  });
  c.querySelector('#durRow').onclick = ()=>push({type:'uti-duration', title:'Duration of Therapy', crumb:'Duration'});
};
RENDERERS['uti-detail'] = function(c, view){
  const cond = UTI_CONDITIONS.find(x=>x.id===view.id);
  c.innerHTML = conditionCard(cond, '--uti', view);
  wireFavButton(c, view);
};
RENDERERS['uti-duration'] = function(c){
  c.innerHTML = `<h1 class="pagetitle">Recommended Duration of Antimicrobial Therapy</h1>
  <p class="pagesub">"Shorter is smarter" — overuse of prolonged antibiotics contributes to resistance.</p>
  <table class="dtab"><tr><th>Diagnosis / Indication</th><th>Duration</th></tr>
  <tr><td>Asymptomatic bacteriuria (ASB)</td><td>Pregnancy: 5 days. Before urological procedure: 1–5 days.</td></tr>
  <tr><td>Uncomplicated cystitis</td><td>3–5 days (bacterial); 14 days (Candida)</td></tr>
  <tr><td>Complicated cystitis</td><td>7–10 days</td></tr>
  <tr><td>Uncomplicated pyelonephritis</td><td>7–10 days</td></tr>
  <tr><td>Complicated pyelonephritis</td><td>10–14 days</td></tr>
  <tr><td>Recurrent UTI (≥3/yr or ≥2/6 months)</td><td>3–6 months OR post-coital</td></tr>
  </table>
  <div class="card"><h3>Surgical Prophylaxis</h3><p>Single IV dose (STAT dose) for most procedures.</p>
  <p>24 hours (maximum 3 days) for: prostate biopsy; complex procedure; procedure with significant mucosal injury & bleeding; MDRO isolated (DTR).</p></div>`;
};

/* ---------------- Surgical Prophylaxis ---------------- */
RENDERERS['surg-list'] = function(c){
  let html = `<h1 class="pagetitle">Surgical Prophylaxis Policy</h1>
  <p class="pagesub">Perform pre-operative urine C/S for all elective surgeries. Perform MDRO screening for high-risk patients before surgery: MRSA & MDR Gram-negatives.</p>`;
  SURG_ENTRIES.forEach(cond=>{
    html += `<button class="rowlink" style="border-left-color:var(--surg)" data-id="${cond.id}">
      <div class="rt">${esc(cond.title)}</div>
    </button>`;
  });
  html += `<button class="rowlink" style="border-left-color:var(--surg)" id="durRow">
      <div class="rt">Dosing & Timing (Duration)</div>
      <div class="rs">STAT timing, re-dosing intervals, max duration</div>
    </button>`;
  c.innerHTML = html;
  c.querySelectorAll('.rowlink[data-id]').forEach(b=>{
    b.onclick = ()=>push({type:'surg-detail', id:b.dataset.id, title:'Surgical Prophylaxis', crumb:'Procedure'});
  });
  c.querySelector('#durRow').onclick = ()=>push({type:'surg-duration', title:'Dosing & Timing', crumb:'Timing'});
};
RENDERERS['surg-detail'] = function(c, view){
  const cond = SURG_ENTRIES.find(x=>x.id===view.id);
  c.innerHTML = conditionCard(cond, '--surg', view);
  wireFavButton(c, view);
};
RENDERERS['surg-duration'] = function(c){
  c.innerHTML = `<h1 class="pagetitle">Surgical Prophylaxis — Dosing & Timing</h1>
  <div class="card"><h3>Timing</h3><p>STAT (single dose) at least 30–60 minutes before surgery. Re-dose if the procedure extends ≥4 hours or blood loss volume ≥1.5 litres.</p>
  <h3>Duration</h3><p>${esc(SURG_DURATION.general)}</p><p>${esc(SURG_DURATION.extended)}</p></div>`;
};

/* ---------------- STDs ---------------- */
RENDERERS['std-list'] = function(c){
  let html = `<h1 class="pagetitle">Sexually Transmitted Diseases</h1>
  <p class="pagesub">Always offer screening for other STDs if high-risk behaviour or a positive test for an STD. Always screen & treat partners of patients with a positive STD.</p>`;
  STD_CONDITIONS.forEach(cond=>{
    html += `<button class="rowlink" style="border-left-color:var(--std)" data-id="${cond.id}">
      <div class="rt">${esc(cond.title)}</div>
    </button>`;
  });
  c.innerHTML = html;
  c.querySelectorAll('.rowlink[data-id]').forEach(b=>{
    b.onclick = ()=>push({type:'std-detail', id:b.dataset.id, title:'STD', crumb:'Condition'});
  });
};
RENDERERS['std-detail'] = function(c, view){
  const cond = STD_CONDITIONS.find(x=>x.id===view.id);
  c.innerHTML = conditionCard(cond, '--std', view);
  wireFavButton(c, view);
};

/* ---------------- Candiduria ---------------- */
RENDERERS['candid-list'] = function(c){
  let html = `<h1 class="pagetitle">Management of Candiduria</h1>
  <p class="pagesub">Identifying patients who need antifungal therapy and those in whom treatment should be avoided.</p>`;
  CANDID_CONDITIONS.forEach(cond=>{
    html += `<button class="rowlink" style="border-left-color:var(--candid)" data-id="${cond.id}">
      <div class="rt">${esc(cond.title)}${cond.subtitle?' — '+esc(cond.subtitle):''}</div>
    </button>`;
  });
  c.innerHTML = html;
  c.querySelectorAll('.rowlink[data-id]').forEach(b=>{
    b.onclick = ()=>push({type:'candid-detail', id:b.dataset.id, title:'Candiduria', crumb:'Condition'});
  });
};
RENDERERS['candid-detail'] = function(c, view){
  const cond = CANDID_CONDITIONS.find(x=>x.id===view.id);
  c.innerHTML = conditionCard(cond, '--candid', view);
  wireFavButton(c, view);
};

/* ---------------- Principles ---------------- */
RENDERERS.principles = function(c){
  c.innerHTML = `<h1 class="pagetitle">Antimicrobial Prescribing Principles</h1>
  <button class="rowlink" data-id="general"><div class="rt">General Principles & Stewardship Cycle</div><div class="rs">How to use this policy, Initiate → Evaluate → De-escalate, IV–PO switch</div></button>
  <button class="rowlink" data-id="mdro-risk"><div class="rt">MDRO & Complicated UTI Risk Factors</div></button>
  <button class="rowlink" data-id="screening"><div class="rt">MDRO Screening Checklist</div></button>
  <button class="rowlink" data-id="reserved"><div class="rt">Reserved Antimicrobials at SAUC</div><div class="rs">Require stewardship approval</div></button>
  <button class="rowlink" data-id="glossary"><div class="rt">Glossary of Terms</div></button>`;
  c.querySelectorAll('.rowlink').forEach(b=>{
    b.onclick = ()=>push({type:'principles-detail', id:b.dataset.id, title:'Principles', crumb:'Principles'});
  });
};
RENDERERS['principles-detail'] = function(c, view){
  if(view.id==='general'){
    let ivpo = IVPO_TABLE.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('');
    c.innerHTML = `<h1 class="pagetitle">General Principles</h1>
    <div class="card"><h3>How to use this policy</h3>
      <ul>
      <li>Refer to relevant sections quickly using in-app navigation.</li>
      <li>Follow empirical therapy guidance for initial antibiotic choices based on infection type and resistance risk.</li>
      <li>Review culture results and switch to directed therapy whenever possible.</li>
      <li>Use the MDRO and UTI complication risk checklists before initiating broad-spectrum antibiotics.</li>
      <li>Refer to the TDM and dosing sections for appropriate monitoring and adjustment.</li>
      <li>Apply the surgical prophylaxis section before operative interventions, especially in high-risk cases.</li>
      <li>Reserved antimicrobials require approval — refer to the listed criteria and obtain stewardship team approval as needed.</li>
      </ul>
      <p>Clinical decisions must integrate patient-specific factors and local antimicrobial resistance trends. When in doubt, contact the Antimicrobial Stewardship Team for advice.</p>
    </div>
    <div class="card"><h3>Daily Antimicrobial Use — Prescription & Follow-Up Cycle</h3>
      <p><b>Initiate:</b> select antibiotics based on national guidelines and local susceptibilities; consider patient-specific factors (immunosuppression, indwelling catheters, allergies); consider common pathogens for suspected source.</p>
      <p><b>Evaluate:</b> daily review of clinical signs and symptoms of infection; review cultures and molecular diagnostics; analyze current dosing strategy.</p>
      <p><b>De-escalate:</b> narrow therapy based on cultures to minimize adverse events; consider shorter durations based on clinical status.</p>
      <div class="remarknote">Review indication & duration of empirical Rx daily.</div>
    </div>
    <div class="card"><h3>IV to Oral Switch Strategy (STOP criteria)</h3>
      <p>Patients who have negative blood cultures and have received ≥48 hours of IV therapy may be eligible to STOP or switch to oral therapy. Important exclusions apply.</p>
      <p><b>S</b> — Signs of clinical improvement? (afebrile temp &gt;36°C and &lt;38°C for past 48h; CRP/PCT trending down; stable immune response WCC &gt;4 and &lt;12 ×10⁹/L or trending to normal; no unexplained tachycardia/hypotension/tachypnoea) → if NO: review therapy & investigations, consult ID/Micro if necessary.</p>
      <p><b>T</b> — Tolerating oral medicines? (able to take PO, no aspiration concern, no malabsorption/vomiting/diarrhoea/recent GI surgery) → if NO: reconsider switch in 24 hours.</p>
      <p><b>O</b> — Oral option available? → if NO: continue IV course, consult ID/Micro if necessary.</p>
      <p><b>P</b> — Possible to switch? (prolonged parenteral therapy is required for: deep-seated infection e.g. abscess/empyema, meningitis/encephalitis, necrotising soft tissue infection, infected implant/prosthesis, Staph. aureus bacteraemia, osteomyelitis, septic arthritis, endocarditis) → if NO: continue IV, consult ID/Micro.</p>
      <p><b>?</b> — Is antimicrobial therapy still required? → if NO: STOP antimicrobial. If YES: SWITCH to oral therapy (contact Infectious Diseases, Clinical Microbiology, or Clinical Pharmacy for advice).</p>
      <h3>Common IV → Oral Equivalents (adult doses, normal renal function)</h3>
      <table class="dtab"><tr><th>Current IV therapy</th><th>Oral option</th></tr>${ivpo}</table>
      <p style="font-size:11px;color:var(--muted);">The following IV drugs have equivalent oral doses: azithromycin, linezolid, fluconazole, trimethoprim/sulfamethoxazole. Consider patient allergy status when converting to a penicillin.</p>
    </div>`;
    return;
  }
  if(view.id==='mdro-risk'){
    c.innerHTML = `<h1 class="pagetitle">MDRO & Complicated UTI Risk Factors</h1>
    <div class="card"><h3>MDRO risk factors</h3><ul>${MDRO_RISK.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
    <div class="card"><h3>Complicated UTI risk factors</h3><ul>${COMPLICATED_UTI_RISK.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`;
    return;
  }
  if(view.id==='screening'){
    c.innerHTML = `<h1 class="pagetitle">MRSA & MDR Gram-Negative Risk Factors Checklist</h1>
    <p class="pagesub">Helps identify patients who should undergo MRSA or MDR Gram-negative screening prior to certain procedures or antibiotic choices.</p>
    <div class="card"><ul>${SCREENING_CHECKLIST.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`;
    return;
  }
  if(view.id==='reserved'){
    c.innerHTML = `<h1 class="pagetitle">Reserved Antimicrobials at SAUC</h1>
    <div class="flagnote">The source document states these need prior approval by a stewardship team member (Clinical Pharmacist or Clinical Microbiologist) because they are antimicrobials of last resort, reserved by WHO for MDRO infections. The generic app template's banner phrase "ID Consult &gt;48h" does not match SAUC's actual approval mechanism — the label on the root screen has been adapted accordingly.</div>
    <div class="card"><ul>${RESERVED_LIST.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`;
    return;
  }
  if(view.id==='glossary'){
    const g = [['ASB','Asymptomatic Bacteriuria: presence of bacteria in urine without signs or symptoms of UTI.'],['AWaRe','WHO’s Access, Watch, and Reserve antibiotic categorization.'],['C/S','Culture and Sensitivity: lab test to identify pathogens and their antibiotic susceptibility.'],['CLSI','Clinical and Laboratory Standards Institute.'],['Complicated UTI','UTI with risk factors like obstruction, MDROs, or structural/functional abnormalities.'],['CrCl','Creatinine Clearance — renal function estimation for dose adjustment.'],['Directed Therapy','Treatment guided by identified organism and sensitivity report.'],['DTR','Difficult-to-Treat Resistance: highly resistant organisms needing last-line therapy.'],['EAU / AUA','European Association of Urology / American Urological Association.'],['Empirical Therapy','Initial treatment based on most likely pathogens, before lab results.'],['IV to Oral Switch','Transitioning from IV antibiotics to oral therapy once clinically stable.'],['MDRO','Multidrug-Resistant Organism: microbe resistant to multiple antibiotic classes.'],['MIC','Minimum Inhibitory Concentration — the lowest antibiotic concentration that inhibits visible growth.'],['PCR','Polymerase Chain Reaction: molecular test for detecting DNA/RNA of organisms.'],['PDR','Pan-Drug Resistant: resistance against all classes of antibiotics.'],['Prophylaxis','Preventive antibiotic given before procedures or surgery.'],['STAT','Immediate, one dose only.'],['TDM','Therapeutic Drug Monitoring.'],['UTI','Urinary Tract Infection.'],['XDR','Extensively Drug-Resistant: resistance to all classes of antibiotics except one or two.']];
    c.innerHTML = `<h1 class="pagetitle">Glossary of Terms</h1><div class="card">${g.map(([a,b])=>`<div class="field-label">${esc(a)}</div><div class="field-value">${esc(b)}</div>`).join('')}</div>`;
    return;
  }
};

/* ---------------- Favorites (honest placeholder) ---------------- */
RENDERERS.favorites = function(c){
  const favs = lsGet(LS_FAV);
  const recent = lsGet(LS_RECENT);
  function rows(list, emptyIcon, emptyText){
    if(list.length===0) return `<div class="empty-state"><div class="big">${emptyIcon}</div><p>${emptyText}</p></div>`;
    return list.map(item=>`<button class="rowlink" data-k="${esc(item.key)}">
      <div class="rt">${esc(item.title)}</div><div class="rs">${esc(item.sub)}</div>
    </button>`).join('');
  }
  c.innerHTML = `<h1 class="pagetitle">Favorites & Recent</h1>
  <p class="pagesub">Stored on this device only, using your browser's local storage. Clearing site data or browser storage will erase it.</p>
  <h3 style="margin:6px 0 10px;color:var(--navy-ink);font-size:12.5px;text-transform:uppercase;letter-spacing:.03em;">★ Favorites</h3>
  <div id="favRows">${rows(favs, '⭐', 'No favorites yet — tap the ☆ on any condition or drug page to save it here.')}</div>
  <h3 style="margin:20px 0 10px;color:var(--navy-ink);font-size:12.5px;text-transform:uppercase;letter-spacing:.03em;">Recently Viewed</h3>
  <div id="recentRows">${rows(recent, '🕘', 'Conditions and drugs you look up will appear here.')}</div>`;
  function wireRows(container, list){
    container.querySelectorAll('.rowlink').forEach(b=>{
      const item = list.find(x=>x.key===b.dataset.k);
      if(!item) return;
      b.onclick = ()=>push(Object.assign({title:item.title, crumb:item.title}, item.view));
    });
  }
  wireRows(c.querySelector('#favRows'), favs);
  wireRows(c.querySelector('#recentRows'), recent);
};

/* ---------------- Calculators ---------------- */
RENDERERS.calculators = function(c){
  c.innerHTML = `<h1 class="pagetitle">Calculators</h1>
  <p class="pagesub">Quick bedside calculations referenced throughout the guide.</p>
  <div class="flagnote"><b>What's SAUC-specific vs. general reference:</b> CrCl, Amikacin dosing, and Colistin dosing implement SAUC's own policy content directly. IBW/Adjusted Body Weight and BMI support those calculations. Everything under "Severity & Risk Scores," "Organ Function," and "Diagnostic Criteria" — plus the surgical-prophylaxis weight-tier and Vancomycin AUC24 tools — are standard, independently published clinical formulas included for reference and app-suite consistency. They are <b>not</b> sourced from SAUC's urology-specific document and should be confirmed against local protocol before use.</div>

  <h3 style="margin:18px 0 10px;color:var(--navy-ink);font-size:12.5px;text-transform:uppercase;letter-spacing:.03em;">Renal & Body Weight</h3>
  <button class="rowlink" id="c1"><div class="rt">Creatinine Clearance (Cockcroft-Gault)</div><div class="rs">Drives renal dose adjustment throughout this policy</div></button>
  <button class="rowlink" id="c2"><div class="rt">Ideal / Adjusted Body Weight (Devine)</div><div class="rs">Used for CrCl and Colistin dosing (adjusted body weight)</div></button>
  <button class="rowlink" id="c3"><div class="rt">BMI (Body Mass Index)</div><div class="rs">Informs actual vs. ideal vs. adjusted weight for dosing</div></button>

  <h3 style="margin:20px 0 10px;color:var(--navy-ink);font-size:12.5px;text-transform:uppercase;letter-spacing:.03em;">Antibiotic Dosing</h3>
  <button class="rowlink" id="c4"><div class="rt">Amikacin Dosing & TDM</div><div class="rs">Extended-interval dosing by CrCl, per SAUC Section 13</div></button>
  <button class="rowlink" id="c5"><div class="rt">Colistin Dosing</div><div class="rs">Loading + CrCl-based maintenance, per SAUC Section 12</div></button>
  <button class="rowlink" id="c6"><div class="rt">Vancomycin — surgical prophylaxis dose</div><div class="rs">General reference — not in SAUC's policy</div></button>
  <button class="rowlink" id="c7"><div class="rt">Cefazolin — surgical prophylaxis dose</div><div class="rs">General reference (ASHP/SHEA/IDSA/SIS) — weight-tiered</div></button>
  <button class="rowlink" id="c8"><div class="rt">Gentamicin — prophylaxis dose by weight</div><div class="rs">General reference, mg/kg-based</div></button>
  <button class="rowlink" id="c9"><div class="rt">Vancomycin — AUC₂₄ (peak/trough method)</div><div class="rs">Sawchuk-Zaske two-level trapezoidal estimation</div></button>

  <h3 style="margin:20px 0 10px;color:var(--navy-ink);font-size:12.5px;text-transform:uppercase;letter-spacing:.03em;">Severity & Risk Scores</h3>
  <button class="rowlink" id="c10"><div class="rt">CURB-65 (Pneumonia Severity)</div></button>
  <button class="rowlink" id="c11"><div class="rt">qSOFA (Quick SOFA)</div></button>
  <button class="rowlink" id="c12"><div class="rt">Modified Centor Score (McIsaac)</div><div class="rs">Strep pharyngitis</div></button>
  <button class="rowlink" id="c13"><div class="rt">Candida Score (ICU)</div></button>
  <button class="rowlink" id="c14"><div class="rt">NEWS2 (National Early Warning Score 2)</div></button>
  <button class="rowlink" id="c15"><div class="rt">PSI / PORT Score</div><div class="rs">Pneumonia Severity Index</div></button>

  <h3 style="margin:20px 0 10px;color:var(--navy-ink);font-size:12.5px;text-transform:uppercase;letter-spacing:.03em;">Organ Function</h3>
  <button class="rowlink" id="c16"><div class="rt">Child-Pugh Score</div><div class="rs">Hepatic impairment</div></button>
  <button class="rowlink" id="c17"><div class="rt">MELD Score</div><div class="rs">Model for End-Stage Liver Disease — classic formula</div></button>

  <h3 style="margin:20px 0 10px;color:var(--navy-ink);font-size:12.5px;text-transform:uppercase;letter-spacing:.03em;">Diagnostic Criteria</h3>
  <button class="rowlink" id="c18"><div class="rt">Modified Duke Criteria</div><div class="rs">Infective endocarditis</div></button>
  `;
  const map = {
    c1:'calc-crcl', c2:'calc-ibw', c3:'calc-bmi', c4:'calc-amikacin', c5:'calc-colistin',
    c6:'calc-vanco-surg', c7:'calc-cefazolin-surg', c8:'calc-gent-surg', c9:'calc-vanco-auc24',
    c10:'calc-curb65', c11:'calc-qsofa', c12:'calc-centor', c13:'calc-candida-score', c14:'calc-news2', c15:'calc-psi',
    c16:'calc-childpugh', c17:'calc-meld', c18:'calc-duke'
  };
  Object.keys(map).forEach(id=>{
    c.querySelector('#'+id).onclick = ()=>push({type:map[id], title:'Calculator', crumb:'Calculator'});
  });
};

RENDERERS['calc-crcl'] = function(c){
  c.innerHTML = `<h1 class="pagetitle">Creatinine Clearance</h1>
  <p class="pagesub">Cockcroft-Gault equation (SI units). Not explicitly spelled out in SAUC's policy text, but included because nearly every drug in this policy requires "renal dose adjustment" referencing CrCl.</p>
  <div class="card">
    <div class="seg" id="sexSeg"><button class="active" data-v="male">Male</button><button data-v="female">Female</button></div>
    <div class="calc-field"><label>Age (years)</label><input type="number" id="age" inputmode="numeric"></div>
    <div class="calc-field"><label>Weight (kg)</label><input type="number" id="wt" inputmode="decimal"></div>
    <div class="seg" id="unitSeg"><button class="active" data-v="umol">SCr in µmol/L</button><button data-v="mgdl">SCr in mg/dL</button></div>
    <div class="calc-field"><label>Serum Creatinine</label><input type="number" id="scr" inputmode="decimal"></div>
    <div id="result"></div>
  </div>`;
  let sex='male', unit='umol';
  const segs = c.querySelectorAll('.seg');
  segs[0].querySelectorAll('button').forEach(b=>b.onclick=()=>{segs[0].querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active');sex=b.dataset.v;calc();});
  segs[1].querySelectorAll('button').forEach(b=>b.onclick=()=>{segs[1].querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active');unit=b.dataset.v;calc();});
  ['age','wt','scr'].forEach(id=>c.querySelector('#'+id).addEventListener('input', calc));
  function calc(){
    const age = parseFloat(c.querySelector('#age').value);
    const wt = parseFloat(c.querySelector('#wt').value);
    let scr = parseFloat(c.querySelector('#scr').value);
    const res = c.querySelector('#result');
    if(!age||!wt||!scr){ res.innerHTML=''; return; }
    let crcl;
    if(unit==='umol'){
      const constant = sex==='male' ? 1.23 : 1.04;
      crcl = ((140-age)*wt*constant)/scr;
    } else {
      crcl = ((140-age)*wt)/(72*scr);
      if(sex==='female') crcl *= 0.85;
    }
    res.innerHTML = `<div class="calc-result"><div class="rlabel">Estimated CrCl</div>
      <div class="rvalue">${crcl.toFixed(1)} mL/min</div>
      <div class="rnote">Cockcroft-Gault (SI units): [(140−age) × weight × constant] / SCr(µmol/L), constant = 1.23 (male) or 1.04 (female). Use actual body weight; consider ideal/adjusted weight if obese, and use adjusted body weight specifically for Colistin dosing per SAUC's own guidance.</div></div>`;
  }
  calc();
};

RENDERERS['calc-ibw'] = function(c){
  c.innerHTML = `<h1 class="pagetitle">Ideal & Adjusted Body Weight</h1>
  <p class="pagesub">Devine formula. SAUC's Colistin Dosing Guide specifically notes: "Adjusted body weight should be used to estimate creatinine clearance" for Colistin.</p>
  <div class="card">
    <div class="seg" id="sexSeg"><button class="active" data-v="male">Male</button><button data-v="female">Female</button></div>
    <div class="calc-field"><label>Height (cm)</label><input type="number" id="ht" inputmode="decimal"></div>
    <div class="calc-field"><label>Actual weight (kg)</label><input type="number" id="wt" inputmode="decimal"></div>
    <div id="result"></div>
  </div>`;
  let sex='male';
  c.querySelector('#sexSeg').querySelectorAll('button').forEach(b=>b.onclick=()=>{c.querySelector('#sexSeg').querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active');sex=b.dataset.v;calc();});
  ['ht','wt'].forEach(id=>c.querySelector('#'+id).addEventListener('input', calc));
  function calc(){
    const ht = parseFloat(c.querySelector('#ht').value);
    const wt = parseFloat(c.querySelector('#wt').value);
    const res = c.querySelector('#result');
    if(!ht||!wt){ res.innerHTML=''; return; }
    const inches = ht/2.54;
    if(inches<60){ res.innerHTML = `<div class="calc-result"><div class="rlabel">Ideal Body Weight</div><div class="rvalue">Formula applies ≥60 in (152 cm)</div><div class="rnote">Height below Devine formula's valid range — use actual body weight and clinical judgment.</div></div>`; return; }
    const ibw = sex==='male' ? 50+2.3*(inches-60) : 45.5+2.3*(inches-60);
    let adjbw = ibw;
    let note = 'Actual weight ≤ IBW — adjusted body weight not applicable; use actual or ideal weight per clinical context.';
    if(wt>ibw){ adjbw = ibw + 0.4*(wt-ibw); note='Adjusted body weight = IBW + 0.4 × (actual weight − IBW).'; }
    res.innerHTML = `<div class="calc-result"><div class="rlabel">Ideal Body Weight (IBW)</div><div class="rvalue">${ibw.toFixed(1)} kg</div>
    <div class="rlabel" style="margin-top:10px;">Adjusted Body Weight</div><div class="rvalue">${adjbw.toFixed(1)} kg</div>
    <div class="rnote">${note}</div></div>`;
  }
};

RENDERERS['calc-amikacin'] = function(c){
  let tab = AMIKACIN_EXT_TABLE.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
  c.innerHTML = `<h1 class="pagetitle">Amikacin Dosing & TDM</h1>
  <p class="pagesub">Extended-interval strategy (preferred, less toxic) per SAUC Section 13.</p>
  <div class="card">
    <div class="calc-field"><label>Creatinine clearance (mL/min)</label><input type="number" id="crcl" inputmode="decimal"></div>
    <div id="result"></div>
    <h3>Reference table</h3>
    <table class="dtab"><tr><th>CrCl</th><th>Amikacin</th></tr>${tab}</table>
  </div>
  <div class="card"><h3>Initial TDM</h3>
    <p>Single trough level drawn 8 hours after the first dose. Use SAUC's nomogram graph to confirm/modify the dosage interval. For 15 mg/kg/dose: divide the trough level by 3, then plot on the graph.</p>
    <h3>Follow-up TDM</h3>
    <p>An early trough (6 hours prior to next dose) should be considered if there are acute changes in renal function or suspicion of extended-interval failure. Maintenance random levels should be monitored at least once weekly. If duration of therapy is anticipated to be &gt;2 weeks, audiometry should be considered.</p>
  </div>`;
  c.querySelector('#crcl').addEventListener('input', ()=>{
    const v = parseFloat(c.querySelector('#crcl').value);
    const res = c.querySelector('#result');
    if(!v && v!==0){ res.innerHTML=''; return; }
    let dose;
    if(v>=60) dose='15 mg/kg Q24H';
    else if(v>=40) dose='15 mg/kg Q36H';
    else if(v>=20) dose='15 mg/kg Q48H';
    else dose='Not recommended — seek pharmacy/ID input for alternative dosing strategy';
    res.innerHTML = `<div class="calc-result"><div class="rlabel">Suggested regimen (extended-interval)</div><div class="rvalue">${dose}</div>
    <div class="rnote">Use ideal body weight, not actual weight, per SAUC policy. Confirm against SAUC's trough nomogram before finalizing.</div></div>`;
  });
};

RENDERERS['calc-colistin'] = function(c){
  c.innerHTML = `<h1 class="pagetitle">Colistin (Polymyxin E) Dosing</h1>
  <div class="flagnote">Reserved antibiotic at SAUC — use is solely based on prior approval by an antimicrobial stewardship member. Colistin will not be used for colonizing bacteria, only infections.</div>
  <div class="card">
    <h3>Loading dose</h3>
    <div class="calc-field"><label>Actual body weight (kg)</label><input type="number" id="abw" inputmode="decimal"></div>
    <div id="loadResult"></div>
    <p class="field-value" style="margin-top:8px;">Required in critically ill patients and severe systemic infections. May not be necessary for localized cystitis without systemic signs. Maximum dose 300 mg.</p>
    <h3>Maintenance dose (starts 12h after loading dose, if given)</h3>
    <div class="calc-field"><label>Creatinine clearance (mL/min) — use adjusted body weight to estimate</label><input type="number" id="crcl" inputmode="decimal"></div>
    <div id="maintResult"></div>
    <h3>Reference table — Daily dose of CMS for plasma colistin Css,avg of 2 mg/L</h3>
    <table class="dtab"><tr><th>CrCl (mL/min)</th><th>mg CBA/day</th><th>Million IU/day</th></tr>
    <tr><td>0</td><td>130</td><td>3.95</td></tr>
    <tr><td>5 to &lt;10</td><td>145</td><td>4.40</td></tr>
    <tr><td>10 to &lt;20</td><td>160</td><td>4.85</td></tr>
    <tr><td>20 to &lt;30</td><td>175</td><td>5.30</td></tr>
    <tr><td>30 to &lt;40</td><td>195</td><td>5.90</td></tr>
    <tr><td>40 to &lt;50</td><td>220</td><td>6.65</td></tr>
    <tr><td>50 to &lt;60</td><td>245</td><td>7.40</td></tr>
    <tr><td>60 to &lt;70</td><td>275</td><td>8.35</td></tr>
    <tr><td>70 to &lt;80</td><td>300</td><td>9.00</td></tr>
    <tr><td>80 to &lt;90</td><td>340</td><td>10.3</td></tr>
    <tr><td>90</td><td>360</td><td>10.9</td></tr>
    </table>
    <p style="font-size:11px;color:var(--muted);">Total daily dose is divided q12h. Infuse loading & maintenance doses over 30–60 minutes.</p>
  </div>`;
  c.querySelector('#abw').addEventListener('input', ()=>{
    const w = parseFloat(c.querySelector('#abw').value);
    const res = c.querySelector('#loadResult');
    if(!w){ res.innerHTML=''; return; }
    const load = Math.min(4*w, 300);
    res.innerHTML = `<div class="calc-result"><div class="rlabel">Loading dose</div><div class="rvalue">${load.toFixed(0)} mg</div>
    <div class="rnote">4 × actual body weight, capped at 300 mg maximum.</div></div>`;
  });
  c.querySelector('#crcl').addEventListener('input', ()=>{
    const v = parseFloat(c.querySelector('#crcl').value);
    const res = c.querySelector('#maintResult');
    if(!v && v!==0){ res.innerHTML=''; return; }
    let row;
    if(v<5) row=COLISTIN_TABLE[0];
    else if(v<10) row=COLISTIN_TABLE[1];
    else if(v<20) row=COLISTIN_TABLE[2];
    else if(v<30) row=COLISTIN_TABLE[3];
    else if(v<40) row=COLISTIN_TABLE[4];
    else if(v<50) row=COLISTIN_TABLE[5];
    else if(v<60) row=COLISTIN_TABLE[6];
    else if(v<70) row=COLISTIN_TABLE[7];
    else if(v<80) row=COLISTIN_TABLE[8];
    else if(v<90) row=COLISTIN_TABLE[9];
    else row=COLISTIN_TABLE[10];
    const per12h = (row[1]/2).toFixed(0);
    res.innerHTML = `<div class="calc-result"><div class="rlabel">Total daily maintenance dose</div><div class="rvalue">${row[1]} mg CBA/day (${row[2]} Million IU/day)</div>
    <div class="rnote">≈ ${per12h} mg CBA per dose, given q12h. CrCl should be estimated using adjusted body weight per SAUC guidance.</div></div>`;
  });
};

/* ---------------- BMI ---------------- */
RENDERERS['calc-bmi'] = function(c){
  c.innerHTML = `<h1 class="pagetitle">BMI (Body Mass Index)</h1>
  <div class="card">
    <div class="calc-field"><label>Weight (kg)</label><input type="number" id="wt" inputmode="decimal"></div>
    <div class="calc-field"><label>Height (cm)</label><input type="number" id="ht" inputmode="decimal"></div>
    <div id="result"></div>
    <p class="field-value" style="margin-top:10px;">WHO bands: &lt;18.5 underweight · 18.5–24.9 normal · 25–29.9 overweight · 30–34.9 obese I · 35–39.9 obese II · ≥40 obese III. Informs whether to use actual, ideal, or adjusted body weight for dosing.</p>
  </div>`;
  ['wt','ht'].forEach(id=>c.querySelector('#'+id).addEventListener('input', calc));
  function calc(){
    const wt = parseFloat(c.querySelector('#wt').value);
    const ht = parseFloat(c.querySelector('#ht').value);
    const res = c.querySelector('#result');
    if(!wt||!ht){ res.innerHTML=''; return; }
    const m = ht/100;
    const bmi = wt/(m*m);
    let band;
    if(bmi<18.5) band='Underweight';
    else if(bmi<25) band='Normal';
    else if(bmi<30) band='Overweight';
    else if(bmi<35) band='Obese I';
    else if(bmi<40) band='Obese II';
    else band='Obese III';
    res.innerHTML = `<div class="calc-result"><div class="rlabel">BMI</div><div class="rvalue">${bmi.toFixed(1)} — ${band}</div></div>`;
  }
};

/* ---------------- Surgical prophylaxis weight-tier calculators (general reference) ---------------- */
RENDERERS['calc-vanco-surg'] = function(c){
  c.innerHTML = `<h1 class="pagetitle">Vancomycin — Surgical Prophylaxis Dose</h1>
  <div class="flagnote">General reference dosing, not part of SAUC's own surgical prophylaxis section (SAUC's policy uses Cefazolin/Amikacin for urologic procedures — see Guidelines). Included for app-suite consistency; confirm against local protocol before use.</div>
  <div class="card">
    <div class="calc-field"><label>Weight (kg)</label><input type="number" id="wt" inputmode="decimal"></div>
    <div id="result"></div>
    <p class="field-value" style="margin-top:10px;">1 g IV for ≤90 kg · 1.5 g IV for &gt;90 kg. Infuse over 60–90+ minutes.</p>
  </div>`;
  c.querySelector('#wt').addEventListener('input', ()=>{
    const wt = parseFloat(c.querySelector('#wt').value);
    const res = c.querySelector('#result');
    if(!wt){ res.innerHTML=''; return; }
    const dose = wt>90 ? '1.5 g IV' : '1 g IV';
    res.innerHTML = `<div class="calc-result"><div class="rlabel">Prophylaxis dose</div><div class="rvalue">${dose}</div></div>`;
  });
};
RENDERERS['calc-cefazolin-surg'] = function(c){
  c.innerHTML = `<h1 class="pagetitle">Cefazolin — Surgical Prophylaxis Dose</h1>
  <div class="flagnote">General reference dosing (ASHP/SHEA/IDSA/SIS surgical antimicrobial prophylaxis guidance). SAUC's own policy specifies a flat STAT IV Cefazolin 2 g for urologic procedures without a weight tier — see Guidelines › Surgical Prophylaxis for SAUC's exact wording.</div>
  <div class="card">
    <div class="calc-field"><label>Weight (kg)</label><input type="number" id="wt" inputmode="decimal"></div>
    <div id="result"></div>
    <p class="field-value" style="margin-top:10px;">2 g IV standard · 3 g IV if &gt;120 kg. Re-dose every 4 hours intraoperatively.</p>
  </div>`;
  c.querySelector('#wt').addEventListener('input', ()=>{
    const wt = parseFloat(c.querySelector('#wt').value);
    const res = c.querySelector('#result');
    if(!wt){ res.innerHTML=''; return; }
    const dose = wt>120 ? '3 g IV' : '2 g IV';
    res.innerHTML = `<div class="calc-result"><div class="rlabel">Prophylaxis dose</div><div class="rvalue">${dose}</div></div>`;
  });
};
RENDERERS['calc-gent-surg'] = function(c){
  c.innerHTML = `<h1 class="pagetitle">Gentamicin — Prophylaxis Dose by Weight</h1>
  <div class="flagnote">General mg/kg reference dose, not reproduced from any specific institution's stepped table. SAUC's own surgical prophylaxis uses Amikacin 15 mg/kg, not Gentamicin, for MDRO-risk urologic procedures — see Guidelines › Surgical Prophylaxis.</div>
  <div class="card">
    <div class="calc-field"><label>Weight (kg) — actual or ideal, per clinical context</label><input type="number" id="wt" inputmode="decimal"></div>
    <div id="result"></div>
    <p class="field-value" style="margin-top:10px;">5 mg/kg single dose, within 60 minutes before incision. Do not re-dose.</p>
  </div>`;
  c.querySelector('#wt').addEventListener('input', ()=>{
    const wt = parseFloat(c.querySelector('#wt').value);
    const res = c.querySelector('#result');
    if(!wt){ res.innerHTML=''; return; }
    const dose = (wt*5).toFixed(0);
    res.innerHTML = `<div class="calc-result"><div class="rlabel">Prophylaxis dose</div><div class="rvalue">${dose} mg</div></div>`;
  });
};

/* ---------------- Vancomycin AUC24 ---------------- */
RENDERERS['calc-vanco-auc24'] = function(c){
  c.innerHTML = `<h1 class="pagetitle">Vancomycin — AUC₂₄ (Peak/Trough Method)</h1>
  <div class="flagnote">Estimation tool only — for steady-state levels (typically 3rd–4th dose), peak drawn at end of infusion, trough drawn just before next dose. Two-level trapezoidal (Sawchuk-Zaske) method. Correlate with pharmacy/ID; use validated Bayesian software where available.</div>
  <div class="card">
    <div class="calc-field"><label>Dose (mg)</label><input type="number" id="dose" inputmode="decimal"></div>
    <div class="calc-field"><label>Infusion duration (hr)</label><input type="number" id="tinf" inputmode="decimal"></div>
    <div class="calc-field"><label>Dosing interval τ (hr)</label><input type="number" id="tau" inputmode="decimal"></div>
    <div class="calc-field"><label>Peak level Cmax (mg/L)</label><input type="number" id="cmax" inputmode="decimal"></div>
    <div class="calc-field"><label>Trough level Cmin (mg/L)</label><input type="number" id="cmin" inputmode="decimal"></div>
    <div id="result"></div>
    <p class="field-value" style="margin-top:10px;">Target 400–600 mg·hr/L for most serious MRSA infections (2020 ASHP/IDSA consensus). &lt;400 = likely subtherapeutic; &gt;600 = increased nephrotoxicity risk.</p>
  </div>`;
  ['dose','tinf','tau','cmax','cmin'].forEach(id=>c.querySelector('#'+id).addEventListener('input', calc));
  function calc(){
    const tinf = parseFloat(c.querySelector('#tinf').value);
    const tau = parseFloat(c.querySelector('#tau').value);
    const cmax = parseFloat(c.querySelector('#cmax').value);
    const cmin = parseFloat(c.querySelector('#cmin').value);
    const res = c.querySelector('#result');
    if(!tinf||!tau||!cmax||!cmin){ res.innerHTML=''; return; }
    const ke = Math.log(cmax/cmin)/(tau-tinf);
    const aucInf = ((cmax+cmin)/2)*tinf;
    const aucElim = (cmax-cmin)/ke;
    const aucTau = aucInf + aucElim;
    const auc24 = aucTau*(24/tau);
    let flag = auc24<400 ? 'Likely subtherapeutic' : (auc24>600 ? 'Increased nephrotoxicity risk' : 'Within typical target range');
    res.innerHTML = `<div class="calc-result"><div class="rlabel">Estimated AUC₂₄</div><div class="rvalue">${auc24.toFixed(0)} mg·hr/L</div>
    <div class="rnote">${flag}. Elimination rate constant (ke) ≈ ${ke.toFixed(4)} /hr.</div></div>`;
  }
};

/* ---------------- CURB-65 ---------------- */
RENDERERS['calc-curb65'] = function(c){
  c.innerHTML = `<h1 class="pagetitle">CURB-65 (Pneumonia Severity)</h1>
  <div class="card" id="chk">
    ${['Confusion (new disorientation to person, place, or time)','Urea &gt;7 mmol/L (BUN &gt;19 mg/dL)','Respiratory rate ≥30/min','Blood pressure — SBP &lt;90 or DBP ≤60 mmHg','Age ≥65 years'].map((t,i)=>`
    <label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:12px;font-size:13.5px;color:#28394C;">
      <input type="checkbox" data-w="1" id="q${i}" style="margin-top:3px;"> <span>${t}</span>
    </label>`).join('')}
    <div id="result"></div>
  </div>`;
  c.querySelectorAll('#chk input').forEach(x=>x.addEventListener('change', calc));
  function calc(){
    const score = [...c.querySelectorAll('#chk input')].filter(x=>x.checked).length;
    let note;
    if(score<=1) note='Low risk — likely suitable for outpatient treatment.';
    else if(score===2) note='Intermediate risk — consider hospital admission or close outpatient follow-up.';
    else note='High risk (3–5) — hospital admission indicated; consider ICU assessment if 4–5.';
    c.querySelector('#result').innerHTML = `<div class="calc-result"><div class="rlabel">CURB-65 Score</div><div class="rvalue">${score} / 5</div><div class="rnote">${note}</div></div>`;
  }
  calc();
};

/* ---------------- qSOFA ---------------- */
RENDERERS['calc-qsofa'] = function(c){
  c.innerHTML = `<h1 class="pagetitle">qSOFA (Quick SOFA)</h1>
  <div class="card" id="chk">
    ${['Respiratory rate ≥22/min','Altered mentation','Systolic BP ≤100 mmHg'].map((t,i)=>`
    <label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:12px;font-size:13.5px;color:#28394C;">
      <input type="checkbox" id="q${i}" style="margin-top:3px;"> <span>${t}</span>
    </label>`).join('')}
    <div id="result"></div>
    <p class="field-value" style="margin-top:6px;">Score ≥2 associated with worse outcomes — consider sepsis workup and escalation of care.</p>
  </div>`;
  c.querySelectorAll('#chk input').forEach(x=>x.addEventListener('change', calc));
  function calc(){
    const score = [...c.querySelectorAll('#chk input')].filter(x=>x.checked).length;
    c.querySelector('#result').innerHTML = `<div class="calc-result"><div class="rlabel">qSOFA Score</div><div class="rvalue">${score} / 3</div></div>`;
  }
  calc();
};

/* ---------------- Modified Centor (McIsaac) ---------------- */
RENDERERS['calc-centor'] = function(c){
  c.innerHTML = `<h1 class="pagetitle">Modified Centor Score (McIsaac)</h1><p class="pagesub">Strep pharyngitis.</p>
  <div class="card">
    ${['Tonsillar exudate or swelling','Tender/swollen anterior cervical lymph nodes','Fever (history of, &gt;38°C)','Absence of cough'].map((t,i)=>`
    <label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:12px;font-size:13.5px;color:#28394C;">
      <input type="checkbox" class="ck" id="q${i}" style="margin-top:3px;"> <span>${t} (+1)</span>
    </label>`).join('')}
    <div class="calc-field"><label>Age group</label>
      <select id="ageGrp">
        <option value="1">3–14 years (+1)</option>
        <option value="0" selected>15–44 years (0)</option>
        <option value="-1">≥45 years (−1)</option>
      </select>
    </div>
    <div id="result"></div>
  </div>`;
  c.querySelectorAll('.ck').forEach(x=>x.addEventListener('change', calc));
  c.querySelector('#ageGrp').addEventListener('change', calc);
  function calc(){
    const base = [...c.querySelectorAll('.ck')].filter(x=>x.checked).length;
    const ageAdj = parseInt(c.querySelector('#ageGrp').value);
    const score = base+ageAdj;
    let note;
    if(score<=0) note='Low risk — strep testing/antibiotics generally not indicated.';
    else if(score===1) note='Low-moderate risk.';
    else if(score<=3) note='Moderate risk — consider rapid strep test/culture.';
    else note='High risk — consider empiric treatment or testing per local protocol.';
    c.querySelector('#result').innerHTML = `<div class="calc-result"><div class="rlabel">Modified Centor Score</div><div class="rvalue">${score}</div><div class="rnote">${note}</div></div>`;
  }
  calc();
};

/* ---------------- Candida Score (ICU) ---------------- */
RENDERERS['calc-candida-score'] = function(c){
  c.innerHTML = `<h1 class="pagetitle">Candida Score (ICU)</h1>
  <div class="card">
    <label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:12px;font-size:13.5px;color:#28394C;"><input type="checkbox" class="ck" data-w="1" style="margin-top:3px;"> <span>Multifocal Candida colonization (+1)</span></label>
    <label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:12px;font-size:13.5px;color:#28394C;"><input type="checkbox" class="ck" data-w="1" style="margin-top:3px;"> <span>Surgery (+1)</span></label>
    <label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:12px;font-size:13.5px;color:#28394C;"><input type="checkbox" class="ck" data-w="1" style="margin-top:3px;"> <span>Total parenteral nutrition (+1)</span></label>
    <label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:12px;font-size:13.5px;color:#28394C;"><input type="checkbox" class="ck" data-w="2" style="margin-top:3px;"> <span>Severe sepsis (+2)</span></label>
    <div id="result"></div>
    <p class="field-value" style="margin-top:6px;">Score ≥3 suggests increased risk of invasive candidiasis — consider empiric antifungal therapy in the right clinical context.</p>
  </div>`;
  c.querySelectorAll('.ck').forEach(x=>x.addEventListener('change', calc));
  function calc(){
    const score = [...c.querySelectorAll('.ck')].filter(x=>x.checked).reduce((s,x)=>s+parseInt(x.dataset.w),0);
    c.querySelector('#result').innerHTML = `<div class="calc-result"><div class="rlabel">Candida Score</div><div class="rvalue">${score}</div></div>`;
  }
  calc();
};

/* ---------------- NEWS2 ---------------- */
RENDERERS['calc-news2'] = function(c){
  c.innerHTML = `<h1 class="pagetitle">NEWS2 (National Early Warning Score 2)</h1>
  <div class="card">
    <div class="calc-field"><label>Respiratory rate (/min)</label><input type="number" id="rr" inputmode="decimal"></div>
    <div class="calc-field"><label>SpO₂ (%)</label><input type="number" id="spo2" inputmode="decimal"></div>
    <div class="calc-field"><label>On supplemental O₂?</label><select id="o2"><option value="0">Air</option><option value="1">Supplemental O₂</option></select></div>
    <div class="calc-field"><label>Systolic BP (mmHg)</label><input type="number" id="sbp" inputmode="decimal"></div>
    <div class="calc-field"><label>Pulse (/min)</label><input type="number" id="pulse" inputmode="decimal"></div>
    <div class="calc-field"><label>Consciousness</label><select id="avpu"><option value="0">Alert</option><option value="1">Confused/Voice/Pain/Unresponsive</option></select></div>
    <div class="calc-field"><label>Temperature (°C)</label><input type="number" id="temp" inputmode="decimal"></div>
    <div id="result"></div>
    <p class="field-value" style="margin-top:6px;">Uses Scale 1 (standard SpO₂ scale). For known hypercapnic COPD on target sats 88–92%, use clinical judgement/Scale 2 — not implemented here.</p>
  </div>`;
  ['rr','spo2','o2','sbp','pulse','avpu','temp'].forEach(id=>c.querySelector('#'+id).addEventListener('input', calc));
  function pRR(v){ if(v<=8) return 3; if(v<=11) return 1; if(v<=20) return 0; if(v<=24) return 2; return 3; }
  function pSpO2(v){ if(v<=91) return 3; if(v<=93) return 2; if(v<=95) return 1; return 0; }
  function pSBP(v){ if(v<=90) return 3; if(v<=100) return 2; if(v<=110) return 1; if(v<=219) return 0; return 3; }
  function pPulse(v){ if(v<=40) return 3; if(v<=50) return 1; if(v<=90) return 0; if(v<=110) return 1; if(v<=130) return 2; return 3; }
  function pTemp(v){ if(v<=35.0) return 3; if(v<=36.0) return 1; if(v<=38.0) return 0; if(v<=39.0) return 1; return 2; }
  function calc(){
    const rr=parseFloat(c.querySelector('#rr').value), spo2=parseFloat(c.querySelector('#spo2').value),
      o2=parseInt(c.querySelector('#o2').value), sbp=parseFloat(c.querySelector('#sbp').value),
      pulse=parseFloat(c.querySelector('#pulse').value), avpu=parseInt(c.querySelector('#avpu').value),
      temp=parseFloat(c.querySelector('#temp').value);
    const res = c.querySelector('#result');
    if([rr,spo2,sbp,pulse,temp].some(v=>isNaN(v))){ res.innerHTML=''; return; }
    const score = pRR(rr)+pSpO2(spo2)+(o2*2)+pSBP(sbp)+pPulse(pulse)+(avpu*3)+pTemp(temp);
    let note = score>=7 ? 'High risk — urgent clinical review.' : score>=5 ? 'Medium risk — urgent review.' : 'Low risk — routine monitoring.';
    res.innerHTML = `<div class="calc-result"><div class="rlabel">NEWS2 Score</div><div class="rvalue">${score}</div><div class="rnote">${note} Any single parameter scoring 3 warrants urgent review regardless of total.</div></div>`;
  }
};

/* ---------------- PSI/PORT ---------------- */
RENDERERS['calc-psi'] = function(c){
  c.innerHTML = `<h1 class="pagetitle">PSI / PORT Score (Pneumonia Severity Index)</h1>
  <div class="card">
    <div class="seg" id="sexSeg"><button class="active" data-v="male">Male</button><button data-v="female">Female</button></div>
    <div class="calc-field"><label>Age (years)</label><input type="number" id="age" inputmode="numeric"></div>
    <h3>Comorbidities</h3>
    ${['Neoplastic disease (+30)','Liver disease (+20)','Congestive heart failure (+10)','Cerebrovascular disease (+10)','Renal disease (+10)'].map((t,i)=>`<label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;font-size:13.5px;color:#28394C;"><input type="checkbox" class="ck" data-w="${[30,20,10,10,10][i]}" style="margin-top:3px;"> <span>${t}</span></label>`).join('')}
    <h3>Exam findings</h3>
    ${['Nursing home resident (+10)','Altered mental status (+20)','Respiratory rate ≥30/min (+20)','Systolic BP &lt;90 mmHg (+20)','Temp &lt;35°C or ≥40°C (+15)','Pulse ≥125/min (+10)'].map((t,i)=>`<label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;font-size:13.5px;color:#28394C;"><input type="checkbox" class="ck" data-w="${[10,20,20,20,15,10][i]}" style="margin-top:3px;"> <span>${t}</span></label>`).join('')}
    <h3>Labs / imaging</h3>
    ${['Arterial pH &lt;7.35 (+30)','BUN ≥30 mg/dL / Urea ≥10.7 mmol/L (+20)','Sodium &lt;130 mmol/L (+20)','Glucose ≥250 mg/dL / ≥13.9 mmol/L (+10)','Hematocrit &lt;30% (+10)','PaO₂ &lt;60 mmHg or SpO₂ &lt;90% (+10)','Pleural effusion (+10)'].map((t,i)=>`<label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;font-size:13.5px;color:#28394C;"><input type="checkbox" class="ck" data-w="${[30,20,20,10,10,10,10][i]}" style="margin-top:3px;"> <span>${t}</span></label>`).join('')}
    <div id="result"></div>
  </div>`;
  let sex='male';
  c.querySelector('#sexSeg').querySelectorAll('button').forEach(b=>b.onclick=()=>{c.querySelector('#sexSeg').querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active');sex=b.dataset.v;calc();});
  c.querySelector('#age').addEventListener('input', calc);
  c.querySelectorAll('.ck').forEach(x=>x.addEventListener('change', calc));
  function calc(){
    const age = parseFloat(c.querySelector('#age').value);
    const res = c.querySelector('#result');
    if(!age){ res.innerHTML=''; return; }
    let pts = sex==='male' ? age : age-10;
    pts += [...c.querySelectorAll('.ck')].filter(x=>x.checked).reduce((s,x)=>s+parseInt(x.dataset.w),0);
    let cls, riskLabel;
    if(pts<=70){ cls='II'; riskLabel='Low risk'; }
    else if(pts<=90){ cls='III'; riskLabel='Low-moderate risk'; }
    else if(pts<=130){ cls='IV'; riskLabel='Moderate-high risk'; }
    else { cls='V'; riskLabel='High risk'; }
    res.innerHTML = `<div class="calc-result"><div class="rlabel">PSI Points</div><div class="rvalue">${pts.toFixed(0)} — Class ${cls}</div><div class="rnote">${riskLabel}. Class I (not point-based) generally applies to patients &lt;50 years with no listed comorbidities and normal vital signs — use clinical judgement in that scenario.</div></div>`;
  }
};

/* ---------------- Child-Pugh ---------------- */
RENDERERS['calc-childpugh'] = function(c){
  c.innerHTML = `<h1 class="pagetitle">Child-Pugh Score (Hepatic Impairment)</h1>
  <div class="card">
    <div class="calc-field"><label>Bilirubin (µmol/L)</label><select id="bili"><option value="1">&lt; 34</option><option value="2">34–50</option><option value="3">&gt; 50</option></select></div>
    <div class="calc-field"><label>Albumin (g/L)</label><select id="alb"><option value="1">&gt; 35</option><option value="2">28–35</option><option value="3">&lt; 28</option></select></div>
    <div class="calc-field"><label>INR</label><select id="inr"><option value="1">&lt; 1.7</option><option value="2">1.7–2.3</option><option value="3">&gt; 2.3</option></select></div>
    <div class="calc-field"><label>Ascites</label><select id="asc"><option value="1">None</option><option value="2">Mild</option><option value="3">Moderate–Severe</option></select></div>
    <div class="calc-field"><label>Encephalopathy</label><select id="enc"><option value="1">None</option><option value="2">Grade 1–2</option><option value="3">Grade 3–4</option></select></div>
    <div id="result"></div>
  </div>`;
  ['bili','alb','inr','asc','enc'].forEach(id=>c.querySelector('#'+id).addEventListener('change', calc));
  function calc(){
    const score = ['bili','alb','inr','asc','enc'].reduce((s,id)=>s+parseInt(c.querySelector('#'+id).value),0);
    let cls = score<=6?'A':score<=9?'B':'C';
    let note = cls==='A'?'Well compensated.':cls==='B'?'Significant functional compromise.':'Decompensated — dose-reduce or avoid hepatically-cleared antimicrobials; consult pharmacy.';
    c.querySelector('#result').innerHTML = `<div class="calc-result"><div class="rlabel">Child-Pugh Score</div><div class="rvalue">${score} — Class ${cls}</div><div class="rnote">${note}</div></div>`;
  }
  calc();
};

/* ---------------- MELD ---------------- */
RENDERERS['calc-meld'] = function(c){
  c.innerHTML = `<h1 class="pagetitle">MELD Score</h1>
  <p class="pagesub">Classic/original MELD, shown for reference. UNOS now uses MELD-Na / MELD 3.0 for transplant allocation — use this as a general severity estimate only.</p>
  <div class="card">
    <div class="calc-field"><label>Bilirubin (µmol/L)</label><input type="number" id="bili" inputmode="decimal"></div>
    <div class="calc-field"><label>INR</label><input type="number" id="inr" inputmode="decimal"></div>
    <div class="calc-field"><label>Creatinine (µmol/L)</label><input type="number" id="cr" inputmode="decimal"></div>
    <div class="calc-field"><label><input type="checkbox" id="dialysis"> Dialysis ≥2× in past week, or CVVHD ≥24h</label></div>
    <div id="result"></div>
  </div>`;
  ['bili','inr','cr','dialysis'].forEach(id=>c.querySelector('#'+id).addEventListener('input', calc));
  function calc(){
    let bili = parseFloat(c.querySelector('#bili').value)/17.1;
    let inr = parseFloat(c.querySelector('#inr').value);
    let cr = parseFloat(c.querySelector('#cr').value)/88.4;
    const dialysis = c.querySelector('#dialysis').checked;
    const res = c.querySelector('#result');
    if(isNaN(bili)||isNaN(inr)||isNaN(cr)){ res.innerHTML=''; return; }
    if(dialysis) cr = 4.0;
    bili = Math.max(bili,1); inr = Math.max(inr,1); cr = Math.max(Math.min(cr,4.0),1);
    let meld = 3.78*Math.log(bili) + 11.2*Math.log(inr) + 9.57*Math.log(cr) + 6.43;
    meld = Math.round(Math.max(6, Math.min(40, meld)));
    res.innerHTML = `<div class="calc-result"><div class="rlabel">MELD Score</div><div class="rvalue">${meld}</div></div>`;
  }
};

/* ---------------- Duke Criteria ---------------- */
RENDERERS['calc-duke'] = function(c){
  c.innerHTML = `<h1 class="pagetitle">Modified Duke Criteria — Infective Endocarditis</h1>
  <div class="card">
    <h3>Major criteria</h3>
    <label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;font-size:13.5px;color:#28394C;"><input type="checkbox" class="maj" style="margin-top:3px;"> <span>Positive blood cultures for IE (typical organism from 2 separate cultures, persistently positive cultures, or single positive for Coxiella burnetii)</span></label>
    <label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;font-size:13.5px;color:#28394C;"><input type="checkbox" class="maj" style="margin-top:3px;"> <span>Evidence of endocardial involvement (positive echocardiogram — vegetation, abscess, new partial dehiscence of prosthetic valve — or new valvular regurgitation)</span></label>
    <h3>Minor criteria</h3>
    <label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;font-size:13.5px;color:#28394C;"><input type="checkbox" class="min" style="margin-top:3px;"> <span>Predisposing heart condition or IV drug use</span></label>
    <label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;font-size:13.5px;color:#28394C;"><input type="checkbox" class="min" style="margin-top:3px;"> <span>Fever ≥38°C</span></label>
    <label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;font-size:13.5px;color:#28394C;"><input type="checkbox" class="min" style="margin-top:3px;"> <span>Vascular phenomena (arterial emboli, septic pulmonary infarcts, mycotic aneurysm, intracranial hemorrhage, conjunctival hemorrhages, Janeway lesions)</span></label>
    <label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;font-size:13.5px;color:#28394C;"><input type="checkbox" class="min" style="margin-top:3px;"> <span>Immunologic phenomena (glomerulonephritis, Osler nodes, Roth spots, rheumatoid factor)</span></label>
    <label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;font-size:13.5px;color:#28394C;"><input type="checkbox" class="min" style="margin-top:3px;"> <span>Microbiological evidence not meeting a major criterion</span></label>
    <div id="result"></div>
  </div>
  <div class="flagnote">Definite IE: 2 major, or 1 major + 3 minor, or 5 minor. Possible IE: 1 major + 1 minor, or 3 minor. Otherwise: does not meet criteria for possible/definite IE (does not rule out IE — correlate clinically).</div>`;
  c.querySelectorAll('.maj,.min').forEach(x=>x.addEventListener('change', calc));
  function calc(){
    const maj = [...c.querySelectorAll('.maj')].filter(x=>x.checked).length;
    const min = [...c.querySelectorAll('.min')].filter(x=>x.checked).length;
    let interp;
    if(maj>=2 || (maj>=1&&min>=3) || min>=5) interp='Definite IE';
    else if((maj>=1&&min>=1) || min>=3) interp='Possible IE';
    else interp='Does not meet criteria for possible/definite IE';
    c.querySelector('#result').innerHTML = `<div class="calc-result"><div class="rlabel">Interpretation</div><div class="rvalue">${interp}</div><div class="rnote">${maj} major, ${min} minor criteria met.</div></div>`;
  }
  calc();
};

/* ---------------- Drug Interaction Checker ---------------- */
let selectedDrugs = [];
RENDERERS.interactions = function(c){
  c.innerHTML = `<h1 class="pagetitle">Drug Interaction Checker</h1>
  <div class="flagnote">Scoped to antimicrobials in SAUC's policy plus a handful of common external medications (warfarin, statins, etc.). This is <b>not exhaustive</b> and does not replace a full drug-interaction reference or pharmacist review.</div>
  <div class="addbar">
    <select id="addSel"></select>
    <button id="addBtn">Add</button>
  </div>
  <div class="chipzone" id="chips"></div>
  <div id="results"></div>`;
  const sel = c.querySelector('#addSel');
  DRUG_LIST_INTERACTIONS.forEach(d=>{ const o=document.createElement('option'); o.value=d; o.textContent=d; sel.appendChild(o); });
  c.querySelector('#addBtn').onclick = ()=>{
    const v = sel.value;
    if(v && !selectedDrugs.includes(v)){ selectedDrugs.push(v); renderChips(); }
  };
  renderChips();
  function renderChips(){
    const chipZone = c.querySelector('#chips');
    chipZone.innerHTML = selectedDrugs.map(d=>`<span class="chip">${esc(d)}<button data-d="${esc(d)}">✕</button></span>`).join('');
    chipZone.querySelectorAll('button').forEach(b=>b.onclick=()=>{
      selectedDrugs = selectedDrugs.filter(x=>x!==b.dataset.d);
      renderChips();
    });
    checkAll();
  }
  function checkAll(){
    const res = c.querySelector('#results');
    if(selectedDrugs.length<2){ res.innerHTML = `<div class="empty-state"><div class="big">⚠️</div><p>Add 2 or more medications to check pairwise interactions.</p></div>`; return; }
    let hits = [];
    for(let i=0;i<selectedDrugs.length;i++){
      for(let j=i+1;j<selectedDrugs.length;j++){
        const a=selectedDrugs[i], b=selectedDrugs[j];
        const found = INTERACTIONS.find(x=>(x.pair[0]===a&&x.pair[1]===b)||(x.pair[0]===b&&x.pair[1]===a));
        if(found) hits.push({a,b,...found});
      }
    }
    if(hits.length===0){ res.innerHTML = `<div class="empty-state"><div class="big">✅</div><p>No known interactions found in this scoped checker for the selected combination. This does not guarantee safety — consult a full reference.</p></div>`; return; }
    res.innerHTML = hits.map(h=>`<div class="card interaction-hit ${h.sev==='major'?'':h.sev==='moderate'?'moderate':'moderate'}">
      <h2>${esc(h.a)} + ${esc(h.b)}</h2>
      <span class="badge ${h.sev==='major'?'reserve':h.sev==='moderate'?'watch':'na'}" style="margin-bottom:8px;display:inline-block;">${h.sev.toUpperCase()}</span>
      <p>${esc(h.note)}</p>
    </div>`).join('');
  }
};

/* ---------------- Antimicrobial Information ---------------- */
RENDERERS['drugs-list'] = function(c){
  c.innerHTML = `<h1 class="pagetitle">Antimicrobial Information</h1>
  <input class="searchbox" id="search" placeholder="Search drug name or class…">
  <div id="list"></div>`;
  const list = c.querySelector('#list');
  function draw(filter){
    const f = (filter||'').toLowerCase();
    const items = DRUGS.filter(d=>d.n.toLowerCase().includes(f)||d.cls.toLowerCase().includes(f));
    const byClass = {};
    items.forEach(d=>{ (byClass[d.cls]=byClass[d.cls]||[]).push(d); });
    let html='';
    Object.keys(byClass).forEach(cls=>{
      html += `<h3 style="margin:18px 0 8px;color:var(--navy-ink);font-size:12px;text-transform:uppercase;letter-spacing:.03em;">${esc(cls)}</h3>`;
      byClass[cls].forEach(d=>{
        html += `<button class="rowlink" data-n="${esc(d.n)}"><div class="rt">${esc(d.n)}</div>
        ${awareBadge(d.aware)}</button>`;
      });
    });
    list.innerHTML = html || `<div class="empty-state"><div class="big">🔍</div><p>No drugs match "${esc(filter)}".</p></div>`;
    list.querySelectorAll('.rowlink').forEach(b=>b.onclick=()=>push({type:'drug-detail', name:b.dataset.n, title:'Drug Info', crumb:b.dataset.n}));
  }
  draw('');
  c.querySelector('#search').addEventListener('input', e=>draw(e.target.value));
};
RENDERERS['drug-detail'] = function(c, view){
  const d = DRUGS.find(x=>x.n===view.name);
  if(!d){ c.innerHTML = `<div class="empty-state">Drug not found.</div>`; return; }
  c.innerHTML = `<div class="card accent">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
      <h2 style="margin:0;">${esc(d.n)} ${awareBadge(d.aware)}</h2>
      ${favButtonHtml(view)}
    </div>
    <div class="field-label">Class</div><div class="field-value">${esc(d.cls)}</div>
    <div class="field-label">Bactericidal / Bacteriostatic</div><div class="field-value">${esc(d.bs)}</div>
    <div class="field-label">PK/PD index</div><div class="field-value">${esc(d.pkpd)}</div>
    <div class="field-label">Adult dose</div><div class="dosebox">${esc(d.adult)}</div>
    <div class="field-label">Pediatric dose</div><div class="field-value">${esc(d.ped)}</div>
    <div class="field-label">Renal adjustment</div><div class="field-value">${esc(d.renal)}</div>
    <div class="field-label">Hepatic adjustment</div><div class="field-value">${esc(d.hep)}</div>
    <div class="field-label">TDM</div><div class="field-value">${esc(d.tdm)}</div>
    <div class="field-label">Side effects / Monitoring</div><div class="field-value">${esc(d.se)}</div>
    ${d.note ? `<div class="remarknote"><b>Remarks:</b><br>${esc(d.note)}</div>` : ''}
  </div>`;
  wireFavButton(c, view);
};

/* ---------------- initial render ---------------- */
render();
