(() => {
  'use strict';

  const STORE_KEY = 'mr-daily-auto-v3';
  const STORE_BACKUP_KEY = 'mr-daily-auto-v3-last-good';
  const APP_VERSION = 1.0;
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
  function splitCodedChemistName(value) {
    const raw=clean(value);
    const m=raw.match(/^(\d{4,})\s*:\s*(.+)$/);
    return m ? {name:clean(m[2]), code:m[1]} : {name:raw, code:''};
  }
  const cleanChemistName = value => splitCodedChemistName(value).name;
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
  function successfulDoctorVisits(doctorId){return doctorVisitRows(doctorId).filter(v=>!NOT_MET_OUTCOMES.has(v.outcome));}
  function doctorVisitPolicy(doctor){
    const target=Math.max(1,Math.min(4,Math.round(num(doctor?.monthlyVisitTarget)||2)));
    const automaticGap=target===1?0:target===2?15:target===3?9:7;
    const gap=Math.max(0,Math.round(num(doctor?.minVisitGapDays)||automaticGap));
    return {target,gap,label:`${target}× / month${gap?` • ${gap}d gap`:''}`};
  }
  function doctorEligibilityForDate(doctor,date=localISODate()){
    const policy=doctorVisitPolicy(doctor),month=monthKey(date),rows=successfulDoctorVisits(doctor.id).filter(v=>monthKey(v.date)===month),count=rows.length,last=successfulDoctorVisits(doctor.id).slice(-1)[0]||null;
    if(count>=policy.target)return {eligible:false,reason:`${count}/${policy.target} monthly visits completed`,count,...policy,last};
    if(policy.gap&&last&&daysBetween(last.date,date)<policy.gap)return {eligible:false,reason:`Gap ${daysBetween(last.date,date)}/${policy.gap} days`,count,...policy,last};
    return {eligible:true,reason:`Visit ${count+1}/${policy.target} due`,count,...policy,last};
  }
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
    if(!doctorEligibilityForDate(doctor).eligible)return -10000;
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
    $('#machineQualityText').textContent=`${quality.complete}/${quality.total} fully verified • ${quality.missingTiming} timing pending • ${state.reschedules.filter(r=>r.status==='pending').length} rescheduled • ${pendingDistributorStops().length} distributor stops`;
    box.innerHTML=patch.length?patch.map((x,i)=>`<button class="machine-call plain-button" data-action="log-record" data-type="doctor" data-id="${esc(x.doctor.id)}"><span>${i+1}</span><div><strong>${esc(doctorDisplayName(x.doctor))}</strong><small>${esc([x.timing.label,...x.reasons].filter(Boolean).join(' • '))}</small></div><b>${Math.max(0,Math.round(x.score))}</b></button>`).join(''):empty('No pending doctor call. Add doctor timings or follow-up data.');
  }
  function openIntelligenceCenter(){
    const patch=smartPatchCandidates(12),q=dataQualitySummary(),pending=state.reschedules.filter(r=>r.status==='pending').sort((a,b)=>String(a.scheduledDate).localeCompare(String(b.scheduledDate))),distributorStops=pendingDistributorStops();
    openSheet('MR Machine','Reads saved field data and prepares the next best actions. GPS is not used for attendance or scoring.',`<div class="machine-summary-grid"><div><strong>${patch.length}</strong><small>Doctor calls</small></div><div><strong>${distributorStops.length}</strong><small>Distributor stops</small></div><div><strong>${q.complete}/${q.total}</strong><small>Verified data</small></div></div><div class="detail-section"><h4>Today smart patch</h4><div class="machine-patch-list">${patch.length?patch.map((x,i)=>`<div class="machine-patch-row"><span>${i+1}</span><div><strong>${esc(doctorDisplayName(x.doctor))}</strong><small>${esc(x.reasons.join(' • ')||x.timing.label)}</small><em>${esc(x.opportunity.label)}</em></div><button data-action="log-record" data-type="doctor" data-id="${esc(x.doctor.id)}">Meet</button></div>`).join(''):empty('No pending calls.')}</div></div><div class="detail-section"><h4>Accepted orders → distributor planning</h4>${distributorStops.length?distributorStops.map((x,i)=>`<div class="machine-reschedule"><strong>${i+1}. ${esc(x.distributor.name)} • ₹${esc(x.totalValue.toLocaleString('en-IN'))}</strong><small>${esc(`${x.orders.length} order(s) • ${x.chemists.join(', ')||'Chemist pending'} • ${x.address||'Address missing'}${x.mapReady?' • map ready':' • map pin missing'}`)}</small></div>`).join(''):empty('No accepted order is pending distributor fulfilment.')}</div><button id="confirmMachinePatchBtn" class="btn primary full">Confirm doctor + distributor plan</button><div class="detail-section"><h4>Pending reschedules</h4>${pending.length?pending.map(r=>`<div class="machine-reschedule"><strong>${esc(r.doctorName)}</strong><small>${esc(`${prettyDate(r.scheduledDate)} • ${timeLabel(r.meetingFrom)}–${timeLabel(r.meetingTo)} • ${r.reason}`)}</small></div>`).join(''):empty('No pending reschedule.')}</div><div class="detail-section"><h4>Data quality</h4><div class="quality-grid"><div><b>${q.missingHospital}</b><span>Hospital missing</span></div><div><b>${q.missingChemist}</b><span>Chemist missing</span></div><div><b>${q.missingTiming}</b><span>Timing missing</span></div><div><b>${q.missingGps}</b><span>GPS verification pending</span></div><div><b>${q.duplicates}</b><span>Possible duplicate</span></div></div></div>`);
    $('#confirmMachinePatchBtn')?.addEventListener('click',()=>{state.patchPlans.push({id:uid('patch'),date:localISODate(),createdAt:new Date().toISOString(),status:'confirmed',items:[...patch.map((x,i)=>({order:i+1,type:'Doctor',doctorId:x.doctor.id,doctorName:x.doctor.name,hospital:doctorHospital(x.doctor),timing:x.timing.label,score:Math.round(x.score),reason:x.reasons.join('; '),productAction:x.opportunity.label})),...distributorStops.map((x,i)=>({order:patch.length+i+1,type:'Distributor',distributorId:x.distributor.id,distributorName:x.distributor.name,hospital:'',timing:'Order fulfilment',score:'',reason:`${x.orders.length} accepted order(s); ${x.chemists.join(', ')}`,productAction:`POB ₹${x.totalValue}`}))]});saveState();toast('Doctor calls and distributor stops added to planning reports.');});
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
        tmName: '',
        hq: '',
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
      visits: [],
      expenses: [],
      sampleItems: [],
      sampleTransactions: [],
      tourPlans: [],
      rcpa: [],
      salesMonths: [],
      opening: {monthKey: monthKey(today), calls:0, inputs:0, basket:0, towel:0, conversation:0, newAvailability:0, pobValue:0},
      imports: [],
      settings: {bundledImportAttempted:false, embeddedSeedLoaded:false, pinHash:'', installedHintSeen:false, workflowMode:'field', nearbyRadiusMeters:1000, expenseRatePerKm:0}
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
      expenses: Array.isArray(raw?.expenses) ? raw.expenses : [],
      sampleItems: Array.isArray(raw?.sampleItems) ? raw.sampleItems : [],
      sampleTransactions: Array.isArray(raw?.sampleTransactions) ? raw.sampleTransactions : [],
      tourPlans: Array.isArray(raw?.tourPlans) ? raw.tourPlans : [],
      rcpa: Array.isArray(raw?.rcpa) ? raw.rcpa : [],
      salesMonths: Array.isArray(raw?.salesMonths) ? raw.salesMonths : [],
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
      if (d.chemistName) d.chemistName = cleanChemistName(d.chemistName);
      d.monthlyVisitTarget = Math.max(1,Math.min(4,Math.round(num(d.monthlyVisitTarget)||2)));
      d.minVisitGapDays = Math.max(0,Math.round(num(d.minVisitGapDays)||0));
    });
    out.chemists.forEach(c => {
      if (!c.id) c.id = uid('ch');
      const parsedName=splitCodedChemistName(c.name);
      if(parsedName.code && !c.stockistCode)c.stockistCode=parsedName.code;
      c.name = parsedName.name;
      c.address = clean(c.address);
      c.area = clean(c.area || c.hq);
      if (!c.linkedDistributorId && c.distributorId) c.linkedDistributorId = c.distributorId;
    });
    out.distributors.forEach(d => {
      if (!d.id) d.id = uid('dist');
      d.name=clean(d.name); d.address=clean(d.address); d.area=clean(d.area||d.hq); d.mobile=clean(d.mobile);
    });
    out.schemes.forEach(x=>{if(!x.id)x.id=uid('sch');x.product=clean(x.product);x.pack=clean(x.pack);x.ratio=clean(x.ratio);});
    out.orders.forEach(o=>{if(!o.id)o.id=uid('ord');if(!Array.isArray(o.items))o.items=[];if(o.chemistName)o.chemistName=cleanChemistName(o.chemistName);});
    out.visits.forEach(v => {
      if (!v.id) v.id = uid('log');
      if (!v.productStatuses || typeof v.productStatuses !== 'object') v.productStatuses = {};
      if (!v.doctorId && v.entityType === 'doctor') v.doctorId = v.entityId;
      if (!v.doctorName && v.entityType === 'doctor') v.doctorName = v.entityName;
      if (!v.chemistId && v.entityType === 'chemist') v.chemistId = v.entityId;
      if (!v.chemistName && v.entityType === 'chemist') v.chemistName = v.entityName;
      if (v.chemistName) v.chemistName = cleanChemistName(v.chemistName);
      if (v.entityType === 'chemist' && v.entityName) v.entityName = cleanChemistName(v.entityName);
      if (!v.doctorHospital && v.doctorId) v.doctorHospital = doctorHospital(out.doctors.find(d => d.id === v.doctorId));
      if (!v.latitude && v.location?.latitude) v.latitude = v.location.latitude;
      if (!v.longitude && v.location?.longitude) v.longitude = v.location.longitude;
    });
    out.expenses.forEach(x=>{if(!x.id)x.id=uid('exp');x.amount=num(x.amount);x.km=num(x.km);x.ratePerKm=num(x.ratePerKm);});
    out.sampleItems.forEach(x=>{if(!x.id)x.id=uid('smp');x.product=clean(x.product||x.name);x.pack=clean(x.pack);x.batch=clean(x.batch);x.expiry=clean(x.expiry);x.openingQty=num(x.openingQty);});
    out.sampleTransactions.forEach(x=>{if(!x.id)x.id=uid('smt');x.qty=num(x.qty);});
    out.tourPlans.forEach(x=>{if(!x.id)x.id=uid('tp');x.date=dateOnly(x.date||localISODate());x.area=clean(x.area);x.workType=clean(x.workType||'HQ');});
    out.rcpa.forEach(x=>{if(!x.id)x.id=uid('rcpa');x.rxQty=num(x.rxQty);});
    out.salesMonths.forEach(x=>{if(!x.id)x.id=uid('sale');x.month=clean(x.month||monthKey());x.target=num(x.target);x.primary=num(x.primary);x.secondary=num(x.secondary);x.collection=num(x.collection);});
    out.captures.forEach(c=>{
      if(c.chemistName)c.chemistName=cleanChemistName(c.chemistName);
      if(c.parsed?.chemistName)c.parsed.chemistName=cleanChemistName(c.parsed.chemistName);
    });
    out.patchPlans.forEach(p=>(p.items||[]).forEach(i=>{if(i.chemistName)i.chemistName=cleanChemistName(i.chemistName);}));
    return out;
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY));
      return parsed && typeof parsed === 'object' ? migrateState(parsed) : makeDefaultState();
    } catch (_) {
      try {
        const backup = JSON.parse(localStorage.getItem(STORE_BACKUP_KEY));
        return backup && typeof backup === 'object' ? migrateState(backup) : makeDefaultState();
      } catch (_) {
        return makeDefaultState();
      }
    }
  }

  let state = loadState();
  let activePage = 'dashboard';
  let doctorFilter = 'all';
  let chemistFilter = 'all';
  let visitFilter = 'all';
  let deferredInstallPrompt = null;
  let pendingSanClipboardText = "";
  const nearbyPlaceCache = new Map();

  function saveState(render = true) {
    try {
      const current=localStorage.getItem(STORE_KEY);
      if(current) localStorage.setItem(STORE_BACKUP_KEY,current);
      state.version=APP_VERSION;
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Save failed',error);
      toast?.('Storage is full. Export backup before adding more data.');
      return false;
    }
    if (render) renderAll();
    return true;
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
      `Total POB value Today/Cum:${v('pobValue')}`,
      `Samples issued Today/Month: ${sampleIssuedForDay(date)}/${sampleIssuedForMonth(monthKey(date))}`,
      `Expense Today/Month: ₹${expenseTotal(expensesForDay(date)).toLocaleString('en-IN')}/₹${expenseTotal(expensesForMonth(monthKey(date))).toLocaleString('en-IN')}`,
      `RCPA Today/Month: ${state.rcpa.filter(x=>dateOnly(x.date)===date).length}/${state.rcpa.filter(x=>monthKey(x.date)===monthKey(date)).length}`
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
function orderNeedsDistributorVisit(o,date=localISODate()){
  const status=clean(o?.status||'placed').toLowerCase(),fulfilment=clean(o?.fulfilmentStatus||'pending').toLowerCase(),planDate=String(o?.planningDate||o?.date||date).slice(0,10);
  return ['accepted','placed','pending','confirmed'].includes(status)&&!['completed','fulfilled','cancelled'].includes(fulfilment)&&planDate<=date;
}
function pendingDistributorStops(date=localISODate()){
  const groups=new Map();
  state.orders.filter(o=>orderNeedsDistributorVisit(o,date)).forEach(o=>{
    const distributor=distributorById(o.distributorId);if(!distributor)return;
    if(!groups.has(distributor.id))groups.set(distributor.id,{type:'distributor',distributor,orders:[],totalValue:0,chemists:new Set(),latitude:num(distributor.latitude),longitude:num(distributor.longitude)});
    const g=groups.get(distributor.id);g.orders.push(o);g.totalValue+=orderTotal(o);if(o.chemistName)g.chemists.add(o.chemistName);
  });
  return [...groups.values()].map(g=>({...g,chemists:[...g.chemists],mapReady:!!(g.latitude&&g.longitude),address:g.distributor.address||g.distributor.area||'',area:g.distributor.area||''})).sort((a,b)=>String(a.area).localeCompare(String(b.area))||a.distributor.name.localeCompare(b.distributor.name));
}
function parseMapCoordinates(value){
  let text=clean(value);if(!text)return null;try{text=decodeURIComponent(text);}catch(_){/* keep original text */}
  const patterns=[/@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,/\b(?:query|q|ll)=(-?\d{1,2}(?:\.\d+)?)[,%20\s]+(-?\d{1,3}(?:\.\d+)?)/i,/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/];
  for(const pattern of patterns){const m=text.match(pattern);if(m){const latitude=num(m[1]),longitude=num(m[2]);if(latitude>=-90&&latitude<=90&&longitude>=-180&&longitude<=180)return {latitude,longitude};}}
  return null;
}
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
  const list=state.doctors.map(d=>({doctor:d,slot:todaySlot(d),eligibility:doctorEligibilityForDate(d)})).filter(x=>x.eligibility.eligible&&x.slot&&x.doctor.latitude&&x.doctor.longitude&&(includeVisited||!visited.has(x.doctor.id)));
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
function groupedHospitalRouteCandidates(lat,lng,includeVisited=false){
  const visited=new Set(rowsForDay().map(v=>v.doctorId).filter(Boolean)),groups=new Map();
  state.doctors.forEach(doctor=>{
    const eligibility=doctorEligibilityForDate(doctor);const slot=todaySlot(doctor);if(!eligibility.eligible||!slot||!num(doctor.latitude)||!num(doctor.longitude)||(visited.has(doctor.id)&&!includeVisited))return;
    const key=doctor.placeId?`place:${doctor.placeId}`:`gps:${num(doctor.latitude).toFixed(4)},${num(doctor.longitude).toFixed(4)}:${norm(doctorHospital(doctor))}`;
    if(!groups.has(key))groups.set(key,{key,type:'hospital',hospital:doctorHospital(doctor)||doctorDisplayName(doctor),address:doctor.address||doctor.area||'',latitude:num(doctor.latitude),longitude:num(doctor.longitude),doctors:[]});
    groups.get(key).doctors.push({doctor,slot});
  });
  const remaining=[...groups.values()].map(g=>{g.doctors.sort((a,b)=>a.slot.end-b.slot.end||a.slot.start-b.slot.start);g.slot=g.doctors[0].slot;g.doctor=g.doctors[0].doctor;return g;}),route=[];
  let pLat=num(lat),pLng=num(lng),clock=now().getHours()*60+now().getMinutes();
  while(remaining.length){
    const ranked=remaining.map(stop=>{
      const distance=haversineKm(pLat,pLng,stop.latitude,stop.longitude),travel=Math.max(4,Math.round(distance/24*60)),rawArrival=clock+travel,arrival=Math.max(rawArrival,stop.slot.start),wait=Math.max(0,stop.slot.start-rawArrival),late=Math.max(0,arrival-stop.slot.end);
      return {...stop,distance,travelMinutes:travel,arrivalMinutes:arrival,waitMinutes:wait,timingRisk:late>0,lateMinutes:late};
    }).sort((a,b)=>a.distance-b.distance||a.timingRisk-b.timingRisk||a.arrivalMinutes-b.arrivalMinutes);
    const chosen=ranked[0],idx=remaining.findIndex(x=>x.key===chosen.key);remaining.splice(idx,1);route.push(chosen);pLat=chosen.latitude;pLng=chosen.longitude;clock=chosen.arrivalMinutes+Math.max(12,chosen.doctors.length*8);
  }
  return route;
}
function googleRouteUrl(lat,lng,route){
  if(!route.length)return '';
  const points=route.filter(x=>num(x.latitude||x.doctor?.latitude)&&num(x.longitude||x.doctor?.longitude)).slice(0,9);if(!points.length)return '';
  const coord=x=>`${num(x.latitude||x.doctor?.latitude)},${num(x.longitude||x.doctor?.longitude)}`,dest=points[points.length-1],waypoints=points.slice(0,-1).map(coord).join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${lat},${lng}`)}&destination=${encodeURIComponent(coord(dest))}${waypoints?`&waypoints=${encodeURIComponent(waypoints)}`:''}&travelmode=driving`;
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
  const quick=prefix==='quickdoc',out=$(quick?'#quickNearbyResults':'#nearbyResults'),status=$(quick?'#quickdocLocationStatus':'#nearbyLiveStatus');if(!out)return;
  if(!ok){if(status&&!quick)status.textContent=error||'Live hospital search unavailable.';return;}
  try{
    const live=JSON.parse(json||'[]').filter(x=>Number.isFinite(Number(x.latitude))&&Number.isFinite(Number(x.longitude))).map((x,i)=>({...x,latitude:num(x.latitude),longitude:num(x.longitude),id:`live:${x.placeId||i}`,source:'live',doctorIds:[]}));
    live.forEach(x=>nearbyPlaceCache.set(x.id,x));
    const lat=num($(quick?'#quickdocLatitude':'#nearbyLatitude').value),lng=num($(quick?'#quickdocLongitude':'#nearbyLongitude').value),radius=quick?2000:(num($('#nearbyRadius').value)||1000),saved=savedHospitalGroups(lat,lng,radius),merged=mergeNearbyPlaces(saved,live,lat,lng,radius);
    merged.forEach(x=>nearbyPlaceCache.set(x.id,x));
    if(quick){out.innerHTML=merged.length?merged.slice(0,12).map(x=>`<button type="button" class="nearby-place-card plain-button" data-quick-nearby-place="${esc(x.id)}"><div class="nearby-place-distance">${esc(x.distanceKm.toFixed(2))}<small>km</small></div><div class="nearby-place-copy"><h3>${esc(x.name)}</h3><p>${esc(x.address||'Address unavailable')}</p><small>${esc((x.doctorIds||[]).length)} saved doctor(s) • ${x.source==='live'?'Google':'Saved'}</small></div></button>`).join(''):empty('No hospital or clinic found within 2 km.');}
    else{out.innerHTML=merged.length?merged.map(nearbyResultCard).join(''):empty('No hospital or clinic found in this radius.');if(status)status.textContent=`${live.length} live places received • Powered by Google`;}
  }catch(e){if(status&&!quick)status.textContent=`Could not read live results: ${e.message}`;}
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
    const tp=latestTourPlan();
    $('#routeLabel').textContent = tp?`${tp.workType||'HQ'} • ${tp.area||state.profile.hq||'Area not set'}${tp.jointWorkWith?` • with ${tp.jointWorkWith}`:''}`:(state.settings.workflowMode==='collect'?'Data setup: complete only missing doctor/chemist/timing/GPS details.':'Doctor call → chemist/RCPA → samples/POB → expense → report.');
  }
  function renderDashboard() {
    const today=localISODate(), t=statsForDay(today), c=statsForMonth(today);
    $('#reportPeriod').textContent=`Today / ${now().toLocaleDateString('en-IN',{month:'long'})} cumulative`;
    $('#reportKpis').innerHTML=METRICS.map(([k,label])=>`<div class="report-kpi"><small>${esc(label)}</small><strong>${esc(formatMetric(k,t[k]))} <span>/ ${esc(formatMetric(k,c[k]))}</span></strong></div>`).join('');
    $('#doctorCount').textContent=state.doctors.length;
    $('#chemistCount').textContent=state.chemists.length;
    $('#todayVisitCount').textContent=rowsForDay(today).filter(v=>v.doctorId||v.chemistId).length;
    const due=dueEntities(); $('#dueCount').textContent=due.length;
    const todayExpense=expenseTotal(expensesForDay(today)),todaySamples=sampleIssuedForDay(today),tp=latestTourPlan(today),sale=salesForMonth(monthKey(today)),salesPct=sale?.target?Math.round(num(sale.secondary)/num(sale.target)*100):0;
    if($('#todayExpenseValue'))$('#todayExpenseValue').textContent=`₹${todayExpense.toLocaleString('en-IN')}`;
    if($('#todaySampleIssued'))$('#todaySampleIssued').textContent=String(todaySamples);
    if($('#todayPlanText'))$('#todayPlanText').textContent=tp?`${tp.workType||'HQ'} • ${tp.area||''}`:'Not set';
    if($('#salesProgressText'))$('#salesProgressText').textContent=sale?.target?`${salesPct}% • ₹${num(sale.secondary).toLocaleString('en-IN')}`:'Not set';
    const activities=rowsForDay(today).filter(v=>v.doctorId||v.chemistId).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,6);
    $('#todayActivityList').innerHTML=activities.length?activities.map(miniActivity).join(''):empty('No meeting logged today. Tap + to start.');
    $('#nextActionsList').innerHTML=due.length?due.slice(0,6).map(miniDue).join(''):empty('No follow-ups due.');
    const cov=collectionCoverage(), mode=state.settings.workflowMode||'collect';
    $('#collectionModeTitle').textContent=mode==='collect'?'Data gathering mode':'Field work mode';
    $('#collectionModeText').textContent=mode==='collect'?'First collect correct doctor, hospital, chemist, timing and hospital GPS verification. The Machine will use this saved data later.':'Smart patch, orders and reports now use your collected master data.';
    $('#collectionProgressBar').style.width=`${Math.min(100,cov.score)}%`;
    $('#collectionProgressText').textContent=`${cov.score}% ready • ${cov.gps}/${cov.total} GPS • ${cov.timing}/${cov.total} timings • ${cov.linked}/${cov.total} chemist links`;
    $('#workflowModeBtn').textContent=mode==='collect'?'Switch to field work':'Back to data gathering';
    const routeReady=state.doctors.filter(d=>doctorEligibilityForDate(d).eligible&&todaySlot(d)&&d.latitude&&d.longitude&&!rowsForDay().some(v=>v.doctorId===d.id)).length;
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
    const isDoctor=Boolean(v.doctorId),parts=[isDoctor?v.chemistName:(v.outcomeLabel||'Chemist visit'), prescribed?`${prescribed} prescribed`:'', notPrescribed?`${notPrescribed} not prescribed`:'', v.latitude&&isDoctor?'GPS saved':''].filter(Boolean);
    return `<button class="mini-card plain-button" data-action="view-visit" data-id="${esc(v.id)}"><span class="mini-icon">${isDoctor?'✓':'Rx'}</span><span class="mini-copy"><h3>${esc(isDoctor?([v.doctorName||v.entityName,v.doctorHospital].filter(Boolean).join(' — ')||'Meeting'):(v.chemistName||v.entityName||'Chemist visit'))}</h3><p>${esc(parts.join(' • ')||v.notes||'Meeting saved')}</p></span><span class="mini-side"><strong>${esc(prettyTime(v.date))}</strong><small>${isDoctor?'doctor':'chemist'}</small></span></button>`;
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
      [doctorVisitPolicy(r).label,r.needsCompletion&&'Needs completion',r.latitude&&'Clinic GPS',r.lastVisit&&`Last ${prettyDate(r.lastVisit)}`,r.nextFollowUp&&`Due ${prettyDate(r.nextFollowUp)}`].filter(Boolean):
      [fb.prescribed&&`${fb.prescribed} prescribed`,fb.notPrescribed&&`${fb.notPrescribed} not prescribed`,r.latitude&&'Shop GPS'].filter(Boolean);
    const timingTag=isDoctor&&timing.state!=='unset'?`<span class="tag timing ${timing.state==='available'?'good':''}">${esc(timing.label)}</span>`:'';
    const locationAction=map?`<a href="${map}" target="_blank" rel="noopener">Map</a>`:`<button data-action="edit-record" data-type="${type}" data-id="${r.id}">Location</button>`;
    const actions=isDoctor?`${locationAction}<button class="primary-action" data-action="log-record" data-type="doctor" data-id="${r.id}">Meet</button><button data-action="view-record" data-type="doctor" data-id="${r.id}">View</button>`:`${locationAction}<button class="primary-action" data-action="chemist-visit" data-id="${r.id}">Visit</button><button data-action="quick-rcpa" data-id="${r.id}">RCPA</button><button data-action="view-record" data-type="chemist" data-id="${r.id}">View</button>`;
    return `<article class="record-card"><div class="record-top"><div class="avatar">${esc(initials(r.name))}</div><div class="record-title"><h3>${esc(isDoctor?doctorDisplayName(r):r.name)}</h3><p>${esc(subtitle||'Details not added')}</p></div></div>${r.address?`<p class="record-note">${esc(r.address).slice(0,180)}</p>`:''}<div class="tag-row">${timingTag}${tags.slice(0,4).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div><div class="record-actions ${isDoctor?'three':'chemist-actions-four'}">${actions}</div></article>`;
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
    const statuses=Object.entries(v.productStatuses||{}).filter(([,s])=>s),sampleQty=state.sampleTransactions.filter(x=>x.type==='issue'&&x.visitId===v.id).reduce((n,x)=>n+num(x.qty),0);
    const subtitle=[v.outcomeLabel||OUTCOME_LABELS[v.outcome]||'',v.doctorId?v.chemistName:'',sampleQty?`${sampleQty} sample(s)`:'',v.latitude&&v.doctorId?'Hospital GPS verified':'',v.followUpDate?`Follow-up ${prettyDate(v.followUpDate)}`:''].filter(Boolean).join(' • ');
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
    const expMonth=expenseTotal(expensesForMonth()),sampleBal=state.sampleItems.reduce((n,x)=>n+sampleBalance(x),0),tp=latestTourPlan(),sale=salesForMonth();
    if($('#expenseToolText'))$('#expenseToolText').textContent=`₹${expMonth.toLocaleString('en-IN')} this month`;
    if($('#sampleToolText'))$('#sampleToolText').textContent=`${sampleBal} balance • ${sampleIssuedForMonth()} issued`;
    if($('#tourPlanToolText'))$('#tourPlanToolText').textContent=tp?`${tp.workType||'HQ'} • ${tp.area||''}`:'Today plan not set';
    if($('#rcpaToolText'))$('#rcpaToolText').textContent=`${state.rcpa.filter(x=>monthKey(x.date)===monthKey()).length} RCPA this month`;
    if($('#salesToolText'))$('#salesToolText').textContent=sale?.target?`₹${num(sale.secondary).toLocaleString('en-IN')} / ₹${num(sale.target).toLocaleString('en-IN')}`:'Monthly target not set';
  }

  function navigate(page) {
    activePage=page;
    $$('.page').forEach(p=>p.classList.toggle('active',p.dataset.page===page));
    $$('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.nav===page));
    window.scrollTo({top:0,behavior:'smooth'});
    if(page==='doctors')renderDoctors(); if(page==='chemists')renderChemists(); if(page==='visits')renderVisits(); if(page==='tools')renderTools();
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



  // ---- Practical MR work: expenses, samples, tour plan, RCPA and sales ----
  function expensesForDay(date=localISODate()){return state.expenses.filter(x=>dateOnly(x.date)===date).sort((a,b)=>String(b.date).localeCompare(String(a.date)));}
  function expensesForMonth(month=monthKey()){return state.expenses.filter(x=>monthKey(x.date)===month).sort((a,b)=>String(b.date).localeCompare(String(a.date)));}
  function expenseTotal(rows){return (rows||[]).reduce((n,x)=>n+num(x.amount),0);}
  function latestTourPlan(date=localISODate()){return state.tourPlans.filter(x=>dateOnly(x.date)===date).sort((a,b)=>String(a.updatedAt||a.createdAt||'').localeCompare(String(b.updatedAt||b.createdAt||''))).slice(-1)[0]||null;}
  function salesForMonth(month=monthKey()){return state.salesMonths.find(x=>x.month===month)||null;}
  function sampleItemById(id){return state.sampleItems.find(x=>x.id===id);}
  function sampleBalance(itemOrId){const item=typeof itemOrId==='string'?sampleItemById(itemOrId):itemOrId;if(!item)return 0;let bal=num(item.openingQty);state.sampleTransactions.filter(x=>x.sampleItemId===item.id).forEach(x=>{if(x.type==='receive')bal+=num(x.qty);else if(x.type==='issue')bal-=num(x.qty);else if(x.type==='adjust')bal+=num(x.qty);});return bal;}
  function sampleIssuedForDay(date=localISODate()){return state.sampleTransactions.filter(x=>x.type==='issue'&&dateOnly(x.date)===date).reduce((n,x)=>n+num(x.qty),0);}
  function sampleIssuedForMonth(month=monthKey()){return state.sampleTransactions.filter(x=>x.type==='issue'&&monthKey(x.date)===month).reduce((n,x)=>n+num(x.qty),0);}
  function suggestedTravelKm(date=localISODate()){const plan=state.routePlans.filter(x=>dateOnly(x.date)===date).slice(-1)[0];return Number((plan?.stops||[]).reduce((n,x)=>n+num(x.distanceKm),0).toFixed(1));}
  function sampleItemOptions(selected=''){const items=state.sampleItems.slice().sort((a,b)=>(a.product||'').localeCompare(b.product||''));return `<option value="">Select sample</option>${items.map(x=>`<option value="${esc(x.id)}" ${x.id===selected?'selected':''}>${esc([x.product,x.pack].filter(Boolean).join(' • '))} — balance ${esc(sampleBalance(x))}</option>`).join('')}`;}
  function sampleIssueRow(item={},index=0){return `<div class="sample-issue-row" data-sample-issue><label><span>Sample</span><select name="sampleItemId">${sampleItemOptions(item.sampleItemId||'')}</select></label><label><span>Qty</span><input name="sampleQty" type="number" min="0" step="1" value="${esc(item.qty||1)}"></label><button type="button" class="remove-sample-row" data-remove-sample-row aria-label="Remove">×</button></div>`;}
  function bindSampleIssueRows(root){root?.addEventListener('click',e=>{const b=e.target.closest('[data-remove-sample-row]');if(b)b.closest('[data-sample-issue]')?.remove();});}
  function collectSampleIssues(root){return $$('[data-sample-issue]',root).map(row=>({sampleItemId:clean($('select[name="sampleItemId"]',row).value),qty:num($('input[name="sampleQty"]',row).value)})).filter(x=>x.sampleItemId&&x.qty>0);}
  function validateSampleIssues(issues){const requested=new Map();for(const x of issues)requested.set(x.sampleItemId,(requested.get(x.sampleItemId)||0)+num(x.qty));for(const [id,qty] of requested){const item=sampleItemById(id),bal=sampleBalance(id);if(!item)return `Sample item not found.`;if(qty>bal)return `${item.product} balance is ${bal}; requested ${qty}.`;}return '';}
  function commitSampleIssues(issues,{date=localISODateTime(),doctor=null,chemist=null,visitId='',notes=''}={}){for(const x of issues){const item=sampleItemById(x.sampleItemId);state.sampleTransactions.push({id:uid('smt'),type:'issue',date,sampleItemId:item.id,product:item.product,pack:item.pack||'',batch:item.batch||'',qty:num(x.qty),doctorId:doctor?.id||'',doctorName:doctor?.name||'',chemistId:chemist?.id||'',chemistName:chemist?.name||'',visitId,notes:clean(notes),createdAt:new Date().toISOString()});}}

  function manageExpenses(){
    const todayRows=expensesForDay(),monthRows=expensesForMonth(),rate=num(state.settings.expenseRatePerKm),km=suggestedTravelKm();
    openSheet('Expenses','Fast field expense ledger — TA/DA, stay, toll, parking and other claims.',`<div class="manager-summary"><div><small>TODAY</small><strong>₹${esc(expenseTotal(todayRows).toLocaleString('en-IN'))}</strong></div><div><small>THIS MONTH</small><strong>₹${esc(expenseTotal(monthRows).toLocaleString('en-IN'))}</strong></div><div><small>TRAVEL RATE</small><strong>${rate?`₹${esc(rate)}/km`:'Not set'}</strong></div></div><div class="button-row"><button class="btn secondary" data-action="expense-settings">Travel rate</button><button class="btn primary" data-action="add-expense">+ Add expense</button></div>${km?`<div class="notice">Today saved route distance: about ${esc(km)} km. Travel expense can use this as a suggestion; you can correct it before saving.</div>`:''}<div class="detail-section"><h4>Recent expenses</h4><div class="card-list compact-list">${monthRows.length?monthRows.slice(0,30).map(x=>`<div class="ledger-row"><div class="copy"><strong>${esc(x.category||'Expense')} • ${esc(prettyDate(x.date))}</strong><small>${esc([x.fromPlace&&x.toPlace?`${x.fromPlace} → ${x.toPlace}`:'',x.km?`${x.km} km`:'',x.notes].filter(Boolean).join(' • '))}</small></div><div class="value"><strong>₹${esc(num(x.amount).toLocaleString('en-IN'))}</strong><button data-action="edit-expense" data-id="${esc(x.id)}">Edit</button></div></div>`).join(''):empty('No expenses this month.')}</div></div>`);
  }
  function expenseSettings(){openSheet('Expense settings','Do not guess company rates. Enter only your approved rate.',`<form id="expenseSettingsForm" class="sheet-form"><label><span>Approved travel rate ₹ / km</span><input name="rate" type="number" min="0" step="0.01" value="${esc(num(state.settings.expenseRatePerKm)||'')}"></label><div class="notice">If your company uses fixed HQ/EX/OS allowances instead, keep this zero and enter the actual approved amount in each expense.</div><div class="sticky-save"><button class="btn primary full" type="submit">Save rate</button></div></form>`);$('#expenseSettingsForm').addEventListener('submit',e=>{e.preventDefault();state.settings.expenseRatePerKm=num(new FormData(e.currentTarget).get('rate'));saveState();closeSheet();toast('Expense rate saved.');});}
  function quickExpense(id=''){
    const old=state.expenses.find(x=>x.id===id)||{},suggestedKm=id?num(old.km):suggestedTravelKm(),rate=id?num(old.ratePerKm):num(state.settings.expenseRatePerKm),autoAmount=id?num(old.amount):(suggestedKm&&rate?Number((suggestedKm*rate).toFixed(2)):0);
    openSheet(id?'Edit expense':'Add expense','Save the amount you can actually claim; route distance is only a suggestion.',`<form id="expenseForm" class="sheet-form"><label><span>Date</span><input name="date" type="date" value="${esc(dateOnly(old.date)||localISODate())}" required></label><label><span>Expense type</span><select name="category"><option ${old.category==='Travel'?'selected':''}>Travel</option><option ${old.category==='DA / Food'?'selected':''}>DA / Food</option><option ${old.category==='Stay'?'selected':''}>Stay</option><option ${old.category==='Toll / Parking'?'selected':''}>Toll / Parking</option><option ${old.category==='Public Transport'?'selected':''}>Public Transport</option><option ${old.category==='Other'?'selected':''}>Other</option></select></label><div class="field-grid two"><label><span>From</span><input name="fromPlace" value="${esc(old.fromPlace||'')}"></label><label><span>To</span><input name="toPlace" value="${esc(old.toPlace||'')}"></label><label><span>Distance km</span><input id="expenseKm" name="km" type="number" min="0" step="0.1" value="${esc(suggestedKm||'')}"></label><label><span>Rate ₹/km</span><input id="expenseRate" name="ratePerKm" type="number" min="0" step="0.01" value="${esc(rate||'')}"></label></div><label><span>Claim amount ₹</span><input id="expenseAmount" name="amount" type="number" min="0" step="0.01" value="${esc(autoAmount||'')}" required></label><label><span>Note / bill reference</span><textarea name="notes" rows="2">${esc(old.notes||'')}</textarea></label><div class="sticky-save"><button class="btn primary full" type="submit">Save expense</button></div></form>`);
    const form=$('#expenseForm'),calc=()=>{if(form.elements.category.value!=='Travel')return;const km=num($('#expenseKm').value),r=num($('#expenseRate').value);if(km&&r)$('#expenseAmount').value=(km*r).toFixed(2);};$('#expenseKm').addEventListener('input',calc);$('#expenseRate').addEventListener('input',calc);form.elements.category.addEventListener('change',calc);
    form.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(form),rec={...old,id:id||uid('exp'),date:clean(fd.get('date')),category:clean(fd.get('category')),fromPlace:clean(fd.get('fromPlace')),toPlace:clean(fd.get('toPlace')),km:num(fd.get('km')),ratePerKm:num(fd.get('ratePerKm')),amount:num(fd.get('amount')),notes:clean(fd.get('notes')),updatedAt:new Date().toISOString()};if(!rec.amount){toast('Enter expense amount.');return;}if(id)Object.assign(old,rec);else{rec.createdAt=new Date().toISOString();state.expenses.push(rec);}saveState();closeSheet();toast('Expense saved.');});
  }

  function manageSamples(){
    const totalBalance=state.sampleItems.reduce((n,x)=>n+sampleBalance(x),0),today=sampleIssuedForDay(),month=sampleIssuedForMonth();
    openSheet('Samples','Simple stock ledger: receive stock, issue to doctor, always know balance.',`<div class="manager-summary"><div><small>ITEMS</small><strong>${esc(state.sampleItems.length)}</strong></div><div><small>BALANCE</small><strong>${esc(totalBalance)}</strong></div><div><small>ISSUED THIS MONTH</small><strong>${esc(month)}</strong></div></div><div class="button-row"><button class="btn secondary" data-action="receive-samples">+ Receive</button><button class="btn secondary" data-action="issue-samples">Give to doctor</button><button class="btn primary" data-action="add-sample-item">+ Sample item</button></div><div class="detail-section"><h4>Sample stock</h4><div class="card-list compact-list">${state.sampleItems.length?state.sampleItems.slice().sort((a,b)=>a.product.localeCompare(b.product)).map(x=>{const bal=sampleBalance(x),cls=bal<=0?'zero':bal<=5?'low':'good';return `<div class="ledger-row"><div class="copy"><strong>${esc([x.product,x.pack].filter(Boolean).join(' • '))}</strong><small>${esc([x.batch?`Batch ${x.batch}`:'',x.expiry?`Exp ${x.expiry}`:''].filter(Boolean).join(' • ')||'No batch details')}</small></div><div class="value"><strong class="sample-balance ${cls}">${esc(bal)}</strong><button data-action="edit-sample-item" data-id="${esc(x.id)}">Edit</button></div></div>`;}).join(''):empty('No sample items. Add the samples actually issued to you.')}</div></div>${today?`<div class="notice">${esc(today)} sample unit(s) issued today.</div>`:''}`);
  }
  function editSampleItem(id=''){
    const old=sampleItemById(id)||{};openSheet(id?'Edit sample item':'Add sample item','Create one item per product/pack/batch when needed.',`<form id="sampleItemForm" class="sheet-form"><label><span>Product / sample</span><input name="product" list="sampleProductList" value="${esc(old.product||'')}" required><datalist id="sampleProductList">${productCatalog().map(x=>`<option value="${esc(x)}"></option>`).join('')}</datalist></label><div class="field-grid two"><label><span>Pack</span><input name="pack" value="${esc(old.pack||'')}" placeholder="200 GM"></label><label><span>Opening qty</span><input name="openingQty" type="number" min="0" step="1" value="${esc(num(old.openingQty)||0)}"></label><label><span>Batch</span><input name="batch" value="${esc(old.batch||'')}"></label><label><span>Expiry</span><input name="expiry" type="month" value="${esc(old.expiry||'')}"></label></div><label><span>Note</span><textarea name="notes" rows="2">${esc(old.notes||'')}</textarea></label><div class="sticky-save"><button class="btn primary full" type="submit">Save sample item</button></div></form>`);$('#sampleItemForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget),rec={...old,id:id||uid('smp'),product:clean(fd.get('product')),pack:clean(fd.get('pack')),openingQty:num(fd.get('openingQty')),batch:clean(fd.get('batch')),expiry:clean(fd.get('expiry')),notes:clean(fd.get('notes')),updatedAt:new Date().toISOString()};if(!rec.product){toast('Enter sample product.');return;}if(id)Object.assign(old,rec);else{rec.createdAt=new Date().toISOString();state.sampleItems.push(rec);}saveState();closeSheet();toast('Sample item saved.');});
  }
  function receiveSamples(){if(!state.sampleItems.length){editSampleItem();return;}openSheet('Receive samples','Add stock allotted/received from company.',`<form id="receiveSampleForm" class="sheet-form"><label><span>Sample item</span><select name="sampleItemId" required>${sampleItemOptions()}</select></label><div class="field-grid two"><label><span>Date</span><input name="date" type="date" value="${esc(localISODate())}"></label><label><span>Qty received</span><input name="qty" type="number" min="1" step="1" value="1" required></label></div><label><span>Note / challan</span><textarea name="notes" rows="2"></textarea></label><div class="sticky-save"><button class="btn primary full" type="submit">Add received stock</button></div></form>`);$('#receiveSampleForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget),item=sampleItemById(fd.get('sampleItemId')),qty=num(fd.get('qty'));if(!item||qty<=0){toast('Select item and quantity.');return;}state.sampleTransactions.push({id:uid('smt'),type:'receive',date:clean(fd.get('date'))||localISODate(),sampleItemId:item.id,product:item.product,pack:item.pack||'',batch:item.batch||'',qty,notes:clean(fd.get('notes')),createdAt:new Date().toISOString()});saveState();closeSheet();toast('Sample stock received.');});}
  function issueSamples(doctorId='') {if(!state.sampleItems.length){toast('Add sample stock first.');manageSamples();return;}openSheet('Give samples to doctor','Distribution is deducted immediately from your sample balance.',`<form id="issueSampleForm" class="sheet-form"><label><span>Doctor</span><select name="doctorId" required>${doctorOptions(doctorId)}</select></label><div id="standaloneSampleRows">${sampleIssueRow()}</div><button type="button" id="addStandaloneSampleRow" class="btn secondary compact">+ Another sample</button><label><span>Note</span><textarea name="notes" rows="2"></textarea></label><div class="sticky-save"><button class="btn primary full" type="submit">Save distribution</button></div></form>`);const root=$('#standaloneSampleRows');bindSampleIssueRows(root);$('#addStandaloneSampleRow').addEventListener('click',()=>root.insertAdjacentHTML('beforeend',sampleIssueRow({},root.children.length)));$('#issueSampleForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget),doctor=doctorById(fd.get('doctorId')),issues=collectSampleIssues(root),err=validateSampleIssues(issues);if(!doctor){toast('Select doctor.');return;}if(!issues.length){toast('Add at least one sample.');return;}if(err){toast(err);return;}commitSampleIssues(issues,{date:localISODateTime(),doctor,notes:fd.get('notes')});saveState();closeSheet();toast('Sample distribution saved.');});}

  function doctorPlanSearchText(doctor){
    return clean([doctor?.area,doctor?.town,doctor?.hq,doctorHospital(doctor),doctor?.address,doctor?.hospitalAddress].filter(Boolean).join(' '));
  }
  function doctorSlotsForDate(doctor,date){
    const d=new Date(`${date}T12:00:00`);if(Number.isNaN(d.getTime()))return [];
    if(!normalizeMeetingDays(doctor?.meetingDays).includes(d.getDay()))return [];
    return doctorMeetingSlots(doctor).map(slot=>({...slot,start:timeMinutes(slot.from),end:timeMinutes(slot.to)})).filter(slot=>slot.start!==null&&slot.end!==null);
  }
  function areaTimeDoctorMatches({date,area,from,to,includeVisited=false}){
    const start=timeMinutes(from),end=timeMinutes(to),key=norm(area),visited=new Set(rowsForDay(date).map(v=>v.doctorId).filter(Boolean));
    if(start===null||end===null||end<start)return {rows:[],badWindow:true,missingTiming:0,notDue:0};
    let missingTiming=0,notDue=0;
    const rows=[];
    state.doctors.forEach(doctor=>{
      if(key&&!norm(doctorPlanSearchText(doctor)).includes(key))return;
      const eligibility=doctorEligibilityForDate(doctor,date);if(!eligibility.eligible){notDue++;return;}
      const slots=doctorSlotsForDate(doctor,date);
      if(!slots.length){missingTiming++;return;}
      if(visited.has(doctor.id)&&!includeVisited)return;
      const overlap=slots.filter(slot=>slot.start<=end&&slot.end>=start).sort((a,b)=>a.start-b.start)[0];
      if(!overlap)return;
      const due=Boolean(doctor.nextFollowUp&&doctor.nextFollowUp<=date),last=latestDoctorVisit(doctor.id,true),days=last?daysBetween(last.date,date):999;
      rows.push({doctor,slot:overlap,visited:visited.has(doctor.id),due,last,days,chemist:linkedChemist(doctor),map:entityMapUrl(doctor),eligibility});
    });
    rows.sort((a,b)=>a.visited-b.visited||a.slot.start-b.slot.start||Number(b.due)-Number(a.due)||b.days-a.days||doctorDisplayName(a.doctor).localeCompare(doctorDisplayName(b.doctor)));
    return {rows,badWindow:false,missingTiming,notDue};
  }
  function smartMonthlyRoute(rows,startLat,startLng,from,date){
    if(!num(startLat)||!num(startLng))return {route:[],unroutable:rows,missingStart:true};
    const remaining=rows.filter(x=>num(x.doctor.latitude)&&num(x.doctor.longitude)).map(x=>({...x})),route=[];
    const unroutable=rows.filter(x=>!num(x.doctor.latitude)||!num(x.doctor.longitude));
    let pLat=num(startLat),pLng=num(startLng),clock=timeMinutes(from)||0;
    if(date===localISODate())clock=Math.max(clock,now().getHours()*60+now().getMinutes());
    while(remaining.length){
      const ranked=remaining.map(x=>{
        const distance=haversineKm(pLat,pLng,x.doctor.latitude,x.doctor.longitude),travel=Math.max(3,Math.round(distance/24*60)),rawArrival=clock+travel,arrival=Math.max(rawArrival,x.slot.start),wait=Math.max(0,x.slot.start-rawArrival),late=Math.max(0,arrival-x.slot.end),slack=Math.max(0,x.slot.end-arrival),urgency=Math.max(0,60-slack);
        const score=(late?100000+late*1000:0)+distance*8+wait*.15+urgency*3-(x.due?18:0);
        return {...x,distance,travelMinutes:travel,arrivalMinutes:arrival,waitMinutes:wait,lateMinutes:late,timingRisk:late>0,score};
      }).sort((a,b)=>a.score-b.score||a.slot.end-b.slot.end||a.distance-b.distance);
      const chosen=ranked[0];
      if(chosen.timingRisk){unroutable.push(...remaining);break;}
      remaining.splice(remaining.findIndex(x=>x.doctor.id===chosen.doctor.id),1);route.push(chosen);pLat=num(chosen.doctor.latitude);pLng=num(chosen.doctor.longitude);clock=chosen.arrivalMinutes+12;
    }
    return {route,unroutable,missingStart:false};
  }
  function resolveSmartPlanStart(text,currentLat,currentLng){
    const q=norm(text);if(!q)return num(currentLat)&&num(currentLng)?{latitude:num(currentLat),longitude:num(currentLng),label:'Current GPS'}:null;
    const d=state.doctors.find(x=>norm(doctorDisplayName(x))===q||norm(doctorHospital(x))===q)||state.doctors.find(x=>norm(doctorDisplayName(x)).includes(q)||norm(doctorHospital(x)).includes(q));
    if(d&&num(d.latitude)&&num(d.longitude))return {latitude:num(d.latitude),longitude:num(d.longitude),label:doctorDisplayName(d)};
    return null;
  }
  function renderAreaTimeDoctorResults(values){
    const box=$('#areaTimePlanResults');if(!box)return;
    const result=areaTimeDoctorMatches(values);
    if(result.badWindow){box.innerHTML='<div class="notice error">End time must be after start time.</div>';return;}
    if(!result.rows.length){box.innerHTML=`${empty(`No due doctor matches ${values.area} for this date/time window.`)}${result.missingTiming?`<div class="notice">${esc(result.missingTiming)} doctor(s) match the area but have no usable meeting timing.</div>`:''}${result.notDue?`<div class="notice">${esc(result.notDue)} doctor(s) are already complete for their monthly visit frequency/gap.</div>`:''}`;return;}
    const start=resolveSmartPlanStart(values.startSearch,values.startLat,values.startLng),planned=start?smartMonthlyRoute(result.rows,start.latitude,start.longitude,values.from,values.date):null,ordered=planned?.route?.length?planned.route:result.rows;
    const routeMeta=new Map((planned?.route||[]).map(x=>[x.doctor.id,x]));
    const googleUrl=start&&planned?.route?.length?googleRouteUrl(start.latitude,start.longitude,planned.route):'';
    box.innerHTML=`<div class="plan-result-head"><strong>${esc(ordered.length)} due doctor${ordered.length===1?'':'s'} planned</strong><small>${esc(prettyDate(values.date))} • ${esc(timeLabel(values.from))}–${esc(timeLabel(values.to))} • ${esc(values.area)}</small></div>${start?`<div class="notice">Route starts from <b>${esc(start.label)}</b>. Order respects monthly frequency + doctor timing first, then nearest-chain distance.</div>`:'<div class="notice">GPS/start point unavailable, so doctors are shown timing-wise. Fetch GPS or search a saved doctor/hospital to optimize distance.</div>'}<div class="area-time-plan-list">${ordered.map((x,i)=>{const d=x.doctor,m=routeMeta.get(d.id),policy=x.eligibility||doctorEligibilityForDate(d,values.date),labels=[`${timeLabel(x.slot.from)}–${timeLabel(x.slot.to)}`,m?`ETA ${minuteLabel(m.arrivalMinutes)}`:'',m?`${m.distance.toFixed(1)} km next`:'',`${policy.count}/${policy.target} done this month`,policy.gap?`${policy.gap}d gap`:'1× monthly',doctorHospital(d),x.chemist?.name,x.due?'Follow-up due':'',x.map?'GPS ready':'GPS pending'].filter(Boolean);return `<article class="area-time-plan-row"><div class="plan-seq">${i+1}</div><div class="plan-doctor-copy"><strong>${esc(doctorDisplayName(d))}</strong><small>${esc(labels.join(' • '))}</small></div><div class="plan-doctor-actions">${x.map?`<a href="${x.map}" target="_blank" rel="noopener">Map</a>`:''}<button data-action="view-record" data-type="doctor" data-id="${esc(d.id)}">View</button><button class="primary-action" data-action="log-record" data-type="doctor" data-id="${esc(d.id)}">Meet</button></div></article>`;}).join('')}</div>${googleUrl?`<a class="btn primary full" href="${googleUrl}" target="_blank" rel="noopener">Open optimized route in Maps</a>`:''}${planned?.unroutable?.length?`<div class="notice">${esc(planned.unroutable.length)} due doctor(s) could not be fitted into the route because GPS is missing or their meeting window would be missed.</div>`:''}${result.missingTiming?`<div class="notice">${esc(result.missingTiming)} matching doctor(s) have no meeting timing, so they are excluded.</div>`:''}${result.notDue?`<div class="notice">${esc(result.notDue)} doctor(s) skipped because their monthly visit target/gap is already complete.</div>`:''}`;
  }
  function areaTimeDoctorPlan(){
    const tp=latestTourPlan(),areas=[...new Set(state.doctors.flatMap(d=>[clean(d.area),clean(d.town),clean(d.hq)]).filter(Boolean))].sort((a,b)=>a.localeCompare(b)),starts=state.doctors.filter(d=>num(d.latitude)&&num(d.longitude)).slice().sort((a,b)=>doctorDisplayName(a).localeCompare(doctorDisplayName(b))),defaultArea=clean(tp?.area||state.profile.hq||areas[0]||''),current=now(),defaultFrom=`${pad(current.getHours())}:${current.getMinutes()<30?'00':'30'}`;
    const endDate=new Date(current);endDate.setHours(Math.min(23,current.getHours()+4),current.getMinutes()<30?0:30,0,0);const defaultTo=`${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;
    openSheet('Smart Monthly Doctor Plan','Monthly eligibility + doctor timing + nearest route. Current GPS fetch starts automatically.',`<form id="areaTimePlanForm" class="sheet-form"><label><span>Find area / town</span><input name="area" type="search" list="areaTimePlanAreas" value="${esc(defaultArea)}" placeholder="Type Nikol / Naroda / Ahmedabad" required><datalist id="areaTimePlanAreas">${areas.map(a=>`<option value="${esc(a)}"></option>`).join('')}</datalist></label><label><span>Find starting doctor / hospital (optional)</span><input name="startSearch" type="search" list="smartPlanStarts" placeholder="Leave blank = current GPS"><datalist id="smartPlanStarts">${starts.map(d=>`<option value="${esc(doctorDisplayName(d))}">${esc(doctorHospital(d)||d.area||'')}</option>`).join('')}</datalist></label><div class="location-card"><div class="location-head"><div><strong>Current start GPS</strong><small id="smartplanLocationStatus" class="location-status">Fetching automatically…</small></div><button type="button" id="smartplanFetchLocation" class="btn secondary compact">Refresh GPS</button></div><a id="smartplanLocationMap" class="hidden" target="_blank" rel="noopener">View start map</a><input id="smartplanLatitude" type="hidden"><input id="smartplanLongitude" type="hidden"><input id="smartplanAccuracy" type="hidden"><input id="smartplanCapturedAt" type="hidden"></div><div class="field-grid two"><label><span>Date</span><input name="date" type="date" value="${localISODate()}" required></label><label><span>Already called</span><input name="includeVisitedSearch" type="search" list="includeCalledChoices" value="No"><datalist id="includeCalledChoices"><option value="No"></option><option value="Yes"></option></datalist></label><label><span>From</span><input name="from" type="time" value="${defaultFrom}" required></label><label><span>To</span><input name="to" type="time" value="${defaultTo}" required></label></div><button class="btn primary full" type="submit">Build intelligent doctor route</button></form><div id="areaTimePlanResults" class="detail-section"></div>`);
    const form=$('#areaTimePlanForm');
    const run=()=>{const fd=new FormData(form);renderAreaTimeDoctorResults({area:clean(fd.get('area')),date:clean(fd.get('date'))||localISODate(),from:clean(fd.get('from')),to:clean(fd.get('to')),includeVisited:/^yes$/i.test(clean(fd.get('includeVisitedSearch'))),startSearch:clean(fd.get('startSearch')),startLat:num($('#smartplanLatitude').value)||'',startLng:num($('#smartplanLongitude').value)||''});};
    form.addEventListener('submit',e=>{e.preventDefault();run();});
    form.elements.startSearch.addEventListener('change',run);form.elements.area.addEventListener('change',run);form.elements.date.addEventListener('change',run);form.elements.from.addEventListener('change',run);form.elements.to.addEventListener('change',run);
    const onGps=e=>{if(e.detail?.prefix==='smartplan')run();};document.addEventListener('mr-location-ready',onGps,{once:true});setupLocationCapture('smartplan',true);if(defaultArea)run();
  }

  function manageTourPlan(){const today=latestTourPlan(),recent=state.tourPlans.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,20);openSheet('Tour Program','Keep it practical: date, work type, area and joint work. Doctor selection remains in your smart patch/route.',`<div class="manager-summary"><div><small>TODAY</small><strong>${esc(today?.workType||'—')}</strong></div><div><small>AREA</small><strong>${esc(today?.area||'Not set')}</strong></div><div><small>JOINT WORK</small><strong>${esc(today?.jointWorkWith||'IND')}</strong></div></div><div class="button-row"><button class="btn primary" data-action="edit-tour-plan" data-id="${esc(today?.id||'')}">${today?'Edit today':'+ Plan today'}</button></div><div class="detail-section"><h4>Recent plans</h4>${recent.length?recent.map(x=>`<div class="ledger-row"><div class="copy"><strong>${esc(prettyDate(x.date))} • ${esc(x.workType||'HQ')} • ${esc(x.area||'')}</strong><small>${esc([x.jointWorkWith,x.objective,x.notes].filter(Boolean).join(' • '))}</small></div><div class="value"><button data-action="edit-tour-plan" data-id="${esc(x.id)}">Edit</button></div></div>`).join(''):empty('No tour plan yet.')}</div>`);}
  function editTourPlan(id='') {const old=state.tourPlans.find(x=>x.id===id)||latestTourPlan()||{};openSheet(id?'Edit Tour Program':'Plan field day','TP is linked automatically to DCRs saved on the same date.',`<form id="tourPlanForm" class="sheet-form"><div class="field-grid two"><label><span>Date</span><input name="date" type="date" value="${esc(dateOnly(old.date)||localISODate())}" required></label><label><span>Work type</span><select name="workType"><option ${old.workType==='HQ'?'selected':''}>HQ</option><option ${old.workType==='EX'?'selected':''}>EX</option><option ${old.workType==='OS'?'selected':''}>OS</option><option ${old.workType==='Transit'?'selected':''}>Transit</option></select></label></div><label><span>Area / town</span><input name="area" value="${esc(old.area||state.profile.hq||'')}" required></label><label><span>Joint work with</span><input name="jointWorkWith" value="${esc(old.jointWorkWith||state.profile.joinWorkWith||'IND')}"></label><label><span>Objective</span><input name="objective" value="${esc(old.objective||'')}" placeholder="Coverage / launch / follow-up / camp"></label><label><span>Note</span><textarea name="notes" rows="2">${esc(old.notes||'')}</textarea></label><div class="sticky-save"><button class="btn primary full" type="submit">Save Tour Program</button></div></form>`);$('#tourPlanForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget),date=clean(fd.get('date')),existing=id?state.tourPlans.find(x=>x.id===id):state.tourPlans.find(x=>dateOnly(x.date)===date),rec={...(existing||{}),id:existing?.id||uid('tp'),date,workType:clean(fd.get('workType')),area:clean(fd.get('area')),jointWorkWith:clean(fd.get('jointWorkWith')),objective:clean(fd.get('objective')),notes:clean(fd.get('notes')),updatedAt:new Date().toISOString()};if(!rec.area){toast('Enter area/town.');return;}if(existing)Object.assign(existing,rec);else{rec.createdAt=new Date().toISOString();state.tourPlans.push(rec);}saveState();closeSheet();toast('Tour Program saved.');});}

  function quickChemistVisit(chemistId='') {openSheet('Chemist visit','Fast chemist call — availability, follow-up or market update.',`<form id="chemistVisitForm" class="sheet-form"><label><span>Chemist</span><select name="chemistId" required>${chemistOptions(chemistId)}</select></label><label><span>Purpose</span><select name="purpose"><option>Product availability</option><option>POB follow-up</option><option>RCPA / market feedback</option><option>Stock / distributor follow-up</option><option>General visit</option></select></label><label class="toggle-line"><input name="availabilityDone" type="checkbox"> New product availability checked / created</label><label><span>Follow-up date</span><input name="followUpDate" type="date"></label><label><span>Note</span><textarea name="notes" rows="3" placeholder="Only useful market or commitment note"></textarea></label><div class="sticky-save"><button class="btn primary full" type="submit">Save chemist visit</button></div></form>`);$('#chemistVisitForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget),c=chemistById(fd.get('chemistId'));if(!c){toast('Select chemist.');return;}const date=localISODateTime(),purpose=clean(fd.get('purpose')),follow=clean(fd.get('followUpDate'));state.visits.push({id:uid('log'),date,entityType:'chemist',entityId:c.id,entityName:c.name,chemistId:c.id,chemistName:c.name,productStatuses:{},notes:clean(fd.get('notes')),followUpDate:follow,calls:0,outcome:'chemist_visit',outcomeLabel:purpose,newAvailability:fd.get('availabilityDone')==='on'?1:0,pobValue:0,createdAt:new Date().toISOString(),tourPlanId:latestTourPlan(dateOnly(date))?.id||''});c.lastVisit=dateOnly(date);if(follow)c.nextFollowUp=follow;c.updatedAt=new Date().toISOString();saveState();closeSheet();toast('Chemist visit saved.');});}

  function manageRcpa(){const monthRows=state.rcpa.filter(x=>monthKey(x.date)===monthKey()).sort((a,b)=>String(b.date).localeCompare(String(a.date)));openSheet('RCPA / Competition','Retail chemist prescription audit and competitor activity.',`<div class="manager-summary"><div><small>THIS MONTH</small><strong>${esc(monthRows.length)}</strong></div><div><small>CHEMISTS</small><strong>${esc(new Set(monthRows.map(x=>x.chemistId).filter(Boolean)).size)}</strong></div><div><small>COMPETITOR BRANDS</small><strong>${esc(new Set(monthRows.map(x=>norm(x.competitorBrand)).filter(Boolean)).size)}</strong></div></div><div class="button-row"><button class="btn primary" data-action="quick-rcpa">+ RCPA</button></div><div class="detail-section"><h4>Recent RCPA</h4>${monthRows.length?monthRows.slice(0,30).map(x=>`<div class="ledger-row"><div class="copy"><strong>${esc(x.chemistName||'Chemist')} • ${esc(x.ourBrand||'Our brand')}</strong><small>${esc([x.doctorName,x.competitorBrand&&`Vs ${x.competitorBrand}`,x.competitorCompany,x.rxQty?`Rx ${x.rxQty}`:'',x.notes].filter(Boolean).join(' • '))}</small></div><div class="value"><button data-action="edit-rcpa" data-id="${esc(x.id)}">Edit</button></div></div>`).join(''):empty('No RCPA this month.')}</div>`);}
  function quickRcpa(chemistId='',id='') {const old=state.rcpa.find(x=>x.id===id)||{};openSheet(id?'Edit RCPA':'RCPA / competition','Record only actionable prescription and competition information.',`<form id="rcpaForm" class="sheet-form"><label><span>Chemist</span><select name="chemistId" required>${chemistOptions(old.chemistId||chemistId)}</select></label><label><span>Related doctor (optional)</span><select name="doctorId">${doctorOptions(old.doctorId||'')}</select></label><div class="rcpa-grid"><label><span>Our brand</span><select name="ourBrand">${productOptions(old.ourBrand||'')}</select></label><label><span>Our availability</span><select name="ourAvailability"><option value="">Not checked</option><option ${old.ourAvailability==='Available'?'selected':''}>Available</option><option ${old.ourAvailability==='Low stock'?'selected':''}>Low stock</option><option ${old.ourAvailability==='Not available'?'selected':''}>Not available</option></select></label><label><span>Competitor brand</span><input name="competitorBrand" value="${esc(old.competitorBrand||'')}"></label><label><span>Competitor company</span><input name="competitorCompany" value="${esc(old.competitorCompany||'')}"></label><label><span>Rx / units observed</span><input name="rxQty" type="number" min="0" step="1" value="${esc(num(old.rxQty)||'')}"></label><label><span>Date</span><input name="date" type="date" value="${esc(dateOnly(old.date)||localISODate())}"></label></div><label><span>Market note</span><textarea name="notes" rows="2">${esc(old.notes||'')}</textarea></label><label class="toggle-line"><input name="logVisit" type="checkbox" ${id?'':'checked'}> Also log this as a chemist visit</label><div class="sticky-save"><button class="btn primary full" type="submit">Save RCPA</button></div></form>`);$('#rcpaForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget),c=chemistById(fd.get('chemistId')),d=doctorById(fd.get('doctorId')),rec={...old,id:id||uid('rcpa'),date:clean(fd.get('date'))||localISODate(),chemistId:c?.id||'',chemistName:c?.name||'',doctorId:d?.id||'',doctorName:d?.name||'',ourBrand:clean(fd.get('ourBrand')),ourAvailability:clean(fd.get('ourAvailability')),competitorBrand:clean(fd.get('competitorBrand')),competitorCompany:clean(fd.get('competitorCompany')),rxQty:num(fd.get('rxQty')),notes:clean(fd.get('notes')),updatedAt:new Date().toISOString()};if(!c){toast('Select chemist.');return;}if(id)Object.assign(old,rec);else{rec.createdAt=new Date().toISOString();state.rcpa.push(rec);}if(fd.get('logVisit')==='on'&&!id){state.visits.push({id:uid('log'),date:`${rec.date}T${pad(now().getHours())}:${pad(now().getMinutes())}`,entityType:'chemist',entityId:c.id,entityName:c.name,chemistId:c.id,chemistName:c.name,productStatuses:{},notes:rec.notes,followUpDate:'',calls:0,outcome:'rcpa',outcomeLabel:'RCPA / market feedback',newAvailability:rec.ourAvailability?1:0,pobValue:0,createdAt:new Date().toISOString(),tourPlanId:latestTourPlan(rec.date)?.id||''});c.lastVisit=rec.date;}saveState();closeSheet();toast('RCPA saved.');});}

  function manageSales(){const month=monthKey(),x=salesForMonth(month),pct=x?.target?Math.min(999,Math.round(num(x.secondary)/num(x.target)*100)):0;openSheet('Target & Sales','Simple monthly self-tracking. Enter only official figures available to you.',`<div class="manager-summary"><div><small>TARGET</small><strong>${x?`₹${esc(num(x.target).toLocaleString('en-IN'))}`:'—'}</strong></div><div><small>PRIMARY</small><strong>${x?`₹${esc(num(x.primary).toLocaleString('en-IN'))}`:'—'}</strong></div><div><small>SECONDARY</small><strong>${x?`₹${esc(num(x.secondary).toLocaleString('en-IN'))}`:'—'}</strong></div></div>${x?.target?`<div class="sales-progress"><span style="width:${Math.min(100,pct)}%"></span></div><p class="muted-line">Secondary achievement: ${esc(pct)}%</p>`:''}<div class="button-row"><button class="btn primary" data-action="edit-sales">${x?'Update this month':'+ Add this month'}</button></div><div class="notice">This summary is separate from product-wise official sales. The app will not invent or spread one total across products.</div>`);}
  function editSales(){const month=monthKey(),old=salesForMonth(month)||{};openSheet('Monthly target & sales',now().toLocaleDateString('en-IN',{month:'long',year:'numeric'}),`<form id="salesForm" class="sheet-form"><div class="field-grid two"><label><span>Target ₹</span><input name="target" type="number" min="0" step="0.01" value="${esc(num(old.target)||'')}"></label><label><span>Primary sales ₹</span><input name="primary" type="number" min="0" step="0.01" value="${esc(num(old.primary)||'')}"></label><label><span>Secondary sales ₹</span><input name="secondary" type="number" min="0" step="0.01" value="${esc(num(old.secondary)||'')}"></label><label><span>Collection ₹</span><input name="collection" type="number" min="0" step="0.01" value="${esc(num(old.collection)||'')}"></label></div><label><span>Note</span><textarea name="notes" rows="2">${esc(old.notes||'')}</textarea></label><div class="sticky-save"><button class="btn primary full" type="submit">Save sales summary</button></div></form>`);$('#salesForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget),rec={...old,id:old.id||uid('sale'),month,target:num(fd.get('target')),primary:num(fd.get('primary')),secondary:num(fd.get('secondary')),collection:num(fd.get('collection')),notes:clean(fd.get('notes')),updatedAt:new Date().toISOString()};if(old.id)Object.assign(old,rec);else{rec.createdAt=new Date().toISOString();state.salesMonths.push(rec);}saveState();closeSheet();toast('Monthly sales summary saved.');});}

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
          <div class="lookup-label field-block"><span class="field-caption">Doctor under pharmacy / chemist</span>
            <div class="lookup-field chemist-lookup-field">
              <input id="meetingChemistSearch" type="search" autocomplete="off" placeholder="Type chemist name, area or address…" value="${esc(chemist?.name||'')}">
              <input id="meetingChemistId" name="chemistId" type="hidden" value="${esc(chemist?.id||'')}">
              <div id="meetingChemistResults" class="search-results lookup-results hidden"></div>
            </div>
          </div>
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
        <details class="more-fields sample-panel"><summary>Samples given (optional)</summary><div class="order-panel-body"><div id="meetingSampleRows">${state.sampleItems.length?sampleIssueRow():empty('No sample stock added yet. Use Tools → Samples.')}</div>${state.sampleItems.length?'<button type="button" id="addMeetingSampleRow" class="btn secondary compact">+ Another sample</button>':''}<small class="muted-line">Sample balance is checked before saving and distribution is linked to this doctor visit.</small></div></details>
        <details class="more-fields order-panel"><summary>POB / Distributor order (optional)</summary><div class="order-panel-body"><label class="toggle-line"><input id="meetingOrderPlaced" name="orderPlaced" type="checkbox"> Order placed to distributor</label><label><span>Distributor</span><select name="distributorId">${distributorOptions(preferredDistributor(chemist)?.id||'')}</select></label><div id="meetingOrderItems" class="order-items">${orderItemRow({},0)}</div><button type="button" id="addMeetingOrderItem" class="btn secondary compact">+ Add product</button><div class="order-total-line"><span>Order / POB total</span><strong data-order-total>₹0</strong></div><label><span>Order note</span><textarea name="orderNote" rows="2" placeholder="Delivery, urgency or commitment"></textarea></label></div></details>
        <details class="more-fields"><summary>More daily report items (optional)</summary><div class="inline-metrics">${METRICS.filter(([k])=>k!=='calls'&&k!=='pobValue').map(([k,label])=>`<label><span>${esc(label)}</span><input name="${k}" type="number" min="0" step="1" value="0"></label>`).join('')}<label><span>Other POB Value</span><input name="pobValue" type="number" min="0" step="0.01" value="0"></label></div></details>
        <input name="date" type="hidden" value="${esc(localISODateTime())}">
        <div class="sticky-save"><button type="submit" class="btn primary full">Save meeting + 1 call</button></div>
      </form>`);
    const form=$('#meetingForm'), doctorInput=$('#meetingDoctorSearch'), doctorIdInput=$('#meetingDoctorId'), doctorResults=$('#meetingDoctorResults'), chemistSelect=form.elements.chemistId, chemistInput=$('#meetingChemistSearch'), chemistResults=$('#meetingChemistResults'), orderDistributorSelect=form.elements.distributorId, hospitalInput=form.elements.hospital, timingPending=$('#meetingTimingPending');
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
    const chemistScore=(c,q)=>{
      if(!q)return c.lastVisit?18:0;
      const name=clean(c.name).toLowerCase(),area=clean(c.area||c.hq).toLowerCase(),address=clean(c.address).toLowerCase();
      let score=0;if(name===q)score+=100;if(name.startsWith(q))score+=70;else if(name.includes(q))score+=46;if(area.startsWith(q))score+=34;else if(area.includes(q))score+=20;if(address.includes(q))score+=14;return score;
    };
    const matchingChemists=q=>{q=clean(q).toLowerCase();return state.chemists.map(c=>({c,score:chemistScore(c,q)})).filter(x=>!q||x.score>0).sort((a,b)=>b.score-a.score||String(b.c.lastVisit||'').localeCompare(String(a.c.lastVisit||''))||a.c.name.localeCompare(b.c.name)).slice(0,30).map(x=>x.c);};
    const showChemistResults=()=>{const items=matchingChemists(chemistInput.value);chemistResults.innerHTML=items.length?items.map(c=>`<button type="button" class="search-result chemist-search-result" data-meeting-chemist-id="${esc(c.id)}"><strong>${esc(c.name)}</strong><small>${esc([c.area||c.hq,c.address,`${linkedDoctorCount(c.id)} linked doctor(s)`].filter(Boolean).join(' • '))}</small></button>`).join(''):`<div class="lookup-empty">No chemist found. Add it from Chemists → Add.</div>`;chemistResults.classList.remove('hidden');};
    const chooseChemist=id=>{const c=chemistById(id);if(!c)return;chemistSelect.value=c.id;chemistInput.value=c.name;chemistResults.classList.add('hidden');reloadProducts();};
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
      const lc=linkedChemist(d);if(lc){chemistSelect.value=lc.id;chemistInput.value=lc.name;}else if(requestedChemist){chemistSelect.value=requestedChemist.id;chemistInput.value=requestedChemist.name;}else{chemistSelect.value='';chemistInput.value='';}
      fillMasterFields(d);reloadProducts();refreshOutcomeIntelligence();
    };
    const applyMeetingCapturedText=text=>{
      const parsed=parseVoiceDetails(text);let d=doctorById(parsed.doctorId);
      if(!d&&parsed.doctorName)d=state.doctors.find(x=>norm(x.name)===norm(parsed.doctorName));
      if(!d&&parsed.hospital)d=state.doctors.find(x=>norm(doctorHospital(x))===norm(parsed.hospital));
      if(d)chooseDoctor(d.id);
      const c=chemistById(parsed.chemistId)||state.chemists.find(x=>parsed.chemistName&&norm(x.name)===norm(parsed.chemistName));if(c)chooseChemist(c.id);
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
      refreshSummary();
    };
    bindVoiceControls('meeting',applyMeetingCapturedText);
    doctorInput.addEventListener('focus',showDoctorResults);
    doctorInput.addEventListener('input',()=>{doctorIdInput.value='';showDoctorResults();$('#meetingSummary').innerHTML=meetingSummaryHtml(null,chemistById(chemistSelect.value));});
    doctorResults.addEventListener('click',e=>{const b=e.target.closest('[data-meeting-doctor-id]');if(b)chooseDoctor(b.dataset.meetingDoctorId);});
    chemistInput.addEventListener('focus',showChemistResults);
    chemistInput.addEventListener('input',()=>{chemistSelect.value='';showChemistResults();refreshSummary();});
    chemistResults.addEventListener('click',e=>{const b=e.target.closest('[data-meeting-chemist-id]');if(b)chooseChemist(b.dataset.meetingChemistId);});
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
    const meetingSampleRoot=$('#meetingSampleRows');bindSampleIssueRows(meetingSampleRoot);
    $('#addMeetingSampleRow')?.addEventListener('click',()=>meetingSampleRoot.insertAdjacentHTML('beforeend',sampleIssueRow({},meetingSampleRoot.children.length)));
    bindOrderItems($('#meetingOrderItems'));
    $('#addMeetingOrderItem').addEventListener('click',()=>{const wrap=$('#meetingOrderItems');wrap.insertAdjacentHTML('beforeend',orderItemRow({},wrap.children.length));updateOrderTotal(wrap);});
    setupLocationCapture('meet',false);
    const refreshLocationAudit=()=>{const d=doctorById(doctorIdInput.value),lat=num($('#meetLatitude').value),lng=num($('#meetLongitude').value),out=$('#meetLocationAudit');if(!out)return;if(!lat||!lng){out.textContent='Waiting for visit GPS…';out.className='muted-line';return;}if(!d?.latitude||!d?.longitude){out.textContent='Hospital master GPS is not saved yet. Keep Update hospital master location enabled.';out.className='muted-line audit-pending';return;}const meters=Math.round(haversineKm(lat,lng,d.latitude,d.longitude)*1000),accuracy=num($('#meetAccuracy').value);out.textContent=`Current visit is ${meters.toLocaleString('en-IN')} m from saved hospital GPS${accuracy?` • GPS ±${accuracy} m`:''}.`;out.className=`muted-line ${meters<=250&&accuracy<=100?'audit-good':meters<=750?'audit-review':'audit-bad'}`;};
    document.addEventListener('mr-location-ready',e=>{if(e.detail.prefix==='meet'){$('#meetSaveLocation').checked=true;refreshLocationAudit();}},{once:true});
    const capturedSanText=pendingSanClipboardText;
    if(capturedSanText){pendingSanClipboardText='';setTimeout(()=>applyMeetingCapturedText(capturedSanText),120);}
    if(!doctor&&!capturedSanText)setTimeout(()=>{doctorInput.focus();showDoctorResults();},120);
    form.addEventListener('submit',e=>{
      e.preventDefault();
      const fd=new FormData(form), d=doctorById(doctorIdInput.value), c=chemistById(fd.get('chemistId'));
      if(!d){toast('Search and choose a doctor or hospital.');doctorInput.focus();showDoctorResults();return;}
      const hospital=clean(fd.get('hospital')),days=fd.getAll('meetingDays').map(Number),from=normalizeTime(fd.get('meetingFrom')),to=normalizeTime(fd.get('meetingTo')),from2=normalizeTime(fd.get('meetingFrom2')),to2=normalizeTime(fd.get('meetingTo2')),isTimingPending=fd.get('timingPending')==='on';
      if(!hospital){toast('Enter hospital or clinic name.');hospitalInput.focus();return;}
      if(!c){toast('Type and select the pharmacy / chemist under this doctor.');chemistInput.focus();showChemistResults();return;}
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
      const saveGps=$('#meetSaveLocation').checked, updateMasterLocation=$('#meetUpdateDoctorLocation').checked,currentLat=num($('#meetLatitude').value)||'',currentLng=num($('#meetLongitude').value)||'',orderPlaced=$('#meetingOrderPlaced').checked, orderItems=collectOrderItems($('#meetingOrderItems')), distributor=distributorById(fd.get('distributorId')), orderValue=orderItems.reduce((n,x)=>n+x.value,0), sampleIssues=meetingSampleRoot?collectSampleIssues(meetingSampleRoot):[], sampleError=validateSampleIssues(sampleIssues);
      if(saveGps&&(!currentLat||!currentLng)){toast('Wait for GPS or tap Fetch GPS before saving.');return;}
      const oldHospitalLat=num(d.latitude)||'',oldHospitalLng=num(d.longitude)||'',distanceFromSaved=saveGps&&oldHospitalLat&&oldHospitalLng?Math.round(haversineKm(currentLat,currentLng,oldHospitalLat,oldHospitalLng)*1000):'';
      if(updateMasterLocation&&distanceFromSaved&&distanceFromSaved>500&&!confirm(`Current GPS is ${distanceFromSaved.toLocaleString('en-IN')} m from the saved hospital location. Replace the hospital master location?`))return;
      if(orderPlaced&&!distributor){toast('Select distributor for the order.');return;}
      if(orderPlaced&&!orderItems.length){toast('Add at least one ordered product.');return;}
      if(sampleError){toast(sampleError);return;}
      const meetingDoctor={...d,hospital,meetingDays:days,meetingFrom:from,meetingTo:to,meetingFrom2:from2,meetingTo2:to2},nextSuggested=NOT_MET_OUTCOMES.has(outcome)?nextMeetingOccurrence(meetingDoctor,now(),true):null,replacement=NOT_MET_OUTCOMES.has(outcome)?replacementDoctor(d.id):null,autoFollowUp=clean(fd.get('followUpDate'))||(nextSuggested?.date||'');
      const row={
        id:uid('log'),date:fd.get('date')||localISODateTime(),entityType:'doctor',entityId:d.id,entityName:d.name,
        doctorId:d.id,doctorName:d.name,doctorHospital:hospital,chemistId:c?.id||'',chemistName:c?.name||'',productStatuses,
        notes:clean(fd.get('notes')),followUpDate:autoFollowUp,calls:1,outcome,outcomeLabel:OUTCOME_LABELS[outcome]||outcome,notMetReason,rescheduledFor:nextSuggested?.dateTime||'',replacementDoctorId:replacement?.doctor.id||'',replacementDoctorName:replacement?doctorDisplayName(replacement.doctor):'',intelligenceAction:NOT_MET_OUTCOMES.has(outcome)?[nextSuggested?`Rescheduled ${nextSuggested.label}`:'Timing pending',replacement?`Replacement ${doctorDisplayName(replacement.doctor)}`:'No replacement'].join(' • '):productOpportunity(d).label,
        inputs:num(fd.get('inputs')),basket:num(fd.get('basket')),towel:num(fd.get('towel')),conversation:num(fd.get('conversation')),newAvailability:num(fd.get('newAvailability')),pobValue:orderPlaced?(orderValue||num(fd.get('pobValue'))):num(fd.get('pobValue')),
        latitude:saveGps?currentLat:'',longitude:saveGps?currentLng:'',locationAccuracy:saveGps?num($('#meetAccuracy').value)||'':'',locationCapturedAt:saveGps?$('#meetCapturedAt').value:'',
        hospitalLatitude:oldHospitalLat||'',hospitalLongitude:oldHospitalLng||'',distanceFromHospitalM:distanceFromSaved,locationAuditStatus:!saveGps?'Missing visit GPS':!oldHospitalLat?'Hospital GPS pending':distanceFromSaved<=250?'Verified at hospital':distanceFromSaved<=750?'Review location':'Location mismatch',sampleIssues:sampleIssues.map(x=>({sampleItemId:x.sampleItemId,product:sampleItemById(x.sampleItemId)?.product||'',qty:x.qty})),tourPlanId:latestTourPlan(dateOnly(fd.get('date')||localISODate()))?.id||'',createdAt:new Date().toISOString()
      };
      state.visits.push(row);
      if(sampleIssues.length)commitSampleIssues(sampleIssues,{date:row.date,doctor:d,chemist:c,visitId:row.id,notes:'Doctor visit distribution'});
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

  function quickDoctorSearchMatches(q){
    const key=clean(q).toLowerCase();
    return state.doctors.filter(d=>!key||[d.name,doctorHospital(d),d.area,d.hq,d.address,d.mobile].join(' ').toLowerCase().includes(key)).sort((a,b)=>doctorDisplayName(a).localeCompare(doctorDisplayName(b))).slice(0,35);
  }
  function quickChemistSearchMatches(q){
    const key=clean(q).toLowerCase();
    return state.chemists.filter(c=>!key||[c.name,c.area,c.hq,c.address].join(' ').toLowerCase().includes(key)).sort((a,b)=>a.name.localeCompare(b.name)).slice(0,35);
  }
  function quickCompleteDoctor(){
    const hospitals=[...new Set(state.doctors.map(doctorHospital).filter(Boolean))].sort((a,b)=>a.localeCompare(b)),areas=[...new Set(state.doctors.flatMap(d=>[clean(d.area),clean(d.town),clean(d.hq)]).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    openSheet('Quick Doctor Details','Search existing doctor, fill only what you know. GPS starts automatically and nearby saved hospitals are suggested.',`<form id="quickDoctorForm" class="sheet-form"><div class="lookup-label field-block"><span class="field-caption">Find doctor</span><div class="lookup-field"><input id="quickDoctorSearch" type="search" autocomplete="off" placeholder="Type doctor / hospital / area…"><input id="quickDoctorId" name="doctorId" type="hidden"><div id="quickDoctorResults" class="search-results lookup-results hidden"></div></div></div><div id="quickDoctorSelected" class="notice">Select a doctor to complete details.</div><label><span>Find hospital / clinic</span><input id="quickHospital" name="hospital" type="search" list="quickHospitalList" placeholder="Type hospital"><datalist id="quickHospitalList">${hospitals.map(x=>`<option value="${esc(x)}"></option>`).join('')}</datalist></label><label><span>Find area / place</span><input id="quickArea" name="area" type="search" list="quickAreaList" placeholder="Type area"><datalist id="quickAreaList">${areas.map(x=>`<option value="${esc(x)}"></option>`).join('')}</datalist></label><label><span>Address</span><textarea id="quickAddress" name="address" rows="2" placeholder="Clinic address if known"></textarea></label><div class="lookup-label field-block"><span class="field-caption">Find chemist under doctor</span><div class="lookup-field"><input id="quickChemistSearch" type="search" autocomplete="off" placeholder="Type chemist / area…"><input id="quickChemistId" name="linkedChemistId" type="hidden"><div id="quickChemistResults" class="search-results lookup-results hidden"></div></div></div><div class="schedule-card"><div class="form-section-title"><h3>Monthly visit rule</h3><p>Planner uses this before suggesting the doctor.</p></div><label><span>Find / choose frequency</span><input id="quickFrequency" name="monthlyVisitTargetText" type="search" list="quickFrequencyList" value="2× / month"><datalist id="quickFrequencyList"><option value="1× / month"></option><option value="2× / month"></option><option value="3× / month"></option><option value="4× / month"></option></datalist></label><label><span>Minimum gap days (0 = automatic)</span><input id="quickGap" name="minVisitGapDays" type="number" min="0" max="31" step="1" value="0"></label></div><div class="schedule-card"><div class="form-section-title"><h3>Meeting timing</h3><p>Search preset or set exact days/time.</p></div><label><span>Find timing preset</span><input id="quickTimingPreset" type="search" list="quickTimingPresets" placeholder="Morning / Lunch / Evening"><datalist id="quickTimingPresets"><option value="Morning 10–12"></option><option value="Lunch 12–2"></option><option value="Afternoon 2–5"></option><option value="Evening 5–8"></option><option value="Morning + Evening"></option></datalist></label><div class="schedule-quick"><button type="button" id="quickMonSat">Mon–Sat</button><button type="button" id="quickEveryDay">Every day</button><button type="button" id="quickClearDays">Clear days</button></div><div class="day-selector" id="quickDaySelector">${DAY_NAMES.map((day,i)=>`<label class="day-option"><input type="checkbox" name="meetingDays" value="${i}"><span>${day}</span></label>`).join('')}</div><div class="field-grid two timing-grid"><label><span>From</span><input name="meetingFrom" type="time"></label><label><span>To</span><input name="meetingTo" type="time"></label><label><span>Second from</span><input name="meetingFrom2" type="time"></label><label><span>Second to</span><input name="meetingTo2" type="time"></label></div></div><div class="location-card"><div class="location-head"><div><strong>Automatic nearby GPS</strong><small id="quickdocLocationStatus" class="location-status">Fetching automatically…</small></div><button type="button" id="quickdocFetchLocation" class="btn secondary compact">Refresh GPS</button></div><a id="quickdocLocationMap" class="hidden" target="_blank" rel="noopener">View current map</a><input id="quickdocLatitude" type="hidden"><input id="quickdocLongitude" type="hidden"><input id="quickdocAccuracy" type="hidden"><input id="quickdocCapturedAt" type="hidden"><label class="toggle-line"><input id="quickUseGps" type="checkbox" checked> Save current GPS as this doctor/hospital location</label></div><div class="detail-section"><h4>Nearby saved hospitals / doctors</h4><div id="quickNearbyResults">Waiting for GPS…</div></div><div class="sticky-save"><button class="btn primary full" type="submit">Save doctor details</button></div></form>`);
    const form=$('#quickDoctorForm'),doctorSearch=$('#quickDoctorSearch'),doctorId=$('#quickDoctorId'),doctorResults=$('#quickDoctorResults'),chemistSearch=$('#quickChemistSearch'),chemistId=$('#quickChemistId'),chemistResults=$('#quickChemistResults');
    const selectedDays=()=>form.elements.meetingDays?[...form.elements.meetingDays].filter(x=>x.checked).map(x=>Number(x.value)):[];
    const setDays=days=>$$('input[name="meetingDays"]',form).forEach(x=>x.checked=days.includes(Number(x.value)));
    const setTimes=(a,b,c='',d='')=>{form.elements.meetingFrom.value=a;form.elements.meetingTo.value=b;form.elements.meetingFrom2.value=c;form.elements.meetingTo2.value=d;};
    const frequencyText=n=>`${Math.max(1,Math.min(4,Math.round(num(n)||2)))}× / month`;
    const parseFrequency=v=>{const m=clean(v).match(/[1-4]/);return m?Number(m[0]):2;};
    const showDoctors=()=>{const items=quickDoctorSearchMatches(doctorSearch.value);doctorResults.innerHTML=items.length?items.map(d=>`<button type="button" class="search-result" data-quick-doctor-id="${esc(d.id)}"><strong>${esc(doctorDisplayName(d))}</strong><small>${esc([d.area||d.hq,doctorMeetingTiming(d)||'Timing pending',doctorVisitPolicy(d).label].filter(Boolean).join(' • '))}</small></button>`).join(''):`<div class="lookup-empty">No doctor found.</div>`;doctorResults.classList.remove('hidden');};
    const showChemists=()=>{const items=quickChemistSearchMatches(chemistSearch.value);chemistResults.innerHTML=items.length?items.map(c=>`<button type="button" class="search-result" data-quick-chemist-id="${esc(c.id)}"><strong>${esc(c.name)}</strong><small>${esc([c.area||c.hq,c.address].filter(Boolean).join(' • ')||'No address')}</small></button>`).join(''):`<div class="lookup-empty">No chemist found.</div>`;chemistResults.classList.remove('hidden');};
    const loadDoctor=d=>{if(!d)return;doctorId.value=d.id;doctorSearch.value=doctorDisplayName(d);doctorResults.classList.add('hidden');$('#quickDoctorSelected').innerHTML=`<b>${esc(doctorDisplayName(d))}</b> • ${esc(doctorEligibilityForDate(d).reason)}`;$('#quickHospital').value=doctorHospital(d);$('#quickArea').value=d.area||d.hq||'';$('#quickAddress').value=d.address||d.hospitalAddress||'';const c=linkedChemist(d);chemistId.value=c?.id||'';chemistSearch.value=c?.name||'';$('#quickFrequency').value=frequencyText(d.monthlyVisitTarget);$('#quickGap').value=num(d.minVisitGapDays)||0;setDays(normalizeMeetingDays(d.meetingDays));setTimes(normalizeTime(d.meetingFrom),normalizeTime(d.meetingTo),normalizeTime(d.meetingFrom2),normalizeTime(d.meetingTo2));};
    const renderNearby=(lat,lng)=>{const out=$('#quickNearbyResults'),groups=savedHospitalGroups(lat,lng,2000).slice(0,12);out.innerHTML=groups.length?groups.map(g=>{const d=(g.doctorIds||[]).map(doctorById).filter(Boolean)[0];return `<button type="button" class="nearby-place-card plain-button" data-quick-nearby-doctor="${esc(d?.id||'')}"><div class="nearby-place-distance">${esc(g.distanceKm.toFixed(2))}<small>km</small></div><div class="nearby-place-copy"><h3>${esc(g.name)}</h3><p>${esc(g.address||'')}</p><small>${esc((g.doctorIds||[]).length)} saved doctor(s)</small></div></button>`;}).join(''):empty('No saved hospital within 2 km. Current GPS can still be saved to the selected doctor.');};
    doctorSearch.addEventListener('focus',showDoctors);doctorSearch.addEventListener('input',()=>{doctorId.value='';showDoctors();});doctorResults.addEventListener('click',e=>{const b=e.target.closest('[data-quick-doctor-id]');if(b)loadDoctor(doctorById(b.dataset.quickDoctorId));});
    chemistSearch.addEventListener('focus',showChemists);chemistSearch.addEventListener('input',()=>{chemistId.value='';showChemists();});chemistResults.addEventListener('click',e=>{const b=e.target.closest('[data-quick-chemist-id]');if(!b)return;const c=chemistById(b.dataset.quickChemistId);if(c){chemistId.value=c.id;chemistSearch.value=c.name;chemistResults.classList.add('hidden');}});
    $('#quickMonSat').addEventListener('click',()=>setDays([1,2,3,4,5,6]));$('#quickEveryDay').addEventListener('click',()=>setDays([0,1,2,3,4,5,6]));$('#quickClearDays').addEventListener('click',()=>setDays([]));
    $('#quickTimingPreset').addEventListener('change',e=>{const q=clean(e.target.value).toLowerCase();if(q.includes('morning +'))setTimes('10:00','12:00','17:00','20:00');else if(q.includes('morning'))setTimes('10:00','12:00');else if(q.includes('lunch'))setTimes('12:00','14:00');else if(q.includes('afternoon'))setTimes('14:00','17:00');else if(q.includes('evening'))setTimes('17:00','20:00');});
    $('#quickNearbyResults').addEventListener('click',e=>{const p=e.target.closest('[data-quick-nearby-place]');if(p){const place=nearbyPlaceCache.get(p.dataset.quickNearbyPlace);if(!place)return;$('#quickHospital').value=place.name||'';$('#quickAddress').value=place.address||'';$('#quickdocLatitude').value=place.latitude||'';$('#quickdocLongitude').value=place.longitude||'';$('#quickdocCapturedAt').value=new Date().toISOString();$('#quickdocLocationStatus').textContent=`Nearby hospital selected • ${place.name}`;return;}const b=e.target.closest('[data-quick-nearby-doctor]');if(!b)return;const d=doctorById(b.dataset.quickNearbyDoctor);if(!d)return;$('#quickHospital').value=doctorHospital(d);$('#quickArea').value=d.area||d.hq||'';$('#quickAddress').value=d.address||d.hospitalAddress||'';$('#quickdocLatitude').value=d.latitude||'';$('#quickdocLongitude').value=d.longitude||'';$('#quickdocAccuracy').value=d.locationAccuracy||'';$('#quickdocCapturedAt').value=d.locationCapturedAt||'';$('#quickdocLocationStatus').textContent=`Nearby saved hospital selected • ${doctorHospital(d)}`;});
    const gpsListener=e=>{if(e.detail?.prefix!=='quickdoc')return;renderNearby(e.detail.latitude,e.detail.longitude);if(window.AndroidBridge?.searchNearbyHospitals)window.AndroidBridge.searchNearbyHospitals('quickdoc',e.detail.latitude,e.detail.longitude,2000);};document.addEventListener('mr-location-ready',gpsListener,{once:true});setupLocationCapture('quickdoc',true);
    form.addEventListener('submit',e=>{e.preventDefault();const d=doctorById(doctorId.value);if(!d){toast('Search and select a doctor first.');showDoctors();return;}const fd=new FormData(form),days=selectedDays(),from=normalizeTime(fd.get('meetingFrom')),to=normalizeTime(fd.get('meetingTo')),from2=normalizeTime(fd.get('meetingFrom2')),to2=normalizeTime(fd.get('meetingTo2'));if((from&&!to)||(!from&&to)||(from2&&!to2)||(!from2&&to2)){toast('Complete both From and To for each timing.');return;}if((from&&timeMinutes(to)<=timeMinutes(from))||(from2&&timeMinutes(to2)<=timeMinutes(from2))){toast('Meeting To must be later than From.');return;}if((from||from2)&&!days.length){toast('Select meeting day(s).');return;}d.hospital=clean(fd.get('hospital'));d.area=clean(fd.get('area'))||d.area||d.hq;d.address=clean(fd.get('address'));d.monthlyVisitTarget=parseFrequency(fd.get('monthlyVisitTargetText'));d.minVisitGapDays=Math.max(0,Math.round(num(fd.get('minVisitGapDays'))));d.meetingDays=days;d.meetingFrom=from;d.meetingTo=to;d.meetingFrom2=from2;d.meetingTo2=to2;d.linkedChemistId=clean(fd.get('linkedChemistId'));d.chemistName=chemistById(d.linkedChemistId)?.name||'';if($('#quickUseGps').checked){const lat=num($('#quickdocLatitude').value),lng=num($('#quickdocLongitude').value),acc=num($('#quickdocAccuracy').value);if(lat&&lng){if(acc>200&&!confirm(`GPS accuracy is about ${Math.round(acc)} m. Save this hospital location anyway?`))return;d.latitude=lat;d.longitude=lng;d.locationAccuracy=acc||'';d.locationCapturedAt=$('#quickdocCapturedAt').value||new Date().toISOString();d.locationSource='Quick doctor GPS';}}d.updatedAt=new Date().toISOString();d.needsCompletion=doctorCompleteness(d).score<100;saveState();closeSheet();toast(`Doctor details saved • ${doctorVisitPolicy(d).label}`);});
  }

  function editRecord(type,id='') {
    const arr=type==='doctor'?state.doctors:state.chemists, old=arr.find(x=>x.id===id)||{}, isDoctor=type==='doctor';
    const existingChemist=isDoctor?(linkedChemist(old)?.id||''):'';
    openSheet(`${id?'Edit':'Add'} ${isDoctor?'doctor':'chemist'}`,isDoctor?'Doctor name, hospital/clinic, address and linked chemist are saved once.':'Only shop name and location are needed.',`
      <form id="recordForm" class="sheet-form">
        <label><span>${isDoctor?'Doctor name':'Chemist name'}</span><input name="name" required value="${esc(old.name||'')}"></label>
        ${!isDoctor?`<label><span>Preferred distributor (optional)</span><select name="linkedDistributorId">${distributorOptions(preferredDistributor(old)?.id||'')}</select></label>`:''}
        ${isDoctor?`<label><span>Hospital / clinic name</span><input name="hospital" value="${esc(doctorHospital(old))}" placeholder="Example: Sterling Hospital"></label><div class="lookup-label field-block"><span class="field-caption">Doctor under chemist</span><div class="lookup-field"><input id="recordChemistSearch" type="search" autocomplete="off" value="${esc(linkedChemist(old)?.name||'')}" placeholder="Search chemist name or area…"><input id="recordChemistId" name="linkedChemistId" type="hidden" value="${esc(existingChemist)}"><div id="recordChemistResults" class="search-results lookup-results hidden"></div></div></div><div class="field-grid two"><label><span>Monthly visits</span><select name="monthlyVisitTarget"><option value="1" ${doctorVisitPolicy(old).target===1?'selected':''}>1× / month</option><option value="2" ${doctorVisitPolicy(old).target===2?'selected':''}>2× / month</option><option value="3" ${doctorVisitPolicy(old).target===3?'selected':''}>3× / month</option><option value="4" ${doctorVisitPolicy(old).target===4?'selected':''}>4× / month</option></select></label><label><span>Custom minimum gap days</span><input name="minVisitGapDays" type="number" min="0" max="31" value="${esc(num(old.minVisitGapDays)||0)}" placeholder="0 = automatic"></label></div><div class="schedule-card"><div class="form-section-title"><h3>Doctor meeting timing</h3><p>Save once. It appears during every search and meeting.</p></div><div class="schedule-quick"><button type="button" id="monSatDaysBtn">Mon–Sat</button><button type="button" id="allDaysBtn">Every day</button><button type="button" id="clearDaysBtn">Clear</button></div><div class="day-selector">${DAY_NAMES.map((day,i)=>`<label class="day-option"><input type="checkbox" name="meetingDays" value="${i}" ${normalizeMeetingDays(old.meetingDays).includes(i)?'checked':''}><span>${day}</span></label>`).join('')}</div><div class="field-grid two timing-grid"><label><span>First timing from</span><input name="meetingFrom" type="time" value="${esc(normalizeTime(old.meetingFrom))}"></label><label><span>First timing to</span><input name="meetingTo" type="time" value="${esc(normalizeTime(old.meetingTo))}"></label><label><span>Second timing from (optional)</span><input name="meetingFrom2" type="time" value="${esc(normalizeTime(old.meetingFrom2))}"></label><label><span>Second timing to (optional)</span><input name="meetingTo2" type="time" value="${esc(normalizeTime(old.meetingTo2))}"></label></div></div>`:''}
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
        rec.monthlyVisitTarget=Math.max(1,Math.min(4,Math.round(num(fd.get('monthlyVisitTarget'))||2)));rec.minVisitGapDays=Math.max(0,Math.round(num(fd.get('minVisitGapDays'))||0));
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
    if(isDoctor){const timing=doctorMeetingStatus(r),elig=doctorEligibilityForDate(r);extra=`<div class="detail-section"><h4>Monthly visit rule</h4><div class="detail-address"><strong>${esc(doctorVisitPolicy(r).label)}</strong><br>${esc(elig.reason)}</div></div><div class="detail-section"><h4>Doctor meeting timing</h4><div class="detail-address timing-detail ${esc(timing.state)}"><strong>${esc(timing.label)}</strong>${doctorMeetingTiming(r)?`<br>${esc(doctorMeetingTiming(r))}`:'<br>Not set yet'}</div></div><div class="detail-section"><h4>Under chemist</h4><div class="detail-address">${esc(ch?.name||'Not linked yet')}</div></div><div class="detail-section"><h4>Latest product status</h4>${statusTags(latestStatuses(r.id,ch?.id||''))}</div>`;}
    else{
      const docs=state.doctors.filter(d=>d.linkedChemistId===id),dist=preferredDistributor(r);
      extra=`<div class="detail-section"><h4>Preferred distributor</h4><div class="detail-address">${esc(dist?.name||'Not set')}</div></div><div class="detail-section"><h4>Doctors under this chemist</h4>${docs.length?docs.map(d=>`<button class="linked-doctor-row" data-action="view-record" data-type="doctor" data-id="${d.id}"><strong>${esc(doctorDisplayName(d))}</strong><small>${esc(d.area||'')}</small></button>`).join(''):empty('No doctor linked yet.')}</div>`;
    }
    openSheet(isDoctor?doctorDisplayName(r):r.name,isDoctor?'Doctor profile':'Chemist profile',`<div class="detail-hero"><div class="avatar">${esc(initials(r.name))}</div><div><h3>${esc(isDoctor?doctorDisplayName(r):r.name)}</h3><p>${esc(isDoctor?(ch?.name||'Chemist not linked'):`${linkedDoctorCount(r.id)} doctors linked`)}</p></div></div><div class="detail-grid"><div class="detail-box"><small>Area</small><strong>${esc(r.area||r.hq||'—')}</strong></div><div class="detail-box"><small>Last meeting</small><strong>${esc(prettyDate(r.lastVisit))}</strong></div></div>${isDoctor&&doctorHospital(r)?`<div class="detail-section"><h4>Hospital / clinic</h4><div class="detail-address">${esc(doctorHospital(r))}</div></div>`:''}<div class="detail-section"><h4>Address</h4><div class="detail-address">${esc(r.address||'Not added')}</div></div>${map?`<a class="map-main-btn" href="${map}" target="_blank" rel="noopener">Open map location</a>`:''}${extra}${r.notes?`<div class="detail-section"><h4>Note</h4><div class="note-box">${esc(r.notes)}</div></div>`:''}<div class="detail-actions"><button data-action="log-record" data-type="${type}" data-id="${id}">Log meeting</button><button data-action="edit-record" data-type="${type}" data-id="${id}">Edit once</button><button data-close-sheet>Close</button></div><div class="detail-section"><h4>Meeting history</h4>${history.length?history.map(miniActivity).join(''):empty('No meetings yet.')}</div>`);
  }
  function viewVisit(id) {
    const v=state.visits.find(x=>x.id===id);if(!v)return;
    const map=visitMapUrl(v),isDoctor=Boolean(v.doctorId),audit=isDoctor?locationAuditForVisit(v):null,tp=state.tourPlans.find(x=>x.id===v.tourPlanId),samples=state.sampleTransactions.filter(x=>x.type==='issue'&&x.visitId===v.id);
    const title=isDoctor?([v.doctorName||v.entityName,v.doctorHospital].filter(Boolean).join(' — ')||'Doctor meeting'):(v.chemistName||v.entityName||'Chemist visit');
    openSheet(title,`${prettyDate(v.date)} • ${prettyTime(v.date)}`,`<div class="detail-grid"><div class="detail-box"><small>${isDoctor?'Doctor / hospital':'Chemist'}</small><strong>${esc(isDoctor?([v.doctorName,v.doctorHospital].filter(Boolean).join(' — ')||'—'):(v.chemistName||v.entityName||'—'))}</strong></div><div class="detail-box"><small>${isDoctor?'Under chemist':'Purpose'}</small><strong>${esc(isDoctor?(v.chemistName||'—'):(v.outcomeLabel||'Chemist visit'))}</strong></div><div class="detail-box"><small>Result</small><strong>${esc(v.outcomeLabel||OUTCOME_LABELS[v.outcome]||'Saved')}</strong></div><div class="detail-box"><small>Doctor call counted</small><strong>${esc(num(v.calls))}</strong></div>${isDoctor?`<div class="detail-box"><small>GPS accuracy</small><strong>${v.locationAccuracy?`${esc(v.locationAccuracy)} m`:'Not saved'}</strong></div><div class="detail-box"><small>Location audit</small><strong>${esc(audit.status)}${audit.distanceMeters!==''?` • ${esc(audit.distanceMeters)} m`:''}</strong></div>`:''}</div>${map?`<a class="map-main-btn" href="${map}" target="_blank" rel="noopener">Open visit location</a>`:''}${isDoctor?`<div class="detail-section"><h4>Prescription feedback</h4>${statusTags(v.productStatuses)}</div>`:''}${samples.length?`<div class="detail-section"><h4>Samples distributed</h4><div class="note-box">${samples.map(x=>`${esc([x.product,x.pack].filter(Boolean).join(' • '))} × ${esc(x.qty)}`).join('<br>')}</div></div>`:''}${tp?`<div class="detail-section"><h4>Tour Program</h4><div class="detail-address">${esc(`${tp.workType||'HQ'} • ${tp.area||''}${tp.jointWorkWith?` • ${tp.jointWorkWith}`:''}`)}</div></div>`:''}${v.notes?`<div class="detail-section"><h4>Meeting note</h4><div class="note-box">${esc(v.notes)}</div></div>`:''}<div class="detail-section"><h4>Follow-up</h4><div class="detail-address">${esc(prettyDate(v.followUpDate))}</div></div><div class="button-row"><button id="deleteVisitBtn" class="btn danger">Delete meeting</button></div>`);
    $('#deleteVisitBtn').addEventListener('click',()=>{if(!confirm('Delete this meeting log? Linked sample issues from this visit will also be reversed.'))return;state.visits=state.visits.filter(x=>x.id!==id);state.sampleTransactions=state.sampleTransactions.filter(x=>x.visitId!==id);saveState();closeSheet();toast('Meeting deleted.');});
  }


function manageDistributors(){
  openSheet('Distributors','Set once; chemist orders will remember the preferred distributor.',`<div class="button-row"><button class="btn primary" data-action="add-distributor">+ Add distributor</button></div><div class="card-list compact-list">${state.distributors.length?state.distributors.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(d=>`<article class="record-card"><div class="record-top"><div class="avatar">${esc(initials(d.name))}</div><div class="record-title"><h3>${esc(d.name)}</h3><p>${esc([d.area,d.mobile].filter(Boolean).join(' • ')||'Details not added')}</p></div></div><div class="tag-row"><span class="tag">${state.orders.filter(o=>o.distributorId===d.id).length} orders</span></div><div class="record-actions"><button data-action="edit-distributor" data-id="${d.id}">Edit</button><button data-action="new-order" data-distributor-id="${d.id}">Order</button></div></article>`).join(''):empty('No distributor added yet.')}</div>`);
}
function editDistributor(id=''){
  const old=state.distributors.find(x=>x.id===id)||{};
  openSheet(`${id?'Edit':'Add'} distributor`,'Address and optional manual map pin are saved once. Device GPS is never collected for distributors.',`<form id="distributorForm" class="sheet-form"><label><span>Distributor name</span><input name="name" required value="${esc(old.name||'')}"></label><label><span>Mobile</span><input name="mobile" inputmode="tel" value="${esc(old.mobile||'')}"></label><label><span>Address</span><textarea name="address" rows="2">${esc(old.address||'')}</textarea></label><label><span>Area</span><input name="area" value="${esc(old.area||state.profile.hq||'')}"></label><label><span>Google Maps full link or coordinates</span><input name="mapLink" value="${esc(old.mapLink||'')}" placeholder="22.3039,70.8022 or full maps URL"></label><div class="field-grid two"><label><span>Map latitude</span><input name="latitude" inputmode="decimal" value="${esc(old.latitude||'')}"></label><label><span>Map longitude</span><input name="longitude" inputmode="decimal" value="${esc(old.longitude||'')}"></label></div><div class="notice">No distributor GPS capture. Paste a verified map coordinate/link only when you need location-wise distributor planning.</div><label><span>Note</span><textarea name="notes" rows="2">${esc(old.notes||'')}</textarea></label><div class="button-row">${id?'<button type="button" id="deleteDistributorBtn" class="btn danger">Delete</button>':''}<button class="btn primary" type="submit">Save distributor</button></div></form>`);
  const f=$('#distributorForm');f.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(f),parsed=parseMapCoordinates(fd.get('mapLink')),latitude=num(fd.get('latitude'))||parsed?.latitude||'',longitude=num(fd.get('longitude'))||parsed?.longitude||'',rec={...old,id:id||uid('dist'),name:clean(fd.get('name')),mobile:clean(fd.get('mobile')),address:clean(fd.get('address')),area:clean(fd.get('area')),hq:state.profile.hq,mapLink:clean(fd.get('mapLink')),latitude,longitude,locationSource:latitude&&longitude?'Manual verified map pin':'',notes:clean(fd.get('notes')),updatedAt:new Date().toISOString()};if(!id){rec.createdAt=new Date().toISOString();state.distributors.push(rec);}else Object.assign(old,rec);saveState();closeSheet();toast(latitude&&longitude?'Distributor saved with map pin.':'Distributor saved; map pin is still pending.');});
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
  openSheet('Accept distributor order','Accepted order automatically appears in today planning until marked fulfilled.',`<form id="quickOrderForm" class="sheet-form"><label><span>Chemist</span><select name="chemistId">${chemistOptions('')}</select></label><label><span>Distributor</span><select name="distributorId">${distributorOptions(dist?.id||'')}</select></label><label><span>Planning date</span><input name="planningDate" type="date" value="${localISODate()}"></label><div id="quickOrderItems" class="order-items">${orderItemRow({},0)}</div><button type="button" id="addQuickOrderItem" class="btn secondary compact">+ Add product</button><div class="order-total-line"><span>Total POB</span><strong data-order-total>₹0</strong></div><label><span>Order note</span><textarea name="notes" rows="2"></textarea></label><button class="btn primary full" type="submit">Accept order + add distributor to planning</button></form>`);
  const wrap=$('#quickOrderItems');bindOrderItems(wrap);$('#addQuickOrderItem').addEventListener('click',()=>{wrap.insertAdjacentHTML('beforeend',orderItemRow({},wrap.children.length));});const f=$('#quickOrderForm');f.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(f),c=chemistById(fd.get('chemistId')),d=distributorById(fd.get('distributorId')),items=collectOrderItems(wrap),total=items.reduce((n,x)=>n+x.value,0);if(!c||!d||!items.length){toast('Select chemist, distributor and product.');return;}const date=localISODateTime(),order={id:uid('ord'),date,planningDate:clean(fd.get('planningDate'))||localISODate(),chemistId:c.id,chemistName:c.name,distributorId:d.id,distributorName:d.name,items,totalValue:total,status:'accepted',fulfilmentStatus:'pending',notes:clean(fd.get('notes')),createdAt:new Date().toISOString()};state.orders.push(order);state.visits.push({id:uid('log'),date,entityType:'chemist',entityId:c.id,entityName:c.name,chemistId:c.id,chemistName:c.name,calls:0,inputs:0,basket:0,towel:0,conversation:0,newAvailability:0,pobValue:total,notes:`Accepted POB order to ${d.name}${order.notes?`: ${order.notes}`:''}`,productStatuses:{},orderId:order.id,createdAt:new Date().toISOString()});c.linkedDistributorId=d.id;c.distributorName=d.name;c.lastVisit=localISODate();d.lastOrderDate=localISODate();saveState();closeSheet();toast('Order accepted. Distributor added to planning.');});
}
function viewOrder(id){
  const o=state.orders.find(x=>x.id===id);if(!o)return;const d=distributorById(o.distributorId),pending=orderNeedsDistributorVisit(o),map=d?entityMapUrl(d):'';
  openSheet('Distributor order',`${prettyDate(o.date)} • ${prettyTime(o.date)}`,`<div class="detail-grid"><div class="detail-box"><small>Chemist</small><strong>${esc(o.chemistName||'—')}</strong></div><div class="detail-box"><small>Distributor</small><strong>${esc(d?.name||o.distributorName||'—')}</strong></div><div class="detail-box"><small>Status</small><strong>${esc(o.status||'placed')} / ${esc(o.fulfilmentStatus||'pending')}</strong></div><div class="detail-box"><small>Planning</small><strong>${esc(prettyDate(o.planningDate||o.date))}</strong></div><div class="detail-box"><small>Total</small><strong>₹${esc(orderTotal(o).toLocaleString('en-IN'))}</strong></div><div class="detail-box"><small>Plan visibility</small><strong>${pending?'Shown in planning':'Completed / hidden'}</strong></div></div>${map?`<a class="map-main-btn" href="${map}" target="_blank" rel="noopener">Open distributor map</a>`:''}<div class="detail-section"><h4>Products</h4>${(o.items||[]).map(x=>`<div class="order-detail-row"><strong>${esc(x.product)} • ${esc(x.pack||'')}</strong><span>Qty ${esc(x.qty||0)} • ₹${esc(num(x.value).toLocaleString('en-IN'))}${x.schemeRatio?` • ${esc(x.schemeRatio)}`:''}</span></div>`).join('')||empty('No items')}</div>${o.notes?`<div class="detail-section"><h4>Note</h4><div class="note-box">${esc(o.notes)}</div></div>`:''}<div class="button-row"><button id="toggleOrderPlanBtn" class="btn secondary">${pending?'Mark fulfilled':'Add back to planning'}</button><button id="deleteOrderBtn" class="btn danger">Delete order</button></div>`);
  $('#toggleOrderPlanBtn').addEventListener('click',()=>{if(pending){o.fulfilmentStatus='completed';o.completedAt=new Date().toISOString();}else{o.status='accepted';o.fulfilmentStatus='pending';o.planningDate=localISODate();delete o.completedAt;}saveState();closeSheet();toast(pending?'Order fulfilled; distributor removed from planning.':'Distributor added back to planning.');});
  $('#deleteOrderBtn').addEventListener('click',()=>{if(!confirm('Delete order and its POB activity?'))return;state.orders=state.orders.filter(x=>x.id!==id);state.visits=state.visits.filter(v=>v.orderId!==id);saveState();closeSheet();});
}
function planTodayRoute(){
  const eligible=state.doctors.filter(d=>todaySlot(d)&&num(d.latitude)&&num(d.longitude)),distributorStops=pendingDistributorStops(),preferred=smartPatchCandidates(30).find(x=>eligible.some(d=>d.id===x.doctor.id))?.doctor||eligible[0]||null;
  openSheet('Today location-wise planning','Strict nearest-chain mode: selected start → nearest next stop → nearest from that stop. Timing conflicts are warnings only.',`${eligible.length?`<label class="sheet-form"><span>Start from saved doctor / hospital</span><select id="routeStartDoctor">${eligible.map(d=>`<option value="${esc(d.id)}" ${d.id===preferred?.id?'selected':''}>${esc(doctorDisplayName(d))}</option>`).join('')}</select></label><label class="toggle-line"><input id="includeVisitedRoute" type="checkbox"> Include doctors already called today</label><div id="routeResult"></div>`:empty('No doctor has both today timing and verified hospital GPS. Distributor planning is still shown below.')}<div id="distributorPlanResult"></div>`);
  const renderDistributors=()=>{$('#distributorPlanResult').innerHTML=`<div class="detail-section"><h4>Accepted-order distributor stops</h4>${distributorStops.length?distributorStops.map((x,i)=>`<div class="route-stop ${x.mapReady?'':'route-risk'}"><span>${i+1}</span><div><strong>${esc(x.distributor.name)}</strong><small>${esc(`₹${x.totalValue.toLocaleString('en-IN')} • ${x.orders.length} order(s) • ${x.chemists.join(', ')||'Chemist pending'} • ${x.address||'Address missing'}${x.mapReady?' • map pin ready':' • add map pin in Distributor'}`)}</small></div>${entityMapUrl(x.distributor)?`<a class="btn secondary compact" href="${entityMapUrl(x.distributor)}" target="_blank" rel="noopener">Map</a>`:''}</div>`).join(''):empty('No accepted order is pending fulfilment.')}</div>`;};
  renderDistributors();if(!eligible.length)return;
  const render=()=>{const startDoctor=doctorById($('#routeStartDoctor').value)||preferred;if(!startDoctor)return;const lat=num(startDoctor.latitude),lng=num(startDoctor.longitude),route=groupedHospitalRouteCandidates(lat,lng,$('#includeVisitedRoute').checked),mappedDistributors=distributorStops.filter(x=>x.mapReady).map(x=>({type:'distributor',latitude:x.latitude,longitude:x.longitude,distributor:x.distributor})),url=googleRouteUrl(lat,lng,[...route,...mappedDistributors]);$('#routeResult').innerHTML=route.length?`<div class="notice">Start: ${esc(doctorDisplayName(startDoctor))}. Order is built as a true chain from each previous stop; same-hospital doctors are combined. Timing conflicts are shown but do not jump over a nearer stop.</div><div class="route-list">${route.map((x,i)=>`<div class="route-stop ${x.timingRisk?'route-risk':''}"><span>${i+1}</span><div><strong>${esc(x.hospital)}</strong><small>${esc(`${x.doctors.map(y=>doctorDisplayName(y.doctor)).join(', ')} • ETA ${minuteLabel(x.arrivalMinutes)} • ${x.distance.toFixed(1)} km approximate • ${x.waitMinutes?`wait ${x.waitMinutes} min • `:''}${x.timingRisk?`timing conflict +${x.lateMinutes} min • `:''}verified hospital pin`)}</small></div><button data-action="log-record" data-type="doctor" data-id="${x.doctor.id}">Meet</button></div>`).join('')}</div><div class="button-row">${url?`<a class="btn primary" href="${url}" target="_blank" rel="noopener">Open doctors + mapped distributors in Maps</a>`:''}<button id="saveRoutePlanBtn" class="btn secondary">Save plan</button></div>`:empty('No unvisited doctor is available with today timing and verified hospital GPS.');$('#saveRoutePlanBtn')?.addEventListener('click',()=>{state.routePlans.push({id:uid('route'),date:localISODate(),createdAt:new Date().toISOString(),startDoctorId:startDoctor.id,startDoctorName:doctorDisplayName(startDoctor),startLatitude:lat,startLongitude:lng,source:'Strict nearest-chain verified hospital GPS + accepted distributor orders',stops:[...route.map((x,i)=>({order:i+1,type:'Hospital',doctorId:x.doctor.id,doctorName:x.doctors.map(y=>y.doctor.name).join('; '),hospital:x.hospital,meetingFrom:x.slot.from,meetingTo:x.slot.to,estimatedArrival:minuteLabel(x.arrivalMinutes),travelMinutes:x.travelMinutes,waitMinutes:x.waitMinutes,timingRisk:x.timingRisk?'Yes':'No',locationAccuracy:x.doctor.locationAccuracy||'',locationSource:x.doctor.locationSource||'Verified hospital GPS',latitude:x.latitude,longitude:x.longitude,distanceKm:Number(x.distance.toFixed(2))})),...distributorStops.map((x,i)=>({order:route.length+i+1,type:'Distributor',doctorName:'',hospital:x.distributor.name,meetingFrom:'',meetingTo:'',estimatedArrival:'Flexible',travelMinutes:'',waitMinutes:'',timingRisk:x.mapReady?'No':'Map pin missing',locationAccuracy:'',locationSource:x.mapReady?'Manual verified map pin':'Address only',latitude:x.latitude||'',longitude:x.longitude||'',distanceKm:''}))]});saveState(false);toast('Doctor and distributor plan added to Excel.');});};
  $('#routeStartDoctor').addEventListener('change',render);$('#includeVisitedRoute').addEventListener('change',render);render();
}
function workbookData(){
  const latestRoute=state.routePlans.filter(r=>r.date===localISODate()).slice(-1)[0];
  return {sheets:[
    {name:'Summary',rows:[['MR One Export',localISODateTime()],['HQ',state.profile.hq],['TM',state.profile.tmName],['Doctors',state.doctors.length],['Chemists',state.chemists.length],['Distributors',state.distributors.length],['Orders',state.orders.length],['RCPA',state.rcpa.length],['Sample Items',state.sampleItems.length],['Sample Balance',state.sampleItems.reduce((n,x)=>n+sampleBalance(x),0)],['Expenses This Month',expenseTotal(expensesForMonth())],['Voice Captures',state.captures.length],['Active Schemes',state.schemes.filter(x=>schemeState(x)==='active').length],[],['Metric','Today','Month Cumulative'],...METRICS.map(([k,l])=>[l,statsForDay()[k],statsForMonth()[k]]),['Samples Issued',sampleIssuedForDay(),sampleIssuedForMonth()],['Expenses',expenseTotal(expensesForDay()),expenseTotal(expensesForMonth())],['RCPA',state.rcpa.filter(x=>dateOnly(x.date)===localISODate()).length,state.rcpa.filter(x=>monthKey(x.date)===monthKey()).length]]},
    {name:'Doctors',rows:[['Doctor Name','Hospital / Clinic','Google Place ID','Hospital Opening Hours','Under Chemist','Monthly Visit Target','Minimum Gap Days','Meeting Days','Meeting From 1','Meeting To 1','Meeting From 2','Meeting To 2','Address','Area','Latitude','Longitude','Location Source','Last Meeting','Next Follow-up','Notes'],...state.doctors.map(d=>[d.name,doctorHospital(d),d.placeId||'',(d.hospitalOpeningHours||[]).join('; '),linkedChemist(d)?.name||d.chemistName,doctorVisitPolicy(d).target,doctorVisitPolicy(d).gap,normalizeMeetingDays(d.meetingDays).map(x=>DAY_NAMES[x]).join('; '),d.meetingFrom,d.meetingTo,d.meetingFrom2,d.meetingTo2,d.address,d.area,d.latitude,d.longitude,d.locationSource||'',d.lastVisit,d.nextFollowUp,d.notes])]},
    {name:'Chemists',rows:[['Chemist Name','Preferred Distributor','Address','Area','Latitude','Longitude','Last Meeting','Next Follow-up','Notes'],...state.chemists.map(c=>[c.name,preferredDistributor(c)?.name||c.distributorName,c.address,c.area,c.latitude,c.longitude,c.lastVisit,c.nextFollowUp,c.notes])]},
    {name:'Distributors',rows:[['Distributor Name','Mobile','Address','Area','Latitude','Longitude','Last Order','Notes'],...state.distributors.map(d=>[d.name,d.mobile,d.address,d.area,d.latitude,d.longitude,d.lastOrderDate,d.notes])]},
    {name:'Orders',rows:[['Date','Doctor','Hospital','Chemist','Distributor','Products','Packs','Quantities','Schemes','POB Value','Status','Notes','Latitude','Longitude'],...state.orders.map(o=>[o.date,o.doctorName,o.doctorHospital,o.chemistName,distributorById(o.distributorId)?.name||o.distributorName,(o.items||[]).map(x=>x.product).join('; '),(o.items||[]).map(x=>x.pack).join('; '),(o.items||[]).map(x=>x.qty).join('; '),(o.items||[]).map(x=>x.schemeRatio).join('; '),orderTotal(o),o.status,o.notes,o.latitude,o.longitude])]},
    {name:'Expenses',rows:[['Date','Category','From','To','Distance Km','Rate per Km','Amount','Notes'],...state.expenses.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).map(x=>[x.date,x.category,x.fromPlace,x.toPlace,x.km,x.ratePerKm,x.amount,x.notes])]},
    {name:'Sample Stock',rows:[['Product','Pack','Batch','Expiry','Opening Qty','Received Qty','Issued Qty','Balance','Notes'],...state.sampleItems.map(x=>[x.product,x.pack,x.batch,x.expiry,x.openingQty,state.sampleTransactions.filter(t=>t.sampleItemId===x.id&&t.type==='receive').reduce((n,t)=>n+num(t.qty),0),state.sampleTransactions.filter(t=>t.sampleItemId===x.id&&t.type==='issue').reduce((n,t)=>n+num(t.qty),0),sampleBalance(x),x.notes])]},
    {name:'Sample Distribution',rows:[['Date','Doctor','Chemist','Product','Pack','Batch','Qty','Visit ID','Notes'],...state.sampleTransactions.filter(x=>x.type==='issue').map(x=>[x.date,x.doctorName,x.chemistName,x.product,x.pack,x.batch,x.qty,x.visitId,x.notes])]},
    {name:'RCPA',rows:[['Date','Chemist','Doctor','Our Brand','Our Availability','Competitor Brand','Competitor Company','Rx / Units','Notes'],...state.rcpa.map(x=>[x.date,x.chemistName,x.doctorName,x.ourBrand,x.ourAvailability,x.competitorBrand,x.competitorCompany,x.rxQty,x.notes])]},
    {name:'Tour Program',rows:[['Date','Work Type','Area / Town','Joint Work With','Objective','Notes'],...state.tourPlans.map(x=>[x.date,x.workType,x.area,x.jointWorkWith,x.objective,x.notes])]},
    {name:'Target & Sales',rows:[['Month','Target','Primary Sales','Secondary Sales','Collection','Achievement %','Notes'],...state.salesMonths.map(x=>[x.month,x.target,x.primary,x.secondary,x.collection,x.target?Math.round(num(x.secondary)/num(x.target)*100):'',x.notes])]},
    {name:'Visits',rows:[['Date','Doctor','Hospital','Chemist','Result','Not-met Reason','Rescheduled For','Replacement Doctor','Machine Action','Calls','POB Value','Product Feedback','Follow-up','Notes','Visit Latitude','Visit Longitude','GPS Accuracy','Hospital Latitude','Hospital Longitude','Distance from Hospital (m)','Location Audit'],...state.visits.filter(v=>v.doctorId||v.chemistId).map(v=>{const a=locationAuditForVisit(v);return [v.date,v.doctorName,v.doctorHospital,v.chemistName,v.outcomeLabel||OUTCOME_LABELS[v.outcome]||'Doctor met',v.notMetReason||'',v.rescheduledFor||'',v.replacementDoctorName||'',v.intelligenceAction||'',v.calls,v.pobValue,Object.entries(v.productStatuses||{}).map(([p,x])=>`${p}: ${statusLabel(x)}`).join('; '),v.followUpDate,v.notes,v.latitude,v.longitude,v.locationAccuracy,v.hospitalLatitude||doctorById(v.doctorId)?.latitude||'',v.hospitalLongitude||doctorById(v.doctorId)?.longitude||'',a.distanceMeters,a.status];})]},
    {name:'Location Audit',rows:[['Date','Doctor','Hospital','Visit GPS','Hospital Master GPS','Distance (m)','GPS Accuracy (m)','Audit Status'],...state.visits.filter(v=>v.doctorId).map(v=>{const d=doctorById(v.doctorId),a=locationAuditForVisit(v);return [v.date,v.doctorName,v.doctorHospital,[v.latitude,v.longitude].filter(Boolean).join(', '),[v.hospitalLatitude||d?.latitude,v.hospitalLongitude||d?.longitude].filter(Boolean).join(', '),a.distanceMeters,a.accuracyMeters,a.status];})]},
    {name:'Schemes',rows:[['Product','Pack','Scheme / Offer','Start Date','End Date','Current Status','Source','Notes'],...state.schemes.map(x=>[x.product,x.pack,x.ratio,x.startDate,x.endDate,schemeState(x),x.source,x.notes])]},
    {name:'Today Route',rows:[['Order','Type','Doctor(s)','Hospital / Distributor','Meeting From','Meeting To','Estimated Arrival','Travel Minutes','Wait Minutes','Timing Risk','Distance Km','GPS Accuracy','Location Source','Latitude','Longitude'],...(latestRoute?.stops||[]).map(x=>[x.order,x.type||'Hospital',x.doctorName,x.hospital,x.meetingFrom,x.meetingTo,x.estimatedArrival,x.travelMinutes,x.waitMinutes,x.timingRisk,x.distanceKm,x.locationAccuracy,x.locationSource,x.latitude,x.longitude])]},
    {name:'Smart Patch',rows:[['Date','Order','Type','Doctor','Hospital','Distributor','Timing','Score','Reason','Product Action'],...state.patchPlans.flatMap(p=>(p.items||[]).map(x=>[p.date,x.order,x.type||'Doctor',x.doctorName,x.hospital,x.distributorName||'',x.timing,x.score,x.reason,x.productAction]))]},
    {name:'Reschedules',rows:[['Created','Doctor','Hospital','Reason','Scheduled Date','Scheduled Time','Replacement Doctor','Status'],...state.reschedules.map(r=>[r.createdAt,r.doctorName,r.hospital,r.reason,r.scheduledDate,[r.meetingFrom,r.meetingTo].filter(Boolean).join('-'),r.replacementDoctorName,r.status])]},
    {name:'Data Quality',rows:[['Doctor','Hospital','Chemist','Completion %','Missing Fields','Last Met','Next Follow-up','Recent Not-met'],...state.doctors.map(d=>{const q=doctorCompleteness(d);return [d.name,doctorHospital(d),linkedChemist(d)?.name||'',q.score,q.missing.join('; '),latestDoctorVisit(d.id,true)?.date||'',d.nextFollowUp||'',recentNotMetCount(d.id)];})]},
    {name:'Distributor Planning',rows:[['Distributor','Area','Address','Map Ready','Accepted Orders','Chemists','POB Value','Planning Date'],...pendingDistributorStops().map(x=>[x.distributor.name,x.area,x.address,x.mapReady?'Yes':'No',x.orders.length,x.chemists.join('; '),x.totalValue,localISODate()])]},
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
    const incoming={...(rec||{})};
    const parsedName=splitCodedChemistName(incoming.name);
    incoming.name=parsedName.name;
    if(parsedName.code&&!incoming.stockistCode)incoming.stockistCode=parsedName.code;
    const key=norm(incoming.name),place=norm(incoming.area||incoming.hq);let old=state.chemists.find(x=>norm(x.name)===key&&(!place||norm(x.area||x.hq)===place))||state.chemists.find(x=>norm(x.name)===key);
    if(!old){const created={...incoming,id:uid('ch'),createdAt:new Date().toISOString(),products:incoming.products||[]};state.chemists.push(created);return {mode:'added',record:created};}
    const protectedFields=['notes','lastVisit','nextFollowUp','createdAt','id','latitude','longitude','locationCapturedAt'];Object.entries(incoming).forEach(([k,v])=>{if(protectedFields.includes(k)||v===''||v==null)return;if(Array.isArray(v))old[k]=mergeArrays(old[k],v);else old[k]=v;});old.sourceFiles=mergeArrays(old.sourceFiles,incoming.sourceFiles);old.updatedAt=new Date().toISOString();return {mode:'updated',record:old};
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

  function haptic(kind='light'){try{if(window.AndroidBridge?.haptic)window.AndroidBridge.haptic(kind);}catch(_){}}

  function sanDetectedHtml(parsed){
    const timing=[parsed.meetingFrom&&parsed.meetingTo?`${timeLabel(parsed.meetingFrom)}–${timeLabel(parsed.meetingTo)}`:'',parsed.meetingFrom2&&parsed.meetingTo2?`${timeLabel(parsed.meetingFrom2)}–${timeLabel(parsed.meetingTo2)}`:''].filter(Boolean).join(' / ');
    const days=parsed.meetingDays?.length?parsed.meetingDays.map(x=>DAY_NAMES[x]).join(', '):'Not detected';
    const products=Object.entries(parsed.productStatuses||{}).filter(([,v])=>v).map(([k,v])=>`${k}: ${statusLabel(v)}`).join(' • ')||'No product status detected';
    return `<div class="san-detected-grid"><div><small>Doctor</small><strong>${esc(parsed.doctorName||'Not detected')}</strong></div><div><small>Hospital</small><strong>${esc(parsed.hospital||'Not detected')}</strong></div><div><small>Chemist</small><strong>${esc(parsed.chemistName||'Not detected')}</strong></div><div><small>Distributor</small><strong>${esc(parsed.distributorName||'Not detected')}</strong></div><div><small>Meeting</small><strong>${esc(`${days}${timing?` • ${timing}`:''}`)}</strong></div><div><small>POB</small><strong>${parsed.pobValue?`₹${esc(parsed.pobValue.toLocaleString('en-IN'))}`:'Not detected'}</strong></div></div><div class="note-box san-product-detection"><strong>Product detection</strong><br>${esc(products)}</div>`;
  }

  function openSanClipboardReview(text){
    text=clean(text);if(!text){toast('No copied SAN text found.');return;}
    const parsed=parseVoiceDetails(text);
    openSheet('Review SAN copied details','Nothing is saved until you confirm. Detected values can be checked in one place.',`<div id="sanDetectedSummary">${sanDetectedHtml(parsed)}</div><label class="field-block"><span class="field-caption">Copied SAN text</span><textarea id="sanClipboardText" rows="7">${esc(text)}</textarea></label><div class="button-row"><button id="sanReparseBtn" class="btn secondary">Re-detect details</button><button id="sanSaveInboxBtn" class="btn secondary">Save to capture inbox</button></div><button id="sanUseMeetingBtn" class="btn primary full">Use these details in Log Meeting</button><div class="notice">Flow: SAN me text select → Copy → MR bubble → Paste clipboard → Send to MR → Review → Log Meeting. Overlay screen ko read ya scrape nahi karta.</div>`);
    const raw=()=>clean($('#sanClipboardText').value);
    $('#sanReparseBtn').addEventListener('click',()=>{$('#sanDetectedSummary').innerHTML=sanDetectedHtml(parseVoiceDetails(raw()));haptic();});
    $('#sanSaveInboxBtn').addEventListener('click',()=>{const value=raw(),details=parseVoiceDetails(value);if(!value){toast('Paste text first.');return;}state.captures.push({id:uid('cap'),date:new Date().toISOString(),source:'SAN clipboard overlay',transcript:value,doctorId:details.doctorId||'',doctorName:details.doctorName||'',hospital:details.hospital||'',chemistId:details.chemistId||'',chemistName:details.chemistName||'',parsed:details,loggedMeeting:false});saveState();closeSheet();haptic('strong');toast('SAN details saved to capture inbox.');});
    $('#sanUseMeetingBtn').addEventListener('click',()=>{const value=raw(),details=parseVoiceDetails(value);if(!value){toast('Paste text first.');return;}pendingSanClipboardText=value;closeSheet();haptic('strong');setTimeout(()=>quickMeeting(details.doctorId||'',details.chemistId||''),100);});
  }

  window.__mrSanOverlayText=text=>setTimeout(()=>openSanClipboardReview(text),80);

  function openSanOverlayManager(){
    if(!window.AndroidBridge?.isNativeApp){openSheet('SAN copy overlay','Android APK required','<div class="note-box">Floating overlay is available only inside the Android APK.</div>');return;}
    const allowed=Boolean(window.AndroidBridge.canDrawOverlays?.()),running=Boolean(window.AndroidBridge.isSanOverlayRunning?.());
    openSheet('SAN copy overlay','Copy selected details from SAN and transfer them into the MR review screen.',`<div class="overlay-status-card ${running?'running':''}"><span>${running?'●':'○'}</span><div><strong>${running?'Overlay active':'Overlay stopped'}</strong><small>${allowed?'Display-over-apps permission allowed':'Permission required once'}</small></div></div><div class="san-flow"><div><b>1</b><span>SAN me required doctor / hospital / chemist details select karke Copy.</span></div><div><b>2</b><span>Floating MR bubble tap karo and Paste clipboard.</span></div><div><b>3</b><span>Send to MR, detected details review karo, then meeting me fill.</span></div></div><div class="button-row"><button id="sanPermissionBtn" class="btn secondary">${allowed?'Permission settings':'Allow overlay'}</button><button id="sanStartOverlayBtn" class="btn primary">Start overlay</button><button id="sanStopOverlayBtn" class="btn danger">Stop</button></div><button id="sanPasteNowBtn" class="btn secondary full">Paste current clipboard directly in app</button><div class="notice">Overlay only reads clipboard when you tap Paste. Android may show a clipboard-access message. Some protected apps can block overlays; in that case use Copy, return to MR, and tap Paste current clipboard.</div>`);
    $('#sanPermissionBtn').addEventListener('click',()=>window.AndroidBridge.requestSanOverlayPermission?.());
    $('#sanStartOverlayBtn').addEventListener('click',()=>{window.AndroidBridge.startSanOverlay?.();haptic('strong');setTimeout(closeSheet,250);});
    $('#sanStopOverlayBtn').addEventListener('click',()=>{window.AndroidBridge.stopSanOverlay?.();haptic();closeSheet();});
    $('#sanPasteNowBtn').addEventListener('click',()=>{const text=clean(window.AndroidBridge.readClipboardText?.()||'');if(!text){toast('Clipboard is empty or unavailable. Copy details in SAN first.');return;}closeSheet();openSanClipboardReview(text);});
  }

  function restoreObject(obj){if(!obj||!Array.isArray(obj.doctors)||!Array.isArray(obj.chemists)||!Array.isArray(obj.visits))throw new Error('Not a valid MR FieldBook backup.');try{localStorage.setItem(STORE_BACKUP_KEY,JSON.stringify(state));}catch(_){}state=migrateState(obj);return {sourceVersion:obj.version||'unknown',doctors:state.doctors.length,chemists:state.chemists.length,visits:state.visits.length};}
  function download(name,content,type='application/json'){if(window.AndroidBridge?.saveTextFile){window.AndroidBridge.saveTextFile(name,type,content);return;}const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  const csvCell=v=>`"${(Array.isArray(v)?v.join('; '):String(v??'')).replace(/"/g,'""')}"`;
  function exportCSV(){const headers=['Type','Name','Hospital / Clinic','Under Chemist','Meeting Days','Meeting Slot 1','Meeting Slot 2','Address','Area','Latitude','Longitude','Last Meeting','Next Follow-up','Notes'];const rows=[headers,...state.doctors.map(d=>['Doctor',d.name,doctorHospital(d),linkedChemist(d)?.name||d.chemistName,normalizeMeetingDays(d.meetingDays).map(x=>DAY_NAMES[x]).join('; '),doctorMeetingSlots(d)[0]?`${timeLabel(doctorMeetingSlots(d)[0].from)}-${timeLabel(doctorMeetingSlots(d)[0].to)}`:'',doctorMeetingSlots(d)[1]?`${timeLabel(doctorMeetingSlots(d)[1].from)}-${timeLabel(doctorMeetingSlots(d)[1].to)}`:'',d.address,d.area,d.latitude,d.longitude,d.lastVisit,d.nextFollowUp,d.notes]),...state.chemists.map(c=>['Chemist',c.name,'','','','','',c.address,c.area,c.latitude,c.longitude,c.lastVisit,c.nextFollowUp,c.notes])];download(`MR-Master-${localISODate()}.csv`,rows.map(r=>r.map(csvCell).join(',')).join('\n'),'text/csv;charset=utf-8');}
  async function hashPin(pin){if(window.AndroidBridge?.sha256)return window.AndroidBridge.sha256(pin);const data=new TextEncoder().encode(pin);const digest=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');}
  function showLockIfNeeded(){if(state.settings.pinHash){$('#lockScreen').classList.remove('hidden');$('#lockScreen').setAttribute('aria-hidden','false');setTimeout(()=>$('#unlockPin').focus(),100);}}

  function bindEvents(){
    document.addEventListener('click',e=>{
      if(e.target.closest('button,.btn,[data-nav]'))haptic(e.target.closest('.primary,.danger,[type="submit"]')?'strong':'light');
      const nav=e.target.closest('[data-nav]');if(nav){navigate(nav.dataset.nav);return;}
      const close=e.target.closest('[data-close-sheet]');if(close){closeSheet();return;}
      const a=e.target.closest('[data-action]');if(a){const action=a.dataset.action,type=a.dataset.type,id=a.dataset.id;
        if(action==='quick-log'||action==='add-visit')quickMeeting();
        if(action==='chemist-visit')quickChemistVisit(id||a.dataset.chemistId||'');
        if(action==='quick-rcpa')quickRcpa(id||a.dataset.chemistId||'');
        if(action==='edit-rcpa')quickRcpa('',id);
        if(action==='manage-rcpa')manageRcpa();
        if(action==='manage-expenses')manageExpenses();
        if(action==='add-expense')quickExpense();
        if(action==='edit-expense')quickExpense(id);
        if(action==='expense-settings')expenseSettings();
        if(action==='manage-samples')manageSamples();
        if(action==='add-sample-item')editSampleItem();
        if(action==='edit-sample-item')editSampleItem(id);
        if(action==='receive-samples')receiveSamples();
        if(action==='issue-samples')issueSamples(a.dataset.doctorId||'');
        if(action==='manage-tour-plan')manageTourPlan();
        if(action==='quick-complete-doctor')quickCompleteDoctor();
        if(action==='area-time-plan')areaTimeDoctorPlan();
        if(action==='edit-tour-plan')editTourPlan(id);
        if(action==='manage-sales')manageSales();
        if(action==='edit-sales')editSales();
        if(action==='add-doctor')editRecord('doctor');if(action==='add-chemist')editRecord('chemist');
        if(action==='log-record'){if(type==='doctor')quickMeeting(id,'');else quickChemistVisit(id);}
        if(action==='edit-record')editRecord(type,id);if(action==='view-record')viewRecord(type,id);if(action==='view-visit')viewVisit(id);if(action==='add-distributor')editDistributor();if(action==='edit-distributor')editDistributor(id);if(action==='manage-distributors')manageDistributors();if(action==='add-scheme')editScheme();if(action==='edit-scheme')editScheme(id);if(action==='manage-schemes')manageSchemes();if(action==='new-order')quickOrder(a.dataset.distributorId||'');if(action==='view-order')viewOrder(id);if(action==='plan-route')planTodayRoute();if(action==='nearby-hospitals')discoverNearbyHospitals();if(action==='voice-capture')voiceDataCapture();return;}
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
    $('#machineOpenBtn').addEventListener('click',openIntelligenceCenter);$('#companyReportPackBtn').addEventListener('click',exportCompanyReportPack);$('#sanOverlayBtn').addEventListener('click',openSanOverlayManager);
    $('#nearbyHospitalBtn').addEventListener('click',discoverNearbyHospitals);$('#planRouteBtn').addEventListener('click',planTodayRoute);$('#newOrderBtn').addEventListener('click',()=>quickOrder());$('#manageDistributorsBtn').addEventListener('click',manageDistributors);$('#manageSchemesBtn').addEventListener('click',manageSchemes);$('#exportXlsxBtn').addEventListener('click',exportXLSX);
    $('#copyReportBtn').addEventListener('click',async()=>{try{const text=getReportText();if(window.AndroidBridge?.copyText)window.AndroidBridge.copyText(text);else await navigator.clipboard.writeText(text);toast('Daily report copied.');}catch(_){toast('Copy failed. Use Share.');}});
    $('#shareReportBtn').addEventListener('click',async()=>{const text=getReportText();try{if(window.AndroidBridge?.shareText)window.AndroidBridge.shareText('MR Daily Report',text);else if(navigator.share)await navigator.share({title:'MR Daily Report',text});else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,'_blank');}catch(e){if(e.name!=='AbortError')toast('Share cancelled.');}});
    $('#importFile').addEventListener('change',e=>{if(e.target.files.length)importFiles([...e.target.files]);e.target.value='';});$('#loadBundledBtn').addEventListener('click',()=>{if(window.AndroidBridge){const status=$('#importStatus');status.className='notice';status.classList.remove('hidden');status.textContent='The supplied doctor, chemist and product data is already included in this Android app.';toast('Starter data is already loaded.');}else loadBundledFiles(false);});
    $('#exportJsonBtn').addEventListener('click',()=>download(`MR-Daily-Auto-Backup-${localISODate()}.json`,JSON.stringify(state,null,2)));$('#exportCsvBtn').addEventListener('click',exportCSV);$('#restoreBtn').addEventListener('click',()=>$('#restoreInput').click());
    $('#restoreInput').addEventListener('change',async e=>{try{const info=restoreObject(JSON.parse(await e.target.files[0].text()));saveState();toast(`Backup v${info.sourceVersion} restored • ${info.doctors} doctors • ${info.chemists} chemists • ${info.visits} activities.`);}catch(err){toast(err.message);}e.target.value='';});
    $('#profileForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget);['tmName','hq','joinWorkWith','companyDivision','products'].forEach(k=>state.profile[k]=clean(fd.get(k)));saveState();toast('Profile and product buttons saved.');});
    $('#openingForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget);state.opening.monthKey=monthKey(localISODate());METRICS.forEach(([k])=>state.opening[k]=num(fd.get(k)));saveState();toast('Opening balances saved.');});
    $('#pinForm').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),p=clean(fd.get('pin')),c=clean(fd.get('confirmPin'));if(!/^\d{4,6}$/.test(p)||p!==c){toast('PIN must be matching 4–6 digits.');return;}state.settings.pinHash=await hashPin(p);saveState(false);e.currentTarget.reset();toast('PIN lock set.');});
    $('#removePinBtn').addEventListener('click',()=>{state.settings.pinHash='';saveState(false);toast('PIN removed.');});$('#unlockBtn').addEventListener('click',async()=>{const h=await hashPin($('#unlockPin').value);if(h===state.settings.pinHash){$('#lockScreen').classList.add('hidden');$('#unlockError').textContent='';$('#unlockPin').value='';}else $('#unlockError').textContent='Wrong PIN';});$('#unlockPin').addEventListener('keydown',e=>{if(e.key==='Enter')$('#unlockBtn').click();});
    $('#resetBtn').addEventListener('click',()=>{if(!confirm('Reset all local app data? Export a backup first.'))return;state=makeDefaultState();saveState();toast('App reset.');navigate('dashboard');});
    window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;});
  }

  async function init(){loadEmbeddedSeed();bindEvents();renderAll();showLockIfNeeded();if(window.AndroidBridge?.consumeSanOverlayText){const pending=clean(window.AndroidBridge.consumeSanOverlayText());if(pending)setTimeout(()=>openSanClipboardReview(pending),500);}if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./service-worker.js').catch(console.warn);if(!state.settings.bundledImportAttempted&&location.protocol!=='file:')setTimeout(()=>loadBundledFiles(true),900);}
  document.addEventListener('DOMContentLoaded',init);
})();
