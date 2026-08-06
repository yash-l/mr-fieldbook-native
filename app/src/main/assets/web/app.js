(() => {
  'use strict';

  const STORE_KEY = 'mr-daily-auto-v3';
  const APP_VERSION = 14;
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
  const doctorDisplayName = doctor => {if(!doctor)return '';const name=clean(doctor.name),hospital=doctorHospital(doctor);return name&&hospital&&norm(name)===norm(hospital)?name:[name,hospital].filter(Boolean).join(' — ');};
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
  const OUTCOME_LABELS={met:'Doctor met',not_met:'Doctor not met',leave:'Doctor on leave',ot:'Doctor in OT',closed:'Hospital closed',timing_changed:'Timing changed'};
  const NOT_MET_OUTCOMES=new Set(['not_met','leave','ot','closed','timing_changed']);
  const dateOnly=v=>clean(v).slice(0,10);
  function daysBetween(a,b){const x=new Date(`${dateOnly(a)}T00:00:00`),y=new Date(`${dateOnly(b)}T00:00:00`);return Number.isNaN(x.getTime())||Number.isNaN(y.getTime())?0:Math.round((y-x)/86400000);}
  function doctorVisitRows(doctorId){return state.visits.filter(v=>v.doctorId===doctorId).sort((a,b)=>String(a.date).localeCompare(String(b.date)));}
  function latestDoctorVisit(doctorId,metOnly=false){return doctorVisitRows(doctorId).filter(v=>!metOnly||!NOT_MET_OUTCOMES.has(v.outcome)).slice(-1)[0]||null;}
  function recentNotMetCount(doctorId,windowDays=60){const cutoff=new Date();cutoff.setDate(cutoff.getDate()-windowDays);return doctorVisitRows(doctorId).filter(v=>NOT_MET_OUTCOMES.has(v.outcome)&&new Date(v.date)>=cutoff).length;}
  function doctorCompleteness(doctor){
    const checks=[['Hospital',doctorHospital(doctor)],['Chemist',linkedChemist(doctor)],['Meeting days',normalizeMeetingDays(doctor?.meetingDays).length],['Meeting timing',doctorMeetingSlots(doctor).length],['Hospital GPS',num(doctor?.latitude)&&num(doctor?.longitude)]];
    const missing=checks.filter(([,ok])=>!ok).map(([name])=>name),score=Math.round(((checks.length-missing.length)/checks.length)*100);
    return {score,missing,label:score===100?'Verified':score>=60?'Needs review':'Needs completion'};
  }
  function nextMeetingOccurrence(doctor,from=now(),skipCurrent=false){
    const days=normalizeMeetingDays(doctor?.meetingDays),slots=doctorMeetingSlots(doctor);if(!days.length||!slots.length)return null;
    const floor=new Date(from);if(skipCurrent)floor.setMinutes(floor.getMinutes()+20);
    for(let offset=0;offset<=21;offset++){
      const base=new Date(floor);base.setHours(0,0,0,0);base.setDate(base.getDate()+offset);if(!days.includes(base.getDay()))continue;
      for(const slot of slots){const [h,m]=slot.from.split(':').map(Number),candidate=new Date(base);candidate.setHours(h,m,0,0);if(candidate>floor)return {date:localISODate(candidate),dateTime:localISODateTime(candidate),from:slot.from,to:slot.to,label:`${offset===0?'Today':offset===1?'Tomorrow':DAY_NAMES[candidate.getDay()]} ${timeLabel(slot.from)}–${timeLabel(slot.to)}`};}
    }
    return null;
  }
  function productOpportunity(doctor){
    const rows=doctorVisitRows(doctor.id),latest={};
    rows.forEach(v=>Object.entries(v.productStatuses||{}).forEach(([p,status])=>{if(status)latest[p]=status;}));
    const pending=Object.entries(latest).filter(([,s])=>!s||s==='no_update').map(([p])=>p);
    const lost=Object.keys(latest).filter(p=>latest[p]==='not_prescribed'&&rows.some(v=>v.productStatuses?.[p]==='prescribed'));
    if(lost.length)return {level:'high',label:`Recover ${lost[0]}`,detail:`Previously prescribed; latest status is not prescribed.`};
    if(pending.length)return {level:'medium',label:`Feedback: ${pending[0]}`,detail:'Product feedback is still pending.'};
    const products=focusProducts();if(products.length&&!Object.keys(latest).length)return {level:'medium',label:`Discuss ${products[0]}`,detail:'No product feedback has been saved yet.'};
    return {level:'normal',label:'Continue follow-up',detail:'Use the last saved product status.'};
  }
  function intelligenceScore(doctor){
    if(rowsForDay().some(v=>v.doctorId===doctor.id))return -10000;
    const timing=doctorMeetingStatus(doctor),complete=doctorCompleteness(doctor),last=latestDoctorVisit(doctor.id,true),days=last?daysBetween(last.date,localISODate()):999,notMet=recentNotMetCount(doctor.id),due=doctor.nextFollowUp&&doctor.nextFollowUp<=localISODate(),rescheduled=state.reschedules.some(r=>r.doctorId===doctor.id&&r.status==='pending'&&r.scheduledDate<=localISODate());
    let score=0;if(timing.state==='available')score+=100;else if(timing.state==='upcoming')score+=65;else if(timing.state==='scheduled')score+=30;else score-=35;
    if(due)score+=75;if(rescheduled)score+=85;score+=Math.min(55,Math.max(0,days));score+=Math.min(30,notMet*8);score+=complete.score/10;
    const opportunity=productOpportunity(doctor);if(opportunity.level==='high')score+=45;else if(opportunity.level==='medium')score+=22;
    return score;
  }
  function intelligenceReasons(doctor){
    const reasons=[],timing=doctorMeetingStatus(doctor),quality=doctorCompleteness(doctor),opportunity=productOpportunity(doctor),last=latestDoctorVisit(doctor.id,true),notMet=recentNotMetCount(doctor.id);
    if(timing.state==='available')reasons.push('available now');else if(timing.state==='upcoming')reasons.push(timing.label.toLowerCase());else if(timing.state==='unset')reasons.push('meeting timing missing');
    if(doctor.nextFollowUp&&doctor.nextFollowUp<=localISODate())reasons.push('follow-up due');
    if(last){const gap=daysBetween(last.date,localISODate());if(gap>=14)reasons.push(`${gap} days since met`);}else reasons.push('no confirmed meeting history');
    if(notMet)reasons.push(`${notMet} recent not-met`);
    if(opportunity.level!=='normal')reasons.push(opportunity.label);
    if(quality.missing.length)reasons.push(`missing ${quality.missing.slice(0,2).join(' + ')}`);
    return reasons.slice(0,4);
  }
  function smartPatchCandidates(limit=10){
    return state.doctors.map(doctor=>({doctor,score:intelligenceScore(doctor),timing:doctorMeetingStatus(doctor),quality:doctorCompleteness(doctor),opportunity:productOpportunity(doctor),reasons:intelligenceReasons(doctor)})).filter(x=>x.score>-9000).sort((a,b)=>b.score-a.score||doctorDisplayName(a.doctor).localeCompare(doctorDisplayName(b.doctor))).slice(0,limit);
  }
  function replacementDoctor(excludeId){return smartPatchCandidates(20).find(x=>x.doctor.id!==excludeId&&['available','upcoming'].includes(x.timing.state))||smartPatchCandidates(20).find(x=>x.doctor.id!==excludeId)||null;}
  function dataQualitySummary(){
    const missingHospital=state.doctors.filter(d=>!doctorHospital(d)).length,missingChemist=state.doctors.filter(d=>!linkedChemist(d)).length,missingTiming=state.doctors.filter(d=>!normalizeMeetingDays(d.meetingDays).length||!doctorMeetingSlots(d).length).length,missingGps=state.doctors.filter(d=>!num(d.latitude)||!num(d.longitude)).length;
    const keyCounts=new Map();state.doctors.forEach(d=>{const key=`${norm(d.name)}|${norm(doctorHospital(d))}`;if(norm(d.name))keyCounts.set(key,(keyCounts.get(key)||0)+1);});
    const duplicates=[...keyCounts.values()].filter(n=>n>1).reduce((a,n)=>a+n,0),complete=state.doctors.filter(d=>doctorCompleteness(d).score===100).length;
    return {complete,missingHospital,missingChemist,missingTiming,missingGps,duplicates,total:state.doctors.length};
  }
  function renderMachineDashboard(){
    const box=$('#machineTopList'),quality=dataQualitySummary(),patch=smartPatchCandidates(3);if(!box)return;
    $('#machineQualityText').textContent=`${quality.complete}/${quality.total} fully verified • ${quality.missingTiming} timing pending • ${state.reschedules.filter(r=>r.status==='pending').length} rescheduled`;
    box.innerHTML=patch.length?patch.map((x,i)=>`<button class="machine-call plain-button" data-action="log-record" data-type="doctor" data-id="${esc(x.doctor.id)}"><span>${i+1}</span><div><strong>${esc(doctorDisplayName(x.doctor))}</strong><small>${esc([x.timing.label,...x.reasons].filter(Boolean).join(' • '))}</small></div><b>${Math.max(0,Math.round(x.score))}</b></button>`).join(''):empty('No pending doctor call. Add doctor timings or follow-up data.');
  }
  function openIntelligenceCenter(){
    const patch=smartPatchCandidates(12),q=dataQualitySummary(),pending=state.reschedules.filter(r=>r.status==='pending').sort((a,b)=>String(a.scheduledDate).localeCompare(String(b.scheduledDate)));
    openSheet('MR Machine','Reads saved field data and prepares the next best actions. GPS is not used for attendance or scoring.',`<div class="machine-summary-grid"><div><strong>${patch.length}</strong><small>Suggested calls</small></div><div><strong>${pending.length}</strong><small>Rescheduled</small></div><div><strong>${q.complete}/${q.total}</strong><small>Verified data</small></div></div><div class="detail-section"><h4>Today smart patch</h4><div class="machine-patch-list">${patch.length?patch.map((x,i)=>`<div class="machine-patch-row"><span>${i+1}</span><div><strong>${esc(doctorDisplayName(x.doctor))}</strong><small>${esc(x.reasons.join(' • ')||x.timing.label)}</small><em>${esc(x.opportunity.label)}</em></div><button data-action="log-record" data-type="doctor" data-id="${esc(x.doctor.id)}">Meet</button></div>`).join(''):empty('No pending calls.')}</div><button id="confirmMachinePatchBtn" class="btn primary full">Confirm today patch</button></div><div class="detail-section"><h4>Pending reschedules</h4>${pending.length?pending.map(r=>`<div class="machine-reschedule"><strong>${esc(r.doctorName)}</strong><small>${esc(`${prettyDate(r.scheduledDate)} • ${timeLabel(r.meetingFrom)}–${timeLabel(r.meetingTo)} • ${r.reason}`)}</small></div>`).join(''):empty('No pending reschedule.')}</div><div class="detail-section"><h4>Data quality</h4><div class="quality-grid"><div><b>${q.missingHospital}</b><span>Hospital missing</span></div><div><b>${q.missingChemist}</b><span>Chemist missing</span></div><div><b>${q.missingTiming}</b><span>Timing missing</span></div><div><b>${q.missingGps}</b><span>GPS verification pending</span></div><div><b>${q.duplicates}</b><span>Possible duplicate</span></div></div></div>`);
    $('#confirmMachinePatchBtn')?.addEventListener('click',()=>{state.patchPlans.push({id:uid('patch'),date:localISODate(),createdAt:new Date().toISOString(),status:'confirmed',items:patch.map((x,i)=>({order:i+1,doctorId:x.doctor.id,doctorName:x.doctor.name,hospital:doctorHospital(x.doctor),timing:x.timing.label,score:Math.round(x.score),reason:x.reasons.join('; '),productAction:x.opportunity.label}))});saveState();toast('Today smart patch confirmed and added to reports.');});
  }


function defaultSchemes() {
  const startDate='2026-07-03', endDate='2026-09-25', source='FDC Scheme Ref. Scheme/2026-27/24';
  return [
    ['SIMYL MCT POWDER','200 GM','9+1'],
    ['SIMYL MCT POWDER','400 GM','9+1'],
    ['ZEFRICH CHOCOLATE','200 GM','9+1'],
    ['ZEFRICH MILK MASALA','200 GM','9+1'],
    ['ZIORAL ORAL SOLUTION','100 ML','9+1'],
    ['ZIORAL DROPS','15 ML','9+1'],
    ['SIMYL MCT','200 GM POUCH','9+1']
  ].map(([product,pack,ratio])=>({id:uid('sch'),product,pack,ratio,startDate,endDate,source,notes:'Stockist / retailer scheme. Edit dates or ratio when company circular changes.',createdAt:new Date().toISOString()}));
}

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
      distributors: [],
      products: [],
      schemes: defaultSchemes(),
      orders: [],
      routePlans: [],
      patchPlans: [],
      reschedules: [],
      intelligenceLog: [],
      captures: [],
      visits: [{
        id: uid('log'), date: `${today}T10:00`, entityType: 'general', entityId: '', entityName: 'Starting daily report',
        calls: 12, inputs: 0, basket: 0, towel: 0, conversation: 0, newAvailability: 0, pobValue: 0,
        notes: 'Starting value supplied for today.', productStatuses: {}, followUpDate: '', createdAt: new Date().toISOString()
      }],
      opening: {monthKey: monthKey(today), calls:164, inputs:0, basket:0, towel:0, conversation:0, newAvailability:0, pobValue:0},
      imports: [],
      settings: {bundledImportAttempted:false, embeddedSeedLoaded:false, pinHash:'', installedHintSeen:false, workflowMode:'collect', nearbyRadiusMeters:1000}
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
      distributors: Array.isArray(raw?.distributors) ? raw.distributors : [],
      products: Array.isArray(raw?.products) ? raw.products : [],
      schemes: Array.isArray(raw?.schemes) && raw.schemes.length ? raw.schemes : fresh.schemes,
      orders: Array.isArray(raw?.orders) ? raw.orders : [],
      routePlans: Array.isArray(raw?.routePlans) ? raw.routePlans : [],
      patchPlans: Array.isArray(raw?.patchPlans) ? raw.patchPlans : [],
      reschedules: Array.isArray(raw?.reschedules) ? raw.reschedules : [],
      intelligenceLog: Array.isArray(raw?.intelligenceLog) ? raw.intelligenceLog : [],
      captures: Array.isArray(raw?.captures) ? raw.captures : [],
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
      if (!c.linkedDistributorId && c.distributorId) c.linkedDistributorId = c.distributorId;
    });
    out.distributors.forEach(d => {
      if (!d.id) d.id = uid('dist');
      d.name=clean(d.name); d.address=clean(d.address); d.area=clean(d.area||d.hq); d.mobile=clean(d.mobile);
    });
    out.schemes.forEach(x=>{if(!x.id)x.id=uid('sch');x.product=clean(x.product);x.pack=clean(x.pack);x.ratio=clean(x.ratio);});
    out.orders.forEach(o=>{if(!o.id)o.id=uid('ord');if(!Array.isArray(o.items))o.items=[];});
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
  const nearbyPlaceCache = new Map();

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
  function distributorById(id) { return state.distributors.find(x => x.id === id); }
  function preferredDistributor(chemist) { return chemist ? distributorById(chemist.linkedDistributorId) || state.distributors.find(d=>norm(d.name)===norm(chemist.distributorName)) : null; }
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


