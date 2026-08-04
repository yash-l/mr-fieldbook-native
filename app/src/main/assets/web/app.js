(() => {
  'use strict';

  const STORE_KEY = 'mr-daily-auto-v3';
  const APP_VERSION = 7;
  const METRICS = [
    ['calls', 'Calls'],
    ['inputs', 'Input Distributed'],
    ['basket', 'Basket'],
    ['towel', 'Towel'],
    ['conversation', 'Conversations'],
    ['newAvailability', 'New Chemist Availability'],
    ['pobValue', 'POB Value']
  ];
  const BUNDLED_FILES = [
    'seed/MY Z & NICU Covering July.26.xlsx',
    'seed/Lost Prescrber rapid action & Follow up.xlsx',
    'seed/Kunjan compilation july26.xlsx',
    'seed/GUJ_SALES.xls'
  ];

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const now = () => new Date();
  const pad = n => String(n).padStart(2, '0');
  const localISODate = (d = now()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const localISODateTime = (d = now()) => `${localISODate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const monthKey = date => String(date || localISODate()).slice(0, 7);
  const uid = prefix => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();
  const norm = v => clean(v).toLowerCase().replace(/\b(dr|doctor|mr|mrs|ms|md)\.?\b/g, '').replace(/[^a-z0-9]+/g, '');
  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const prettyDate = v => {
    if (!v) return '—';
    const d = new Date(String(v).length === 10 ? `${v}T00:00:00` : v);
    return Number.isNaN(d.getTime()) ? clean(v) : d.toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'});
  };
  const prettyTime = v => {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'});
  };
  const initials = name => clean(name).split(' ').filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || 'MR';
  const doctorHospital = doctor => clean(doctor?.hospital || doctor?.clinic || doctor?.hospitalName);
  const doctorDisplayName = doctor => doctor ? [clean(doctor.name), doctorHospital(doctor)].filter(Boolean).join(' — ') : '';
  const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const DAY_ALIASES = {sun:0,sunday:0,mon:1,monday:1,tue:2,tues:2,tuesday:2,wed:3,wednesday:3,thu:4,thur:4,thurs:4,thursday:4,fri:5,friday:5,sat:6,saturday:6};
  function normalizeMeetingDays(value) {
    if (Array.isArray(value)) return [...new Set(value.map(Number).filter(x=>Number.isInteger(x)&&x>=0&&x<=6))].sort((a,b)=>a-b);
    const raw=clean(value).toLowerCase(); if(!raw)return [];
    if(/mon(day)?\s*[-–]\s*sat(urday)?/.test(raw))return [1,2,3,4,5,6];
    if(/mon(day)?\s*[-–]\s*fri(day)?/.test(raw))return [1,2,3,4,5];
    if(/every\s*day|all\s*days|daily/.test(raw))return [0,1,2,3,4,5,6];
    return [...new Set(raw.split(/[^a-z0-9]+/).map(x=>DAY_ALIASES[x]).filter(x=>x!==undefined))].sort((a,b)=>a-b);
  }
  function normalizeTime(value) {
    let raw=clean(value); if(!raw)return '';
    const ap=raw.match(/^(\d{1,2})(?::(\d{2}))?\s*([AP]M)$/i);
    if(ap){let h=Number(ap[1])%12;if(ap[3].toUpperCase()==='PM')h+=12;return `${pad(h)}:${pad(Number(ap[2]||0))}`;}
    const h24=raw.match(/^(\d{1,2})(?::(\d{2}))?/);
    if(h24){const h=Number(h24[1]),m=Number(h24[2]||0);if(h>=0&&h<24&&m>=0&&m<60)return `${pad(h)}:${pad(m)}`;}
    return '';
  }
  const timeMinutes=value=>{const t=normalizeTime(value);if(!t)return null;const [h,m]=t.split(':').map(Number);return h*60+m;};
  const timeLabel=value=>{const t=normalizeTime(value);if(!t)return '';const [h,m]=t.split(':').map(Number);const d=new Date(2000,0,1,h,m);return d.toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'});};
  function doctorMeetingSlots(doctor){
    if(!doctor)return [];
    return [[doctor.meetingFrom,doctor.meetingTo],[doctor.meetingFrom2,doctor.meetingTo2]].map(([from,to])=>({from:normalizeTime(from),to:normalizeTime(to)})).filter(x=>x.from&&x.to);
  }
  function doctorMeetingTiming(doctor){
    const days=normalizeMeetingDays(doctor?.meetingDays),slots=doctorMeetingSlots(doctor);
    if(!days.length||!slots.length)return '';
    const dayText=days.length===7?'Every day':days.join(',')==='1,2,3,4,5,6'?'Mon–Sat':days.join(',')==='1,2,3,4,5'?'Mon–Fri':days.map(x=>DAY_NAMES[x]).join(', ');
    return `${dayText} • ${slots.map(x=>`${timeLabel(x.from)}–${timeLabel(x.to)}`).join(' / ')}`;
  }
  function doctorMeetingStatus(doctor,at=now()){
    const days=normalizeMeetingDays(doctor?.meetingDays),slots=doctorMeetingSlots(doctor);
    if(!days.length||!slots.length)return {state:'unset',label:'Timing not set',detail:''};
    const current=at.getHours()*60+at.getMinutes();
    if(days.includes(at.getDay())){
      const active=slots.find(x=>current>=timeMinutes(x.from)&&current<=timeMinutes(x.to));
      if(active)return {state:'available',label:'Available now',detail:`Until ${timeLabel(active.to)}`};
    }
    for(let offset=0;offset<=7;offset++){
      const d=new Date(at);d.setDate(d.getDate()+offset);const day=d.getDay();if(!days.includes(day))continue;
      for(const slot of slots){const start=timeMinutes(slot.from);if(offset===0&&start<=current)continue;const dayText=offset===0?'Today':offset===1?'Tomorrow':DAY_NAMES[day];return {state:'upcoming',label:`${dayText} ${timeLabel(slot.from)}`,detail:`${timeLabel(slot.from)}–${timeLabel(slot.to)}`};}
    }
    return {state:'scheduled',label:'Scheduled',detail:doctorMeetingTiming(doctor)};
  }
  const metricBlank = () => ({calls:0, inputs:0, basket:0, towel:0, conversation:0, newAvailability:0, pobValue:0});
  const sumInto = (out, row) => METRICS.forEach(([k]) => out[k] += num(row[k]));
  const formatMetric = (key, value) => key === 'pobValue' ? `₹${num(value).toLocaleString('en-IN', {maximumFractionDigits:2})}` : num(value).toLocaleString('en-IN', {maximumFractionDigits:2});
  const empty = text => `<div class="empty-state"><span>•</span><p>${esc(text)}</p></div>`;
  const statusLabel = s => s === 'prescribed' ? 'Prescribed' : s === 'not_prescribed' ? 'Not prescribed' : 'No update';
  const statusClass = s => s === 'prescribed' ? 'good' : s === 'not_prescribed' ? 'bad' : '';

  function makeDefaultState() {
    const today = localISODate();
    return {
      version: APP_VERSION,
      profile: {
        tmName: 'Olakiya Vishal',
        hq: 'Rajkot',
        joinWorkWith: 'IND',
        companyDivision: 'FDC Nutrica',
        products: 'MumMum 1, MumMum 2, Simyl MCT, Zefrich, Zefrich HP'
      },
      doctors: [],
      chemists: [],
      products: [],
      visits: [{
        id: uid('log'), date: `${today}T10:00`, entityType: 'general', entityId: '', entityName: 'Starting daily report',
        calls: 12, inputs: 0, basket: 0, towel: 0, conversation: 0, newAvailability: 0, pobValue: 0,
        notes: 'Starting value supplied for today.', productStatuses: {}, followUpDate: '', createdAt: new Date().toISOString()
      }],
      opening: {monthKey: monthKey(today), calls:164, inputs:0, basket:0, towel:0, conversation:0, newAvailability:0, pobValue:0},
      imports: [],
      settings: {bundledImportAttempted:false, embeddedSeedLoaded:false, pinHash:'', installedHintSeen:false}
    };
  }

  function migrateState(raw) {
    const fresh = makeDefaultState();
    const out = {
      ...fresh,
      ...(raw || {}),
      version: APP_VERSION,
      profile: {...fresh.profile, ...((raw && raw.profile) || {})},
      opening: {...fresh.opening, ...((raw && raw.opening) || {})},
      settings: {...fresh.settings, ...((raw && raw.settings) || {})},
      doctors: Array.isArray(raw?.doctors) ? raw.doctors : [],
      chemists: Array.isArray(raw?.chemists) ? raw.chemists : [],
      products: Array.isArray(raw?.products) ? raw.products : [],
      visits: Array.isArray(raw?.visits) ? raw.visits : [],
      imports: Array.isArray(raw?.imports) ? raw.imports : []
    };
    out.doctors.forEach(d => {
      if (!d.id) d.id = uid('dr');
      d.name = clean(d.name);
      d.hospital = doctorHospital(d);
      d.address = clean(d.address);
      d.area = clean(d.area || d.hq);
      d.meetingDays = normalizeMeetingDays(d.meetingDays);
      d.meetingFrom = normalizeTime(d.meetingFrom); d.meetingTo = normalizeTime(d.meetingTo);
      d.meetingFrom2 = normalizeTime(d.meetingFrom2); d.meetingTo2 = normalizeTime(d.meetingTo2);
      if (!d.linkedChemistId && d.chemistId) d.linkedChemistId = d.chemistId;
    });
    out.chemists.forEach(c => {
      if (!c.id) c.id = uid('ch');
      c.name = clean(c.name);
      c.address = clean(c.address);
      c.area = clean(c.area || c.hq);
    });
    out.visits.forEach(v => {
      if (!v.id) v.id = uid('log');
      if (!v.productStatuses || typeof v.productStatuses !== 'object') v.productStatuses = {};
      if (!v.doctorId && v.entityType === 'doctor') v.doctorId = v.entityId;
      if (!v.doctorName && v.entityType === 'doctor') v.doctorName = v.entityName;
      if (!v.doctorHospital && v.doctorId) v.doctorHospital = doctorHospital(out.doctors.find(d => d.id === v.doctorId));
      if (!v.latitude && v.location?.latitude) v.latitude = v.location.latitude;
      if (!v.longitude && v.location?.longitude) v.longitude = v.location.longitude;
    });
    return out;
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY));
      return parsed && typeof parsed === 'object' ? migrateState(parsed) : makeDefaultState();
    } catch (_) {
      return makeDefaultState();
    }
  }

  let state = loadState();
  let activePage = 'dashboard';
  let doctorFilter = 'all';
  let chemistFilter = 'all';
  let visitFilter = 'all';
  let deferredInstallPrompt = null;

  function saveState(render = true) {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    if (render) renderAll();
  }

  function focusProducts() {
    const fromProfile = clean(state.profile.products).split(',').map(clean).filter(Boolean);
    if (fromProfile.length) return [...new Set(fromProfile)].slice(0, 12);
    return state.products.map(p => clean(p.name)).filter(Boolean).slice(0, 12);
  }

  function doctorById(id) { return state.doctors.find(x => x.id === id); }
  function chemistById(id) { return state.chemists.find(x => x.id === id); }
  function linkedChemist(doctor) {
    if (!doctor) return null;
    return chemistById(doctor.linkedChemistId) || state.chemists.find(c => norm(c.name) === norm(doctor.chemistName));
  }
  function linkedDoctorCount(chemistId) { return state.doctors.filter(d => d.linkedChemistId === chemistId).length; }
  function rowsForDay(date = localISODate()) { return state.visits.filter(v => String(v.date || '').slice(0, 10) === date); }
  function statsForDay(date = localISODate()) { const out=metricBlank(); rowsForDay(date).forEach(v=>sumInto(out,v)); return out; }
  function statsForMonth(date = localISODate()) {
    const key = monthKey(date), out = metricBlank();
    if (state.opening.monthKey === key) sumInto(out, state.opening);
    state.visits.filter(v => monthKey(v.date) === key && String(v.date).slice(0,10) <= String(date).slice(0,10)).forEach(v => sumInto(out, v));
    return out;
  }
  function dueEntities() {
    const today=localISODate();
    return [
      ...state.doctors.filter(x=>x.nextFollowUp && x.nextFollowUp<=today).map(x=>({...x,type:'doctor'})),
      ...state.chemists.filter(x=>x.nextFollowUp && x.nextFollowUp<=today).map(x=>({...x,type:'chemist'}))
    ].sort((a,b)=>String(a.nextFollowUp).localeCompare(String(b.nextFollowUp)));
  }

  function getReportText(date = localISODate()) {
    const t=statsForDay(date), c=statsForMonth(date), p=state.profile;
    const v=k=>`${num(t[k]).toLocaleString('en-IN')}/${num(c[k]).toLocaleString('en-IN')}`;
    return [
      `HQ : ${p.hq || ''}`,
      `Name of TM - ${p.tmName || ''}`,
      `Join work with - ${p.joinWorkWith || ''}`,
      `Today Calls/Cum - ${v('calls')}`,
      `Input Distributed -${v('inputs')}`,
      `Basket Today/Cum -${v('basket')}`,
      `Towel Today/Cum -${v('towel')}`,
      `No of conversation Today/Cum: ${v('conversation')}`,
      `No new chemist product availability done Today/Cum:${v('newAvailability')}`,
      `Total POB value Today/Cum:${v('pobValue')}`
    ].join('\n');
  }

  function mapUrl(lat, lng, address='') {
    if (lat && lng) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
    const q=clean(address); return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : '';
  }
  function entityMapUrl(r) { return mapUrl(r.latitude, r.longitude, [r.address,r.area,r.hq].filter(Boolean).join(', ')); }
  function visitMapUrl(v) { return mapUrl(v.latitude, v.longitude); }

  function latestPairVisit(doctorId, chemistId='') {
    return state.visits
      .filter(v => v.doctorId===doctorId && (!chemistId || v.chemistId===chemistId))
      .sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0] || null;
  }
  function latestStatuses(doctorId, chemistId='') {
    const out={};
    state.visits
      .filter(v=>v.doctorId===doctorId && (!chemistId || v.chemistId===chemistId))
      .sort((a,b)=>String(a.date).localeCompare(String(b.date)))
      .forEach(v=>Object.entries(v.productStatuses||{}).forEach(([p,s])=>{if(s)out[p]=s;}));
    return out;
  }
  function statusCountsForChemist(chemistId) {
    const latest={};
    state.visits.filter(v=>v.chemistId===chemistId).sort((a,b)=>String(a.date).localeCompare(String(b.date))).forEach(v=>{
      Object.entries(v.productStatuses||{}).forEach(([p,s])=>{if(s)latest[`${v.doctorId||v.doctorName}|${p}`]=s;});
    });
    return Object.values(latest).reduce((a,s)=>{if(s==='prescribed')a.prescribed++;if(s==='not_prescribed')a.notPrescribed++;return a;},{prescribed:0,notPrescribed:0});
  }

  function renderAll() { renderHeader(); renderDashboard(); renderDoctors(); renderChemists(); renderVisits(); renderTools(); }
  function renderHeader() {
    $('#profileLine').textContent = `${state.profile.hq || 'My HQ'} • ${state.profile.tmName || 'TM'}`;
    const h=now().getHours();
    $('#greeting').textContent = h<12?'Good morning':h<17?'Good afternoon':'Good evening';
    $('#todayLabel').textContent = now().toLocaleDateString('en-IN',{weekday:'short',day:'2-digit',month:'short'}).toUpperCase();
    $('#routeLabel').textContent = 'Search doctor or hospital → see saved meeting timing → GPS + chemist auto-fill → save.';
  }
  function renderDashboard() {
    const today=localISODate(), t=statsForDay(today), c=statsForMonth(today);
    $('#reportPeriod').textContent=`Today / ${now().toLocaleDateString('en-IN',{month:'long'})} cumulative`;
    $('#reportKpis').innerHTML=METRICS.map(([k,label])=>`<div class="report-kpi"><small>${esc(label)}</small><strong>${esc(formatMetric(k,t[k]))} <span>/ ${esc(formatMetric(k,c[k]))}</span></strong></div>`).join('');
    $('#doctorCount').textContent=state.doctors.length;
    $('#chemistCount').textContent=state.chemists.length;
    $('#todayVisitCount').textContent=rowsForDay(today).filter(v=>v.doctorId||v.chemistId).length;
    const due=dueEntities(); $('#dueCount').textContent=due.length;
    const activities=rowsForDay(today).filter(v=>v.doctorId||v.chemistId).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,6);
    $('#todayActivityList').innerHTML=activities.length?activities.map(miniActivity).join(''):empty('No meeting logged today. Tap + to start.');
    $('#nextActionsList').innerHTML=due.length?due.slice(0,6).map(miniDue).join(''):empty('No follow-ups due.');
  }
  function miniActivity(v) {
    const prescribed=Object.values(v.productStatuses||{}).filter(x=>x==='prescribed').length;
    const notPrescribed=Object.values(v.productStatuses||{}).filter(x=>x==='not_prescribed').length;
    const parts=[v.chemistName, prescribed?`${prescribed} prescribed`:'', notPrescribed?`${notPrescribed} not prescribed`:'', v.latitude?'GPS saved':''].filter(Boolean);
    return `<button class="mini-card plain-button" data-action="view-visit" data-id="${esc(v.id)}"><span class="mini-icon">✓</span><span class="mini-copy"><h3>${esc([v.doctorName||v.entityName, v.doctorHospital].filter(Boolean).join(' — ')||'Meeting')}</h3><p>${esc(parts.join(' • ')||v.notes||'Meeting saved')}</p></span><span class="mini-side"><strong>${esc(prettyTime(v.date))}</strong><small>meeting</small></span></button>`;
  }
  function miniDue(x) {
    return `<button class="mini-card plain-button" data-action="view-record" data-type="${esc(x.type)}" data-id="${esc(x.id)}"><span class="mini-icon">◷</span><span class="mini-copy"><h3>${esc(x.type==='doctor'?doctorDisplayName(x):x.name)}</h3><p>${esc(x.type==='doctor'?(linkedChemist(x)?.name||'Chemist not linked'):(`${linkedDoctorCount(x.id)} doctors linked`))}</p></span><span class="mini-side"><strong>${esc(prettyDate(x.nextFollowUp))}</strong><small>due</small></span></button>`;
  }

  function renderDoctors() {
    const q=clean($('#doctorSearch')?.value).toLowerCase();
    const areas=[...new Set(state.doctors.map(d=>clean(d.area||d.hq)).filter(Boolean))].slice(0,5);
    const chips=['all','available','unlinked','due',...areas];
    $('#doctorChips').innerHTML=chips.map(c=>`<button class="chip ${doctorFilter===c?'active':''}" data-doctor-chip="${esc(c)}">${esc(c==='all'?'All':c==='available'?'Available now':c==='unlinked'?'No chemist':c==='due'?'Due':c)}</button>`).join('');
    let list=state.doctors.filter(d=>{
      const ch=linkedChemist(d);
      const hay=[d.name,doctorHospital(d),d.address,d.area,d.hq,ch?.name,d.notes].join(' ').toLowerCase();
      const matchQ=!q||hay.includes(q);
      const matchF=doctorFilter==='all'||(doctorFilter==='available'?doctorMeetingStatus(d).state==='available':doctorFilter==='unlinked'?!ch:doctorFilter==='due'?(d.nextFollowUp&&d.nextFollowUp<=localISODate()):clean(d.area||d.hq)===doctorFilter);
      return matchQ&&matchF;
    }).sort((a,b)=>{const rank=x=>doctorMeetingStatus(x).state==='available'?0:doctorMeetingStatus(x).state==='upcoming'?1:2;return rank(a)-rank(b)||a.name.localeCompare(b.name);});
    $('#doctorSubtitle').textContent=`${list.length} of ${state.doctors.length} records`;
    $('#doctorList').innerHTML=list.length?list.map(d=>recordCard(d,'doctor')).join(''):empty('No matching doctors. Import Excel or add one.');
  }
  function renderChemists() {
    const q=clean($('#chemistSearch')?.value).toLowerCase();
    const areas=[...new Set(state.chemists.map(c=>clean(c.area||c.hq)).filter(Boolean))].slice(0,5);
    const chips=['all','linked','feedback','due',...areas];
    $('#chemistChips').innerHTML=chips.map(c=>`<button class="chip ${chemistFilter===c?'active':''}" data-chemist-chip="${esc(c)}">${esc(c==='all'?'All':c==='linked'?'Linked doctors':c==='feedback'?'Feedback saved':c==='due'?'Due':c)}</button>`).join('');
    let list=state.chemists.filter(c=>{
      const count=linkedDoctorCount(c.id), fb=statusCountsForChemist(c.id);
      const hay=[c.name,c.address,c.area,c.hq,c.notes].join(' ').toLowerCase();
      const matchQ=!q||hay.includes(q);
      const matchF=chemistFilter==='all'||(chemistFilter==='linked'?count>0:chemistFilter==='feedback'?(fb.prescribed+fb.notPrescribed)>0:chemistFilter==='due'?(c.nextFollowUp&&c.nextFollowUp<=localISODate()):clean(c.area||c.hq)===chemistFilter);
      return matchQ&&matchF;
    }).sort((a,b)=>a.name.localeCompare(b.name));
    $('#chemistSubtitle').textContent=`${list.length} of ${state.chemists.length} records`;
    $('#chemistList').innerHTML=list.length?list.map(c=>recordCard(c,'chemist')).join(''):empty('No matching chemists. Import Excel or add one.');
  }
  function recordCard(r,type) {
    const isDoctor=type==='doctor';
    const ch=isDoctor?linkedChemist(r):null;
    const fb=!isDoctor?statusCountsForChemist(r.id):null;
    const map=entityMapUrl(r);
    const subtitle=isDoctor?[ch?.name||'Chemist not linked',r.area||r.hq].filter(Boolean).join(' • '):[`${linkedDoctorCount(r.id)} doctors`,r.area||r.hq].filter(Boolean).join(' • ');
    const timing=isDoctor?doctorMeetingStatus(r):null;
    const tags=isDoctor?
      [r.latitude&&'Clinic GPS',r.lastVisit&&`Last ${prettyDate(r.lastVisit)}`,r.nextFollowUp&&`Due ${prettyDate(r.nextFollowUp)}`].filter(Boolean):
      [fb.prescribed&&`${fb.prescribed} prescribed`,fb.notPrescribed&&`${fb.notPrescribed} not prescribed`,r.latitude&&'Shop GPS'].filter(Boolean);
    const timingTag=isDoctor&&timing.state!=='unset'?`<span class="tag timing ${timing.state==='available'?'good':''}">${esc(timing.label)}</span>`:'';
    return `<article class="record-card"><div class="record-top"><div class="avatar">${esc(initials(r.name))}</div><div class="record-title"><h3>${esc(isDoctor?doctorDisplayName(r):r.name)}</h3><p>${esc(subtitle||'Details not added')}</p></div></div>${r.address?`<p class="record-note">${esc(r.address).slice(0,180)}</p>`:''}<div class="tag-row">${timingTag}${tags.slice(0,4).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div><div class="record-actions three">${map?`<a href="${map}" target="_blank" rel="noopener">Map</a>`:`<button data-action="edit-record" data-type="${type}" data-id="${r.id}">Add location</button>`}<button class="primary-action" data-action="log-record" data-type="${type}" data-id="${r.id}">Meet</button><button data-action="view-record" data-type="${type}" data-id="${r.id}">View</button></div></article>`;
  }

  function renderVisits() {
    $$('#visitSegments button').forEach(b=>b.classList.toggle('active',b.dataset.visitFilter===visitFilter));
    let list=state.visits.filter(v=>v.doctorId||v.chemistId).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    if(visitFilter==='doctor') list=list.filter(v=>v.doctorId);
    if(visitFilter==='chemist') list=list.filter(v=>v.chemistId);
    if(visitFilter==='due') list=list.filter(v=>v.followUpDate&&v.followUpDate<=localISODate());
    $('#visitSubtitle').textContent=`${list.length} meeting logs`;
    $('#visitList').innerHTML=list.length?list.map(visitCard).join(''):empty('No meetings in this filter.');
  }
  function visitCard(v) {
    const statuses=Object.entries(v.productStatuses||{}).filter(([,s])=>s);
    const subtitle=[v.chemistName,v.latitude?'GPS saved':'',v.followUpDate?`Follow-up ${prettyDate(v.followUpDate)}`:''].filter(Boolean).join(' • ');
    return `<div class="timeline-item"><span class="timeline-dot"></span><article class="visit-card"><div class="visit-top"><h3>${esc([v.doctorName||v.entityName, v.doctorHospital].filter(Boolean).join(' — ')||'Meeting')}</h3><time>${esc(prettyDate(v.date))} ${esc(prettyTime(v.date))}</time></div><p>${esc(subtitle||v.notes||'Meeting saved')}</p><div class="tag-row">${statuses.slice(0,5).map(([p,s])=>`<span class="tag ${statusClass(s)}">${esc(p)}: ${esc(statusLabel(s))}</span>`).join('')}</div><div class="visit-footer"><small>${esc(v.notes||'')}</small><button data-action="view-visit" data-id="${esc(v.id)}">Details</button></div></article></div>`;
  }

  function renderTools() {
    const p=state.profile,f=$('#profileForm');
    if(f) ['tmName','hq','joinWorkWith','companyDivision','products'].forEach(k=>{if(f.elements[k]&&document.activeElement!==f.elements[k])f.elements[k].value=p[k]||'';});
    const month=monthKey(localISODate());
    if(state.opening.monthKey!==month) state.opening={monthKey:month,...metricBlank()};
    $('#openingFields').innerHTML=METRICS.map(([k,label])=>`<label><span>${esc(label)}</span><input name="${k}" type="number" step="${k==='pobValue'?'0.01':'1'}" min="0" value="${esc(state.opening[k]||0)}"></label>`).join('');
    $('#importHistory').innerHTML=state.imports.slice().reverse().slice(0,6).map(i=>`<div class="import-item"><div><strong>${esc(i.file)}</strong><small>${esc(i.summary)}</small></div><small>${esc(prettyDate(i.date))}</small></div>`).join('');
  }

  function navigate(page) {
    activePage=page;
    $$('.page').forEach(p=>p.classList.toggle('active',p.dataset.page===page));
    $$('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.nav===page));
    window.scrollTo({top:0,behavior:'smooth'});
    if(page==='doctors')renderDoctors(); if(page==='chemists')renderChemists(); if(page==='visits')renderVisits();
  }
  function openSheet(title,subtitle,body) {
    $('#sheetTitle').textContent=title; $('#sheetSubtitle').textContent=subtitle||''; $('#sheetBody').innerHTML=body;
    $('#sheetBackdrop').classList.remove('hidden'); $('#editorSheet').classList.remove('hidden'); document.body.style.overflow='hidden';
  }
  function closeSheet(){ $('#sheetBackdrop').classList.add('hidden');$('#editorSheet').classList.add('hidden');document.body.style.overflow=''; }
  function toast(text){const el=$('#toast');el.textContent=text;el.classList.remove('hidden');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.add('hidden'),2600);}

  function doctorOptions(selected='') {
    return `<option value="">Select doctor</option>${state.doctors.slice().sort((a,b)=>doctorDisplayName(a).localeCompare(doctorDisplayName(b))).map(d=>`<option value="${esc(d.id)}" ${d.id===selected?'selected':''}>${esc(doctorDisplayName(d))}${d.area?` • ${esc(d.area)}`:''}</option>`).join('')}`;
  }
  function chemistOptions(selected='') {
    return `<option value="">Select chemist</option>${state.chemists.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(c=>`<option value="${esc(c.id)}" ${c.id===selected?'selected':''}>${esc(c.name)}${c.area?` — ${esc(c.area)}`:''}</option>`).join('')}`;
  }
  function productRows(statuses={}) {
    const products=focusProducts();
    return products.length?products.map((p,i)=>{
      const s=statuses[p]||'';
      return `<div class="product-status-row" data-product="${esc(p)}"><div class="product-name"><strong>${esc(p)}</strong><small>Tap only if status changed</small></div><div class="status-buttons"><button type="button" data-status="prescribed" class="${s==='prescribed'?'selected prescribed':''}">✓ Prescribed</button><button type="button" data-status="not_prescribed" class="${s==='not_prescribed'?'selected not-prescribed':''}">× Not</button><button type="button" data-status="" class="clear-status ${!s?'selected':''}">—</button></div><input type="hidden" name="productStatus_${i}" value="${esc(s)}"></div>`;
    }).join(''):empty('Add focus products in Tools → Profile.');
  }
  function meetingSummaryHtml(doctor,chemist) {
    if(!doctor)return '<div class="meeting-summary muted-card">Search and choose a doctor. Stored chemist, address and meeting timing will appear here.</div>';
    const map=entityMapUrl(doctor),timing=doctorMeetingStatus(doctor),fullTiming=doctorMeetingTiming(doctor);
    return `<div class="meeting-summary"><div><small>DOCTOR / HOSPITAL</small><strong>${esc(doctorDisplayName(doctor))}</strong><p>${esc(doctor.address||doctor.area||'Address not added')}</p></div><div><small>UNDER CHEMIST</small><strong>${esc(chemist?.name||'Select once below')}</strong><p>${esc(chemist?.address||chemist?.area||'')}</p></div><div class="meeting-timing-cell ${esc(timing.state)}"><small>DOCTOR MEETING TIMING</small><strong>${esc(timing.label)}</strong><p>${esc(fullTiming||'Not set — edit doctor once to add days and time')}</p></div>${map?`<a href="${map}" target="_blank" rel="noopener">Open stored map</a>`:''}</div>`;
  }

  window.__mrNativeLocation=(prefix,ok,latitude,longitude,acc,error)=>{
    const status=$(`#${prefix}LocationStatus`),map=$(`#${prefix}LocationMap`),button=$(`#${prefix}FetchLocation`),lat=$(`#${prefix}Latitude`),lng=$(`#${prefix}Longitude`),accuracy=$(`#${prefix}Accuracy`),captured=$(`#${prefix}CapturedAt`);
    if(!status||!button)return;
    if(ok){lat.value=latitude;lng.value=longitude;accuracy.value=Math.round(acc||0);captured.value=new Date().toISOString();status.textContent=`GPS ready • accuracy about ${Math.round(acc||0)} m`;status.className='location-status success';map.href=mapUrl(latitude,longitude);map.classList.remove('hidden');button.textContent='Refresh GPS';}
    else{status.textContent=error||'GPS unavailable. Tap Retry.';status.className='location-status error';button.textContent='Retry GPS';}
    button.disabled=false;
  };

  function setupLocationCapture(prefix, auto=true) {
    const status=$(`#${prefix}LocationStatus`), map=$(`#${prefix}LocationMap`), button=$(`#${prefix}FetchLocation`);
    const lat=$(`#${prefix}Latitude`), lng=$(`#${prefix}Longitude`), accuracy=$(`#${prefix}Accuracy`), captured=$(`#${prefix}CapturedAt`);
    if(!status||!button)return;
    const run=()=>{
      status.textContent='Fetching current GPS…';status.className='location-status loading';button.disabled=true;
      if(window.AndroidBridge?.fetchLocation){window.AndroidBridge.fetchLocation(prefix);return;}
      if(!navigator.geolocation){status.textContent='Location is not supported on this phone.';status.className='location-status error';button.disabled=false;return;}
      navigator.geolocation.getCurrentPosition(pos=>{
        const {latitude,longitude,accuracy:acc}=pos.coords;
        lat.value=latitude;lng.value=longitude;accuracy.value=Math.round(acc||0);captured.value=new Date().toISOString();
        status.textContent=`GPS ready • accuracy about ${Math.round(acc||0)} m`;
        status.className='location-status success';
        map.href=mapUrl(latitude,longitude);map.classList.remove('hidden');button.textContent='Refresh GPS';button.disabled=false;
      },err=>{
        const message=err.code===1?'Location permission denied. Allow Location for Chrome/this app.':err.code===2?'GPS unavailable. Turn on phone Location.':'Location timed out. Tap Retry.';
        status.textContent=message;status.className='location-status error';button.textContent='Retry GPS';button.disabled=false;
      },{enableHighAccuracy:true,timeout:12000,maximumAge:30000});
    };
    button.addEventListener('click',run); if(auto)setTimeout(run,180);
  }

  function quickMeeting(doctorId='',chemistId='') {
    if(!state.doctors.length){openSheet('Add doctor first','Only name, hospital, address and chemist are needed.',`<div class="note-box">No doctor is available yet.</div><div class="button-row"><button class="btn primary" data-action="add-doctor">Add doctor</button></div>`);return;}
    const requestedChemist=chemistById(chemistId)||null;
    let doctor=doctorById(doctorId)||null;
    let chemist=requestedChemist||linkedChemist(doctor)||null;
    const remembered=doctor?latestStatuses(doctor.id,chemist?.id||''):{};
    openSheet('Log meeting','Search doctor or hospital; linked details fill automatically.',`
      <form id="meetingForm" class="sheet-form">
        <div class="lookup-label field-block"><span class="field-caption">Search doctor or hospital</span>
          <div class="lookup-field">
            <input id="meetingDoctorSearch" type="search" autocomplete="off" placeholder="Type doctor or hospital name…" value="${esc(doctorDisplayName(doctor))}">
            <input id="meetingDoctorId" name="doctorId" type="hidden" value="${esc(doctor?.id||'')}">
            <div id="meetingDoctorResults" class="search-results lookup-results hidden"></div>
          </div>
        </div>
        <label><span>Under chemist (auto-filled)</span><select name="chemistId">${chemistOptions(chemist?.id||'')}</select></label>
        <div id="meetingSummary">${meetingSummaryHtml(doctor,chemist)}</div>
        <div class="location-card">
          <div class="location-head"><div><strong>Visit GPS</strong><small id="meetLocationStatus" class="location-status loading">Preparing location…</small></div><button type="button" id="meetFetchLocation" class="btn secondary compact">Fetch GPS</button></div>
          <div class="location-actions"><a id="meetLocationMap" class="hidden" target="_blank" rel="noopener">View current map</a><label class="save-location-check"><input id="meetSaveLocation" type="checkbox" checked> Save GPS in this meeting</label></div>
          <input id="meetLatitude" type="hidden"><input id="meetLongitude" type="hidden"><input id="meetAccuracy" type="hidden"><input id="meetCapturedAt" type="hidden">
        </div>
        <div class="form-section-title"><h3>What chemist says</h3><p>Previous status is prefilled. Tap only what changed.</p></div>
        <div id="meetingProductRows" class="product-status-list">${productRows(remembered)}</div>
        <label><span>Short meeting note (optional)</span><textarea name="notes" rows="2" placeholder="Commitment or next action only"></textarea></label>
        <label><span>Follow-up date (optional)</span><input name="followUpDate" type="date"></label>
        <details class="more-fields"><summary>More daily report items (optional)</summary><div class="inline-metrics">${METRICS.filter(([k])=>k!=='calls').map(([k,label])=>`<label><span>${esc(label)}</span><input name="${k}" type="number" min="0" step="${k==='pobValue'?'0.01':'1'}" value="0"></label>`).join('')}</div></details>
        <input name="date" type="hidden" value="${esc(localISODateTime())}">
        <div class="sticky-save"><button type="submit" class="btn primary full">Save meeting + 1 call</button></div>
      </form>`);
    const form=$('#meetingForm'), doctorInput=$('#meetingDoctorSearch'), doctorIdInput=$('#meetingDoctorId'), doctorResults=$('#meetingDoctorResults'), chemistSelect=form.elements.chemistId;
    const doctorScore=(d,q)=>{
      if(!q)return d.lastVisit?20:0;
      const name=clean(d.name).toLowerCase(),hospital=doctorHospital(d).toLowerCase(),area=clean(d.area||d.hq).toLowerCase(),ch=clean(linkedChemist(d)?.name).toLowerCase();
      let score=0;
      if(name===q||hospital===q)score+=100;
      if(name.startsWith(q))score+=70;else if(name.includes(q))score+=45;
      if(hospital.startsWith(q))score+=65;else if(hospital.includes(q))score+=40;
      if(area.includes(q))score+=12;if(ch.includes(q))score+=10;
      return score;
    };
    const matchingDoctors=q=>{
      q=clean(q).toLowerCase();
      return state.doctors.map(d=>({d,score:doctorScore(d,q)})).filter(x=>!q||x.score>0).sort((a,b)=>b.score-a.score||String(b.d.lastVisit||'').localeCompare(String(a.d.lastVisit||''))||doctorDisplayName(a.d).localeCompare(doctorDisplayName(b.d))).slice(0,25).map(x=>x.d);
    };
    const showDoctorResults=()=>{
      const items=matchingDoctors(doctorInput.value);
      doctorResults.innerHTML=items.length?items.map(d=>{const lc=linkedChemist(d),timing=doctorMeetingStatus(d);return `<button type="button" class="search-result doctor-search-result" data-meeting-doctor-id="${esc(d.id)}"><strong>${esc(doctorDisplayName(d))}</strong><small><span class="result-timing ${esc(timing.state)}">${esc(timing.label)}</span> • ${esc([lc?.name,d.area||d.hq,d.address].filter(Boolean).join(' • ')||'No extra details')}</small></button>`;}).join(''):`<div class="lookup-empty">No doctor or hospital found.</div>`;
      doctorResults.classList.remove('hidden');
    };
    const refreshSummary=()=>{
      doctor=doctorById(doctorIdInput.value); chemist=chemistById(chemistSelect.value);
      $('#meetingSummary').innerHTML=meetingSummaryHtml(doctor,chemist);
    };
    const reloadProducts=()=>{
      const d=doctorById(doctorIdInput.value);
      if(!d){$('#meetingProductRows').innerHTML=empty('Search and choose a doctor first.');refreshSummary();return;}
      const linked=linkedChemist(d); if(linked) chemistSelect.value=linked.id;
      const c=chemistById(chemistSelect.value);
      $('#meetingProductRows').innerHTML=productRows(latestStatuses(d.id,c?.id||''));
      bindStatusButtons($('#meetingProductRows')); refreshSummary();
    };
    const chooseDoctor=id=>{
      const d=doctorById(id);if(!d)return;
      doctorIdInput.value=d.id;doctorInput.value=doctorDisplayName(d);doctorResults.classList.add('hidden');
      const lc=linkedChemist(d);if(lc)chemistSelect.value=lc.id;else if(requestedChemist)chemistSelect.value=requestedChemist.id;
      reloadProducts();
    };
    doctorInput.addEventListener('focus',showDoctorResults);
    doctorInput.addEventListener('input',()=>{doctorIdInput.value='';showDoctorResults();$('#meetingSummary').innerHTML=meetingSummaryHtml(null,chemistById(chemistSelect.value));});
    doctorResults.addEventListener('click',e=>{const b=e.target.closest('[data-meeting-doctor-id]');if(b)chooseDoctor(b.dataset.meetingDoctorId);});
    chemistSelect.addEventListener('change',reloadProducts);
    bindStatusButtons($('#meetingProductRows'));
    setupLocationCapture('meet',true);
    if(!doctor)setTimeout(()=>{doctorInput.focus();showDoctorResults();},120);
    form.addEventListener('submit',e=>{
      e.preventDefault();
      const fd=new FormData(form), d=doctorById(doctorIdInput.value), c=chemistById(fd.get('chemistId'));
      if(!d){toast('Search and choose a doctor or hospital.');doctorInput.focus();showDoctorResults();return;}
      const productStatuses={};
      $$('.product-status-row',form).forEach(row=>{const value=$('input[type="hidden"]',row).value;if(value)productStatuses[row.dataset.product]=value;});
      const saveGps=$('#meetSaveLocation').checked;
      const row={
        id:uid('log'),date:fd.get('date')||localISODateTime(),entityType:'doctor',entityId:d.id,entityName:d.name,
        doctorId:d.id,doctorName:d.name,doctorHospital:doctorHospital(d),chemistId:c?.id||'',chemistName:c?.name||'',productStatuses,
        notes:clean(fd.get('notes')),followUpDate:clean(fd.get('followUpDate')),calls:1,
        inputs:num(fd.get('inputs')),basket:num(fd.get('basket')),towel:num(fd.get('towel')),conversation:num(fd.get('conversation')),newAvailability:num(fd.get('newAvailability')),pobValue:num(fd.get('pobValue')),
        latitude:saveGps?num($('#meetLatitude').value)||'':'',longitude:saveGps?num($('#meetLongitude').value)||'':'',locationAccuracy:saveGps?num($('#meetAccuracy').value)||'':'',locationCapturedAt:saveGps?$('#meetCapturedAt').value:'',createdAt:new Date().toISOString()
      };
      state.visits.push(row);
      d.lastVisit=String(row.date).slice(0,10); d.updatedAt=new Date().toISOString();
      if(c){d.linkedChemistId=c.id;d.chemistName=c.name;c.lastVisit=d.lastVisit;c.updatedAt=new Date().toISOString();}
      if(row.followUpDate){d.nextFollowUp=row.followUpDate;if(c)c.nextFollowUp=row.followUpDate;}
      if(row.latitude&&row.longitude){d.latitude=row.latitude;d.longitude=row.longitude;d.locationAccuracy=row.locationAccuracy;d.locationCapturedAt=row.locationCapturedAt;if(c&&!c.latitude){c.latitude=row.latitude;c.longitude=row.longitude;c.locationAccuracy=row.locationAccuracy;c.locationCapturedAt=row.locationCapturedAt;}}
      saveState();closeSheet();toast('Meeting saved. Call and cumulative report updated.');
    });
  }

  function bindStatusButtons(root) {
    root?.addEventListener('click',e=>{
      const b=e.target.closest('[data-status]');if(!b)return;
      const row=b.closest('.product-status-row'), value=b.dataset.status, hidden=$('input[type="hidden"]',row);
      hidden.value=value;
      $$('[data-status]',row).forEach(x=>x.classList.remove('selected','prescribed','not-prescribed'));
      b.classList.add('selected');if(value==='prescribed')b.classList.add('prescribed');if(value==='not_prescribed')b.classList.add('not-prescribed');
    });
  }

  function editRecord(type,id='') {
    const arr=type==='doctor'?state.doctors:state.chemists, old=arr.find(x=>x.id===id)||{}, isDoctor=type==='doctor';
    const existingChemist=isDoctor?(linkedChemist(old)?.id||''):'';
    openSheet(`${id?'Edit':'Add'} ${isDoctor?'doctor':'chemist'}`,isDoctor?'Doctor name, hospital/clinic, address and linked chemist are saved once.':'Only shop name and location are needed.',`
      <form id="recordForm" class="sheet-form">
        <label><span>${isDoctor?'Doctor name':'Chemist name'}</span><input name="name" required value="${esc(old.name||'')}"></label>
        ${isDoctor?`<label><span>Hospital / clinic name</span><input name="hospital" value="${esc(doctorHospital(old))}" placeholder="Example: Sterling Hospital"></label><div class="lookup-label field-block"><span class="field-caption">Doctor under chemist</span><div class="lookup-field"><input id="recordChemistSearch" type="search" autocomplete="off" value="${esc(linkedChemist(old)?.name||'')}" placeholder="Search chemist name or area…"><input id="recordChemistId" name="linkedChemistId" type="hidden" value="${esc(existingChemist)}"><div id="recordChemistResults" class="search-results lookup-results hidden"></div></div></div><div class="schedule-card"><div class="form-section-title"><h3>Doctor meeting timing</h3><p>Save once. It appears during every search and meeting.</p></div><div class="schedule-quick"><button type="button" id="monSatDaysBtn">Mon–Sat</button><button type="button" id="allDaysBtn">Every day</button><button type="button" id="clearDaysBtn">Clear</button></div><div class="day-selector">${DAY_NAMES.map((day,i)=>`<label class="day-option"><input type="checkbox" name="meetingDays" value="${i}" ${normalizeMeetingDays(old.meetingDays).includes(i)?'checked':''}><span>${day}</span></label>`).join('')}</div><div class="field-grid two timing-grid"><label><span>First timing from</span><input name="meetingFrom" type="time" value="${esc(normalizeTime(old.meetingFrom))}"></label><label><span>First timing to</span><input name="meetingTo" type="time" value="${esc(normalizeTime(old.meetingTo))}"></label><label><span>Second timing from (optional)</span><input name="meetingFrom2" type="time" value="${esc(normalizeTime(old.meetingFrom2))}"></label><label><span>Second timing to (optional)</span><input name="meetingTo2" type="time" value="${esc(normalizeTime(old.meetingTo2))}"></label></div></div>`:''}
        <label><span>Address</span><textarea name="address" rows="2" placeholder="Clinic / shop full address">${esc(old.address||'')}</textarea></label>
        <label><span>Area / place</span><input name="area" value="${esc(old.area||old.hq||state.profile.hq||'')}"></label>
        <div class="location-card">
          <div class="location-head"><div><strong>${isDoctor?'Clinic':'Chemist'} GPS</strong><small id="recordLocationStatus" class="location-status">${old.latitude&&old.longitude?`Saved • ${esc(old.latitude)}, ${esc(old.longitude)}`:'Optional — capture once'}</small></div><button type="button" id="recordFetchLocation" class="btn secondary compact">${old.latitude?'Refresh':'Capture GPS'}</button></div>
          <a id="recordLocationMap" class="${old.latitude?'':'hidden'}" href="${old.latitude?mapUrl(old.latitude,old.longitude):''}" target="_blank" rel="noopener">View map</a>
          <input id="recordLatitude" type="hidden" value="${esc(old.latitude||'')}"><input id="recordLongitude" type="hidden" value="${esc(old.longitude||'')}"><input id="recordAccuracy" type="hidden" value="${esc(old.locationAccuracy||'')}"><input id="recordCapturedAt" type="hidden" value="${esc(old.locationCapturedAt||'')}">
        </div>
        <label><span>Short note (optional)</span><textarea name="notes" rows="2">${esc(old.notes||'')}</textarea></label>
        <div class="button-row">${id?`<button type="button" class="btn danger" id="deleteRecordBtn">Delete</button>`:''}<button type="submit" class="btn primary">Save once</button></div>
      </form>`);
    if(isDoctor){
      const chemistInput=$('#recordChemistSearch'),chemistIdInput=$('#recordChemistId'),chemistResults=$('#recordChemistResults');
      const showChemists=()=>{const q=clean(chemistInput.value).toLowerCase();const items=state.chemists.filter(c=>!q||[c.name,c.area,c.hq,c.address].join(' ').toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name)).slice(0,25);chemistResults.innerHTML=items.length?items.map(c=>`<button type="button" class="search-result" data-record-chemist-id="${esc(c.id)}"><strong>${esc(c.name)}</strong><small>${esc([c.area||c.hq,c.address].filter(Boolean).join(' • ')||'No address')}</small></button>`).join(''):`<div class="lookup-empty">No chemist found.</div>`;chemistResults.classList.remove('hidden');};
      chemistInput.addEventListener('focus',showChemists);chemistInput.addEventListener('input',()=>{chemistIdInput.value='';showChemists();});chemistResults.addEventListener('click',e=>{const b=e.target.closest('[data-record-chemist-id]');if(!b)return;const c=chemistById(b.dataset.recordChemistId);if(!c)return;chemistIdInput.value=c.id;chemistInput.value=c.name;chemistResults.classList.add('hidden');});
      const setDays=days=>$$('input[name="meetingDays"]',$('#recordForm')).forEach(x=>x.checked=days.includes(Number(x.value)));
      $('#monSatDaysBtn').addEventListener('click',()=>setDays([1,2,3,4,5,6]));$('#allDaysBtn').addEventListener('click',()=>setDays([0,1,2,3,4,5,6]));$('#clearDaysBtn').addEventListener('click',()=>setDays([]));
    }
    setupLocationCapture('record',false);
    const form=$('#recordForm');
    form.addEventListener('submit',e=>{
      e.preventDefault();const fd=new FormData(form),rec={...old,id:id||uid(isDoctor?'dr':'ch'),updatedAt:new Date().toISOString()};
      rec.name=clean(fd.get('name'));rec.address=clean(fd.get('address'));rec.area=clean(fd.get('area'));rec.hq=rec.hq||state.profile.hq;rec.notes=clean(fd.get('notes'));if(isDoctor)rec.hospital=clean(fd.get('hospital'));
      rec.latitude=num($('#recordLatitude').value)||'';rec.longitude=num($('#recordLongitude').value)||'';rec.locationAccuracy=num($('#recordAccuracy').value)||'';rec.locationCapturedAt=$('#recordCapturedAt').value||'';
      if(isDoctor){
        const days=fd.getAll('meetingDays').map(Number),from=normalizeTime(fd.get('meetingFrom')),to=normalizeTime(fd.get('meetingTo')),from2=normalizeTime(fd.get('meetingFrom2')),to2=normalizeTime(fd.get('meetingTo2'));
        const anyTime=from||to||from2||to2;if(anyTime&&!days.length){toast('Choose doctor meeting day(s).');return;}if((from&&!to)||(!from&&to)||(from2&&!to2)||(!from2&&to2)){toast('Complete both From and To for each timing.');return;}if((from&&timeMinutes(to)<=timeMinutes(from))||(from2&&timeMinutes(to2)<=timeMinutes(from2))){toast('Meeting To time must be later than From time.');return;}if(days.length&&!anyTime){toast('Add at least one meeting time or clear the selected days.');return;}
        rec.meetingDays=days;rec.meetingFrom=from;rec.meetingTo=to;rec.meetingFrom2=from2;rec.meetingTo2=to2;
        rec.linkedChemistId=clean(fd.get('linkedChemistId'));const c=chemistById(rec.linkedChemistId);rec.chemistName=c?.name||'';
      }
      if(!id){rec.createdAt=new Date().toISOString();arr.push(rec);}else Object.assign(old,rec);
      saveState();closeSheet();toast(`${isDoctor?'Doctor':'Chemist'} saved. Future meetings will auto-fill it.`);
    });
    $('#deleteRecordBtn')?.addEventListener('click',()=>{if(!confirm(`Delete ${old.name}? Meeting history will remain.`))return;const i=arr.findIndex(x=>x.id===id);if(i>=0)arr.splice(i,1);saveState();closeSheet();toast('Record deleted.');});
  }

  function statusTags(statuses) {
    const entries=Object.entries(statuses||{}).filter(([,s])=>s);
    return entries.length?`<div class="status-detail-list">${entries.map(([p,s])=>`<div><strong>${esc(p)}</strong><span class="tag ${statusClass(s)}">${esc(statusLabel(s))}</span></div>`).join('')}</div>`:empty('No prescription feedback saved yet.');
  }
  function viewRecord(type,id) {
    const arr=type==='doctor'?state.doctors:state.chemists,r=arr.find(x=>x.id===id);if(!r)return;
    const isDoctor=type==='doctor',ch=isDoctor?linkedChemist(r):null;
    const history=state.visits.filter(v=>isDoctor?v.doctorId===id:v.chemistId===id).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,10);
    const map=entityMapUrl(r);
    let extra='';
    if(isDoctor){const timing=doctorMeetingStatus(r);extra=`<div class="detail-section"><h4>Doctor meeting timing</h4><div class="detail-address timing-detail ${esc(timing.state)}"><strong>${esc(timing.label)}</strong>${doctorMeetingTiming(r)?`<br>${esc(doctorMeetingTiming(r))}`:'<br>Not set yet'}</div></div><div class="detail-section"><h4>Under chemist</h4><div class="detail-address">${esc(ch?.name||'Not linked yet')}</div></div><div class="detail-section"><h4>Latest product status</h4>${statusTags(latestStatuses(r.id,ch?.id||''))}</div>`;}
    else{
      const docs=state.doctors.filter(d=>d.linkedChemistId===id);
      extra=`<div class="detail-section"><h4>Doctors under this chemist</h4>${docs.length?docs.map(d=>`<button class="linked-doctor-row" data-action="view-record" data-type="doctor" data-id="${d.id}"><strong>${esc(doctorDisplayName(d))}</strong><small>${esc(d.area||'')}</small></button>`).join(''):empty('No doctor linked yet.')}</div>`;
    }
    openSheet(isDoctor?doctorDisplayName(r):r.name,isDoctor?'Doctor profile':'Chemist profile',`<div class="detail-hero"><div class="avatar">${esc(initials(r.name))}</div><div><h3>${esc(isDoctor?doctorDisplayName(r):r.name)}</h3><p>${esc(isDoctor?(ch?.name||'Chemist not linked'):`${linkedDoctorCount(r.id)} doctors linked`)}</p></div></div><div class="detail-grid"><div class="detail-box"><small>Area</small><strong>${esc(r.area||r.hq||'—')}</strong></div><div class="detail-box"><small>Last meeting</small><strong>${esc(prettyDate(r.lastVisit))}</strong></div></div>${isDoctor&&doctorHospital(r)?`<div class="detail-section"><h4>Hospital / clinic</h4><div class="detail-address">${esc(doctorHospital(r))}</div></div>`:''}<div class="detail-section"><h4>Address</h4><div class="detail-address">${esc(r.address||'Not added')}</div></div>${map?`<a class="map-main-btn" href="${map}" target="_blank" rel="noopener">Open map location</a>`:''}${extra}${r.notes?`<div class="detail-section"><h4>Note</h4><div class="note-box">${esc(r.notes)}</div></div>`:''}<div class="detail-actions"><button data-action="log-record" data-type="${type}" data-id="${id}">Log meeting</button><button data-action="edit-record" data-type="${type}" data-id="${id}">Edit once</button><button data-close-sheet>Close</button></div><div class="detail-section"><h4>Meeting history</h4>${history.length?history.map(miniActivity).join(''):empty('No meetings yet.')}</div>`);
  }
  function viewVisit(id) {
    const v=state.visits.find(x=>x.id===id);if(!v)return;
    const map=visitMapUrl(v);
    openSheet([v.doctorName||v.entityName,v.doctorHospital].filter(Boolean).join(' — ')||'Meeting',`${prettyDate(v.date)} • ${prettyTime(v.date)}`,`<div class="detail-grid"><div class="detail-box"><small>Doctor / hospital</small><strong>${esc([v.doctorName,v.doctorHospital].filter(Boolean).join(' — ')||'—')}</strong></div><div class="detail-box"><small>Under chemist</small><strong>${esc(v.chemistName||'—')}</strong></div><div class="detail-box"><small>Call counted</small><strong>${esc(v.calls||1)}</strong></div><div class="detail-box"><small>GPS accuracy</small><strong>${v.locationAccuracy?`${esc(v.locationAccuracy)} m`:'Not saved'}</strong></div></div>${map?`<a class="map-main-btn" href="${map}" target="_blank" rel="noopener">Open visit location</a>`:''}<div class="detail-section"><h4>Prescription feedback</h4>${statusTags(v.productStatuses)}</div>${v.notes?`<div class="detail-section"><h4>Meeting note</h4><div class="note-box">${esc(v.notes)}</div></div>`:''}<div class="detail-section"><h4>Follow-up</h4><div class="detail-address">${esc(prettyDate(v.followUpDate))}</div></div><div class="button-row"><button id="deleteVisitBtn" class="btn danger">Delete meeting</button></div>`);
    $('#deleteVisitBtn').addEventListener('click',()=>{if(!confirm('Delete this meeting log?'))return;state.visits=state.visits.filter(x=>x.id!==id);saveState();closeSheet();toast('Meeting deleted.');});
  }

  function globalSearch() {
    openSheet('Search','Doctor or chemist name, address or area.',`<label class="sheet-form"><span>Search</span><input id="globalSearchInput" autofocus placeholder="Type name, chemist, address or area…"></label><div id="globalSearchResults" class="stack-list">${empty('Start typing to search.')}</div>`);
    const input=$('#globalSearchInput'),out=$('#globalSearchResults');
    input.addEventListener('input',()=>{const q=clean(input.value).toLowerCase();if(!q){out.innerHTML=empty('Start typing to search.');return;}const items=[...state.doctors.map(x=>({...x,type:'doctor',chemist:linkedChemist(x)?.name||''})),...state.chemists.map(x=>({...x,type:'chemist'}))].filter(x=>[x.name,doctorHospital(x),x.address,x.area,x.hq,x.chemist,x.notes].join(' ').toLowerCase().includes(q)).slice(0,25);out.innerHTML=items.length?items.map(x=>{const timing=x.type==='doctor'?doctorMeetingStatus(x):null;return `<button class="mini-card plain-button" data-action="view-record" data-type="${x.type}" data-id="${x.id}"><span class="mini-icon">${x.type==='doctor'?'⚕':'✚'}</span><span class="mini-copy"><h3>${esc(x.type==='doctor'?doctorDisplayName(x):x.name)}</h3><p>${esc(x.type==='doctor'?([timing.label,x.chemist||x.area].filter(Boolean).join(' • ')):(x.area||`${linkedDoctorCount(x.id)} doctors`))}</p></span></button>`;}).join(''):empty('No matches.');});
    setTimeout(()=>input.focus(),100);
  }

  function canonical(v){return clean(v).toLowerCase().replace(/\u00a0/g,' ').replace(/[^a-z0-9]+/g,'');}
  const HEADER_GROUPS={
    doctorName:['listeddoctorname','drname','doctorname','nameofdoctor','nameofdr','drsname','doctor'],
    chemistName:['nameofstockist','stockistname','chemistname','nameofchemist','pharmacyname','firmname','partyname','underchemist','doctorunderchemist','chemist'],
    hq:['hq','hqname','managerhq'],area:['place','territory','area','location','city'],mobile:['contactnumber','mobilenumber','mobile','phone','contactno'],
    address:['address','fulladdress','clinicaddress','doctoraddress','chemistaddress'],hospital:['clinic','hospital','hospitalname','clinicname','nameofhospital','nameofclinic'],
    meetingDays:['meetingdays','visitdays','availabledays','doctordays'],meetingFrom:['meetingfrom','fromtime','visittimefrom','availablefrom'],meetingTo:['meetingto','totime','visittimeto','availableto'],
    campaign:['campaign','productname','productfocus'],product:['product','productname','brand'],pts:['pts','billingprice','price']
  };
  const hasHeader=(h,g)=>(HEADER_GROUPS[g]||[]).includes(canonical(h));
  function findHeaderRow(rows){let best={i:-1,score:0};rows.slice(0,25).forEach((row,i)=>{const cs=row.map(canonical);let score=0;Object.values(HEADER_GROUPS).forEach(group=>{if(group.some(x=>cs.includes(x)))score++;});if(score>best.score)best={i,score};});return best.score>=1?best.i:-1;}
  const indexFor=(headers,g)=>headers.findIndex(h=>hasHeader(h,g));
  const rowVal=(row,headers,g)=>{const i=indexFor(headers,g);return i>=0?clean(row[i]):'';};
  const validName=v=>{const s=clean(v);return s.length>=3&&!/^\d+(\.\d+)?$/.test(s)&&!/^(total|name|doctor|stockist|chemist|product)$/i.test(s);};
  const mergeArrays=(a,b)=>[...new Set([...(a||[]),...(b||[])].map(clean).filter(Boolean))];

  function upsertChemist(rec){
    const key=norm(rec.name),place=norm(rec.area||rec.hq);let old=state.chemists.find(x=>norm(x.name)===key&&(!place||norm(x.area||x.hq)===place))||state.chemists.find(x=>norm(x.name)===key);
    if(!old){const created={...rec,id:uid('ch'),createdAt:new Date().toISOString(),products:rec.products||[]};state.chemists.push(created);return {mode:'added',record:created};}
    const protectedFields=['notes','lastVisit','nextFollowUp','createdAt','id','latitude','longitude','locationCapturedAt'];Object.entries(rec).forEach(([k,v])=>{if(protectedFields.includes(k)||v===''||v==null)return;if(Array.isArray(v))old[k]=mergeArrays(old[k],v);else old[k]=v;});old.sourceFiles=mergeArrays(old.sourceFiles,rec.sourceFiles);old.updatedAt=new Date().toISOString();return {mode:'updated',record:old};
  }
  function upsertDoctor(rec){
    const key=norm(rec.name),hospital=norm(rec.hospital),place=norm(rec.area||rec.hq);let old=state.doctors.find(x=>norm(x.name)===key&&hospital&&norm(doctorHospital(x))===hospital);if(!old&&hospital)old=state.doctors.find(x=>norm(x.name)===key&&!doctorHospital(x)&&(!place||norm(x.area||x.hq)===place));if(!old&&!hospital)old=state.doctors.find(x=>norm(x.name)===key&&(!place||norm(x.area||x.hq)===place))||state.doctors.find(x=>norm(x.name)===key&&!doctorHospital(x));
    if(!old){const created={...rec,id:uid('dr'),createdAt:new Date().toISOString()};state.doctors.push(created);return {mode:'added',record:created};}
    const protectedFields=['notes','lastVisit','nextFollowUp','createdAt','id','latitude','longitude','locationCapturedAt'];Object.entries(rec).forEach(([k,v])=>{if(protectedFields.includes(k)||v===''||v==null)return;if(Array.isArray(v))old[k]=mergeArrays(old[k],v);else old[k]=v;});old.sourceFiles=mergeArrays(old.sourceFiles,rec.sourceFiles);old.updatedAt=new Date().toISOString();return {mode:'updated',record:old};
  }
  function upsertProduct(name,pts=''){if(!validName(name))return false;const key=norm(name);let p=state.products.find(x=>norm(x.name)===key);if(!p){state.products.push({id:uid('p'),name:clean(name),pts:num(pts)||'',createdAt:new Date().toISOString()});return true;}if(pts)p.pts=num(pts)||p.pts;return false;}

  function importSheetRows(sheets,fileName){
    const result={doctorAdded:0,doctorUpdated:0,chemistAdded:0,chemistUpdated:0,products:0,linked:0,skipped:0,sheets:0};
    (sheets||[]).forEach(sheet=>{
      const sheetName=clean(sheet.name)||'Sheet';
      const rows=Array.isArray(sheet.rows)?sheet.rows:[];const hi=findHeaderRow(rows);if(hi<0)return;
      const headers=rows[hi].map(clean),hasDoc=indexFor(headers,'doctorName')>=0,hasChem=indexFor(headers,'chemistName')>=0,hasProd=indexFor(headers,'product')>=0;result.sheets++;
      rows.slice(hi+1).forEach(row=>{
        const chemName=hasChem?rowVal(row,headers,'chemistName'):'';let chem=null;
        if(validName(chemName)){
          const cr=upsertChemist({name:chemName,hq:rowVal(row,headers,'hq')||state.profile.hq,area:rowVal(row,headers,'area'),address:rowVal(row,headers,'address'),products:[],sourceFiles:[fileName],tags:[sheetName]});chem=cr.record;result[cr.mode==='added'?'chemistAdded':'chemistUpdated']++;
        }
        if(hasDoc){
          const name=rowVal(row,headers,'doctorName');if(validName(name)){
            const dr=upsertDoctor({name,hospital:rowVal(row,headers,'hospital'),hq:rowVal(row,headers,'hq')||state.profile.hq,area:rowVal(row,headers,'area'),address:rowVal(row,headers,'address'),meetingDays:normalizeMeetingDays(rowVal(row,headers,'meetingDays')),meetingFrom:normalizeTime(rowVal(row,headers,'meetingFrom')),meetingTo:normalizeTime(rowVal(row,headers,'meetingTo')),campaign:rowVal(row,headers,'campaign')||sheetName,linkedChemistId:chem?.id||'',chemistName:chem?.name||'',sourceFiles:[fileName],tags:[sheetName]});
            result[dr.mode==='added'?'doctorAdded':'doctorUpdated']++;if(chem){dr.record.linkedChemistId=chem.id;dr.record.chemistName=chem.name;result.linked++;}
          }else if(!chem)result.skipped++;
        }else if(!chem&&!hasProd)result.skipped++;
        if(hasProd){const product=rowVal(row,headers,'product');if(upsertProduct(product,rowVal(row,headers,'pts')))result.products++;}
      });
    });return result;
  }
  function importWorkbook(wb,fileName){return importSheetRows(wb.SheetNames.map(sheetName=>({name:sheetName,rows:XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,defval:'',raw:false,blankrows:false})})),fileName);}
  async function importArrayBuffer(buffer,fileName){if(!window.XLSX)throw new Error('Excel engine did not load.');const wb=XLSX.read(buffer,{type:'array',cellDates:false});return importWorkbook(wb,fileName);}
  function bufferToBase64(buffer){const bytes=new Uint8Array(buffer);let binary='';const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+chunk,bytes.length)));return btoa(binary);}
  async function importThroughAndroid(file){
    if(!window.AndroidBridge?.parseSpreadsheet)throw new Error('Offline spreadsheet bridge is unavailable.');
    const raw=window.AndroidBridge.parseSpreadsheet(file.name,bufferToBase64(await file.arrayBuffer()));
    const parsed=JSON.parse(raw);if(parsed.error)throw new Error(parsed.error);return importSheetRows(parsed.sheets,file.name);
  }
  const resultSummary=r=>`${r.doctorAdded} doctors added, ${r.doctorUpdated} updated; ${r.chemistAdded} chemists added, ${r.chemistUpdated} updated; ${r.linked||0} doctor-chemist links; ${r.products} products.`;
  async function importFiles(files){
    const status=$('#importStatus');status.className='notice';status.classList.remove('hidden');status.textContent='Importing and merging records…';let grand={doctorAdded:0,doctorUpdated:0,chemistAdded:0,chemistUpdated:0,products:0,linked:0,skipped:0,sheets:0};
    try{for(const file of files){if(file.name.toLowerCase().endsWith('.json')){restoreObject(JSON.parse(await file.text()));continue;}const r=window.AndroidBridge?.parseSpreadsheet?await importThroughAndroid(file):await importArrayBuffer(await file.arrayBuffer(),file.name);Object.keys(grand).forEach(k=>grand[k]+=num(r[k]));state.imports.push({id:uid('imp'),file:file.name,date:new Date().toISOString(),summary:resultSummary(r)});}saveState();status.textContent=`Done: ${resultSummary(grand)} Old meetings and saved GPS were preserved.`;toast('Import complete.');}catch(err){status.className='notice error';status.textContent=`Import failed: ${err.message}`;}
  }
  function loadEmbeddedSeed(){if(state.settings.embeddedSeedLoaded||!window.MR_SEED_DATA)return;const seed=window.MR_SEED_DATA;let da=0,du=0,ca=0,cu=0,pc=0;(seed.chemists||[]).forEach(r=>{const m=upsertChemist(r);m.mode==='added'?ca++:cu++;});(seed.doctors||[]).forEach(r=>{const m=upsertDoctor(r);m.mode==='added'?da++:du++;});(seed.products||[]).forEach(r=>{if(upsertProduct(r.name,r.pts))pc++;});state.settings.embeddedSeedLoaded=true;state.imports.push({id:uid('imp'),file:'Embedded supplied data',date:new Date().toISOString(),summary:`${da} doctors, ${ca} chemists/stockists and ${pc} products loaded.`});saveState(false);}
  async function loadBundledFiles(auto=false){const status=$('#importStatus');status.className='notice';status.classList.remove('hidden');status.textContent='Loading supplied Excel files…';if(!window.XLSX){status.className='notice error';status.textContent='Excel engine unavailable. Reopen the app.';return;}let total={doctorAdded:0,doctorUpdated:0,chemistAdded:0,chemistUpdated:0,products:0,linked:0,skipped:0,sheets:0},ok=0;for(const path of BUNDLED_FILES){try{const res=await fetch(path);if(!res.ok)throw new Error(String(res.status));const r=await importArrayBuffer(await res.arrayBuffer(),decodeURIComponent(path.split('/').pop()));Object.keys(total).forEach(k=>total[k]+=num(r[k]));ok++;}catch(e){console.warn('Bundled import skipped',path,e);}}state.settings.bundledImportAttempted=true;if(ok){state.imports.push({id:uid('imp'),file:`${ok} supplied files`,date:new Date().toISOString(),summary:resultSummary(total)});saveState();status.textContent=`Supplied files loaded: ${resultSummary(total)}`;if(!auto)toast('Supplied data loaded.');}else{saveState(false);status.className='notice error';status.textContent='Could not read bundled files. Start through the included Termux server.';}}

  function restoreObject(obj){if(!obj||!Array.isArray(obj.doctors)||!Array.isArray(obj.chemists)||!Array.isArray(obj.visits))throw new Error('Not a valid MR Daily Auto backup.');state=migrateState(obj);}
  function download(name,content,type='application/json'){if(window.AndroidBridge?.saveTextFile){window.AndroidBridge.saveTextFile(name,type,content);return;}const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  const csvCell=v=>`"${(Array.isArray(v)?v.join('; '):String(v??'')).replace(/"/g,'""')}"`;
  function exportCSV(){const headers=['Type','Name','Hospital / Clinic','Under Chemist','Meeting Days','Meeting Slot 1','Meeting Slot 2','Address','Area','Latitude','Longitude','Last Meeting','Next Follow-up','Notes'];const rows=[headers,...state.doctors.map(d=>['Doctor',d.name,doctorHospital(d),linkedChemist(d)?.name||d.chemistName,normalizeMeetingDays(d.meetingDays).map(x=>DAY_NAMES[x]).join('; '),doctorMeetingSlots(d)[0]?`${timeLabel(doctorMeetingSlots(d)[0].from)}-${timeLabel(doctorMeetingSlots(d)[0].to)}`:'',doctorMeetingSlots(d)[1]?`${timeLabel(doctorMeetingSlots(d)[1].from)}-${timeLabel(doctorMeetingSlots(d)[1].to)}`:'',d.address,d.area,d.latitude,d.longitude,d.lastVisit,d.nextFollowUp,d.notes]),...state.chemists.map(c=>['Chemist',c.name,'','','','','',c.address,c.area,c.latitude,c.longitude,c.lastVisit,c.nextFollowUp,c.notes])];download(`MR-Master-${localISODate()}.csv`,rows.map(r=>r.map(csvCell).join(',')).join('\n'),'text/csv;charset=utf-8');}
  async function hashPin(pin){if(window.AndroidBridge?.sha256)return window.AndroidBridge.sha256(pin);const data=new TextEncoder().encode(pin);const digest=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');}
  function showLockIfNeeded(){if(state.settings.pinHash){$('#lockScreen').classList.remove('hidden');$('#lockScreen').setAttribute('aria-hidden','false');setTimeout(()=>$('#unlockPin').focus(),100);}}

  function bindEvents(){
    document.addEventListener('click',e=>{
      const nav=e.target.closest('[data-nav]');if(nav){navigate(nav.dataset.nav);return;}
      const close=e.target.closest('[data-close-sheet]');if(close){closeSheet();return;}
      const a=e.target.closest('[data-action]');if(a){const action=a.dataset.action,type=a.dataset.type,id=a.dataset.id;if(action==='quick-log'||action==='add-visit')quickMeeting();if(action==='add-doctor')editRecord('doctor');if(action==='add-chemist')editRecord('chemist');if(action==='log-record'){if(type==='doctor')quickMeeting(id,'');else quickMeeting('',id);}if(action==='edit-record')editRecord(type,id);if(action==='view-record')viewRecord(type,id);if(action==='view-visit')viewVisit(id);return;}
      const dc=e.target.closest('[data-doctor-chip]');if(dc){doctorFilter=dc.dataset.doctorChip;renderDoctors();return;}
      const cc=e.target.closest('[data-chemist-chip]');if(cc){chemistFilter=cc.dataset.chemistChip;renderChemists();return;}
      const vf=e.target.closest('[data-visit-filter]');if(vf){visitFilter=vf.dataset.visitFilter;renderVisits();return;}
      if(e.target.closest('[data-filter-followups="due"]')){visitFilter='due';navigate('visits');}
    });
    $('#sheetBackdrop').addEventListener('click',closeSheet);$('#quickLogBtn').addEventListener('click',()=>quickMeeting());$('#quickSearchBtn').addEventListener('click',globalSearch);
    $('#doctorSearch').addEventListener('input',renderDoctors);$('#chemistSearch').addEventListener('input',renderChemists);
    $('#doctorFilterBtn').addEventListener('click',()=>{doctorFilter=doctorFilter==='unlinked'?'all':'unlinked';renderDoctors();});
    $('#stockFilterBtn').addEventListener('click',()=>{chemistFilter=chemistFilter==='feedback'?'all':'feedback';renderChemists();});
    $('#copyReportBtn').addEventListener('click',async()=>{try{const text=getReportText();if(window.AndroidBridge?.copyText)window.AndroidBridge.copyText(text);else await navigator.clipboard.writeText(text);toast('Daily report copied.');}catch(_){toast('Copy failed. Use Share.');}});
    $('#shareReportBtn').addEventListener('click',async()=>{const text=getReportText();try{if(window.AndroidBridge?.shareText)window.AndroidBridge.shareText('MR Daily Report',text);else if(navigator.share)await navigator.share({title:'MR Daily Report',text});else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,'_blank');}catch(e){if(e.name!=='AbortError')toast('Share cancelled.');}});
    $('#importFile').addEventListener('change',e=>{if(e.target.files.length)importFiles([...e.target.files]);e.target.value='';});$('#loadBundledBtn').addEventListener('click',()=>{if(window.AndroidBridge){const status=$('#importStatus');status.className='notice';status.classList.remove('hidden');status.textContent='The supplied doctor, chemist and product data is already included in this Android app.';toast('Starter data is already loaded.');}else loadBundledFiles(false);});
    $('#exportJsonBtn').addEventListener('click',()=>download(`MR-Daily-Auto-Backup-${localISODate()}.json`,JSON.stringify(state,null,2)));$('#exportCsvBtn').addEventListener('click',exportCSV);$('#restoreBtn').addEventListener('click',()=>$('#restoreInput').click());
    $('#restoreInput').addEventListener('change',async e=>{try{restoreObject(JSON.parse(await e.target.files[0].text()));saveState();toast('Backup restored.');}catch(err){toast(err.message);}e.target.value='';});
    $('#profileForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget);['tmName','hq','joinWorkWith','companyDivision','products'].forEach(k=>state.profile[k]=clean(fd.get(k)));saveState();toast('Profile and product buttons saved.');});
    $('#openingForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget);state.opening.monthKey=monthKey(localISODate());METRICS.forEach(([k])=>state.opening[k]=num(fd.get(k)));saveState();toast('Opening balances saved.');});
    $('#pinForm').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),p=clean(fd.get('pin')),c=clean(fd.get('confirmPin'));if(!/^\d{4,6}$/.test(p)||p!==c){toast('PIN must be matching 4–6 digits.');return;}state.settings.pinHash=await hashPin(p);saveState(false);e.currentTarget.reset();toast('PIN lock set.');});
    $('#removePinBtn').addEventListener('click',()=>{state.settings.pinHash='';saveState(false);toast('PIN removed.');});$('#unlockBtn').addEventListener('click',async()=>{const h=await hashPin($('#unlockPin').value);if(h===state.settings.pinHash){$('#lockScreen').classList.add('hidden');$('#unlockError').textContent='';$('#unlockPin').value='';}else $('#unlockError').textContent='Wrong PIN';});$('#unlockPin').addEventListener('keydown',e=>{if(e.key==='Enter')$('#unlockBtn').click();});
    $('#resetBtn').addEventListener('click',()=>{if(!confirm('Reset all local app data? Export a backup first.'))return;state=makeDefaultState();saveState();toast('App reset.');navigate('dashboard');});
    window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;});$('#installBtn').addEventListener('click',async()=>{if(window.AndroidBridge){openSheet('Android app installed','Ready to use','<div class="note-box">This is already the native Android APK. Termux and Chrome installation are not required.</div>');}else if(deferredInstallPrompt){deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;}else openSheet('Install on Android','Chrome steps','<div class="note-box">Open Chrome menu (⋮) → Add to Home screen or Install app.</div>');});
  }

  async function init(){loadEmbeddedSeed();bindEvents();renderAll();showLockIfNeeded();if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./service-worker.js').catch(console.warn);if(!state.settings.bundledImportAttempted&&location.protocol!=='file:')setTimeout(()=>loadBundledFiles(true),900);}
  document.addEventListener('DOMContentLoaded',init);
})();