function schemeState(x,date=localISODate()){
  if(x.startDate&&date<x.startDate)return 'upcoming';
  if(x.endDate&&date>x.endDate)return 'expired';
  return 'active';
}
function activeScheme(product,pack='',date=localISODate()){
  const pn=norm(product),pk=norm(pack);
  return state.schemes.filter(x=>schemeState(x,date)==='active'&&norm(x.product)===pn&&(!pk||!x.pack||norm(x.pack)===pk)).sort((a,b)=>String(b.startDate).localeCompare(String(a.startDate)))[0]||null;
}
function productCatalog(){
  return [...new Set([...focusProducts(),...state.products.map(p=>clean(p.name)),...state.schemes.map(x=>clean(x.product))].filter(Boolean))].sort((a,b)=>a.localeCompare(b));
}
function ordersForDay(date=localISODate()){return state.orders.filter(o=>String(o.date||'').slice(0,10)===date);}
function orderTotal(o){return (o.items||[]).reduce((n,x)=>n+num(x.value),0)||num(o.totalValue);}
function collectionCoverage(){
  const total=state.doctors.length||1;
  const hospital=state.doctors.filter(d=>doctorHospital(d)).length;
  const address=state.doctors.filter(d=>d.address).length;
  const gps=state.doctors.filter(d=>d.latitude&&d.longitude).length;
  const timing=state.doctors.filter(d=>doctorMeetingSlots(d).length&&normalizeMeetingDays(d.meetingDays).length).length;
  const linked=state.doctors.filter(d=>linkedChemist(d)).length;
  const score=Math.round(((hospital+address+gps+timing+linked)/(total*5))*100);
  return {total:state.doctors.length,hospital,address,gps,timing,linked,score,distributors:state.distributors.length};
}
function haversineKm(aLat,aLng,bLat,bLng){
  const R=6371,toRad=x=>Number(x)*Math.PI/180,dLat=toRad(bLat-aLat),dLng=toRad(bLng-aLng),a=Math.sin(dLat/2)**2+Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function locationAuditForVisit(visit){
  const doctor=doctorById(visit?.doctorId),visitLat=num(visit?.latitude),visitLng=num(visit?.longitude),hasSnapshot=Object.prototype.hasOwnProperty.call(visit||{},'hospitalLatitude'),masterLat=num(hasSnapshot?visit?.hospitalLatitude:doctor?.latitude),masterLng=num(hasSnapshot?visit?.hospitalLongitude:doctor?.longitude),accuracy=num(visit?.locationAccuracy);
  if(!visitLat||!visitLng)return {status:'Missing visit GPS',distanceMeters:'',accuracyMeters:accuracy||'',quality:'missing'};
  if(!masterLat||!masterLng)return {status:'Hospital GPS pending',distanceMeters:'',accuracyMeters:accuracy||'',quality:'pending'};
  const distance=Math.round(haversineKm(visitLat,visitLng,masterLat,masterLng)*1000);
  const poorAccuracy=accuracy>100,quality=distance<=250&&!poorAccuracy?'verified':distance<=750?'review':'mismatch';
  const status=quality==='verified'?'Verified at hospital':quality==='review'?'Review location':'Location mismatch';
  return {status,distanceMeters:distance,accuracyMeters:accuracy||'',quality};
}
function todaySlot(doctor,at=now()){
  const days=normalizeMeetingDays(doctor.meetingDays),slots=doctorMeetingSlots(doctor),day=at.getDay(),cur=at.getHours()*60+at.getMinutes();
  if(!days.includes(day))return null;
  const candidates=slots.map(s=>({...s,start:timeMinutes(s.from),end:timeMinutes(s.to)})).filter(s=>s.end>=cur).sort((a,b)=>a.start-b.start);
  if(!candidates.length)return null;
  const slot=candidates[0]; return {...slot,state:cur>=slot.start?'available':'upcoming',target:Math.max(cur,slot.start)};
}
function routeCandidates(lat,lng,includeVisited=false){
  const visited=new Set(rowsForDay().map(v=>v.doctorId).filter(Boolean));
  const list=state.doctors.map(d=>({doctor:d,slot:todaySlot(d)})).filter(x=>x.slot&&x.doctor.latitude&&x.doctor.longitude&&(includeVisited||!visited.has(x.doctor.id)));
  const remaining=[...list],route=[];let pLat=num(lat),pLng=num(lng),clock=now().getHours()*60+now().getMinutes();
  while(remaining.length){
    const ranked=remaining.map(x=>{
      const distance=haversineKm(pLat,pLng,x.doctor.latitude,x.doctor.longitude);
      const travel=Math.max(4,Math.round(distance/24*60));
      const rawArrival=clock+travel;
      const arrival=Math.max(rawArrival,x.slot.start);
      const wait=Math.max(0,x.slot.start-rawArrival);
      const late=Math.max(0,arrival-x.slot.end);
      const score=(late?100000+late*100:0)+wait*0.35+distance*3;
      return {...x,distance,travelMinutes:travel,arrivalMinutes:arrival,waitMinutes:wait,timingRisk:late>0,lateMinutes:late,score};
    }).sort((a,b)=>a.score-b.score||a.arrivalMinutes-b.arrivalMinutes);
    const chosen=ranked[0],idx=remaining.findIndex(x=>x.doctor.id===chosen.doctor.id);
    remaining.splice(idx,1);route.push(chosen);pLat=num(chosen.doctor.latitude);pLng=num(chosen.doctor.longitude);clock=chosen.arrivalMinutes+12;
  }
  return route;
}
function googleRouteUrl(lat,lng,route){
  if(!route.length)return '';
  const points=route.slice(0,9),dest=points[points.length-1].doctor,waypoints=points.slice(0,-1).map(x=>`${x.doctor.latitude},${x.doctor.longitude}`).join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${lat},${lng}`)}&destination=${encodeURIComponent(`${dest.latitude},${dest.longitude}`)}${waypoints?`&waypoints=${encodeURIComponent(waypoints)}`:''}&travelmode=driving`;
}
function minuteLabel(value){
  const m=Math.max(0,Math.round(num(value))),h=Math.floor(m/60)%24,min=m%60,d=new Date(2000,0,1,h,min);return d.toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'});
}
function savedHospitalGroups(lat,lng,radiusMeters=1000){
  const groups=new Map();
  state.doctors.forEach(d=>{
    const hospital=doctorHospital(d);if(!hospital||!d.latitude||!d.longitude)return;
    const key=d.placeId?`place:${d.placeId}`:`name:${norm(hospital)}:${Number(d.latitude).toFixed(4)}:${Number(d.longitude).toFixed(4)}`;
    if(!groups.has(key))groups.set(key,{id:`saved:${key}`,source:'saved',placeId:d.placeId||'',name:hospital,address:d.address||d.area||'',latitude:num(d.latitude),longitude:num(d.longitude),openingHours:d.hospitalOpeningHours||[],doctorIds:[]});
    groups.get(key).doctorIds.push(d.id);
  });
  return [...groups.values()].map(x=>({...x,distanceKm:haversineKm(lat,lng,x.latitude,x.longitude)})).filter(x=>x.distanceKm*1000<=radiusMeters).sort((a,b)=>a.distanceKm-b.distanceKm);
}
function nearbyResultCard(x){
  const doctors=(x.doctorIds||[]).map(doctorById).filter(Boolean),timings=doctors.map(doctorMeetingStatus),available=timings.filter(t=>t.state==='available').length;
  const timingText=available?`${available} doctor${available===1?'':'s'} available now`:doctors.length?`${doctors.length} linked doctor${doctors.length===1?'':'s'}`:'No linked doctor yet';
  const hours=(x.openingHours||[]).slice(0,2).join(' • ');
  return `<button class="nearby-place-card plain-button" data-nearby-place-id="${esc(x.id)}"><div class="nearby-place-distance">${esc(x.distanceKm.toFixed(2))}<small>km</small></div><div class="nearby-place-copy"><h3>${esc(x.name)}</h3><p>${esc(x.address||'Address unavailable')}</p><small>${esc(timingText)}${hours?` • ${esc(hours)}`:''}</small></div><span class="source-pill ${x.source==='live'?'live':''}">${x.source==='live'?'Google':'Saved'}</span></button>`;
}
function mergeNearbyPlaces(saved,live,lat,lng,radiusMeters){
  const all=[],seen=new Set();
  [...saved,...live].forEach(x=>{
    const distanceKm=x.distanceKm??haversineKm(lat,lng,x.latitude,x.longitude);if(distanceKm*1000>radiusMeters)return;
    const key=x.placeId?`p:${x.placeId}`:`n:${norm(x.name)}:${Number(x.latitude).toFixed(3)}:${Number(x.longitude).toFixed(3)}`;
    if(seen.has(key))return;seen.add(key);const savedMatch=saved.find(s=>(x.placeId&&s.placeId===x.placeId)||(!x.placeId&&norm(s.name)===norm(x.name)&&haversineKm(s.latitude,s.longitude,x.latitude,x.longitude)<0.12));
    all.push({...x,distanceKm,doctorIds:savedMatch?.doctorIds||x.doctorIds||[],source:savedMatch?'saved':x.source});
  });
  return all.sort((a,b)=>a.distanceKm-b.distanceKm);
}
window.__mrNearbyPlaces=(prefix,ok,json,error)=>{
  const out=$('#nearbyResults'),status=$('#nearbyLiveStatus');if(!out)return;
  if(!ok){if(status)status.textContent=error||'Live hospital search unavailable.';return;}
  try{
    const live=JSON.parse(json||'[]').filter(x=>Number.isFinite(Number(x.latitude))&&Number.isFinite(Number(x.longitude))).map((x,i)=>({...x,latitude:num(x.latitude),longitude:num(x.longitude),id:`live:${x.placeId||i}`,source:'live',doctorIds:[]}));
    live.forEach(x=>nearbyPlaceCache.set(x.id,x));
    const lat=num($('#nearbyLatitude').value),lng=num($('#nearbyLongitude').value),radius=num($('#nearbyRadius').value)||1000,saved=savedHospitalGroups(lat,lng,radius),merged=mergeNearbyPlaces(saved,live,lat,lng,radius);
    merged.forEach(x=>nearbyPlaceCache.set(x.id,x));out.innerHTML=merged.length?merged.map(nearbyResultCard).join(''):empty('No hospital or clinic found in this radius.');
    if(status)status.textContent=`${live.length} live places received • Powered by Google`;
  }catch(e){if(status)status.textContent=`Could not read live results: ${e.message}`;}
};
function chooseNearbyHospital(place){
  if(!place)return;const linked=(place.doctorIds||[]).map(doctorById).filter(Boolean);
  openSheet(place.name,`${place.distanceKm.toFixed(2)} km away • ${place.source==='live'?'Google place':'saved master location'}`,`<div class="detail-section"><h4>Hospital details</h4><div class="note-box">${esc(place.address||'Address unavailable')}<br><a href="${mapUrl(place.latitude,place.longitude)}" target="_blank" rel="noopener">Open exact map</a></div></div><div class="detail-section"><h4>Which doctor do you want to meet?</h4><div id="nearbyDoctorResults">${linked.length?linked.map(d=>`<button class="mini-card plain-button" data-nearby-doctor-id="${d.id}"><span class="mini-icon">⚕</span><span class="mini-copy"><h3>${esc(d.name)}</h3><p>${esc([doctorMeetingStatus(d).label,linkedChemist(d)?.name].filter(Boolean).join(' • '))}</p></span></button>`).join(''):empty('No doctor is linked to this hospital yet. Search the accurate doctor below.')}</div><label class="search-box nearby-doctor-search"><span>⌕</span><input id="nearbyDoctorSearch" type="search" placeholder="Search accurate doctor name…"></label><div id="nearbyDoctorSearchResults" class="search-results lookup-results hidden"></div></div><div class="google-attribution">Powered by Google when live place data is shown.</div>`);
  const selectDoctor=id=>{const d=doctorById(id);if(!d)return;d.hospital=place.name;d.address=place.address||d.address;d.latitude=place.latitude;d.longitude=place.longitude;d.placeId=place.placeId||d.placeId||'';d.hospitalOpeningHours=place.openingHours||d.hospitalOpeningHours||[];d.locationSource=place.source==='live'?'Google Places':'Saved location';d.locationCapturedAt=new Date().toISOString();d.updatedAt=new Date().toISOString();saveState(false);closeSheet();quickMeeting(d.id,'');toast('Hospital name and exact location linked to doctor.');};
  $('#nearbyDoctorResults').addEventListener('click',e=>{const b=e.target.closest('[data-nearby-doctor-id]');if(b)selectDoctor(b.dataset.nearbyDoctorId);});
  const input=$('#nearbyDoctorSearch'),results=$('#nearbyDoctorSearchResults');input.addEventListener('input',()=>{const q=clean(input.value).toLowerCase();if(!q){results.classList.add('hidden');return;}const list=state.doctors.filter(d=>[d.name,doctorHospital(d),d.area,d.address].join(' ').toLowerCase().includes(q)).slice(0,12);results.innerHTML=list.length?list.map(d=>`<button type="button" data-nearby-doctor-id="${d.id}"><strong>${esc(d.name)}</strong><small>${esc(doctorHospital(d)||'Hospital not linked')}</small></button>`).join(''):empty('No doctor match. Add the doctor first from Doctors.');results.classList.remove('hidden');});
  results.addEventListener('click',e=>{const b=e.target.closest('[data-nearby-doctor-id]');if(b)selectDoctor(b.dataset.nearbyDoctorId);});
}
function discoverNearbyHospitals(){
  nearbyPlaceCache.clear();const defaultRadius=num(state.settings.nearbyRadiusMeters)||1000;
  openSheet('Nearby hospitals','Stand at the location, fetch GPS, then select the hospital and accurate doctor.',`<div class="location-card"><div class="location-head"><div><strong>My current location</strong><small id="nearbyLocationStatus" class="location-status loading">Preparing GPS…</small></div><button type="button" id="nearbyFetchLocation" class="btn secondary compact">Fetch GPS</button></div><a id="nearbyLocationMap" class="hidden" target="_blank" rel="noopener">View my map</a><input id="nearbyLatitude" type="hidden"><input id="nearbyLongitude" type="hidden"><input id="nearbyAccuracy" type="hidden"><input id="nearbyCapturedAt" type="hidden"></div><div class="nearby-controls"><label><span>Search radius</span><select id="nearbyRadius"><option value="500" ${defaultRadius===500?'selected':''}>500 m</option><option value="1000" ${defaultRadius===1000?'selected':''}>1 km</option><option value="2000" ${defaultRadius===2000?'selected':''}>2 km</option><option value="5000" ${defaultRadius===5000?'selected':''}>5 km</option></select></label><button id="nearbyLiveSearchBtn" type="button" class="btn primary">Search live hospitals</button></div><small id="nearbyLiveStatus" class="muted-line">Saved hospitals appear first. Live search needs a configured Google Places API key and internet.</small><div id="nearbyResults">${empty('Fetching current location…')}</div><div class="google-attribution">Powered by Google • live place results</div>`);
  const renderSaved=()=>{const lat=num($('#nearbyLatitude').value),lng=num($('#nearbyLongitude').value),radius=num($('#nearbyRadius').value)||1000;if(!lat||!lng)return;state.settings.nearbyRadiusMeters=radius;saveState(false);const saved=savedHospitalGroups(lat,lng,radius);saved.forEach(x=>nearbyPlaceCache.set(x.id,x));$('#nearbyResults').innerHTML=saved.length?saved.map(nearbyResultCard).join(''):empty('No saved hospital in this radius. Tap Search live hospitals.');};
  document.addEventListener('mr-location-ready',e=>{if(e.detail.prefix==='nearby')renderSaved();},{once:true});
  $('#nearbyRadius').addEventListener('change',renderSaved);$('#nearbyResults').addEventListener('click',e=>{const b=e.target.closest('[data-nearby-place-id]');if(b)chooseNearbyHospital(nearbyPlaceCache.get(b.dataset.nearbyPlaceId));});
  $('#nearbyLiveSearchBtn').addEventListener('click',()=>{const lat=num($('#nearbyLatitude').value),lng=num($('#nearbyLongitude').value),radius=num($('#nearbyRadius').value)||1000;if(!lat||!lng){toast('Fetch current GPS first.');return;}const status=$('#nearbyLiveStatus');status.textContent='Searching live hospitals and clinics…';if(window.AndroidBridge?.searchNearbyHospitals){window.AndroidBridge.searchNearbyHospitals('nearby',lat,lng,radius);return;}status.textContent='Live search is available in the Android APK. Saved nearby hospitals are shown above.';});
  setupLocationCapture('nearby',true);
}

  function renderAll() { renderHeader(); renderDashboard(); renderDoctors(); renderChemists(); renderVisits(); renderTools(); }
  function renderHeader() {
    $('#profileLine').textContent = `${state.profile.hq || 'My HQ'} • ${state.profile.tmName || 'TM'}`;
    const h=now().getHours();
    $('#greeting').textContent = h<12?'Good morning':h<17?'Good afternoon':'Good evening';
    $('#todayLabel').textContent = now().toLocaleDateString('en-IN',{weekday:'short',day:'2-digit',month:'short'}).toUpperCase();
    $('#routeLabel').textContent = state.settings.workflowMode==='collect'?'Data gathering mode: save doctor, hospital, chemist, timing and verify hospital GPS once.':'Search doctor or hospital → timing → feedback / order → save.';
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
    const cov=collectionCoverage(), mode=state.settings.workflowMode||'collect';
    $('#collectionModeTitle').textContent=mode==='collect'?'Data gathering mode':'Field work mode';
    $('#collectionModeText').textContent=mode==='collect'?'First collect correct doctor, hospital, chemist, timing and hospital GPS verification. The Machine will use this saved data later.':'Smart patch, orders and reports now use your collected master data.';
    $('#collectionProgressBar').style.width=`${Math.min(100,cov.score)}%`;
    $('#collectionProgressText').textContent=`${cov.score}% ready • ${cov.gps}/${cov.total} GPS • ${cov.timing}/${cov.total} timings • ${cov.linked}/${cov.total} chemist links`;
    $('#workflowModeBtn').textContent=mode==='collect'?'Switch to field work':'Back to data gathering';
    const routeReady=state.doctors.filter(d=>todaySlot(d)&&d.latitude&&d.longitude&&!rowsForDay().some(v=>v.doctorId===d.id)).length;
    $('#nearbyReadyCount').textContent=state.doctors.filter(d=>doctorHospital(d)&&d.latitude&&d.longitude).length;
    $('#routeReadyCount').textContent=routeReady;
    $('#routeReadyText').textContent=routeReady?`${routeReady} unvisited doctors have saved timing + hospital GPS`:`Add doctor timing and verify hospital GPS once`;
    renderMachineDashboard();
    const orders=ordersForDay().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    $('#todayOrderCount').textContent=orders.length;
    $('#todayOrderValue').textContent=`₹${orders.reduce((n,o)=>n+orderTotal(o),0).toLocaleString('en-IN')}`;
    $('#recentOrderList').innerHTML=orders.length?orders.slice(0,4).map(orderMiniCard).join(''):empty('No distributor order today.');
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


function orderMiniCard(o){
  const d=distributorById(o.distributorId),items=(o.items||[]).map(x=>`${x.product}${x.qty?` ×${x.qty}`:''}`).join(', ');
  return `<button class="mini-card plain-button" data-action="view-order" data-id="${esc(o.id)}"><span class="mini-icon">₹</span><span class="mini-copy"><h3>${esc(o.chemistName||o.doctorName||'POB order')}</h3><p>${esc([d?.name||o.distributorName,items].filter(Boolean).join(' • '))}</p></span><span class="mini-side"><strong>₹${esc(orderTotal(o).toLocaleString('en-IN'))}</strong><small>${esc(prettyTime(o.date))}</small></span></button>`;
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
      [r.needsCompletion&&'Needs completion',r.latitude&&'Clinic GPS',r.lastVisit&&`Last ${prettyDate(r.lastVisit)}`,r.nextFollowUp&&`Due ${prettyDate(r.nextFollowUp)}`].filter(Boolean):
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
    const subtitle=[v.outcomeLabel||OUTCOME_LABELS[v.outcome]||'',v.chemistName,v.latitude?'Hospital GPS verified':'',v.followUpDate?`Follow-up ${prettyDate(v.followUpDate)}`:''].filter(Boolean).join(' • ');
    return `<div class="timeline-item"><span class="timeline-dot"></span><article class="visit-card"><div class="visit-top"><h3>${esc([v.doctorName||v.entityName, v.doctorHospital].filter(Boolean).join(' — ')||'Meeting')}</h3><time>${esc(prettyDate(v.date))} ${esc(prettyTime(v.date))}</time></div><p>${esc(subtitle||v.notes||'Meeting saved')}</p><div class="tag-row">${statuses.slice(0,5).map(([p,s])=>`<span class="tag ${statusClass(s)}">${esc(p)}: ${esc(statusLabel(s))}</span>`).join('')}</div><div class="visit-footer"><small>${esc(v.notes||'')}</small><button data-action="view-visit" data-id="${esc(v.id)}">Details</button></div></article></div>`;
  }

  function renderTools() {
    const p=state.profile,f=$('#profileForm');
    if(f) ['tmName','hq','joinWorkWith','companyDivision','products'].forEach(k=>{if(f.elements[k]&&document.activeElement!==f.elements[k])f.elements[k].value=p[k]||'';});
    const month=monthKey(localISODate());
    if(state.opening.monthKey!==month) state.opening={monthKey:month,...metricBlank()};
    $('#openingFields').innerHTML=METRICS.map(([k,label])=>`<label><span>${esc(label)}</span><input name="${k}" type="number" step="${k==='pobValue'?'0.01':'1'}" min="0" value="${esc(state.opening[k]||0)}"></label>`).join('');
    $('#importHistory').innerHTML=state.imports.slice().reverse().slice(0,6).map(i=>`<div class="import-item"><div><strong>${esc(i.file)}</strong><small>${esc(i.summary)}</small></div><small>${esc(prettyDate(i.date))}</small></div>`).join('');
    $('#distributorCountText').textContent=`${state.distributors.length} distributors • ${state.orders.length} orders`;
    const active=state.schemes.filter(x=>schemeState(x)==='active').length;
    $('#schemeCountText').textContent=`${active} active • ${state.schemes.length} total date-wise schemes`;
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
  function closeSheet(){ if(window.AndroidBridge?.stopVoiceCapture)window.AndroidBridge.stopVoiceCapture();voiceHandlers?.clear?.();$('#sheetBackdrop').classList.add('hidden');$('#editorSheet').classList.add('hidden');document.body.style.overflow=''; }
  function toast(text){const el=$('#toast');el.textContent=text;el.classList.remove('hidden');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.add('hidden'),2600);}

  function doctorOptions(selected='') {
    return `<option value="">Select doctor</option>${state.doctors.slice().sort((a,b)=>doctorDisplayName(a).localeCompare(doctorDisplayName(b))).map(d=>`<option value="${esc(d.id)}" ${d.id===selected?'selected':''}>${esc(doctorDisplayName(d))}${d.area?` • ${esc(d.area)}`:''}</option>`).join('')}`;
  }
  function chemistOptions(selected='') {
    return `<option value="">Select chemist</option>${state.chemists.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(c=>`<option value="${esc(c.id)}" ${c.id===selected?'selected':''}>${esc(c.name)}${c.area?` — ${esc(c.area)}`:''}</option>`).join('')}`;
  }

function distributorOptions(selected=''){
  return `<option value="">Select distributor</option>${state.distributors.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(d=>`<option value="${esc(d.id)}" ${d.id===selected?'selected':''}>${esc(d.name)}${d.area?` — ${esc(d.area)}`:''}</option>`).join('')}`;
}
function productOptions(selected=''){
  return `<option value="">Select product</option>${productCatalog().map(p=>`<option value="${esc(p)}" ${norm(p)===norm(selected)?'selected':''}>${esc(p)}</option>`).join('')}`;
}
function orderItemRow(item={},index=0){
  const scheme=activeScheme(item.product,item.pack);
  return `<div class="order-item-row" data-order-item><label><span>Product</span><select name="orderProduct">${productOptions(item.product)}</select></label><label><span>Pack</span><input name="orderPack" value="${esc(item.pack||scheme?.pack||'')}" placeholder="200 GM"></label><label><span>Qty</span><input name="orderQty" type="number" min="0" step="1" value="${esc(item.qty||1)}"></label><label><span>Value ₹</span><input name="orderValue" type="number" min="0" step="0.01" value="${esc(item.value||0)}"></label><button type="button" class="remove-order-item" data-remove-order-item aria-label="Remove">×</button><small class="scheme-hint">${scheme?`Active offer: ${esc(scheme.ratio)} • till ${esc(prettyDate(scheme.endDate))}`:'No active offer matched'}</small></div>`;
}
function bindOrderItems(root){
  root?.addEventListener('click',e=>{const r=e.target.closest('[data-remove-order-item]');if(r){r.closest('[data-order-item]')?.remove();updateOrderTotal(root);} });
  root?.addEventListener('change',e=>{if(e.target.matches('select[name="orderProduct"],input[name="orderPack"]')){const row=e.target.closest('[data-order-item]'),p=$('select[name="orderProduct"]',row).value,pack=$('input[name="orderPack"]',row).value,sch=activeScheme(p,pack)||activeScheme(p);$('.scheme-hint',row).textContent=sch?`Active offer: ${sch.ratio} • till ${prettyDate(sch.endDate)}`:'No active offer matched';if(!pack&&sch)$('input[name="orderPack"]',row).value=sch.pack||'';}updateOrderTotal(root);});
  root?.addEventListener('input',()=>updateOrderTotal(root));
}
function collectOrderItems(root){return $$('[data-order-item]',root).map(row=>({product:clean($('select[name="orderProduct"]',row).value),pack:clean($('input[name="orderPack"]',row).value),qty:num($('input[name="orderQty"]',row).value),value:num($('input[name="orderValue"]',row).value),schemeRatio:clean($('.scheme-hint',row)?.textContent.replace(/^Active offer:\s*/,'').split(' • ')[0])})).filter(x=>x.product);}
function updateOrderTotal(root){const total=collectOrderItems(root).reduce((n,x)=>n+x.value,0),el=$('[data-order-total]',root);if(el)el.textContent=`₹${total.toLocaleString('en-IN',{maximumFractionDigits:2})}`;}

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
    if(ok){lat.value=latitude;lng.value=longitude;accuracy.value=Math.round(acc||0);captured.value=new Date().toISOString();status.textContent=`GPS ready • accuracy about ${Math.round(acc||0)} m`;status.className='location-status success';map.href=mapUrl(latitude,longitude);map.classList.remove('hidden');button.textContent='Refresh GPS';document.dispatchEvent(new CustomEvent('mr-location-ready',{detail:{prefix,latitude,longitude}}));}
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
        map.href=mapUrl(latitude,longitude);map.classList.remove('hidden');button.textContent='Refresh GPS';button.disabled=false;document.dispatchEvent(new CustomEvent('mr-location-ready',{detail:{prefix,latitude,longitude}}));
      },err=>{
        const message=err.code===1?'Location permission denied. Allow Location for Chrome/this app.':err.code===2?'GPS unavailable. Turn on phone Location.':'Location timed out. Tap Retry.';
        status.textContent=message;status.className='location-status error';button.textContent='Retry GPS';button.disabled=false;
      },{enableHighAccuracy:true,timeout:12000,maximumAge:30000});
    };
    button.addEventListener('click',run); if(auto)setTimeout(run,180);
  }

  const voiceHandlers = new Map();
  window.__mrVoiceUpdate = (prefix,voiceState,text,isFinal,error) => {
    const handler=voiceHandlers.get(prefix);
    if(handler)handler({state:voiceState,text:clean(text),isFinal:Boolean(isFinal),error:clean(error)});
  };

  function voiceProductNames(){
    const raw=[...focusProducts(),...productCatalog()].map(clean).filter(Boolean),byKey=new Map();
    for(const name of raw){
      const key=norm(name);if(key&&!byKey.has(key))byKey.set(key,name);
      const root=clean(name.replace(/\b(?:oral solution|drops?|powder|syrup|oil|chocolate|milk masala|hp|pouch|tablet|capsule)\b.*$/i,''));
      const rootKey=norm(root);if(rootKey.length>=4&&!byKey.has(rootKey))byKey.set(rootKey,root);
    }
    return [...byKey.values()].sort((a,b)=>b.length-a.length);
  }
  function mentionedRecord(list,label,text){
    const compact=norm(text);
    return list.map(item=>({item,label:clean(label(item)),key:norm(label(item))})).filter(x=>x.key.length>=4&&compact.includes(x.key)).sort((a,b)=>b.key.length-a.key.length)[0]?.item||null;
  }
  function voicePhrase(text,endingPattern){
    const source=String(text||'').replace(/\s+/g,' ').trim();
    const re=new RegExp(`(?:^|\\b(?:at|from|under|in|visit|visited|name is)\\s+)([a-z0-9&.'’ -]{2,70}?${endingPattern})(?=\\s+(?:timing|time|open|close|closed|chemist|medical|doctor|dr|prescribed|not|product|address|phone|mobile|today|tomorrow|follow|order|pob|qty|quantity)\\b|[,.]|$)`,'i');
    const m=source.match(re);return clean(m?.[1]||'').replace(/^(?:at|from|under|in)\s+/i,'');
  }
  function parseDoctorName(text){
    const m=String(text||'').match(/\b(?:dr|doctor)\.?\s+([a-z][a-z.'’ -]{1,60})/i);if(!m)return '';
    return clean(m[1].split(/\b(?:at|from|under|in|hospital|clinic|medical|chemist|timing|time|open|close|closed|prescribed|not prescribed|product|address|today|tomorrow|follow|order|pob|pediatric|paediatric|surgeon|physician|consultant|gynecologist|gynaecologist|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)[0]).replace(/[,.]+$/,'');
  }
  function parseVoiceClock(hour,minute,ampm,context,otherAmpm){
    let h=Number(hour),m=Number(minute||0),ap=clean(ampm||otherAmpm).toLowerCase();
    const ctx=clean(context).toLowerCase();
    if(!ap){if(/evening|night|shaam/.test(ctx)&&h<12)ap='pm';else if(/morning|subah/.test(ctx))ap='am';}
    if(ap==='pm'&&h<12)h+=12;if(ap==='am'&&h===12)h=0;
    if(h>=0&&h<24&&m>=0&&m<60)return `${pad(h)}:${pad(m)}`;return '';
  }
  function parseVoiceRanges(text){
    const source=String(text||''),out=[];
    const re=/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|till|until|[-–])\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi;
    let m;
    while((m=re.exec(source))&&out.length<2){
      const before=source.slice(Math.max(0,m.index-24),m.index),after=source.slice(re.lastIndex,Math.min(source.length,re.lastIndex+18)),context=`${before} ${after}`;
      const from=parseVoiceClock(m[1],m[2],m[3],context,m[6]);
      const to=parseVoiceClock(m[4],m[5],m[6],context,m[3]);
      if(from&&to&&timeMinutes(to)>timeMinutes(from))out.push({from,to});
    }
    return out;
  }
  function parseVoiceDetails(text){
    const source=clean(text),lower=source.toLowerCase(),compact=norm(source);
    const existingDoctor=mentionedRecord(state.doctors,doctorDisplayName,source)||mentionedRecord(state.doctors,d=>d.name,source);
    const existingChemist=mentionedRecord(state.chemists,c=>c.name,source);
    const existingDistributor=mentionedRecord(state.distributors,d=>d.name,source);
    let doctorName=existingDoctor?.name||parseDoctorName(source);
    let hospital=existingDoctor?doctorHospital(existingDoctor):voicePhrase(source,'(?:hospital|clinic|nursing home|healthcare|child care(?: clinic)?|women(?:s|\'s)? hospital)');
    let chemistName=existingChemist?.name||voicePhrase(source,'(?:medical(?: stores?)?|pharmacy|chemist|drug store)');
    const distributorName=existingDistributor?.name||voicePhrase(source,'(?:distributor|agency|agencies|stockist)');
    if(!hospital){const hm=source.match(/([a-z0-9&.'’ -]{2,65}?(?:hospital|clinic|nursing home|healthcare))/i);hospital=clean(hm?.[1]||'');}
    hospital=clean(hospital).replace(/^(?:dr|doctor)\.?\s+.*?\s+(?:at|from)\s+/i,'');
    if(!chemistName){const cm=source.match(/([a-z0-9&.'’ -]{2,55}?(?:medical(?: stores?)?|pharmacy|chemist))/i);chemistName=clean(cm?.[1]||'').replace(/^.*?\b(?:under|at|from)\s+/i,'');}
    if(doctorName&&hospital&&norm(doctorName).includes(norm(hospital)))doctorName='';
    const addressMatch=source.match(/\baddress\s*(?:is|:|-)?\s*([^.;]{4,100})/i);
    const areaMatch=source.match(/\b(?:area|place|location)\s*(?:is|:|-)?\s*([^.;,]{2,45})/i);
    const phoneMatch=source.match(/\b(?:mobile|phone|contact)\s*(?:number|no)?\s*(?:is|:|-)?\s*([6-9]\d{9})\b/i)||source.match(/\b([6-9]\d{9})\b/);
    const ranges=parseVoiceRanges(source);
    let meetingDays=[];
    const closed=[];
    Object.entries(DAY_ALIASES).forEach(([name,index])=>{if(new RegExp(`\\bclosed\\s+(?:on\\s+)?${name}\\b|\\b${name}\\s+closed\\b`,'i').test(lower))closed.push(index);});
    if(/closed\s+(?:on\s+)?sunday|sunday\s+closed|ravivar|રવિવાર/.test(lower))closed.push(0);
    if(closed.includes(0)&&ranges.length)meetingDays=[1,2,3,4,5,6];
    else meetingDays=normalizeMeetingDays(source);
    if(!meetingDays.length&&ranges.length)meetingDays=[0,1,2,3,4,5,6];
    meetingDays=meetingDays.filter(d=>!closed.includes(d));
    const productStatuses={};
    for(const product of voiceProductNames()){
      const key=norm(product),idx=compact.indexOf(key);if(idx<0)continue;
      const rawIndex=Math.max(0,lower.indexOf(product.toLowerCase()));
      const context=lower.slice(Math.max(0,rawIndex-45),Math.min(lower.length,rawIndex+product.length+60));
      if(/not\s+prescribed|not\s+prescribe|nr\b|no\s+prescription|nahi\s+likh|not\s+writing/.test(context))productStatuses[product]='not_prescribed';
      else if(/prescribed|prescribe|rx\b|writing|likh/.test(context))productStatuses[product]='prescribed';
      else productStatuses[product]='';
    }
    const pobMatch=source.match(/\b(?:pob|order\s+value|value|amount)\s*(?:is|of|:|-)?\s*(?:rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    const qtyMatch=source.match(/\b(?:qty|quantity)\s*(?:is|:|-)?\s*(\d+)/i);
    const followTomorrow=/\b(?:follow[- ]?up\s+)?tomorrow\b/i.test(source);
    let followUpDate='';if(followTomorrow){const d=new Date();d.setDate(d.getDate()+1);followUpDate=localISODate(d);}
    return {
      doctorId:existingDoctor?.id||'',doctorName,hospital,chemistId:existingChemist?.id||'',chemistName,distributorId:existingDistributor?.id||'',distributorName,
      address:clean(addressMatch?.[1]||''),area:clean(areaMatch?.[1]||state.profile.hq||''),mobile:clean(phoneMatch?.[1]||''),meetingDays,closedDays:[...new Set(closed)],
      meetingFrom:ranges[0]?.from||'',meetingTo:ranges[0]?.to||'',meetingFrom2:ranges[1]?.from||'',meetingTo2:ranges[1]?.to||'',productStatuses,
      pobValue:num(String(pobMatch?.[1]||'').replace(/,/g,'')),quantity:num(qtyMatch?.[1]),followUpDate,transcript:source,
      shouldLog:/\b(today|visited|visit|met|meeting|call)\b/i.test(source)||Object.values(productStatuses).some(Boolean)||Boolean(pobMatch)
    };
  }
  function applyStatusMap(root,statuses){
    $$('.product-status-row',root).forEach(row=>{
      const value=statuses[row.dataset.product]??statuses[Object.keys(statuses).find(k=>norm(k)===norm(row.dataset.product))]??'';
      const hidden=$('input[type="hidden"]',row);hidden.value=value||'';
      $$('[data-status]',row).forEach(x=>{x.classList.remove('selected','prescribed','not-prescribed');if(x.dataset.status===(value||'')){x.classList.add('selected');if(value==='prescribed')x.classList.add('prescribed');if(value==='not_prescribed')x.classList.add('not-prescribed');}});
    });
  }
  function voiceProductRows(statuses={}){
    const products=[...new Map([...voiceProductNames(),...Object.keys(statuses)].map(x=>[norm(x),clean(x)])).values()].filter(Boolean);
    return products.length?products.map((p,i)=>{const s=statuses[p]||statuses[Object.keys(statuses).find(k=>norm(k)===norm(p))]||'';return `<div class="product-status-row" data-product="${esc(p)}"><div class="product-name"><strong>${esc(p)}</strong><small>Detected from voice or tap manually</small></div><div class="status-buttons"><button type="button" data-status="prescribed" class="${s==='prescribed'?'selected prescribed':''}">✓ Prescribed</button><button type="button" data-status="not_prescribed" class="${s==='not_prescribed'?'selected not-prescribed':''}">× Not</button><button type="button" data-status="" class="clear-status ${!s?'selected':''}">—</button></div><input type="hidden" name="voiceProductStatus_${i}" value="${esc(s)}"></div>`;}).join(''):empty('No products available.');
  }
  function voiceControlsHtml(prefix){return `<div class="voice-capture-card"><div class="voice-head"><div><strong>Voice capture</strong><small id="${prefix}VoiceStatus">Tap Start and speak naturally</small></div><div class="voice-buttons"><button type="button" id="${prefix}VoiceStart" class="btn primary compact">🎙 Start</button><button type="button" id="${prefix}VoiceStop" class="btn secondary compact" disabled>Stop</button></div></div><div id="${prefix}VoiceLive" class="voice-live hidden"></div></div>`;}
  function bindVoiceControls(prefix,onTranscript){
    const start=$(`#${prefix}VoiceStart`),stop=$(`#${prefix}VoiceStop`),status=$(`#${prefix}VoiceStatus`),live=$(`#${prefix}VoiceLive`);let finalParts=[];
    const updateTranscript=()=>onTranscript(clean(finalParts.join(' ')));
    voiceHandlers.set(prefix,event=>{
      if(event.state==='result'&&event.text){finalParts.push(event.text);live.textContent=clean(finalParts.join(' '));live.classList.remove('hidden');updateTranscript();}
      else if(event.state==='partial'&&event.text){live.textContent=clean([...finalParts,event.text].join(' '));live.classList.remove('hidden');}
      if(event.state==='starting')status.textContent='Starting microphone…';
      if(event.state==='listening'||event.state==='speech'){status.textContent='Listening… speak doctor, hospital, chemist, timing and products';start.disabled=true;stop.disabled=false;}
      if(event.state==='processing')status.textContent='Processing speech…';
      if(event.state==='stopped'){status.textContent='Stopped. Review the filled details.';start.disabled=false;stop.disabled=true;updateTranscript();}
      if(event.state==='error'){status.textContent=event.error||'Voice capture stopped';status.className='voice-error';start.disabled=false;stop.disabled=true;}
    });
    start.addEventListener('click',()=>{status.className='';if(window.AndroidBridge?.startVoiceCapture)window.AndroidBridge.startVoiceCapture(prefix);else{status.textContent='Voice auto-fill requires the Android APK.';toast('Install the Android APK for voice capture.');}});
    stop.addEventListener('click',()=>{if(window.AndroidBridge?.stopVoiceCapture)window.AndroidBridge.stopVoiceCapture();});
    return {setText:text=>{finalParts=clean(text)?[clean(text)]:[];live.textContent=clean(text);live.classList.toggle('hidden',!clean(text));},dispose:()=>voiceHandlers.delete(prefix)};
  }
  function findOrCreateChemist(details){
    let chemist=chemistById(details.chemistId)||state.chemists.find(c=>norm(c.name)===norm(details.chemistName));
    if(!chemist&&details.chemistName){chemist={id:uid('ch'),name:details.chemistName,address:'',area:details.area||state.profile.hq,hq:state.profile.hq,notes:'Added from voice capture',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};state.chemists.push(chemist);}
    return chemist||null;
  }
  function findOrCreateDoctor(details,chemist){
    let doctor=doctorById(details.doctorId)||state.doctors.find(d=>(details.doctorName&&norm(d.name)===norm(details.doctorName))||(details.hospital&&norm(doctorHospital(d))===norm(details.hospital)&&(!details.doctorName||norm(d.name)===norm(details.doctorName))));
    if(!doctor&&(details.doctorName||details.hospital)){
      const fallback=details.doctorName||details.hospital;
      doctor={id:uid('dr'),name:fallback,hospital:details.hospital||'',address:'',area:details.area||state.profile.hq,hq:state.profile.hq,needsCompletion:!details.doctorName,recordKind:details.doctorName?'doctor':'hospital',notes:'Added from voice capture',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};state.doctors.push(doctor);
    }
    if(!doctor)return null;
    if(details.doctorName)doctor.name=details.doctorName;if(details.hospital)doctor.hospital=details.hospital;if(details.address)doctor.address=details.address;if(details.area)doctor.area=details.area;if(details.mobile)doctor.mobile=details.mobile;
    if(details.doctorName)doctor.needsCompletion=false;
    if(details.meetingDays.length)doctor.meetingDays=details.meetingDays;if(details.meetingFrom){doctor.meetingFrom=details.meetingFrom;doctor.meetingTo=details.meetingTo;}if(details.meetingFrom2){doctor.meetingFrom2=details.meetingFrom2;doctor.meetingTo2=details.meetingTo2;}
    if(details.closedDays.length)doctor.closedDays=details.closedDays;if(chemist){doctor.linkedChemistId=chemist.id;doctor.chemistName=chemist.name;}
    doctor.updatedAt=new Date().toISOString();return doctor;
  }
  function voiceDataCapture(){
    openSheet('Voice data capture','Speak naturally. The app extracts and fills available details; missing fields can be completed later.',`
      <form id="voiceCaptureForm" class="sheet-form">
        ${voiceControlsHtml('master')}
        <label><span>Captured speech</span><textarea id="voiceTranscript" rows="4" placeholder="Example: Dr Ruchi at Me and Mummy Women’s Hospital, timing 10 AM to 12 PM and 5 PM to 8 PM, Sunday closed, under Uma Medical, Simyl MCT prescribed"></textarea></label>
        <button type="button" id="extractVoiceBtn" class="btn secondary full">Extract and fill details</button>
        <div class="form-section-title"><h3>Review detected details</h3><p>Only captured information is filled. You can edit before saving.</p></div>
        <label><span>Doctor name</span><input name="doctorName" placeholder="Can remain blank during initial gathering"></label>
        <label><span>Hospital / clinic</span><input name="hospital"></label>
        <label><span>Under chemist</span><input name="chemistName"></label>
        <label><span>Distributor (optional)</span><input name="distributorName"></label>
        <label><span>Address</span><textarea name="address" rows="2"></textarea></label>
        <div class="field-grid two"><label><span>Area</span><input name="area" value="${esc(state.profile.hq||'')}"></label><label><span>Phone</span><input name="mobile" inputmode="tel"></label></div>
        <div class="schedule-card"><div class="form-section-title"><h3>Opening / meeting timing</h3><p>Detected ranges and closed day are saved to the doctor/hospital record.</p></div><div class="field-grid two timing-grid"><label><span>Timing 1 from</span><input name="meetingFrom" type="time"></label><label><span>Timing 1 to</span><input name="meetingTo" type="time"></label><label><span>Timing 2 from</span><input name="meetingFrom2" type="time"></label><label><span>Timing 2 to</span><input name="meetingTo2" type="time"></label></div><label><span>Open / meeting days</span><input name="meetingDaysText" placeholder="Mon–Sat"></label><label><span>Closed day</span><input name="closedDaysText" placeholder="Sunday"></label></div>
        <div class="form-section-title"><h3>Product feedback</h3><p>Voice-detected prescribed/not prescribed status is selected below.</p></div>
        <div id="voiceProductRows" class="product-status-list">${voiceProductRows({})}</div>
        <div class="field-grid two"><label><span>POB value</span><input name="pobValue" type="number" min="0" step="0.01"></label><label><span>Follow-up date</span><input name="followUpDate" type="date"></label></div>
        <label><span>Notes</span><textarea name="notes" rows="3"></textarea></label>
        <div class="location-card"><div class="location-head"><div><strong>Hospital GPS verification (optional)</strong><small id="voiceLocationStatus" class="location-status">GPS runs only when you tap Verify.</small></div><button type="button" id="voiceFetchLocation" class="btn secondary compact">Verify hospital GPS</button></div><a id="voiceLocationMap" class="hidden" target="_blank" rel="noopener">View map</a><input id="voiceLatitude" type="hidden"><input id="voiceLongitude" type="hidden"><input id="voiceAccuracy" type="hidden"><input id="voiceCapturedAt" type="hidden"></div>
        <label class="toggle-line"><input name="logMeeting" type="checkbox"> Also log today’s meeting + 1 call</label>
        <div class="sticky-save"><button type="submit" class="btn primary full">Save captured details</button></div>
      </form>`);
    const form=$('#voiceCaptureForm'),transcript=$('#voiceTranscript');bindStatusButtons($('#voiceProductRows'));
    const fill=()=>{const d=parseVoiceDetails(transcript.value);form.elements.doctorName.value=d.doctorName;form.elements.hospital.value=d.hospital;form.elements.chemistName.value=d.chemistName;form.elements.distributorName.value=d.distributorName;form.elements.address.value=d.address;form.elements.area.value=d.area||state.profile.hq;form.elements.mobile.value=d.mobile;form.elements.meetingFrom.value=d.meetingFrom;form.elements.meetingTo.value=d.meetingTo;form.elements.meetingFrom2.value=d.meetingFrom2;form.elements.meetingTo2.value=d.meetingTo2;form.elements.meetingDaysText.value=d.meetingDays.length===6&&d.meetingDays.join(',')==='1,2,3,4,5,6'?'Mon–Sat':d.meetingDays.map(x=>DAY_NAMES[x]).join(', ');form.elements.closedDaysText.value=d.closedDays.map(x=>DAY_NAMES[x]).join(', ');form.elements.pobValue.value=d.pobValue||'';form.elements.followUpDate.value=d.followUpDate;form.elements.notes.value=d.transcript;form.elements.logMeeting.checked=d.shouldLog;$('#voiceProductRows').innerHTML=voiceProductRows(d.productStatuses);bindStatusButtons($('#voiceProductRows'));};
    bindVoiceControls('master',text=>{transcript.value=text;fill();});$('#extractVoiceBtn').addEventListener('click',fill);transcript.addEventListener('change',fill);setupLocationCapture('voice',false);
    form.addEventListener('submit',e=>{
      e.preventDefault();if(window.AndroidBridge?.stopVoiceCapture)window.AndroidBridge.stopVoiceCapture();
      const fd=new FormData(form),details=parseVoiceDetails(transcript.value);details.doctorName=clean(fd.get('doctorName'));details.hospital=clean(fd.get('hospital'));details.chemistName=clean(fd.get('chemistName'));details.distributorName=clean(fd.get('distributorName'));details.address=clean(fd.get('address'));details.area=clean(fd.get('area'));details.mobile=clean(fd.get('mobile'));details.meetingFrom=normalizeTime(fd.get('meetingFrom'));details.meetingTo=normalizeTime(fd.get('meetingTo'));details.meetingFrom2=normalizeTime(fd.get('meetingFrom2'));details.meetingTo2=normalizeTime(fd.get('meetingTo2'));details.meetingDays=normalizeMeetingDays(fd.get('meetingDaysText'));details.closedDays=normalizeMeetingDays(fd.get('closedDaysText'));details.pobValue=num(fd.get('pobValue'));details.followUpDate=clean(fd.get('followUpDate'));
      details.productStatuses={};$$('.product-status-row',$('#voiceProductRows')).forEach(row=>{const value=$('input[type="hidden"]',row).value;if(value)details.productStatuses[row.dataset.product]=value;});
      const chemist=findOrCreateChemist(details),doctor=findOrCreateDoctor(details,chemist);
      if(!doctor&&!chemist){toast('Speak or enter at least doctor, hospital or chemist name.');return;}
      const lat=num($('#voiceLatitude').value)||'',lng=num($('#voiceLongitude').value)||'',acc=num($('#voiceAccuracy').value)||'',capturedAt=$('#voiceCapturedAt').value||'';
      if(doctor&&lat&&lng){doctor.latitude=lat;doctor.longitude=lng;doctor.locationAccuracy=acc;doctor.locationCapturedAt=capturedAt;}else if(chemist&&lat&&lng){chemist.latitude=lat;chemist.longitude=lng;chemist.locationAccuracy=acc;chemist.locationCapturedAt=capturedAt;}
      if(chemist&&details.mobile&&!chemist.mobile)chemist.mobile=details.mobile;
      if(chemist&&details.distributorName){let dist=state.distributors.find(x=>norm(x.name)===norm(details.distributorName));if(!dist){dist={id:uid('dist'),name:details.distributorName,area:details.area||state.profile.hq,address:'',mobile:'',notes:'Added from voice capture',createdAt:new Date().toISOString()};state.distributors.push(dist);}chemist.linkedDistributorId=dist.id;chemist.distributorName=dist.name;}
      const logMeeting=fd.get('logMeeting')==='on'&&doctor;if(logMeeting){const date=localISODateTime(),visit={id:uid('log'),date,entityType:'doctor',entityId:doctor.id,entityName:doctor.name,doctorId:doctor.id,doctorName:doctor.name,doctorHospital:doctorHospital(doctor),chemistId:chemist?.id||'',chemistName:chemist?.name||'',productStatuses:details.productStatuses,notes:clean(fd.get('notes'))||details.transcript,followUpDate:details.followUpDate,calls:1,inputs:0,basket:0,towel:0,conversation:0,newAvailability:0,pobValue:details.pobValue,latitude:lat,longitude:lng,locationAccuracy:acc,locationCapturedAt:capturedAt,createdAt:new Date().toISOString()};state.visits.push(visit);doctor.lastVisit=localISODate();if(details.followUpDate)doctor.nextFollowUp=details.followUpDate;if(chemist)chemist.lastVisit=localISODate();}
      state.captures.push({id:uid('cap'),date:new Date().toISOString(),transcript:details.transcript,doctorId:doctor?.id||'',doctorName:doctor?.name||'',hospital:doctor?doctorHospital(doctor):details.hospital,chemistId:chemist?.id||'',chemistName:chemist?.name||'',latitude:lat,longitude:lng,parsed:details,loggedMeeting:Boolean(logMeeting)});
      saveState();voiceHandlers.delete('master');closeSheet();toast(logMeeting?'Voice details and meeting saved.':'Voice details saved. Complete missing fields later.');
    });
  }

  function quickMeeting(doctorId='',chemistId='') {
    if(!state.doctors.length){openSheet('Add doctor first','Only name, hospital, address and chemist are needed.',`<div class="note-box">No doctor is available yet.</div><div class="button-row"><button class="btn primary" data-action="add-doctor">Add doctor</button></div>`);return;}
    const requestedChemist=chemistById(chemistId)||null;
    let doctor=doctorById(doctorId)||null;
    let chemist=requestedChemist||linkedChemist(doctor)||null;
    const remembered=doctor?latestStatuses(doctor.id,chemist?.id||''):{};
    openSheet('Log meeting','Search doctor or hospital; linked details fill automatically.',`
      <form id="meetingForm" class="sheet-form">
        ${voiceControlsHtml('meeting')}
        <div class="lookup-label field-block"><span class="field-caption">Search doctor or hospital</span>
          <div class="lookup-field">
            <input id="meetingDoctorSearch" type="search" autocomplete="off" placeholder="Type doctor or hospital name…" value="${esc(doctorDisplayName(doctor))}">
            <input id="meetingDoctorId" name="doctorId" type="hidden" value="${esc(doctor?.id||'')}">
            <div id="meetingDoctorResults" class="search-results lookup-results hidden"></div>
          </div>
        </div>
        <div class="schedule-card master-data-card">
          <div class="form-section-title"><h3>Hospital, pharmacy & doctor timing</h3><p>Confirm once. These details are saved to the doctor master and auto-fill next time.</p></div>
          <label><span>Hospital / clinic name</span><input id="meetingHospital" name="hospital" value="${esc(doctorHospital(doctor))}" placeholder="Enter hospital or clinic name" autocomplete="off"></label>
          <label><span>Doctor under pharmacy / chemist</span><select name="chemistId">${chemistOptions(chemist?.id||'')}</select></label>
          <div class="schedule-quick"><button type="button" id="meetingMonSatBtn">Mon–Sat</button><button type="button" id="meetingEveryDayBtn">Every day</button><button type="button" id="meetingMorningBtn">Morning 10–12</button><button type="button" id="meetingEveningBtn">Evening 5–8</button><button type="button" id="meetingBothBtn">Both</button><button type="button" id="meetingClearDaysBtn">Clear</button></div>
          <div id="meetingDaySelector" class="day-selector">${DAY_NAMES.map((day,i)=>`<label class="day-option"><input type="checkbox" name="meetingDays" value="${i}" ${normalizeMeetingDays(doctor?.meetingDays).includes(i)?'checked':''}><span>${day}</span></label>`).join('')}</div>
          <div class="field-grid two timing-grid">
            <label><span>First meeting from</span><input name="meetingFrom" type="time" value="${esc(normalizeTime(doctor?.meetingFrom))}"></label>
            <label><span>First meeting to</span><input name="meetingTo" type="time" value="${esc(normalizeTime(doctor?.meetingTo))}"></label>
            <label><span>Second meeting from</span><input name="meetingFrom2" type="time" value="${esc(normalizeTime(doctor?.meetingFrom2))}"></label>
            <label><span>Second meeting to</span><input name="meetingTo2" type="time" value="${esc(normalizeTime(doctor?.meetingTo2))}"></label>
          </div>
          <label class="toggle-line timing-pending-line"><input id="meetingTimingPending" name="timingPending" type="checkbox" ${doctor&&doctorMeetingSlots(doctor).length?'':'checked'}> Meeting timing is not confirmed yet</label>
        </div>
        <div id="meetingSummary">${meetingSummaryHtml(doctor,chemist)}</div>
        <div class="location-card">
          <div class="location-head"><div><strong>Hospital location verification (optional)</strong><small id="meetLocationStatus" class="location-status">GPS runs only when you tap Verify.</small></div><button type="button" id="meetFetchLocation" class="btn secondary compact">Verify hospital GPS</button></div>
          <div class="location-actions"><a id="meetLocationMap" class="hidden" target="_blank" rel="noopener">View captured map</a><label class="save-location-check"><input id="meetSaveLocation" type="checkbox"> Attach captured GPS to this record</label></div><label class="toggle-line master-location-line"><input id="meetUpdateDoctorLocation" type="checkbox" ${doctor&&!doctor.latitude?'checked':''}> Save as doctor/hospital verified location</label><small id="meetLocationAudit" class="muted-line">No background GPS and no attendance tracking. Location is used only for doctor/hospital data verification.</small>
          <input id="meetLatitude" type="hidden"><input id="meetLongitude" type="hidden"><input id="meetAccuracy" type="hidden"><input id="meetCapturedAt" type="hidden">
        </div>
        <div class="form-section-title"><h3>Meeting result</h3><p>Not met select karne par Machine next suitable meeting and replacement suggest karega.</p></div>
        <input type="hidden" name="visitOutcome" value="met">
        <div id="meetingOutcomeSelector" class="outcome-selector">
          <button type="button" class="selected" data-outcome="met">Doctor met</button><button type="button" data-outcome="not_met">Not met</button><button type="button" data-outcome="leave">On leave</button><button type="button" data-outcome="ot">In OT</button><button type="button" data-outcome="closed">Hospital closed</button><button type="button" data-outcome="timing_changed">Timing changed</button>
        </div>
        <div id="notMetIntelligence" class="intelligence-preview hidden"></div>
        <label id="notMetReasonLabel" class="hidden"><span>Reason / receptionist update</span><input name="notMetReason" placeholder="Example: doctor will come Friday evening"></label>
        <div class="form-section-title"><h3>What chemist says</h3><p>Previous status is prefilled. Tap only what changed.</p></div>
        <div id="meetingProductRows" class="product-status-list">${productRows(remembered)}</div>
        <label><span>Short meeting note (optional)</span><textarea name="notes" rows="2" placeholder="Commitment or next action only"></textarea></label>
        <label><span>Follow-up date (optional)</span><input name="followUpDate" type="date"></label>
        <details class="more-fields order-panel"><summary>POB / Distributor order (optional)</summary><div class="order-panel-body"><label class="toggle-line"><input id="meetingOrderPlaced" name="orderPlaced" type="checkbox"> Order placed to distributor</label><label><span>Distributor</span><select name="distributorId">${distributorOptions(preferredDistributor(chemist)?.id||'')}</select></label><div id="meetingOrderItems" class="order-items">${orderItemRow({},0)}</div><button type="button" id="addMeetingOrderItem" class="btn secondary compact">+ Add product</button><div class="order-total-line"><span>Order / POB total</span><strong data-order-total>₹0</strong></div><label><span>Order note</span><textarea name="orderNote" rows="2" placeholder="Delivery, urgency or commitment"></textarea></label></div></details>
        <details class="more-fields"><summary>More daily report items (optional)</summary><div class="inline-metrics">${METRICS.filter(([k])=>k!=='calls'&&k!=='pobValue').map(([k,label])=>`<label><span>${esc(label)}</span><input name="${k}" type="number" min="0" step="1" value="0"></label>`).join('')}<label><span>Other POB Value</span><input name="pobValue" type="number" min="0" step="0.01" value="0"></label></div></details>
        <input name="date" type="hidden" value="${esc(localISODateTime())}">
        <div class="sticky-save"><button type="submit" class="btn primary full">Save meeting + 1 call</button></div>
      </form>`);
    const form=$('#meetingForm'), doctorInput=$('#meetingDoctorSearch'), doctorIdInput=$('#meetingDoctorId'), doctorResults=$('#meetingDoctorResults'), chemistSelect=form.elements.chemistId, orderDistributorSelect=form.elements.distributorId, hospitalInput=form.elements.hospital, timingPending=$('#meetingTimingPending');
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
    const selectedMeetingDays=()=>form.elements.meetingDays?[...form.elements.meetingDays].filter(x=>x.checked).map(x=>Number(x.value)):[];
    const setMeetingDays=days=>$$('input[name="meetingDays"]',form).forEach(x=>x.checked=days.includes(Number(x.value)));
    const setTimingDisabled=()=>{
      const disabled=timingPending.checked;
      ['meetingFrom','meetingTo','meetingFrom2','meetingTo2'].forEach(name=>{form.elements[name].disabled=disabled;});
      $('#meetingDaySelector').classList.toggle('disabled',disabled);
    };
    const fillMasterFields=d=>{
      hospitalInput.value=doctorHospital(d);
      setMeetingDays(normalizeMeetingDays(d?.meetingDays));
      form.elements.meetingFrom.value=normalizeTime(d?.meetingFrom);
      form.elements.meetingTo.value=normalizeTime(d?.meetingTo);
      form.elements.meetingFrom2.value=normalizeTime(d?.meetingFrom2);
      form.elements.meetingTo2.value=normalizeTime(d?.meetingTo2);
      timingPending.checked=!(doctorMeetingSlots(d).length&&normalizeMeetingDays(d?.meetingDays).length);
      setTimingDisabled();
    };
    const previewDoctor=()=>{
      const base=doctorById(doctorIdInput.value);if(!base)return null;
      return {...base,hospital:clean(hospitalInput.value),meetingDays:selectedMeetingDays(),meetingFrom:normalizeTime(form.elements.meetingFrom.value),meetingTo:normalizeTime(form.elements.meetingTo.value),meetingFrom2:normalizeTime(form.elements.meetingFrom2.value),meetingTo2:normalizeTime(form.elements.meetingTo2.value)};
    };
    const refreshSummary=()=>{
      doctor=doctorById(doctorIdInput.value); chemist=chemistById(chemistSelect.value);
      $('#meetingSummary').innerHTML=meetingSummaryHtml(previewDoctor(),chemist);
    };
    const reloadProducts=()=>{
      const d=doctorById(doctorIdInput.value);
      if(!d){$('#meetingProductRows').innerHTML=empty('Search and choose a doctor first.');refreshSummary();return;}
      const c=chemistById(chemistSelect.value),preferred=preferredDistributor(c);
      if(preferred&&orderDistributorSelect)orderDistributorSelect.value=preferred.id;
      $('#meetingProductRows').innerHTML=productRows(latestStatuses(d.id,c?.id||''));
      bindStatusButtons($('#meetingProductRows'));refreshSummary();
    };
    const outcomeInput=form.elements.visitOutcome, outcomePanel=$('#notMetIntelligence'), reasonLabel=$('#notMetReasonLabel');
    const refreshOutcomeIntelligence=()=>{const value=outcomeInput.value,d=doctorById(doctorIdInput.value),isNot=NOT_MET_OUTCOMES.has(value);reasonLabel.classList.toggle('hidden',!isNot);outcomePanel.classList.toggle('hidden',!isNot);if(!isNot||!d)return;const next=nextMeetingOccurrence(previewDoctor()||d,now(),true),replacement=replacementDoctor(d.id);outcomePanel.innerHTML=`<strong>Machine action</strong><p>${next?`Reschedule ${esc(next.label)}.`:'Meeting timing missing — follow-up date required.'}${replacement?` Replace today with ${esc(doctorDisplayName(replacement.doctor))} (${esc(replacement.timing.label)}).`:''}</p>`;};
    $('#meetingOutcomeSelector').addEventListener('click',e=>{const b=e.target.closest('[data-outcome]');if(!b)return;outcomeInput.value=b.dataset.outcome;$$('[data-outcome]',$('#meetingOutcomeSelector')).forEach(x=>x.classList.toggle('selected',x===b));refreshOutcomeIntelligence();});
    const chooseDoctor=id=>{
      const d=doctorById(id);if(!d)return;
      doctorIdInput.value=d.id;doctorInput.value=doctorDisplayName(d);doctorResults.classList.add('hidden');
      const updateLocation=$('#meetUpdateDoctorLocation');if(updateLocation)updateLocation.checked=!(d.latitude&&d.longitude);
      const lc=linkedChemist(d);if(lc)chemistSelect.value=lc.id;else if(requestedChemist)chemistSelect.value=requestedChemist.id;
      fillMasterFields(d);reloadProducts();refreshOutcomeIntelligence();
    };
    bindVoiceControls('meeting',text=>{
      const parsed=parseVoiceDetails(text);let d=doctorById(parsed.doctorId);
      if(!d&&parsed.doctorName)d=state.doctors.find(x=>norm(x.name)===norm(parsed.doctorName));
      if(!d&&parsed.hospital)d=state.doctors.find(x=>norm(doctorHospital(x))===norm(parsed.hospital));
      if(d)chooseDoctor(d.id);
      const c=chemistById(parsed.chemistId)||state.chemists.find(x=>parsed.chemistName&&norm(x.name)===norm(parsed.chemistName));if(c){chemistSelect.value=c.id;reloadProducts();}
      applyStatusMap($('#meetingProductRows'),parsed.productStatuses);
      if(parsed.pobValue)form.elements.pobValue.value=parsed.pobValue;if(parsed.followUpDate)form.elements.followUpDate.value=parsed.followUpDate;
      form.elements.notes.value=clean([form.elements.notes.value,text].filter(Boolean).join(' • '));
      if(parsed.hospital)hospitalInput.value=parsed.hospital;
      if(parsed.meetingFrom||parsed.meetingDays.length){
        if(parsed.meetingDays.length)setMeetingDays(parsed.meetingDays);
        if(parsed.meetingFrom){form.elements.meetingFrom.value=parsed.meetingFrom;form.elements.meetingTo.value=parsed.meetingTo;}
        if(parsed.meetingFrom2){form.elements.meetingFrom2.value=parsed.meetingFrom2;form.elements.meetingTo2.value=parsed.meetingTo2;}
        timingPending.checked=false;setTimingDisabled();refreshSummary();
      }
    });
    doctorInput.addEventListener('focus',showDoctorResults);
    doctorInput.addEventListener('input',()=>{doctorIdInput.value='';showDoctorResults();$('#meetingSummary').innerHTML=meetingSummaryHtml(null,chemistById(chemistSelect.value));});
    doctorResults.addEventListener('click',e=>{const b=e.target.closest('[data-meeting-doctor-id]');if(b)chooseDoctor(b.dataset.meetingDoctorId);});
    chemistSelect.addEventListener('change',reloadProducts);
    hospitalInput.addEventListener('input',refreshSummary);
    $('#meetingMonSatBtn').addEventListener('click',()=>{setMeetingDays([1,2,3,4,5,6]);timingPending.checked=false;setTimingDisabled();refreshSummary();});
    $('#meetingEveryDayBtn').addEventListener('click',()=>{setMeetingDays([0,1,2,3,4,5,6]);timingPending.checked=false;setTimingDisabled();refreshSummary();});
    const setPresetTimes=(a,b,c='',d='')=>{form.elements.meetingFrom.value=a;form.elements.meetingTo.value=b;form.elements.meetingFrom2.value=c;form.elements.meetingTo2.value=d;timingPending.checked=false;setTimingDisabled();refreshSummary();};
    $('#meetingMorningBtn').addEventListener('click',()=>setPresetTimes('10:00','12:00'));
    $('#meetingEveningBtn').addEventListener('click',()=>setPresetTimes('17:00','20:00'));
    $('#meetingBothBtn').addEventListener('click',()=>setPresetTimes('10:00','12:00','17:00','20:00'));
    $('#meetingClearDaysBtn').addEventListener('click',()=>{setMeetingDays([]);setPresetTimes('','','','');});
    timingPending.addEventListener('change',()=>{setTimingDisabled();refreshSummary();refreshOutcomeIntelligence();});
    $$('input[name="meetingDays"], input[name="meetingFrom"], input[name="meetingTo"], input[name="meetingFrom2"], input[name="meetingTo2"]',form).forEach(x=>x.addEventListener('change',()=>{refreshSummary();refreshOutcomeIntelligence();}));
    setTimingDisabled();
    bindStatusButtons($('#meetingProductRows'));
    bindOrderItems($('#meetingOrderItems'));
    $('#addMeetingOrderItem').addEventListener('click',()=>{const wrap=$('#meetingOrderItems');wrap.insertAdjacentHTML('beforeend',orderItemRow({},wrap.children.length));updateOrderTotal(wrap);});
    setupLocationCapture('meet',false);
    const refreshLocationAudit=()=>{const d=doctorById(doctorIdInput.value),lat=num($('#meetLatitude').value),lng=num($('#meetLongitude').value),out=$('#meetLocationAudit');if(!out)return;if(!lat||!lng){out.textContent='Waiting for visit GPS…';out.className='muted-line';return;}if(!d?.latitude||!d?.longitude){out.textContent='Hospital master GPS is not saved yet. Keep Update hospital master location enabled.';out.className='muted-line audit-pending';return;}const meters=Math.round(haversineKm(lat,lng,d.latitude,d.longitude)*1000),accuracy=num($('#meetAccuracy').value);out.textContent=`Current visit is ${meters.toLocaleString('en-IN')} m from saved hospital GPS${accuracy?` • GPS ±${accuracy} m`:''}.`;out.className=`muted-line ${meters<=250&&accuracy<=100?'audit-good':meters<=750?'audit-review':'audit-bad'}`;};
    document.addEventListener('mr-location-ready',e=>{if(e.detail.prefix==='meet'){$('#meetSaveLocation').checked=true;refreshLocationAudit();}},{once:true});
    if(!doctor)setTimeout(()=>{doctorInput.focus();showDoctorResults();},120);
    form.addEventListener('submit',e=>{
      e.preventDefault();
      const fd=new FormData(form), d=doctorById(doctorIdInput.value), c=chemistById(fd.get('chemistId'));
      if(!d){toast('Search and choose a doctor or hospital.');doctorInput.focus();showDoctorResults();return;}
      const hospital=clean(fd.get('hospital')),days=fd.getAll('meetingDays').map(Number),from=normalizeTime(fd.get('meetingFrom')),to=normalizeTime(fd.get('meetingTo')),from2=normalizeTime(fd.get('meetingFrom2')),to2=normalizeTime(fd.get('meetingTo2')),isTimingPending=fd.get('timingPending')==='on';
      if(!hospital){toast('Enter hospital or clinic name.');hospitalInput.focus();return;}
      if(!c){toast('Select the pharmacy / chemist under this doctor.');chemistSelect.focus();return;}
      if(!isTimingPending){
        if(!days.length){toast('Choose doctor meeting day(s), or mark timing not confirmed.');return;}
        if(!from||!to){toast('Add the first doctor meeting From and To time.');return;}
        if(timeMinutes(to)<=timeMinutes(from)){toast('First meeting To time must be later than From time.');return;}
        if((from2&&!to2)||(!from2&&to2)){toast('Complete both From and To for second timing.');return;}
        if(from2&&timeMinutes(to2)<=timeMinutes(from2)){toast('Second meeting To time must be later than From time.');return;}
      }
      const outcome=clean(fd.get('visitOutcome'))||'met',notMetReason=clean(fd.get('notMetReason'));
      const productStatuses={};
      $$('.product-status-row',form).forEach(row=>{const value=$('input[type="hidden"]',row).value;if(value)productStatuses[row.dataset.product]=value;});
      const saveGps=$('#meetSaveLocation').checked, updateMasterLocation=$('#meetUpdateDoctorLocation').checked,currentLat=num($('#meetLatitude').value)||'',currentLng=num($('#meetLongitude').value)||'',orderPlaced=$('#meetingOrderPlaced').checked, orderItems=collectOrderItems($('#meetingOrderItems')), distributor=distributorById(fd.get('distributorId')), orderValue=orderItems.reduce((n,x)=>n+x.value,0);
      if(saveGps&&(!currentLat||!currentLng)){toast('Wait for GPS or tap Fetch GPS before saving.');return;}
      const oldHospitalLat=num(d.latitude)||'',oldHospitalLng=num(d.longitude)||'',distanceFromSaved=saveGps&&oldHospitalLat&&oldHospitalLng?Math.round(haversineKm(currentLat,currentLng,oldHospitalLat,oldHospitalLng)*1000):'';
      if(updateMasterLocation&&distanceFromSaved&&distanceFromSaved>500&&!confirm(`Current GPS is ${distanceFromSaved.toLocaleString('en-IN')} m from the saved hospital location. Replace the hospital master location?`))return;
      if(orderPlaced&&!distributor){toast('Select distributor for the order.');return;}
      if(orderPlaced&&!orderItems.length){toast('Add at least one ordered product.');return;}
      const meetingDoctor={...d,hospital,meetingDays:days,meetingFrom:from,meetingTo:to,meetingFrom2:from2,meetingTo2:to2},nextSuggested=NOT_MET_OUTCOMES.has(outcome)?nextMeetingOccurrence(meetingDoctor,now(),true):null,replacement=NOT_MET_OUTCOMES.has(outcome)?replacementDoctor(d.id):null,autoFollowUp=clean(fd.get('followUpDate'))||(nextSuggested?.date||'');
      const row={
        id:uid('log'),date:fd.get('date')||localISODateTime(),entityType:'doctor',entityId:d.id,entityName:d.name,
        doctorId:d.id,doctorName:d.name,doctorHospital:hospital,chemistId:c?.id||'',chemistName:c?.name||'',productStatuses,
        notes:clean(fd.get('notes')),followUpDate:autoFollowUp,calls:1,outcome,outcomeLabel:OUTCOME_LABELS[outcome]||outcome,notMetReason,rescheduledFor:nextSuggested?.dateTime||'',replacementDoctorId:replacement?.doctor.id||'',replacementDoctorName:replacement?doctorDisplayName(replacement.doctor):'',intelligenceAction:NOT_MET_OUTCOMES.has(outcome)?[nextSuggested?`Rescheduled ${nextSuggested.label}`:'Timing pending',replacement?`Replacement ${doctorDisplayName(replacement.doctor)}`:'No replacement'].join(' • '):productOpportunity(d).label,
        inputs:num(fd.get('inputs')),basket:num(fd.get('basket')),towel:num(fd.get('towel')),conversation:num(fd.get('conversation')),newAvailability:num(fd.get('newAvailability')),pobValue:orderPlaced?(orderValue||num(fd.get('pobValue'))):num(fd.get('pobValue')),
        latitude:saveGps?currentLat:'',longitude:saveGps?currentLng:'',locationAccuracy:saveGps?num($('#meetAccuracy').value)||'':'',locationCapturedAt:saveGps?$('#meetCapturedAt').value:'',
        hospitalLatitude:oldHospitalLat||'',hospitalLongitude:oldHospitalLng||'',distanceFromHospitalM:distanceFromSaved,locationAuditStatus:!saveGps?'Missing visit GPS':!oldHospitalLat?'Hospital GPS pending':distanceFromSaved<=250?'Verified at hospital':distanceFromSaved<=750?'Review location':'Location mismatch',createdAt:new Date().toISOString()
      };
      state.visits.push(row);
      if(orderPlaced){const order={id:uid('ord'),date:row.date,doctorId:d.id,doctorName:d.name,doctorHospital:hospital,chemistId:c?.id||'',chemistName:c?.name||'',distributorId:distributor.id,distributorName:distributor.name,items:orderItems,totalValue:row.pobValue,status:'placed',notes:clean(fd.get('orderNote')),visitId:row.id,latitude:row.latitude,longitude:row.longitude,createdAt:new Date().toISOString()};state.orders.push(order);row.orderId=order.id;if(c){c.linkedDistributorId=distributor.id;c.distributorName=distributor.name;}distributor.lastOrderDate=String(row.date).slice(0,10);}
      d.hospital=hospital;
      if(!isTimingPending){d.meetingDays=days;d.meetingFrom=from;d.meetingTo=to;d.meetingFrom2=from2;d.meetingTo2=to2;}
      d.lastAttempt=String(row.date).slice(0,10);if(outcome==='met')d.lastVisit=d.lastAttempt;d.updatedAt=new Date().toISOString();
      if(c){d.linkedChemistId=c.id;d.chemistName=c.name;if(outcome==='met')c.lastVisit=d.lastAttempt;c.updatedAt=new Date().toISOString();}
      if(row.followUpDate){d.nextFollowUp=row.followUpDate;if(c)c.nextFollowUp=row.followUpDate;}
      if(row.latitude&&row.longitude&&updateMasterLocation){d.latitude=row.latitude;d.longitude=row.longitude;d.locationAccuracy=row.locationAccuracy;d.locationCapturedAt=row.locationCapturedAt;d.locationSource='Visit GPS verified';row.hospitalLatitude=row.latitude;row.hospitalLongitude=row.longitude;row.distanceFromHospitalM=0;row.locationAuditStatus='Verified at hospital';}
      if(NOT_MET_OUTCOMES.has(outcome)){state.reschedules.filter(r=>r.doctorId===d.id&&r.status==='pending').forEach(r=>r.status='replaced');state.reschedules.push({id:uid('res'),doctorId:d.id,doctorName:d.name,hospital:doctorHospital(d),sourceVisitId:row.id,reason:notMetReason||OUTCOME_LABELS[outcome],createdAt:new Date().toISOString(),scheduledDate:nextSuggested?.date||row.followUpDate||'',scheduledDateTime:nextSuggested?.dateTime||'',meetingFrom:nextSuggested?.from||'',meetingTo:nextSuggested?.to||'',replacementDoctorId:replacement?.doctor.id||'',replacementDoctorName:replacement?doctorDisplayName(replacement.doctor):'',status:'pending'});}
      else state.reschedules.filter(r=>r.doctorId===d.id&&r.status==='pending').forEach(r=>r.status='completed');
      state.intelligenceLog.push({id:uid('intel'),date:new Date().toISOString(),doctorId:d.id,doctorName:d.name,outcome,action:row.intelligenceAction});
      d.needsCompletion=!(doctorHospital(d)&&linkedChemist(d)&&d.latitude&&d.longitude&&doctorMeetingSlots(d).length&&normalizeMeetingDays(d.meetingDays).length);
      saveState();closeSheet();toast(NOT_MET_OUTCOMES.has(outcome)?`Not met saved. ${nextSuggested?`Moved to ${nextSuggested.label}.`: 'Timing required.'}${replacement?` Replacement: ${replacement.doctor.name}.`:''}`:(d.needsCompletion?'Meeting saved. Missing master details remain marked pending.':'Meeting saved. Doctor master and report updated.'));
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
        ${!isDoctor?`<label><span>Preferred distributor (optional)</span><select name="linkedDistributorId">${distributorOptions(preferredDistributor(old)?.id||'')}</select></label>`:''}
        ${isDoctor?`<label><span>Hospital / clinic name</span><input name="hospital" value="${esc(doctorHospital(old))}" placeholder="Example: Sterling Hospital"></label><div class="lookup-label field-block"><span class="field-caption">Doctor under chemist</span><div class="lookup-field"><input id="recordChemistSearch" type="search" autocomplete="off" value="${esc(linkedChemist(old)?.name||'')}" placeholder="Search chemist name or area…"><input id="recordChemistId" name="linkedChemistId" type="hidden" value="${esc(existingChemist)}"><div id="recordChemistResults" class="search-results lookup-results hidden"></div></div></div><div class="schedule-card"><div class="form-section-title"><h3>Doctor meeting timing</h3><p>Save once. It appears during every search and meeting.</p></div><div class="schedule-quick"><button type="button" id="monSatDaysBtn">Mon–Sat</button><button type="button" id="allDaysBtn">Every day</button><button type="button" id="clearDaysBtn">Clear</button></div><div class="day-selector">${DAY_NAMES.map((day,i)=>`<label class="day-option"><input type="checkbox" name="meetingDays" value="${i}" ${normalizeMeetingDays(old.meetingDays).includes(i)?'checked':''}><span>${day}</span></label>`).join('')}</div><div class="field-grid two timing-grid"><label><span>First timing from</span><input name="meetingFrom" type="time" value="${esc(normalizeTime(old.meetingFrom))}"></label><label><span>First timing to</span><input name="meetingTo" type="time" value="${esc(normalizeTime(old.meetingTo))}"></label><label><span>Second timing from (optional)</span><input name="meetingFrom2" type="time" value="${esc(normalizeTime(old.meetingFrom2))}"></label><label><span>Second timing to (optional)</span><input name="meetingTo2" type="time" value="${esc(normalizeTime(old.meetingTo2))}"></label></div></div>`:''}
        <label><span>Address</span><textarea name="address" rows="2" placeholder="Clinic / shop full address">${esc(old.address||'')}</textarea></label>
        <label><span>Area / place</span><input name="area" value="${esc(old.area||old.hq||state.profile.hq||'')}"></label>
        ${isDoctor?`<div class="location-card">
          <div class="location-head"><div><strong>Doctor / hospital GPS verification</strong><small id="recordLocationStatus" class="location-status">${old.latitude&&old.longitude?`Verified • ${esc(old.latitude)}, ${esc(old.longitude)}`:'Optional — verify once at hospital'}</small></div><button type="button" id="recordFetchLocation" class="btn secondary compact">${old.latitude?'Refresh verification':'Verify hospital GPS'}</button></div>
          <a id="recordLocationMap" class="${old.latitude?'':'hidden'}" href="${old.latitude?mapUrl(old.latitude,old.longitude):''}" target="_blank" rel="noopener">View map</a>
          <input id="recordLatitude" type="hidden" value="${esc(old.latitude||'')}"><input id="recordLongitude" type="hidden" value="${esc(old.longitude||'')}"><input id="recordAccuracy" type="hidden" value="${esc(old.locationAccuracy||'')}"><input id="recordCapturedAt" type="hidden" value="${esc(old.locationCapturedAt||'')}">
        </div>`:`<div class="notice">GPS is not collected for chemists. Only doctor/hospital location verification uses GPS.</div>`}
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
    if(isDoctor)setupLocationCapture('record',false);
    const form=$('#recordForm');
    form.addEventListener('submit',e=>{
      e.preventDefault();const fd=new FormData(form),rec={...old,id:id||uid(isDoctor?'dr':'ch'),updatedAt:new Date().toISOString()};
      rec.name=clean(fd.get('name'));rec.address=clean(fd.get('address'));rec.area=clean(fd.get('area'));rec.hq=rec.hq||state.profile.hq;rec.notes=clean(fd.get('notes'));if(isDoctor){rec.hospital=clean(fd.get('hospital'));rec.needsCompletion=!(rec.name&&norm(rec.name)!==norm(rec.hospital));}
      if(!isDoctor){rec.linkedDistributorId=clean(fd.get('linkedDistributorId'));const dist=distributorById(rec.linkedDistributorId);rec.distributorName=dist?.name||'';}
      if(isDoctor){rec.latitude=num($('#recordLatitude').value)||'';rec.longitude=num($('#recordLongitude').value)||'';rec.locationAccuracy=num($('#recordAccuracy').value)||'';rec.locationCapturedAt=$('#recordCapturedAt').value||'';}
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
      const docs=state.doctors.filter(d=>d.linkedChemistId===id),dist=preferredDistributor(r);
      extra=`<div class="detail-section"><h4>Preferred distributor</h4><div class="detail-address">${esc(dist?.name||'Not set')}</div></div><div class="detail-section"><h4>Doctors under this chemist</h4>${docs.length?docs.map(d=>`<button class="linked-doctor-row" data-action="view-record" data-type="doctor" data-id="${d.id}"><strong>${esc(doctorDisplayName(d))}</strong><small>${esc(d.area||'')}</small></button>`).join(''):empty('No doctor linked yet.')}</div>`;
    }
    openSheet(isDoctor?doctorDisplayName(r):r.name,isDoctor?'Doctor profile':'Chemist profile',`<div class="detail-hero"><div class="avatar">${esc(initials(r.name))}</div><div><h3>${esc(isDoctor?doctorDisplayName(r):r.name)}</h3><p>${esc(isDoctor?(ch?.name||'Chemist not linked'):`${linkedDoctorCount(r.id)} doctors linked`)}</p></div></div><div class="detail-grid"><div class="detail-box"><small>Area</small><strong>${esc(r.area||r.hq||'—')}</strong></div><div class="detail-box"><small>Last meeting</small><strong>${esc(prettyDate(r.lastVisit))}</strong></div></div>${isDoctor&&doctorHospital(r)?`<div class="detail-section"><h4>Hospital / clinic</h4><div class="detail-address">${esc(doctorHospital(r))}</div></div>`:''}<div class="detail-section"><h4>Address</h4><div class="detail-address">${esc(r.address||'Not added')}</div></div>${map?`<a class="map-main-btn" href="${map}" target="_blank" rel="noopener">Open map location</a>`:''}${extra}${r.notes?`<div class="detail-section"><h4>Note</h4><div class="note-box">${esc(r.notes)}</div></div>`:''}<div class="detail-actions"><button data-action="log-record" data-type="${type}" data-id="${id}">Log meeting</button><button data-action="edit-record" data-type="${type}" data-id="${id}">Edit once</button><button data-close-sheet>Close</button></div><div class="detail-section"><h4>Meeting history</h4>${history.length?history.map(miniActivity).join(''):empty('No meetings yet.')}</div>`);
  }
  function viewVisit(id) {
    const v=state.visits.find(x=>x.id===id);if(!v)return;
    const map=visitMapUrl(v);
    openSheet([v.doctorName||v.entityName,v.doctorHospital].filter(Boolean).join(' — ')||'Meeting',`${prettyDate(v.date)} • ${prettyTime(v.date)}`,`<div class="detail-grid"><div class="detail-box"><small>Doctor / hospital</small><strong>${esc([v.doctorName,v.doctorHospital].filter(Boolean).join(' — ')||'—')}</strong></div><div class="detail-box"><small>Under chemist</small><strong>${esc(v.chemistName||'—')}</strong></div><div class="detail-box"><small>Result</small><strong>${esc(v.outcomeLabel||OUTCOME_LABELS[v.outcome]||'Doctor met')}</strong></div><div class="detail-box"><small>Call counted</small><strong>${esc(v.calls||1)}</strong></div><div class="detail-box"><small>GPS accuracy</small><strong>${v.locationAccuracy?`${esc(v.locationAccuracy)} m`:'Not saved'}</strong></div><div class="detail-box"><small>Location audit</small><strong>${esc(locationAuditForVisit(v).status)}${locationAuditForVisit(v).distanceMeters!==''?` • ${esc(locationAuditForVisit(v).distanceMeters)} m`:''}</strong></div></div>${map?`<a class="map-main-btn" href="${map}" target="_blank" rel="noopener">Open visit location</a>`:''}<div class="detail-section"><h4>Prescription feedback</h4>${statusTags(v.productStatuses)}</div>${v.notes?`<div class="detail-section"><h4>Meeting note</h4><div class="note-box">${esc(v.notes)}</div></div>`:''}<div class="detail-section"><h4>Follow-up</h4><div class="detail-address">${esc(prettyDate(v.followUpDate))}</div></div><div class="button-row"><button id="deleteVisitBtn" class="btn danger">Delete meeting</button></div>`);
    $('#deleteVisitBtn').addEventListener('click',()=>{if(!confirm('Delete this meeting log?'))return;state.visits=state.visits.filter(x=>x.id!==id);saveState();closeSheet();toast('Meeting deleted.');});
  }


function manageDistributors(){
  openSheet('Distributors','Set once; chemist orders will remember the preferred distributor.',`<div class="button-row"><button class="btn primary" data-action="add-distributor">+ Add distributor</button></div><div class="card-list compact-list">${state.distributors.length?state.distributors.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(d=>`<article class="record-card"><div class="record-top"><div class="avatar">${esc(initials(d.name))}</div><div class="record-title"><h3>${esc(d.name)}</h3><p>${esc([d.area,d.mobile].filter(Boolean).join(' • ')||'Details not added')}</p></div></div><div class="tag-row"><span class="tag">${state.orders.filter(o=>o.distributorId===d.id).length} orders</span></div><div class="record-actions"><button data-action="edit-distributor" data-id="${d.id}">Edit</button><button data-action="new-order" data-distributor-id="${d.id}">Order</button></div></article>`).join(''):empty('No distributor added yet.')}</div>`);
}
function editDistributor(id=''){
  const old=state.distributors.find(x=>x.id===id)||{};
  openSheet(`${id?'Edit':'Add'} distributor`,'Name, address and phone are saved once. GPS is not collected.',`<form id="distributorForm" class="sheet-form"><label><span>Distributor name</span><input name="name" required value="${esc(old.name||'')}"></label><label><span>Mobile</span><input name="mobile" inputmode="tel" value="${esc(old.mobile||'')}"></label><label><span>Address</span><textarea name="address" rows="2">${esc(old.address||'')}</textarea></label><label><span>Area</span><input name="area" value="${esc(old.area||state.profile.hq||'')}"></label><div class="notice">GPS is reserved for doctor/hospital verification only.</div><label><span>Note</span><textarea name="notes" rows="2">${esc(old.notes||'')}</textarea></label><div class="button-row">${id?'<button type="button" id="deleteDistributorBtn" class="btn danger">Delete</button>':''}<button class="btn primary" type="submit">Save distributor</button></div></form>`);
  const f=$('#distributorForm');f.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(f),rec={...old,id:id||uid('dist'),name:clean(fd.get('name')),mobile:clean(fd.get('mobile')),address:clean(fd.get('address')),area:clean(fd.get('area')),hq:state.profile.hq,notes:clean(fd.get('notes')),updatedAt:new Date().toISOString()};if(!id){rec.createdAt=new Date().toISOString();state.distributors.push(rec);}else Object.assign(old,rec);saveState();closeSheet();toast('Distributor saved.');});
  $('#deleteDistributorBtn')?.addEventListener('click',()=>{if(!confirm('Delete distributor? Existing order history will remain.'))return;state.distributors=state.distributors.filter(x=>x.id!==id);saveState();closeSheet();});
}
function manageSchemes(){
  const sorted=state.schemes.slice().sort((a,b)=>String(b.startDate).localeCompare(String(a.startDate))||a.product.localeCompare(b.product));
  openSheet('Product offers / schemes','Date-wise offers change automatically from start and end dates.',`<div class="button-row"><button class="btn primary" data-action="add-scheme">+ Add scheme</button></div><div class="scheme-list">${sorted.length?sorted.map(x=>`<button class="scheme-card ${schemeState(x)}" data-action="edit-scheme" data-id="${x.id}"><div><strong>${esc(x.product)} • ${esc(x.pack)}</strong><small>${esc(prettyDate(x.startDate))} to ${esc(prettyDate(x.endDate))}</small></div><span>${esc(x.ratio||'No ratio')}</span></button>`).join(''):empty('No schemes added.')}</div>`);
}
function editScheme(id=''){
  const old=state.schemes.find(x=>x.id===id)||{};
  openSheet(`${id?'Edit':'Add'} scheme`,'Use the circular effective dates. The app shows only the active offer during order entry.',`<form id="schemeForm" class="sheet-form"><label><span>Product</span><input name="product" list="productCatalogList" required value="${esc(old.product||'')}"><datalist id="productCatalogList">${productCatalog().map(p=>`<option value="${esc(p)}"></option>`).join('')}</datalist></label><label><span>Pack</span><input name="pack" value="${esc(old.pack||'')}"></label><label><span>Scheme ratio / offer</span><input name="ratio" required value="${esc(old.ratio||'')}" placeholder="9+1"></label><div class="field-grid two"><label><span>Start date</span><input name="startDate" type="date" required value="${esc(old.startDate||localISODate())}"></label><label><span>End date</span><input name="endDate" type="date" required value="${esc(old.endDate||localISODate())}"></label></div><label><span>Source / circular</span><input name="source" value="${esc(old.source||'')}"></label><label><span>Notes</span><textarea name="notes" rows="2">${esc(old.notes||'')}</textarea></label><div class="button-row">${id?'<button type="button" id="deleteSchemeBtn" class="btn danger">Delete</button>':''}<button class="btn primary" type="submit">Save scheme</button></div></form>`);
  const f=$('#schemeForm');f.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(f),start=clean(fd.get('startDate')),end=clean(fd.get('endDate'));if(end<start){toast('End date must be after start date.');return;}const rec={...old,id:id||uid('sch'),product:clean(fd.get('product')),pack:clean(fd.get('pack')),ratio:clean(fd.get('ratio')),startDate:start,endDate:end,source:clean(fd.get('source')),notes:clean(fd.get('notes')),updatedAt:new Date().toISOString()};if(!id){rec.createdAt=new Date().toISOString();state.schemes.push(rec);}else Object.assign(old,rec);saveState();closeSheet();toast('Date-wise scheme saved.');});
  $('#deleteSchemeBtn')?.addEventListener('click',()=>{if(!confirm('Delete scheme?'))return;state.schemes=state.schemes.filter(x=>x.id!==id);saveState();closeSheet();});
}
function quickOrder(distributorId=''){
  if(!state.distributors.length){editDistributor();return;}
  const dist=distributorById(distributorId);
  openSheet('New distributor order','POB without adding a doctor call.',`<form id="quickOrderForm" class="sheet-form"><label><span>Chemist</span><select name="chemistId">${chemistOptions('')}</select></label><label><span>Distributor</span><select name="distributorId">${distributorOptions(dist?.id||'')}</select></label><div id="quickOrderItems" class="order-items">${orderItemRow({},0)}</div><button type="button" id="addQuickOrderItem" class="btn secondary compact">+ Add product</button><div class="order-total-line"><span>Total POB</span><strong data-order-total>₹0</strong></div><label><span>Order note</span><textarea name="notes" rows="2"></textarea></label><button class="btn primary full" type="submit">Save order / POB</button></form>`);
  const wrap=$('#quickOrderItems');bindOrderItems(wrap);$('#addQuickOrderItem').addEventListener('click',()=>{wrap.insertAdjacentHTML('beforeend',orderItemRow({},wrap.children.length));});const f=$('#quickOrderForm');f.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(f),c=chemistById(fd.get('chemistId')),d=distributorById(fd.get('distributorId')),items=collectOrderItems(wrap),total=items.reduce((n,x)=>n+x.value,0);if(!c||!d||!items.length){toast('Select chemist, distributor and product.');return;}const date=localISODateTime(),order={id:uid('ord'),date,chemistId:c.id,chemistName:c.name,distributorId:d.id,distributorName:d.name,items,totalValue:total,status:'placed',notes:clean(fd.get('notes')),createdAt:new Date().toISOString()};state.orders.push(order);state.visits.push({id:uid('log'),date,entityType:'chemist',entityId:c.id,entityName:c.name,chemistId:c.id,chemistName:c.name,calls:0,inputs:0,basket:0,towel:0,conversation:0,newAvailability:0,pobValue:total,notes:`POB order to ${d.name}${order.notes?`: ${order.notes}`:''}`,productStatuses:{},orderId:order.id,createdAt:new Date().toISOString()});c.linkedDistributorId=d.id;c.distributorName=d.name;c.lastVisit=localISODate();d.lastOrderDate=localISODate();saveState();closeSheet();toast('Distributor order and POB saved.');});
}
function viewOrder(id){const o=state.orders.find(x=>x.id===id);if(!o)return;const d=distributorById(o.distributorId);openSheet('Distributor order',`${prettyDate(o.date)} • ${prettyTime(o.date)}`,`<div class="detail-grid"><div class="detail-box"><small>Chemist</small><strong>${esc(o.chemistName||'—')}</strong></div><div class="detail-box"><small>Distributor</small><strong>${esc(d?.name||o.distributorName||'—')}</strong></div><div class="detail-box"><small>Status</small><strong>${esc(o.status||'placed')}</strong></div><div class="detail-box"><small>Total</small><strong>₹${esc(orderTotal(o).toLocaleString('en-IN'))}</strong></div></div><div class="detail-section"><h4>Products</h4>${(o.items||[]).map(x=>`<div class="order-detail-row"><strong>${esc(x.product)} • ${esc(x.pack||'')}</strong><span>Qty ${esc(x.qty||0)} • ₹${esc(num(x.value).toLocaleString('en-IN'))}${x.schemeRatio?` • ${esc(x.schemeRatio)}`:''}</span></div>`).join('')||empty('No items')}</div>${o.notes?`<div class="detail-section"><h4>Note</h4><div class="note-box">${esc(o.notes)}</div></div>`:''}<div class="button-row"><button id="deleteOrderBtn" class="btn danger">Delete order</button></div>`);$('#deleteOrderBtn').addEventListener('click',()=>{if(!confirm('Delete order and its POB activity?'))return;state.orders=state.orders.filter(x=>x.id!==id);state.visits=state.visits.filter(v=>v.orderId!==id);saveState();closeSheet();});}
function planTodayRoute(){
  const eligible=state.doctors.filter(d=>todaySlot(d)&&num(d.latitude)&&num(d.longitude));
  const preferred=smartPatchCandidates(30).find(x=>eligible.some(d=>d.id===x.doctor.id))?.doctor||eligible[0]||null;
  openSheet('Today saved-location route','Uses only previously verified doctor/hospital locations. It does not fetch your current GPS.',`${eligible.length?`<label class="sheet-form"><span>Start from saved doctor / hospital</span><select id="routeStartDoctor">${eligible.map(d=>`<option value="${esc(d.id)}" ${d.id===preferred?.id?'selected':''}>${esc(doctorDisplayName(d))}</option>`).join('')}</select></label><label class="toggle-line"><input id="includeVisitedRoute" type="checkbox"> Include doctors already called today</label><div id="routeResult"></div>`:empty('No doctor has both today timing and verified hospital GPS. Verify hospital locations first.')}`);
  if(!eligible.length)return;
  const render=()=>{const startDoctor=doctorById($('#routeStartDoctor').value)||preferred;if(!startDoctor)return;const lat=num(startDoctor.latitude),lng=num(startDoctor.longitude),route=routeCandidates(lat,lng,$('#includeVisitedRoute').checked),url=googleRouteUrl(lat,lng,route);$('#routeResult').innerHTML=route.length?`<div class="notice">Start: ${esc(doctorDisplayName(startDoctor))}. Route uses saved hospital coordinates only.</div><div class="route-list">${route.map((x,i)=>`<div class="route-stop ${x.timingRisk?'route-risk':''}"><span>${i+1}</span><div><strong>${esc(doctorDisplayName(x.doctor))}</strong><small>${esc(`ETA ${minuteLabel(x.arrivalMinutes)} • ${timeLabel(x.slot.from)}–${timeLabel(x.slot.to)} • ${x.distance.toFixed(1)} km • verified hospital GPS • ${linkedChemist(x.doctor)?.name||'No chemist'}${x.waitMinutes?` • wait ${x.waitMinutes} min`:''}${x.timingRisk?` • timing conflict +${x.lateMinutes} min`:''}`)}</small></div><button data-action="log-record" data-type="doctor" data-id="${x.doctor.id}">Meet</button></div>`).join('')}</div><div class="button-row">${url?`<a class="btn primary" href="${url}" target="_blank" rel="noopener">Open saved route in Maps</a>`:''}<button id="saveRoutePlanBtn" class="btn secondary">Save plan</button></div>`:empty('No unvisited doctor is available with today timing and verified hospital GPS.');$('#saveRoutePlanBtn')?.addEventListener('click',()=>{state.routePlans.push({id:uid('route'),date:localISODate(),createdAt:new Date().toISOString(),startDoctorId:startDoctor.id,startDoctorName:doctorDisplayName(startDoctor),startLatitude:lat,startLongitude:lng,source:'Saved verified hospital GPS',stops:route.map((x,i)=>({order:i+1,doctorId:x.doctor.id,doctorName:x.doctor.name,hospital:doctorHospital(x.doctor),meetingFrom:x.slot.from,meetingTo:x.slot.to,estimatedArrival:minuteLabel(x.arrivalMinutes),travelMinutes:x.travelMinutes,waitMinutes:x.waitMinutes,timingRisk:x.timingRisk?'Yes':'No',locationAccuracy:x.doctor.locationAccuracy||'',locationSource:x.doctor.locationSource||'Verified hospital GPS',latitude:x.doctor.latitude,longitude:x.doctor.longitude,distanceKm:Number(x.distance.toFixed(2))}))});saveState(false);toast('Saved-location route added to Excel.');});};
  $('#routeStartDoctor').addEventListener('change',render);$('#includeVisitedRoute').addEventListener('change',render);render();
}
function workbookData(){
  const latestRoute=state.routePlans.filter(r=>r.date===localISODate()).slice(-1)[0];
  return {sheets:[
    {name:'Summary',rows:[['MR Machine Intelligence Export',localISODateTime()],['HQ',state.profile.hq],['TM',state.profile.tmName],['Doctors',state.doctors.length],['Chemists',state.chemists.length],['Distributors',state.distributors.length],['Orders',state.orders.length],['Voice Captures',state.captures.length],['Active Schemes',state.schemes.filter(x=>schemeState(x)==='active').length],[],['Metric','Today','Month Cumulative'],...METRICS.map(([k,l])=>[l,statsForDay()[k],statsForMonth()[k]])]},
    {name:'Doctors',rows:[['Doctor Name','Hospital / Clinic','Google Place ID','Hospital Opening Hours','Under Chemist','Meeting Days','Meeting From 1','Meeting To 1','Meeting From 2','Meeting To 2','Address','Area','Latitude','Longitude','Location Source','Last Meeting','Next Follow-up','Notes'],...state.doctors.map(d=>[d.name,doctorHospital(d),d.placeId||'',(d.hospitalOpeningHours||[]).join('; '),linkedChemist(d)?.name||d.chemistName,normalizeMeetingDays(d.meetingDays).map(x=>DAY_NAMES[x]).join('; '),d.meetingFrom,d.meetingTo,d.meetingFrom2,d.meetingTo2,d.address,d.area,d.latitude,d.longitude,d.locationSource||'',d.lastVisit,d.nextFollowUp,d.notes])]},
    {name:'Chemists',rows:[['Chemist Name','Preferred Distributor','Address','Area','Latitude','Longitude','Last Meeting','Next Follow-up','Notes'],...state.chemists.map(c=>[c.name,preferredDistributor(c)?.name||c.distributorName,c.address,c.area,c.latitude,c.longitude,c.lastVisit,c.nextFollowUp,c.notes])]},
    {name:'Distributors',rows:[['Distributor Name','Mobile','Address','Area','Latitude','Longitude','Last Order','Notes'],...state.distributors.map(d=>[d.name,d.mobile,d.address,d.area,d.latitude,d.longitude,d.lastOrderDate,d.notes])]},
    {name:'Orders',rows:[['Date','Doctor','Hospital','Chemist','Distributor','Products','Packs','Quantities','Schemes','POB Value','Status','Notes','Latitude','Longitude'],...state.orders.map(o=>[o.date,o.doctorName,o.doctorHospital,o.chemistName,distributorById(o.distributorId)?.name||o.distributorName,(o.items||[]).map(x=>x.product).join('; '),(o.items||[]).map(x=>x.pack).join('; '),(o.items||[]).map(x=>x.qty).join('; '),(o.items||[]).map(x=>x.schemeRatio).join('; '),orderTotal(o),o.status,o.notes,o.latitude,o.longitude])]},
    {name:'Visits',rows:[['Date','Doctor','Hospital','Chemist','Result','Not-met Reason','Rescheduled For','Replacement Doctor','Machine Action','Calls','POB Value','Product Feedback','Follow-up','Notes','Visit Latitude','Visit Longitude','GPS Accuracy','Hospital Latitude','Hospital Longitude','Distance from Hospital (m)','Location Audit'],...state.visits.filter(v=>v.doctorId||v.chemistId).map(v=>{const a=locationAuditForVisit(v);return [v.date,v.doctorName,v.doctorHospital,v.chemistName,v.outcomeLabel||OUTCOME_LABELS[v.outcome]||'Doctor met',v.notMetReason||'',v.rescheduledFor||'',v.replacementDoctorName||'',v.intelligenceAction||'',v.calls,v.pobValue,Object.entries(v.productStatuses||{}).map(([p,x])=>`${p}: ${statusLabel(x)}`).join('; '),v.followUpDate,v.notes,v.latitude,v.longitude,v.locationAccuracy,v.hospitalLatitude||doctorById(v.doctorId)?.latitude||'',v.hospitalLongitude||doctorById(v.doctorId)?.longitude||'',a.distanceMeters,a.status];})]},
    {name:'Location Audit',rows:[['Date','Doctor','Hospital','Visit GPS','Hospital Master GPS','Distance (m)','GPS Accuracy (m)','Audit Status'],...state.visits.filter(v=>v.doctorId).map(v=>{const d=doctorById(v.doctorId),a=locationAuditForVisit(v);return [v.date,v.doctorName,v.doctorHospital,[v.latitude,v.longitude].filter(Boolean).join(', '),[v.hospitalLatitude||d?.latitude,v.hospitalLongitude||d?.longitude].filter(Boolean).join(', '),a.distanceMeters,a.accuracyMeters,a.status];})]},
    {name:'Schemes',rows:[['Product','Pack','Scheme / Offer','Start Date','End Date','Current Status','Source','Notes'],...state.schemes.map(x=>[x.product,x.pack,x.ratio,x.startDate,x.endDate,schemeState(x),x.source,x.notes])]},
    {name:'Today Route',rows:[['Order','Doctor','Hospital','Meeting From','Meeting To','Estimated Arrival','Travel Minutes','Wait Minutes','Timing Risk','Distance Km','GPS Accuracy','Location Source','Latitude','Longitude'],...(latestRoute?.stops||[]).map(x=>[x.order,x.doctorName,x.hospital,x.meetingFrom,x.meetingTo,x.estimatedArrival,x.travelMinutes,x.waitMinutes,x.timingRisk,x.distanceKm,x.locationAccuracy,x.locationSource,x.latitude,x.longitude])]},
    {name:'Smart Patch',rows:[['Date','Order','Doctor','Hospital','Timing','Score','Reason','Product Action'],...state.patchPlans.flatMap(p=>(p.items||[]).map(x=>[p.date,x.order,x.doctorName,x.hospital,x.timing,x.score,x.reason,x.productAction]))]},
    {name:'Reschedules',rows:[['Created','Doctor','Hospital','Reason','Scheduled Date','Scheduled Time','Replacement Doctor','Status'],...state.reschedules.map(r=>[r.createdAt,r.doctorName,r.hospital,r.reason,r.scheduledDate,[r.meetingFrom,r.meetingTo].filter(Boolean).join('-'),r.replacementDoctorName,r.status])]},
    {name:'Data Quality',rows:[['Doctor','Hospital','Chemist','Completion %','Missing Fields','Last Met','Next Follow-up','Recent Not-met'],...state.doctors.map(d=>{const q=doctorCompleteness(d);return [d.name,doctorHospital(d),linkedChemist(d)?.name||'',q.score,q.missing.join('; '),latestDoctorVisit(d.id,true)?.date||'',d.nextFollowUp||'',recentNotMetCount(d.id)];})]},
    {name:'Products',rows:[['Product','PTS / Price'],...state.products.map(p=>[p.name,p.pts])]},
    {name:'Voice Captures',rows:[['Date','Transcript','Doctor','Hospital','Chemist','Meeting Logged','Latitude','Longitude'],...state.captures.map(c=>[c.date,c.transcript,c.doctorName,c.hospital,c.chemistName,c.loggedMeeting?'Yes':'No',c.latitude,c.longitude])]}
  ]};
}
function exportXLSX(){if(window.AndroidBridge?.saveWorkbook){window.AndroidBridge.saveWorkbook(`MR-Field-Data-${localISODate()}.xlsx`,JSON.stringify(workbookData()));toast('Choose where to save the Excel workbook.');}else{toast('XLSX export is available in the Android APK. Use CSV here.');}}
function reportProductStatus(doctorId,product){const rows=doctorVisitRows(doctorId).filter(v=>v.productStatuses?.[product]);const latest=rows.slice(-1)[0],previous=rows.slice(-2,-1)[0];return {latest:latest?.productStatuses?.[product]||'',latestDate:latest?.date||'',previous:previous?.productStatuses?.[product]||'',previousDate:previous?.date||'',everPrescribed:rows.some(v=>v.productStatuses?.[product]==='prescribed')};}
function prescriberCategory(info){if(info.latest==='prescribed'&&!info.previous)return 'New / Trial Prescriber';if(info.latest==='prescribed')return 'Regular / Continued';if(info.latest==='not_prescribed'&&info.everPrescribed)return 'Lost Prescriber';if(info.latest==='not_prescribed')return 'Not Prescribing';return 'Feedback Pending';}
function companyReportPackData(){
  const products=[...new Set((focusProducts().length?focusProducts():productCatalog()).filter(Boolean))],missing=[];
  state.doctors.forEach(d=>doctorCompleteness(d).missing.forEach(field=>missing.push(['Doctor Master',d.name,field,'Complete in Doctors / Meeting screen'])));
  const lostRows=[['TM','HQ','Doctor','Hospital','Area','Product','Category','Previous Status','Previous Date','Current Status','Current Date','Last Met','Next Follow-up','Recent Not-met','Recommended Action']];
  state.doctors.forEach(d=>products.forEach(product=>{const info=reportProductStatus(d.id,product),cat=prescriberCategory(info);if(info.latest||info.everPrescribed||cat==='Feedback Pending')lostRows.push([state.profile.tmName,state.profile.hq,d.name,doctorHospital(d),d.area,product,cat,statusLabel(info.previous),dateOnly(info.previousDate),statusLabel(info.latest),dateOnly(info.latestDate),dateOnly(latestDoctorVisit(d.id,true)?.date),d.nextFollowUp,recentNotMetCount(d.id),productOpportunity(d).label]);}));
  const coverageRows=[['TM','HQ','Doctor','Hospital','Speciality','Area','Campaign / Focus','Meeting Days','Meeting Timing','Calls This Month','Met Calls','Not-met Calls','Last Call','Next Follow-up','Data Quality']];
  state.doctors.forEach(d=>{const monthRows=doctorVisitRows(d.id).filter(v=>monthKey(v.date)===monthKey()),notMet=monthRows.filter(v=>NOT_MET_OUTCOMES.has(v.outcome)).length;coverageRows.push([state.profile.tmName,state.profile.hq,d.name,doctorHospital(d),d.speciality||d.qualification||'',d.area,d.campaign||d.productFocus||'',normalizeMeetingDays(d.meetingDays).map(i=>DAY_NAMES[i]).join('; '),doctorMeetingTiming(d),monthRows.length,monthRows.length-notMet,notMet,dateOnly(monthRows.slice(-1)[0]?.date),d.nextFollowUp,doctorCompleteness(d).label]);});
  const agg=new Map();state.orders.forEach(o=>(o.items||[]).forEach(i=>{const key=[monthKey(o.date),state.profile.hq,i.product,i.pack,o.distributorName||distributorById(o.distributorId)?.name||''].join('|'),x=agg.get(key)||{month:monthKey(o.date),hq:state.profile.hq,product:i.product,pack:i.pack,distributor:o.distributorName||distributorById(o.distributorId)?.name||'',qty:0,value:0,orders:0};x.qty+=num(i.qty);x.value+=num(i.value);x.orders+=1;agg.set(key,x);}));
  const compilationRows=[['Month','HQ','Product','Pack','Distributor','Order Lines','Quantity','POB Value','Source']];[...agg.values()].forEach(x=>compilationRows.push([x.month,x.hq,x.product,x.pack,x.distributor,x.orders,x.qty,x.value,'App POB / distributor order']));if(agg.size===0)missing.push(['Kunjan Compilation','All products','POB / distributor orders','Add actual orders; figures are not guessed.']);
  const salesRows=[['Month','State','HQ','Product','Target Qty','Primary Sales','Secondary Sales','Closing Stock','POB Qty from App','POB Value from App','Official Sales Import Status']];products.forEach(product=>{const items=[...agg.values()].filter(x=>norm(x.product)===norm(product)),qty=items.reduce((n,x)=>n+x.qty,0),value=items.reduce((n,x)=>n+x.value,0);salesRows.push([monthKey(),'Gujarat',state.profile.hq,product,'','','','',qty,value,'Official primary/secondary/closing sales required']);});missing.push(['GUJ Sales','All products','Primary / Secondary / Closing Sales','Import official SAN SFE or distributor sales; blank by design.']);
  const missingRows=[['Report','Record','Missing / Required','Action'],...missing];
  return {files:[
    {fileName:'Lost Prescrber rapid action & Follow up.xlsx',workbook:{sheets:[{name:'Lost Prescriber Follow-up',rows:lostRows},{name:'Data Missing',rows:missingRows}]}},
    {fileName:'MY Z & NICU Covering July.26.xlsx',workbook:{sheets:[{name:'MY Z NICU Coverage',rows:coverageRows},{name:'Data Missing',rows:missingRows}]}},
    {fileName:'Kunjan compilation july26.xlsx',workbook:{sheets:[{name:'Product HQ Compilation',rows:compilationRows},{name:'Data Missing',rows:missingRows}]}},
    {fileName:'GUJ_SALES.xlsx',workbook:{sheets:[{name:'GUJ Sales',rows:salesRows},{name:'Data Missing',rows:missingRows}]}}
  ]};
}
function exportCompanyReportPack(){if(window.AndroidBridge?.saveReportPack){window.AndroidBridge.saveReportPack(`MR-Company-Report-Pack-${localISODate()}.zip`,JSON.stringify(companyReportPackData()));toast('Choose where to save the ZIP containing all 4 filled report files.');}else{toast('Company report pack export is available in the Android APK.');}}

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
    campaign:['campaign','productname','productfocus'],product:['product','productname','brand'],pts:['pts','billingprice','price'],
    distributorName:['distributor','distributorname','stockistdistributor','preferreddistributor']
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
  function upsertDistributor(rec){
    const key=norm(rec.name),place=norm(rec.area||rec.hq);let old=state.distributors.find(x=>norm(x.name)===key&&(!place||norm(x.area||x.hq)===place))||state.distributors.find(x=>norm(x.name)===key);
    if(!old){const created={...rec,id:uid('dist'),createdAt:new Date().toISOString()};state.distributors.push(created);return {mode:'added',record:created};}
    Object.entries(rec).forEach(([k,v])=>{if(v!==''&&v!=null)old[k]=v;});old.updatedAt=new Date().toISOString();return {mode:'updated',record:old};
  }
  function upsertProduct(name,pts=''){if(!validName(name))return false;const key=norm(name);let p=state.products.find(x=>norm(x.name)===key);if(!p){state.products.push({id:uid('p'),name:clean(name),pts:num(pts)||'',createdAt:new Date().toISOString()});return true;}if(pts)p.pts=num(pts)||p.pts;return false;}

  function importSheetRows(sheets,fileName){
    const result={doctorAdded:0,doctorUpdated:0,chemistAdded:0,chemistUpdated:0,distributorAdded:0,distributorUpdated:0,products:0,linked:0,skipped:0,sheets:0};
    (sheets||[]).forEach(sheet=>{
      const sheetName=clean(sheet.name)||'Sheet';
      const rows=Array.isArray(sheet.rows)?sheet.rows:[];const hi=findHeaderRow(rows);if(hi<0)return;
      const headers=rows[hi].map(clean),hasDoc=indexFor(headers,'doctorName')>=0,hasChem=indexFor(headers,'chemistName')>=0,hasDist=indexFor(headers,'distributorName')>=0,hasProd=indexFor(headers,'product')>=0;result.sheets++;
      rows.slice(hi+1).forEach(row=>{
        const distName=hasDist?rowVal(row,headers,'distributorName'):'';let distributor=null;
        if(validName(distName)){const rr=upsertDistributor({name:distName,hq:rowVal(row,headers,'hq')||state.profile.hq,area:rowVal(row,headers,'area'),address:rowVal(row,headers,'address'),mobile:rowVal(row,headers,'mobile'),sourceFiles:[fileName]});distributor=rr.record;result[rr.mode==='added'?'distributorAdded':'distributorUpdated']++;}
        const chemName=hasChem?rowVal(row,headers,'chemistName'):'';let chem=null;
        if(validName(chemName)){
          const cr=upsertChemist({name:chemName,hq:rowVal(row,headers,'hq')||state.profile.hq,area:rowVal(row,headers,'area'),address:rowVal(row,headers,'address'),linkedDistributorId:distributor?.id||'',distributorName:distributor?.name||'',products:[],sourceFiles:[fileName],tags:[sheetName]});chem=cr.record;result[cr.mode==='added'?'chemistAdded':'chemistUpdated']++;
        }
        if(hasDoc){
          const name=rowVal(row,headers,'doctorName');if(validName(name)){
            const dr=upsertDoctor({name,hospital:rowVal(row,headers,'hospital'),hq:rowVal(row,headers,'hq')||state.profile.hq,area:rowVal(row,headers,'area'),address:rowVal(row,headers,'address'),meetingDays:normalizeMeetingDays(rowVal(row,headers,'meetingDays')),meetingFrom:normalizeTime(rowVal(row,headers,'meetingFrom')),meetingTo:normalizeTime(rowVal(row,headers,'meetingTo')),campaign:rowVal(row,headers,'campaign')||sheetName,linkedChemistId:chem?.id||'',chemistName:chem?.name||'',sourceFiles:[fileName],tags:[sheetName]});
            result[dr.mode==='added'?'doctorAdded':'doctorUpdated']++;if(chem){dr.record.linkedChemistId=chem.id;dr.record.chemistName=chem.name;result.linked++;}
          }else if(!chem&&!distributor)result.skipped++;
        }else if(!chem&&!distributor&&!hasProd)result.skipped++;
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
  const resultSummary=r=>`${r.doctorAdded} doctors added, ${r.doctorUpdated} updated; ${r.chemistAdded} chemists added, ${r.chemistUpdated} updated; ${r.distributorAdded||0} distributors added, ${r.distributorUpdated||0} updated; ${r.linked||0} doctor-chemist links; ${r.products} products.`;
  async function importFiles(files){
    const status=$('#importStatus');status.className='notice';status.classList.remove('hidden');status.textContent='Importing and merging records…';let grand={doctorAdded:0,doctorUpdated:0,chemistAdded:0,chemistUpdated:0,distributorAdded:0,distributorUpdated:0,products:0,linked:0,skipped:0,sheets:0};
    try{for(const file of files){if(file.name.toLowerCase().endsWith('.json')){restoreObject(JSON.parse(await file.text()));continue;}const r=window.AndroidBridge?.parseSpreadsheet?await importThroughAndroid(file):await importArrayBuffer(await file.arrayBuffer(),file.name);Object.keys(grand).forEach(k=>grand[k]+=num(r[k]));state.imports.push({id:uid('imp'),file:file.name,date:new Date().toISOString(),summary:resultSummary(r)});}saveState();status.textContent=`Done: ${resultSummary(grand)} Old meetings and saved GPS were preserved.`;toast('Import complete.');}catch(err){status.className='notice error';status.textContent=`Import failed: ${err.message}`;}
  }
  function loadEmbeddedSeed(){if(state.settings.embeddedSeedLoaded||!window.MR_SEED_DATA)return;const seed=window.MR_SEED_DATA;let da=0,du=0,ca=0,cu=0,pc=0;(seed.chemists||[]).forEach(r=>{const m=upsertChemist(r);m.mode==='added'?ca++:cu++;});(seed.doctors||[]).forEach(r=>{const m=upsertDoctor(r);m.mode==='added'?da++:du++;});(seed.products||[]).forEach(r=>{if(upsertProduct(r.name,r.pts))pc++;});state.settings.embeddedSeedLoaded=true;state.imports.push({id:uid('imp'),file:'Embedded supplied data',date:new Date().toISOString(),summary:`${da} doctors, ${ca} chemists/stockists and ${pc} products loaded.`});saveState(false);}
  async function loadBundledFiles(auto=false){const status=$('#importStatus');status.className='notice';status.classList.remove('hidden');status.textContent='Loading supplied Excel files…';if(!window.XLSX){status.className='notice error';status.textContent='Excel engine unavailable. Reopen the app.';return;}let total={doctorAdded:0,doctorUpdated:0,chemistAdded:0,chemistUpdated:0,distributorAdded:0,distributorUpdated:0,products:0,linked:0,skipped:0,sheets:0},ok=0;for(const path of BUNDLED_FILES){try{const res=await fetch(path);if(!res.ok)throw new Error(String(res.status));const r=await importArrayBuffer(await res.arrayBuffer(),decodeURIComponent(path.split('/').pop()));Object.keys(total).forEach(k=>total[k]+=num(r[k]));ok++;}catch(e){console.warn('Bundled import skipped',path,e);}}state.settings.bundledImportAttempted=true;if(ok){state.imports.push({id:uid('imp'),file:`${ok} supplied files`,date:new Date().toISOString(),summary:resultSummary(total)});saveState();status.textContent=`Supplied files loaded: ${resultSummary(total)}`;if(!auto)toast('Supplied data loaded.');}else{saveState(false);status.className='notice error';status.textContent='Could not read bundled files. Start through the included Termux server.';}}

  function restoreObject(obj){if(!obj||!Array.isArray(obj.doctors)||!Array.isArray(obj.chemists)||!Array.isArray(obj.visits))throw new Error('Not a valid MR Machine backup.');state=migrateState(obj);}
  function download(name,content,type='application/json'){if(window.AndroidBridge?.saveTextFile){window.AndroidBridge.saveTextFile(name,type,content);return;}const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  const csvCell=v=>`"${(Array.isArray(v)?v.join('; '):String(v??'')).replace(/"/g,'""')}"`;
  function exportCSV(){const headers=['Type','Name','Hospital / Clinic','Under Chemist','Meeting Days','Meeting Slot 1','Meeting Slot 2','Address','Area','Latitude','Longitude','Last Meeting','Next Follow-up','Notes'];const rows=[headers,...state.doctors.map(d=>['Doctor',d.name,doctorHospital(d),linkedChemist(d)?.name||d.chemistName,normalizeMeetingDays(d.meetingDays).map(x=>DAY_NAMES[x]).join('; '),doctorMeetingSlots(d)[0]?`${timeLabel(doctorMeetingSlots(d)[0].from)}-${timeLabel(doctorMeetingSlots(d)[0].to)}`:'',doctorMeetingSlots(d)[1]?`${timeLabel(doctorMeetingSlots(d)[1].from)}-${timeLabel(doctorMeetingSlots(d)[1].to)}`:'',d.address,d.area,d.latitude,d.longitude,d.lastVisit,d.nextFollowUp,d.notes]),...state.chemists.map(c=>['Chemist',c.name,'','','','','',c.address,c.area,c.latitude,c.longitude,c.lastVisit,c.nextFollowUp,c.notes])];download(`MR-Master-${localISODate()}.csv`,rows.map(r=>r.map(csvCell).join(',')).join('\n'),'text/csv;charset=utf-8');}
  async function hashPin(pin){if(window.AndroidBridge?.sha256)return window.AndroidBridge.sha256(pin);const data=new TextEncoder().encode(pin);const digest=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');}
  function showLockIfNeeded(){if(state.settings.pinHash){$('#lockScreen').classList.remove('hidden');$('#lockScreen').setAttribute('aria-hidden','false');setTimeout(()=>$('#unlockPin').focus(),100);}}

  function bindEvents(){
    document.addEventListener('click',e=>{
      const nav=e.target.closest('[data-nav]');if(nav){navigate(nav.dataset.nav);return;}
      const close=e.target.closest('[data-close-sheet]');if(close){closeSheet();return;}
      const a=e.target.closest('[data-action]');if(a){const action=a.dataset.action,type=a.dataset.type,id=a.dataset.id;if(action==='quick-log'||action==='add-visit')quickMeeting();if(action==='add-doctor')editRecord('doctor');if(action==='add-chemist')editRecord('chemist');if(action==='log-record'){if(type==='doctor')quickMeeting(id,'');else quickMeeting('',id);}if(action==='edit-record')editRecord(type,id);if(action==='view-record')viewRecord(type,id);if(action==='view-visit')viewVisit(id);if(action==='add-distributor')editDistributor();if(action==='edit-distributor')editDistributor(id);if(action==='manage-distributors')manageDistributors();if(action==='add-scheme')editScheme();if(action==='edit-scheme')editScheme(id);if(action==='manage-schemes')manageSchemes();if(action==='new-order')quickOrder(a.dataset.distributorId||'');if(action==='view-order')viewOrder(id);if(action==='plan-route')planTodayRoute();if(action==='nearby-hospitals')discoverNearbyHospitals();if(action==='voice-capture')voiceDataCapture();return;}
      const dc=e.target.closest('[data-doctor-chip]');if(dc){doctorFilter=dc.dataset.doctorChip;renderDoctors();return;}
      const cc=e.target.closest('[data-chemist-chip]');if(cc){chemistFilter=cc.dataset.chemistChip;renderChemists();return;}
      const vf=e.target.closest('[data-visit-filter]');if(vf){visitFilter=vf.dataset.visitFilter;renderVisits();return;}
      if(e.target.closest('[data-filter-followups="due"]')){visitFilter='due';navigate('visits');}
    });
    $('#sheetBackdrop').addEventListener('click',closeSheet);$('#quickLogBtn').addEventListener('click',()=>quickMeeting());$('#quickSearchBtn').addEventListener('click',globalSearch);
    $('#doctorSearch').addEventListener('input',renderDoctors);$('#chemistSearch').addEventListener('input',renderChemists);
    $('#doctorFilterBtn').addEventListener('click',()=>{doctorFilter=doctorFilter==='unlinked'?'all':'unlinked';renderDoctors();});
    $('#stockFilterBtn').addEventListener('click',()=>{chemistFilter=chemistFilter==='feedback'?'all':'feedback';renderChemists();});
    $('#workflowModeBtn').addEventListener('click',()=>{state.settings.workflowMode=state.settings.workflowMode==='collect'?'field':'collect';saveState();toast(state.settings.workflowMode==='collect'?'Data gathering mode active.':'Field work mode active.');});
    $('#machineOpenBtn').addEventListener('click',openIntelligenceCenter);$('#companyReportPackBtn').addEventListener('click',exportCompanyReportPack);
    $('#nearbyHospitalBtn').addEventListener('click',discoverNearbyHospitals);$('#planRouteBtn').addEventListener('click',planTodayRoute);$('#newOrderBtn').addEventListener('click',()=>quickOrder());$('#manageDistributorsBtn').addEventListener('click',manageDistributors);$('#manageSchemesBtn').addEventListener('click',manageSchemes);$('#exportXlsxBtn').addEventListener('click',exportXLSX);
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
