(() => {
  'use strict';

  const STORE_KEY = 'mr-daily-auto-v3';
  const STORE_BACKUP_KEY = 'mr-daily-auto-v3-last-good';
  const APP_VERSION = 19.0;
  const METRICS = [
    ['calls', 'Calls'],
    ['inputs', 'Input Distributed'],
    ['basket', 'Basket'],
    ['towel', 'Towel'],
    ['conversation', 'Conversations'],
    ['newAvailability', 'New Chemist Availability'],
    ['pobValue', 'POB Value']
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
  let plannerLocation={lat:0,lng:0,accuracy:0,capturedAt:'',source:''};
  const plannerLocationFresh=()=>plannerLocation.lat&&plannerLocation.lng&&plannerLocation.capturedAt&&(Date.now()-new Date(plannerLocation.capturedAt).getTime())<10*60*1000;
  const mapConfidence=d=>{const a=num(d?.locationAccuracy);if(!num(d?.latitude)||!num(d?.longitude))return 'missing';if(a&&a>150)return 'review';return (d?.locationSource||'').toLowerCase().includes('verified')||a&&a<=50?'verified':'saved';};
  const dateOnly=v=>clean(v).slice(0,10);
  function daysBetween(a,b){const x=new Date(`${dateOnly(a)}T00:00:00`),y=new Date(`${dateOnly(b)}T00:00:00`);return Number.isNaN(x.getTime())||Number.isNaN(y.getTime())?0:Math.round((y-x)/86400000);}
  function doctorVisitRows(doctorId){return state.visits.filter(v=>v.doctorId===doctorId).sort((a,b)=>String(a.date).localeCompare(String(b.date)));}
  function latestDoctorVisit(doctorId,metOnly=false){return doctorVisitRows(doctorId).filter(v=>!metOnly||!NOT_MET_OUTCOMES.has(v.outcome)).slice(-1)[0]||null;}
  function recentNotMetCount(doctorId,windowDays=60){const cutoff=new Date();cutoff.setDate(cutoff.getDate()-windowDays);return doctorVisitRows(doctorId).filter(v=>NOT_MET_OUTCOMES.has(v.outcome)&&new Date(v.date)>=cutoff).length;}
  function successfulDoctorVisits(doctorId){return doctorVisitRows(doctorId).filter(v=>!NOT_MET_OUTCOMES.has(v.outcome));}
  function successfulVisitsThisMonth(doctorId,date=localISODate()){const mk=monthKey(date);return successfulDoctorVisits(doctorId).filter(v=>monthKey(v.date)===mk).length;}
  function doctorEligibility(doctor,at=now()){
    const date=localISODate(at),monthVisits=successfulVisitsThisMonth(doctor.id,date),last=latestDoctorVisit(doctor.id,true);
    if(monthVisits>=2)return {eligible:false,reason:'2/2 visits completed this month',monthVisits,nextEligible:''};
    if(last){const gap=daysBetween(last.date,date);if(gap<15){const next=new Date(`${dateOnly(last.date)}T00:00:00`);next.setDate(next.getDate()+15);return {eligible:false,reason:`15-day lock • next ${prettyDate(localISODate(next))}`,monthVisits,nextEligible:localISODate(next)};}}
    return {eligible:true,reason:`Visit ${monthVisits+1}/2 due`,monthVisits,nextEligible:date};
  }
  function learnedDoctorPattern(doctor,at=now()){
    const rows=doctorVisitRows(doctor.id).filter(v=>v.date);
    if(!rows.length)return {confidence:'low',score:0,bestDays:[],bestHours:[],metRate:0,samples:0,weekdayRate:0,timeRate:0,trend:0};
    const valid=rows.map(v=>({v,d:new Date(v.date),met:!NOT_MET_OUTCOMES.has(v.outcome)})).filter(x=>!Number.isNaN(x.d.getTime()));
    if(!valid.length)return {confidence:'low',score:0,bestDays:[],bestHours:[],metRate:0,samples:0,weekdayRate:0,timeRate:0,trend:0};
    const weightedRate=list=>{let yes=0,total=0;list.forEach((x,i)=>{const age=Math.max(0,(at-x.d)/86400000),w=Math.max(.35,Math.exp(-age/90));total+=w;if(x.met)yes+=w;});return total?yes/total:.5;};
    const metRate=weightedRate(valid), dayRows=valid.filter(x=>x.d.getDay()===at.getDay()), hour=at.getHours(),timeRows=valid.filter(x=>Math.abs(x.d.getHours()-hour)<=1);
    const weekdayRate=dayRows.length?weightedRate(dayRows):metRate, timeRate=timeRows.length?weightedRate(timeRows):metRate;
    const byDay=[0,1,2,3,4,5,6].map(day=>({day,rows:valid.filter(x=>x.d.getDay()===day)})).filter(x=>x.rows.length).map(x=>({day:x.day,rate:weightedRate(x.rows),n:x.rows.length})).sort((a,b)=>b.rate-a.rate||b.n-a.n);
    const byHour=[...new Set(valid.map(x=>x.d.getHours()))].map(h=>({h,rows:valid.filter(x=>x.d.getHours()===h)})).map(x=>({h:x.h,rate:weightedRate(x.rows),n:x.rows.length})).sort((a,b)=>b.rate-a.rate||b.n-a.n);
    const recent=valid.slice(-5), older=valid.slice(Math.max(0,valid.length-10),Math.max(0,valid.length-5)),trend=weightedRate(recent)-(older.length?weightedRate(older):metRate);
    const samples=valid.length,confidence=samples>=10?'high':samples>=4?'medium':'low';
    // Bayesian-style conservative score: history helps, but never overrules visit eligibility.
    const strength=Math.min(1,samples/8),score=((metRate-.5)*28+(weekdayRate-.5)*22+(timeRate-.5)*18+trend*12)*strength;
    return {confidence,score,bestDays:byDay.slice(0,3).map(x=>x.day),bestHours:byHour.slice(0,3).map(x=>x.h),metRate,samples,weekdayRate,timeRate,trend};
  }
  function latestPlanningAnchor(){
    if(plannerLocationFresh())return {lat:plannerLocation.lat,lng:plannerLocation.lng,accuracy:plannerLocation.accuracy,source:'current phone GPS'};
    const todayRows=rowsForDay().filter(v=>num(v.latitude)&&num(v.longitude)).sort((a,b)=>String(b.date).localeCompare(String(a.date)));if(todayRows[0])return {lat:num(todayRows[0].latitude),lng:num(todayRows[0].longitude),accuracy:num(todayRows[0].locationAccuracy),source:'last visit GPS'};
    const rows=[...state.visits].filter(v=>num(v.latitude)&&num(v.longitude)).sort((a,b)=>String(b.date).localeCompare(String(a.date)));if(rows[0])return {lat:num(rows[0].latitude),lng:num(rows[0].longitude),accuracy:num(rows[0].locationAccuracy),source:'last saved visit GPS'};return null;
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
    const eligibility=doctorEligibility(doctor);if(!eligibility.eligible)return -10000;
    const timing=doctorMeetingStatus(doctor),complete=doctorCompleteness(doctor),last=latestDoctorVisit(doctor.id,true),days=last?daysBetween(last.date,localISODate()):999,notMet=recentNotMetCount(doctor.id),due=doctor.nextFollowUp&&doctor.nextFollowUp<=localISODate(),rescheduled=state.reschedules.some(r=>r.doctorId===doctor.id&&r.status==='pending'&&r.scheduledDate<=localISODate()),learned=learnedDoctorPattern(doctor);
    let score=0;if(timing.state==='available')score+=110;else if(timing.state==='upcoming')score+=70;else if(timing.state==='scheduled')score+=25;else score-=45;
    if(due)score+=75;if(rescheduled)score+=90;score+=Math.min(60,Math.max(0,days));score-=Math.min(18,notMet*3);score+=complete.score/10;score+=learned.score;
    const opportunity=productOpportunity(doctor);if(opportunity.level==='high')score+=45;else if(opportunity.level==='medium')score+=22;
    const anchor=latestPlanningAnchor();if(anchor&&num(doctor.latitude)&&num(doctor.longitude)){const km=haversineKm(anchor.lat,anchor.lng,doctor.latitude,doctor.longitude);score+=Math.max(0,35-km*5);}
    return score;
  }
  function intelligenceReasons(doctor){
    const reasons=[],timing=doctorMeetingStatus(doctor),quality=doctorCompleteness(doctor),opportunity=productOpportunity(doctor),last=latestDoctorVisit(doctor.id,true),notMet=recentNotMetCount(doctor.id),eligibility=doctorEligibility(doctor),learned=learnedDoctorPattern(doctor);
    reasons.push(eligibility.reason);
    if(timing.state==='available')reasons.push('available now');else if(timing.state==='upcoming')reasons.push(timing.label.toLowerCase());else if(timing.state==='unset')reasons.push('meeting timing missing');
    if(doctor.nextFollowUp&&doctor.nextFollowUp<=localISODate())reasons.push('follow-up due');
    if(last){const gap=daysBetween(last.date,localISODate());if(gap>=15)reasons.push(`${gap} days since met`);}else reasons.push('no confirmed meeting history');
    if(notMet)reasons.push(`${notMet} recent not-met`);if(learned.samples)reasons.push(`learned ${Math.round(learned.metRate*100)}% meet rate (${learned.confidence})`);
    if(opportunity.level!=='normal')reasons.push(opportunity.label);if(quality.missing.length)reasons.push(`missing ${quality.missing.slice(0,2).join(' + ')}`);
    return reasons.slice(0,5);
  }
  function smartPatchCandidates(limit=10){
    return state.doctors.map(doctor=>({doctor,score:intelligenceScore(doctor),timing:doctorMeetingStatus(doctor),quality:doctorCompleteness(doctor),opportunity:productOpportunity(doctor),reasons:intelligenceReasons(doctor)})).filter(x=>x.score>-9000).sort((a,b)=>b.score-a.score||doctorDisplayName(a.doctor).localeCompare(doctorDisplayName(b.doctor))).slice(0,limit);
  }
  function replacementDoctor(excludeId){
    const anchor=latestPlanningAnchor(), candidates=smartPatchCandidates(80).filter(x=>x.doctor.id!==excludeId&&doctorEligibility(x.doctor).eligible&&!rowsForDay().some(v=>v.doctorId===x.doctor.id));
    const usable=candidates.filter(x=>num(x.doctor.latitude)&&num(x.doctor.longitude)&&['available','upcoming'].includes(x.timing.state));
    if(anchor&&usable.length){
      usable.sort((a,b)=>{const aNow=a.timing.state==='available'?0:1,bNow=b.timing.state==='available'?0:1;if(aNow!==bNow)return aNow-bNow;const ad=haversineKm(anchor.lat,anchor.lng,a.doctor.latitude,a.doctor.longitude),bd=haversineKm(anchor.lat,anchor.lng,b.doctor.latitude,b.doctor.longitude);return ad-bd||b.score-a.score;});
      return usable[0];
    }
    return usable[0]||candidates.find(x=>['available','upcoming'].includes(x.timing.state))||candidates[0]||null;
  }
  function addDynamicReplacementToTodayPatch(missedDoctor,replacement){
    if(!replacement?.doctor)return;
    let patch=[...state.patchPlans].reverse().find(p=>p.date===localISODate()&&['confirmed','dynamic'].includes(p.status));
    if(!patch){patch={id:uid('patch'),date:localISODate(),createdAt:new Date().toISOString(),status:'dynamic',items:[]};state.patchPlans.push(patch);}
    patch.items=Array.isArray(patch.items)?patch.items:[];
    patch.items=patch.items.filter(x=>x.doctorId!==missedDoctor.id);
    if(!patch.items.some(x=>x.doctorId===replacement.doctor.id))patch.items.push({order:patch.items.length+1,type:'Replacement',doctorId:replacement.doctor.id,doctorName:replacement.doctor.name,hospital:doctorHospital(replacement.doctor),timing:replacement.timing.label,score:Math.round(replacement.score),reason:`Auto replacement for ${missedDoctor.name} • nearest eligible ${replacement.timing.state==='available'?'available now':'today'}`,productAction:replacement.opportunity.label});
    patch.items.forEach((x,i)=>x.order=i+1);patch.updatedAt=new Date().toISOString();
  }
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
    openSheet('MR Machine','Learns locally from saved visit outcomes, weekday/time success, follow-ups and current foreground GPS. No background tracking or cloud AI.',`<div class="machine-summary-grid"><div><strong>${patch.length}</strong><small>Doctor calls</small></div><div><strong>${distributorStops.length}</strong><small>Distributor stops</small></div><div><strong>${q.complete}/${q.total}</strong><small>Verified data</small></div></div><div class="detail-section"><h4>Today smart patch</h4><div class="machine-patch-list">${patch.length?patch.map((x,i)=>`<div class="machine-patch-row"><span>${i+1}</span><div><strong>${esc(doctorDisplayName(x.doctor))}</strong><small>${esc(x.reasons.join(' • ')||x.timing.label)}</small><em>${esc(x.opportunity.label)}</em></div><button data-action="log-record" data-type="doctor" data-id="${esc(x.doctor.id)}">Meet</button></div>`).join(''):empty('No pending calls.')}</div></div><div class="detail-section"><h4>Accepted orders → distributor planning</h4>${distributorStops.length?distributorStops.map((x,i)=>`<div class="machine-reschedule"><strong>${i+1}. ${esc(x.distributor.name)} • ₹${esc(x.totalValue.toLocaleString('en-IN'))}</strong><small>${esc(`${x.orders.length} order(s) • ${x.chemists.join(', ')||'Chemist pending'} • ${x.address||'Address missing'}${x.mapReady?' • map ready':' • map pin missing'}`)}</small></div>`).join(''):empty('No accepted order is pending distributor fulfilment.')}</div><button id="confirmMachinePatchBtn" class="btn primary full">Confirm doctor + distributor plan</button><div class="detail-section"><h4>Pending reschedules</h4>${pending.length?pending.map(r=>`<div class="machine-reschedule"><strong>${esc(r.doctorName)}</strong><small>${esc(`${prettyDate(r.scheduledDate)} • ${timeLabel(r.meetingFrom)}–${timeLabel(r.meetingTo)} • ${r.reason}`)}</small></div>`).join(''):empty('No pending reschedule.')}</div><div class="detail-section"><h4>Data quality</h4><div class="quality-grid"><div><b>${q.missingHospital}</b><span>Hospital missing</span></div><div><b>${q.missingChemist}</b><span>Chemist missing</span></div><div><b>${q.missingTiming}</b><span>Timing missing</span></div><div><b>${q.missingGps}</b><span>GPS verification pending</span></div><div><b>${q.duplicates}</b><span>Possible duplicate</span></div></div></div>`);
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
      expenses: [],
      routePlans: [],
      patchPlans: [],
      reschedules: [],
      intelligenceLog: [],
      captures: [],
      visits: [],
      opening: {monthKey: monthKey(today), ...metricBlank()},
      imports: [],
      settings: {bundledImportAttempted:false, embeddedSeedLoaded:false, pinHash:'', installedHintSeen:false, workflowMode:'field', nearbyRadiusMeters:1000, lastSavedAt:'', recoveryCount:0}
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
      expenses: Array.isArray(raw?.expenses) ? raw.expenses : [],
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
    const parseStored = key => {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? migrateState(parsed) : null;
    };
    try {
      return parseStored(STORE_KEY) || makeDefaultState();
    } catch (_) {
      try {
        const recovered = parseStored(STORE_BACKUP_KEY);
        if (recovered) {
          recovered.settings.recoveryCount = num(recovered.settings.recoveryCount) + 1;
          return recovered;
        }
      } catch (_) {}
      return makeDefaultState();
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
      if (!state.settings) state.settings = {};
      state.settings.lastSavedAt = new Date().toISOString();
      const next = JSON.stringify(state);
      const previous = localStorage.getItem(STORE_KEY);
      if (previous && previous !== next) {
        try { JSON.parse(previous); localStorage.setItem(STORE_BACKUP_KEY, previous); } catch (_) {}
      }
      localStorage.setItem(STORE_KEY, next);
      if (render) renderAll();
      return true;
    } catch (error) {
      console.error('State save failed', error);
      try { toast('Could not save locally. Export a backup before continuing.'); } catch (_) {}
      return false;
    }
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
function expensesForDay(date=localISODate()){return state.expenses.filter(x=>String(x.date||'').slice(0,10)===date);}
function expenseTotal(date=localISODate()){return expensesForDay(date).reduce((n,x)=>n+num(x.amount),0);}
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
  const list=state.doctors.map(d=>({doctor:d,slot:todaySlot(d)})).filter(x=>x.slot&&num(x.doctor.latitude)&&num(x.doctor.longitude)&&doctorEligibility(x.doctor).eligible&&(includeVisited||!visited.has(x.doctor.id)));
  const remaining=[...list],route=[];let pLat=num(lat),pLng=num(lng),clock=now().getHours()*60+now().getMinutes();
  while(remaining.length){
    const ranked=remaining.map(x=>{const distance=haversineKm(pLat,pLng,x.doctor.latitude,x.doctor.longitude),travel=Math.max(4,Math.round(distance/24*60)),rawArrival=clock+travel,arrival=Math.max(rawArrival,x.slot.start),wait=Math.max(0,x.slot.start-rawArrival),late=Math.max(0,arrival-x.slot.end);return {...x,distance,travelMinutes:travel,arrivalMinutes:arrival,waitMinutes:wait,timingRisk:late>0,lateMinutes:late};}).sort((a,b)=>a.distance-b.distance||a.arrivalMinutes-b.arrivalMinutes);
    const chosen=ranked[0],idx=remaining.findIndex(x=>x.doctor.id===chosen.doctor.id);remaining.splice(idx,1);route.push(chosen);pLat=num(chosen.doctor.latitude);pLng=num(chosen.doctor.longitude);clock=chosen.arrivalMinutes+12;
  }
  return route;
}
function groupedHospitalRouteCandidates(lat,lng,includeVisited=false){
  const visited=new Set(rowsForDay().map(v=>v.doctorId).filter(Boolean)),groups=new Map();
  state.doctors.forEach(doctor=>{const slot=todaySlot(doctor);if(!slot||!num(doctor.latitude)||!num(doctor.longitude)||!doctorEligibility(doctor).eligible||(visited.has(doctor.id)&&!includeVisited))return;const key=doctor.placeId?`place:${doctor.placeId}`:`gps:${num(doctor.latitude).toFixed(4)},${num(doctor.longitude).toFixed(4)}:${norm(doctorHospital(doctor))}`;if(!groups.has(key))groups.set(key,{key,type:'hospital',hospital:doctorHospital(doctor)||doctorDisplayName(doctor),address:doctor.address||doctor.area||'',latitude:num(doctor.latitude),longitude:num(doctor.longitude),doctors:[]});groups.get(key).doctors.push({doctor,slot});});
  const remaining=[...groups.values()].map(g=>{g.doctors.sort((a,b)=>a.slot.end-b.slot.end||a.slot.start-b.slot.start);g.slot=g.doctors[0].slot;g.doctor=g.doctors[0].doctor;return g;}),route=[];let pLat=num(lat),pLng=num(lng),clock=now().getHours()*60+now().getMinutes();
  while(remaining.length){const ranked=remaining.map(stop=>{const distance=haversineKm(pLat,pLng,stop.latitude,stop.longitude),travel=Math.max(4,Math.round(distance/24*60)),rawArrival=clock+travel,arrival=Math.max(rawArrival,stop.slot.start),wait=Math.max(0,stop.slot.start-rawArrival),late=Math.max(0,arrival-stop.slot.end);return {...stop,distance,travelMinutes:travel,arrivalMinutes:arrival,waitMinutes:wait,timingRisk:late>0,lateMinutes:late};}).sort((a,b)=>a.distance-b.distance||a.arrivalMinutes-b.arrivalMinutes);const chosen=ranked[0],idx=remaining.findIndex(x=>x.key===chosen.key);remaining.splice(idx,1);route.push(chosen);pLat=chosen.latitude;pLng=chosen.longitude;clock=chosen.arrivalMinutes+Math.max(12,chosen.doctors.length*8);}
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
  return `<button class="nearby-place-card plain-button" data-nearby-place-id="${esc(x.id)}"><div class="nearby-place-distance">${esc(x.distanceKm.toFixed(2))}<small>km</small></div><div class="nearby-place-copy"><h3>${esc(x.name)}</h3><p>${esc(x.address||'Address unavailable')}</p><small>${esc(timingText)}${hours?` • ${esc(hours)}`:''}</small></div><span class="source-pill">Saved GPS</span></button>`;
}
function chooseNearbyHospital(place){
  if(!place)return;const linked=(place.doctorIds||[]).map(doctorById).filter(Boolean);
  openSheet(place.name,`${place.distanceKm.toFixed(2)} km away • saved master GPS`,`<div class="detail-section"><h4>Hospital details</h4><div class="note-box">${esc(place.address||'Address unavailable')}<br><a href="${mapUrl(place.latitude,place.longitude)}" target="_blank" rel="noopener">Open exact map</a></div></div><div class="detail-section"><h4>Which doctor do you want to meet?</h4><div id="nearbyDoctorResults">${linked.length?linked.map(d=>`<button class="mini-card plain-button" data-nearby-doctor-id="${d.id}"><span class="mini-icon">⚕</span><span class="mini-copy"><h3>${esc(d.name)}</h3><p>${esc([doctorMeetingStatus(d).label,linkedChemist(d)?.name].filter(Boolean).join(' • '))}</p></span></button>`).join(''):empty('No doctor is linked to this hospital yet. Search the accurate doctor below.')}</div><label class="search-box nearby-doctor-search"><span>⌕</span><input id="nearbyDoctorSearch" type="search" placeholder="Search accurate doctor name…"></label><div id="nearbyDoctorSearchResults" class="search-results lookup-results hidden"></div></div>`);
  const selectDoctor=id=>{const d=doctorById(id);if(!d)return;d.hospital=place.name;d.address=place.address||d.address;d.latitude=place.latitude;d.longitude=place.longitude;d.placeId=place.placeId||d.placeId||'';d.hospitalOpeningHours=place.openingHours||d.hospitalOpeningHours||[];d.locationSource='Saved/verified field GPS';d.locationCapturedAt=new Date().toISOString();d.updatedAt=new Date().toISOString();saveState(false);closeSheet();quickMeeting(d.id,'');toast('Hospital name and exact location linked to doctor.');};
  $('#nearbyDoctorResults').addEventListener('click',e=>{const b=e.target.closest('[data-nearby-doctor-id]');if(b)selectDoctor(b.dataset.nearbyDoctorId);});
  const input=$('#nearbyDoctorSearch'),results=$('#nearbyDoctorSearchResults');input.addEventListener('input',()=>{const q=clean(input.value).toLowerCase();if(!q){results.classList.add('hidden');return;}const list=state.doctors.filter(d=>[d.name,doctorHospital(d),d.area,d.address].join(' ').toLowerCase().includes(q)).slice(0,12);results.innerHTML=list.length?list.map(d=>`<button type="button" data-nearby-doctor-id="${d.id}"><strong>${esc(d.name)}</strong><small>${esc(doctorHospital(d)||'Hospital not linked')}</small></button>`).join(''):empty('No doctor match. Add the doctor first from Doctors.');results.classList.remove('hidden');});
  results.addEventListener('click',e=>{const b=e.target.closest('[data-nearby-doctor-id]');if(b)selectDoctor(b.dataset.nearbyDoctorId);});
}
function discoverNearbyHospitals(){
  nearbyPlaceCache.clear();const defaultRadius=num(state.settings.nearbyRadiusMeters)||1000;
  openSheet('Nearby hospitals','Stand at the location, fetch GPS, then select the hospital and accurate doctor.',`<div class="location-card"><div class="location-head"><div><strong>My current location</strong><small id="nearbyLocationStatus" class="location-status loading">Preparing GPS…</small></div><button type="button" id="nearbyFetchLocation" class="btn secondary compact">Fetch GPS</button></div><a id="nearbyLocationMap" class="hidden" target="_blank" rel="noopener">View my map</a><input id="nearbyLatitude" type="hidden"><input id="nearbyLongitude" type="hidden"><input id="nearbyAccuracy" type="hidden"><input id="nearbyCapturedAt" type="hidden"></div><div class="nearby-controls"><label><span>Search radius</span><select id="nearbyRadius"><option value="500" ${defaultRadius===500?'selected':''}>500 m</option><option value="1000" ${defaultRadius===1000?'selected':''}>1 km</option><option value="2000" ${defaultRadius===2000?'selected':''}>2 km</option><option value="5000" ${defaultRadius===5000?'selected':''}>5 km</option></select></label><button id="nearbyLiveSearchBtn" type="button" class="btn primary">Refresh saved nearby</button></div><small id="nearbyLiveStatus" class="muted-line">Uses only saved doctor/hospital GPS. No Maps/Places API required.</small><div id="nearbyResults">${empty('Fetching current location…')}</div>`);
  const renderSaved=()=>{const lat=num($('#nearbyLatitude').value),lng=num($('#nearbyLongitude').value),radius=num($('#nearbyRadius').value)||1000;if(!lat||!lng)return;state.settings.nearbyRadiusMeters=radius;saveState(false);const saved=savedHospitalGroups(lat,lng,radius);saved.forEach(x=>nearbyPlaceCache.set(x.id,x));$('#nearbyResults').innerHTML=saved.length?saved.map(nearbyResultCard).join(''):empty('No saved hospital GPS in this radius.');};
  document.addEventListener('mr-location-ready',e=>{if(e.detail.prefix==='nearby')renderSaved();},{once:true});
  $('#nearbyRadius').addEventListener('change',renderSaved);$('#nearbyResults').addEventListener('click',e=>{const b=e.target.closest('[data-nearby-place-id]');if(b)chooseNearbyHospital(nearbyPlaceCache.get(b.dataset.nearbyPlaceId));});
  $('#nearbyLiveSearchBtn').addEventListener('click',()=>{const lat=num($('#nearbyLatitude').value),lng=num($('#nearbyLongitude').value),radius=num($('#nearbyRadius').value)||1000;if(!lat||!lng){toast('Fetch current GPS first.');return;}state.settings.nearbyRadiusMeters=radius;saveState(false);const saved=savedHospitalGroups(lat,lng,radius);saved.forEach(x=>nearbyPlaceCache.set(x.id,x));$('#nearbyResults').innerHTML=saved.length?saved.map(nearbyResultCard).join(''):empty('No saved hospital GPS in this radius.');$('#nearbyLiveStatus').textContent=`${saved.length} saved hospital stop(s) in range.`;});
  setupLocationCapture('nearby',true);
}

  function renderAll() { renderHeader(); renderDashboard(); renderDoctors(); renderChemists(); renderVisits(); renderTools(); }
  function renderHeader() {
    $('#profileLine').textContent = `${state.profile.hq || 'My HQ'} • ${state.profile.tmName || 'My profile'}`;
    const h=now().getHours();
    $('#greeting').textContent = h<12?'Good morning':h<17?'Good afternoon':'Good evening';
    $('#todayLabel').textContent = now().toLocaleDateString('en-IN',{weekday:'short',day:'2-digit',month:'short'}).toUpperCase();
    $('#routeLabel').textContent = state.settings.workflowMode==='collect'?'Finish missing master data only when needed. Your normal field flow stays simple.':'Doctor calls, chemist work, POB, follow-ups and report — all from Today.';
    const saved=$('#lastSavedStatus');
    if(saved){const last=state.settings.lastSavedAt; saved.textContent=last?`Saved ${prettyTime(last)}`:'Offline ready';}
    const health=$('#saveHealth'); if(health) health.classList.toggle('recovered',num(state.settings.recoveryCount)>0);
  }
  function renderDashboard() {
    const today=localISODate(), t=statsForDay(today), c=statsForMonth(today);
    $('#reportPeriod').textContent=`Today / ${now().toLocaleDateString('en-IN',{month:'long'})} cumulative`;
    $('#reportKpis').innerHTML=METRICS.map(([k,label])=>`<div class="report-kpi"><small>${esc(label)}</small><strong>${esc(formatMetric(k,t[k]))} <span>/ ${esc(formatMetric(k,c[k]))}</span></strong></div>`).join('');
    $('#doctorCount').textContent=state.doctors.length;
    $('#chemistCount').textContent=state.chemists.length;
    $('#todayVisitCount').textContent=num(t.calls);
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
    $('#todayOrderCount').textContent=`${orders.length} ${orders.length===1?'order':'orders'}`;
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
    return `<article class="record-card"><div class="record-top"><div class="avatar">${esc(initials(r.name))}</div><div class="record-title"><h3>${esc(isDoctor?doctorDisplayName(r):r.name)}</h3><p>${esc(subtitle||'Details not added')}</p></div></div>${r.address?`<p class="record-note">${esc(r.address).slice(0,180)}</p>`:''}<div class="tag-row">${timingTag}${tags.slice(0,4).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div><div class="record-actions three">${map?`<a href="${map}" target="_blank" rel="noopener">Map</a>`:`<button data-action="edit-record" data-type="${type}" data-id="${r.id}">Add location</button>`}<button class="primary-action" data-action="${isDoctor?'log-record':'chemist-visit'}" data-type="${type}" data-id="${r.id}">${isDoctor?'Meet':'Visit'}</button><button data-action="view-record" data-type="${type}" data-id="${r.id}">View</button></div></article>`;
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
    window.scrollTo({top:0,behavior:'auto'});
    if(page==='doctors')renderDoctors(); if(page==='chemists')renderChemists(); if(page==='visits')renderVisits();
  }
  function openSheet(title,subtitle,body) {
    $('#sheetTitle').textContent=title; $('#sheetSubtitle').textContent=subtitle||''; $('#sheetBody').innerHTML=body;
    $('#sheetBackdrop').classList.remove('hidden'); $('#editorSheet').classList.remove('hidden'); document.body.style.overflow='hidden';
  }
  function closeSheet(){ if(window.AndroidBridge?.stopVoiceCapture)window.AndroidBridge.stopVoiceCapture();voiceHandlers?.clear?.();$('#sheetBackdrop').classList.add('hidden');$('#editorSheet').classList.add('hidden');document.body.style.overflow=''; }
  function toast(text){const el=$('#toast');el.textContent=text;el.classList.remove('hidden');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.add('hidden'),2600);}

  window.__mrHandleBack=()=>{
    if(!$('#editorSheet').classList.contains('hidden')){closeSheet();return true;}
    if(activePage!=='dashboard'){navigate('dashboard');return true;}
    return false;
  };

  function openWorkMenu(){
    openSheet('Field work','Choose what you are doing now.',`<div class="work-menu-grid"><button data-action="quick-log"><span>⚕</span><strong>Doctor visit</strong><small>Result + product feedback</small></button><button data-action="chemist-visit"><span>Rx</span><strong>Chemist visit</strong><small>Availability + follow-up</small></button><button data-action="new-order"><span>₹</span><strong>POB order</strong><small>Chemist → distributor</small></button><button data-action="nearby-hospitals"><span>◎</span><strong>Nearby hospitals</strong><small>Saved GPS only</small></button><button data-action="plan-route"><span>⌖</span><strong>Plan route</strong><small>Remaining eligible calls</small></button><button data-action="voice-capture"><span>🎙</span><strong>Voice capture</strong><small>Save field notes quickly</small></button><button data-action="expense"><span>₹</span><strong>Expense</strong><small>Travel / food / stay</small></button><button data-action="day-close"><span>✓</span><strong>Close day</strong><small>Review + share report</small></button></div>`);
  }

  function quickChemistVisit(chemistId=''){
    const selected=chemistById(chemistId)||null;
    if(!state.chemists.length){openSheet('Add chemist first','Save the shop once, then every visit is fast.',`<div class="note-box">No chemist is available yet.</div><div class="button-row"><button class="btn primary" data-action="add-chemist">Add chemist</button></div>`);return;}
    openSheet('Chemist visit','Availability, follow-up and quick field note.',`<form id="chemistVisitForm" class="sheet-form"><label><span>Chemist</span><select name="chemistId" required>${chemistOptions(selected?.id||'')}</select></label><div class="field-grid two"><label><span>New product availability</span><input name="newAvailability" type="number" min="0" step="1" value="0"></label><label><span>Conversation</span><input name="conversation" type="number" min="0" step="1" value="1"></label></div><label><span>Follow-up date (optional)</span><input name="followUpDate" type="date"></label><label><span>Visit note</span><textarea name="notes" rows="3" placeholder="Stock, order intent, retailer feedback or next action"></textarea></label><div class="chemist-visit-actions"><button type="button" class="btn secondary" id="chemistVisitOrderBtn">Create POB order</button><button type="submit" class="btn primary">Save chemist visit</button></div></form>`);
    const form=$('#chemistVisitForm');
    $('#chemistVisitOrderBtn').addEventListener('click',()=>{const id=clean(form.elements.chemistId.value);closeSheet();setTimeout(()=>quickOrderForChemist(id),80);});
    form.addEventListener('submit',e=>{e.preventDefault();if(form.dataset.saving==='1')return;const fd=new FormData(form),c=chemistById(fd.get('chemistId'));if(!c){toast('Select a chemist.');return;}form.dataset.saving='1';const date=localISODateTime(),followUpDate=clean(fd.get('followUpDate'));state.visits.push({id:uid('log'),date,entityType:'chemist',entityId:c.id,entityName:c.name,chemistId:c.id,chemistName:c.name,calls:0,inputs:0,basket:0,towel:0,conversation:num(fd.get('conversation')),newAvailability:num(fd.get('newAvailability')),pobValue:0,notes:clean(fd.get('notes')),followUpDate,productStatuses:{},createdAt:new Date().toISOString()});c.lastVisit=localISODate();if(followUpDate)c.nextFollowUp=followUpDate;c.updatedAt=new Date().toISOString();saveState();closeSheet();toast('Chemist visit saved.');});
  }

  function quickOrderForChemist(chemistId=''){
    quickOrder('',chemistId);
  }


  function quickExpense(){
    openSheet('Field expense','Log only what you may need for your claim.',`<form id="expenseForm" class="sheet-form"><div class="field-grid two"><label><span>Date</span><input name="date" type="date" required value="${localISODate()}"></label><label><span>Type</span><select name="type"><option>Travel</option><option>Food</option><option>Stay</option><option>Parking / Toll</option><option>Other</option></select></label></div><label><span>Amount ₹</span><input name="amount" type="number" min="0" step="0.01" required placeholder="0"></label><div class="field-grid two"><label><span>From (optional)</span><input name="from" placeholder="Area / station"></label><label><span>To (optional)</span><input name="to" placeholder="Area / station"></label></div><label><span>Note (optional)</span><textarea name="notes" rows="2" placeholder="Reason or claim reference"></textarea></label><button class="btn primary full" type="submit">Save expense</button></form>`);
    const form=$('#expenseForm');form.addEventListener('submit',e=>{e.preventDefault();if(form.dataset.saving==='1')return;const fd=new FormData(form),amount=num(fd.get('amount'));if(amount<=0){toast('Enter expense amount.');return;}form.dataset.saving='1';state.expenses.push({id:uid('exp'),date:`${clean(fd.get('date'))||localISODate()}T${pad(now().getHours())}:${pad(now().getMinutes())}`,type:clean(fd.get('type'))||'Other',amount,from:clean(fd.get('from')),to:clean(fd.get('to')),notes:clean(fd.get('notes')),createdAt:new Date().toISOString()});saveState();closeSheet();toast('Expense saved.');});
  }

  function openDayClose(){
    const t=statsForDay(),orders=ordersForDay(),expenses=expensesForDay(),due=dueEntities(),doctorRows=rowsForDay().filter(v=>v.doctorId),chemistRows=rowsForDay().filter(v=>v.entityType==='chemist'&&!v.doctorId);
    openSheet('Close day',now().toLocaleDateString('en-IN',{weekday:'long',day:'2-digit',month:'short'}),`<div class="day-close-grid"><div><small>CALLS</small><strong>${num(t.calls)}</strong></div><div><small>DOCTOR LOGS</small><strong>${doctorRows.length}</strong></div><div><small>CHEMIST VISITS</small><strong>${chemistRows.length}</strong></div><div><small>POB</small><strong>₹${orders.reduce((n,o)=>n+orderTotal(o),0).toLocaleString('en-IN')}</strong></div><div><small>EXPENSE</small><strong>₹${expenseTotal().toLocaleString('en-IN')}</strong></div><div><small>FOLLOW-UPS DUE</small><strong>${due.length}</strong></div></div><div class="note-box">Your data is saved locally. Use Full backup regularly, especially before changing phones or clearing app data.</div><div class="button-row"><button class="btn secondary" id="dayCloseCopyBtn">Copy daily report</button><button class="btn primary" id="dayCloseShareBtn">Share daily report</button></div>${expenses.length?`<div class="detail-section"><h4>Expenses today</h4>${expenses.map(x=>`<div class="expense-row"><span>${esc(x.type)}${x.from||x.to?` • ${esc([x.from,x.to].filter(Boolean).join(' → '))}`:''}</span><strong>₹${num(x.amount).toLocaleString('en-IN')}</strong></div>`).join('')}</div>`:''}`);
    $('#dayCloseCopyBtn').addEventListener('click',async()=>{const text=getReportText();try{if(window.AndroidBridge?.copyText)window.AndroidBridge.copyText(text);else await navigator.clipboard.writeText(text);toast('Daily report copied.');}catch(_){toast('Copy failed.');}});
    $('#dayCloseShareBtn').addEventListener('click',async()=>{const text=getReportText();try{if(window.AndroidBridge?.shareText)window.AndroidBridge.shareText('MR Daily Report',text);else if(navigator.share)await navigator.share({title:'MR Daily Report',text});}catch(e){if(e.name!=='AbortError')toast('Share cancelled.');}});
  }

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
    if(ok){plannerLocation={lat:num(latitude),lng:num(longitude),accuracy:Math.round(acc||0),capturedAt:new Date().toISOString(),source:'phone GPS'};}
    const status=$(`#${prefix}LocationStatus`),map=$(`#${prefix}LocationMap`),button=$(`#${prefix}FetchLocation`),lat=$(`#${prefix}Latitude`),lng=$(`#${prefix}Longitude`),accuracy=$(`#${prefix}Accuracy`),captured=$(`#${prefix}CapturedAt`);
    if(!status||!button){if(ok)document.dispatchEvent(new CustomEvent('mr-location-ready',{detail:{prefix,latitude,longitude,accuracy:Math.round(acc||0)}}));return;}
    if(ok){lat.value=latitude;lng.value=longitude;accuracy.value=Math.round(acc||0);captured.value=plannerLocation.capturedAt;status.textContent=`GPS ready • accuracy about ${Math.round(acc||0)} m`;status.className=acc>120?'location-status warning':'location-status success';map.href=mapUrl(latitude,longitude);map.classList.remove('hidden');button.textContent='Refresh GPS';document.dispatchEvent(new CustomEvent('mr-location-ready',{detail:{prefix,latitude,longitude,accuracy:Math.round(acc||0)}}));}
    else{status.textContent=error||'GPS unavailable. Tap Retry.';status.className='location-status error';button.textContent='Retry GPS';}
    button.disabled=false;
  };
  window.__mrAutoPlannerLocation=()=>{if(window.AndroidBridge?.fetchLocation)window.AndroidBridge.fetchLocation('planner');};


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
        plannerLocation={lat:num(latitude),lng:num(longitude),accuracy:Math.round(acc||0),capturedAt:new Date().toISOString(),source:'phone GPS'};
        lat.value=latitude;lng.value=longitude;accuracy.value=Math.round(acc||0);captured.value=plannerLocation.capturedAt;
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
    openSheet('Doctor visit','Choose doctor, record the result, update only what changed.',`
      <form id="meetingForm" class="sheet-form">
        ${voiceControlsHtml('meeting')}
        <div class="lookup-label field-block"><span class="field-caption">Search doctor or hospital</span>
          <div class="lookup-field">
            <input id="meetingDoctorSearch" type="search" autocomplete="off" placeholder="Type doctor or hospital name…" value="${esc(doctorDisplayName(doctor))}">
            <input id="meetingDoctorId" name="doctorId" type="hidden" value="${esc(doctor?.id||'')}">
            <div id="meetingDoctorResults" class="search-results lookup-results hidden"></div>
          </div>
        </div>
        <details class="schedule-card master-data-card flow-disclosure"><summary><span><strong>Doctor master details</strong><small>Open only if hospital, chemist or timing changed</small></span><b>EDIT</b></summary><div class="flow-disclosure-body">
          <div class="form-section-title"><h3>Hospital, pharmacy & doctor timing</h3><p>Change only what is different today. Saved details continue to auto-fill.</p></div>
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
        </div></details>
        <div id="meetingSummary">${meetingSummaryHtml(doctor,chemist)}</div>
        <details class="flow-disclosure location-flow"><summary><span><strong>Hospital GPS verification</strong><small>Optional • use only when confirming/changing location</small></span><b>GPS</b></summary><div class="location-card">
          <div class="location-head"><div><strong>Verify this hospital location</strong><small id="meetLocationStatus" class="location-status">GPS runs only when you tap Verify.</small></div><button type="button" id="meetFetchLocation" class="btn secondary compact">Verify hospital GPS</button></div>
          <div class="location-actions"><a id="meetLocationMap" class="hidden" target="_blank" rel="noopener">View captured map</a><label class="save-location-check"><input id="meetSaveLocation" type="checkbox"> Attach captured GPS to this record</label></div><label class="toggle-line master-location-line"><input id="meetUpdateDoctorLocation" type="checkbox" ${doctor&&!doctor.latitude?'checked':''}> Save as doctor/hospital verified location</label><small id="meetLocationAudit" class="muted-line">No background GPS and no attendance tracking. Location is used only for doctor/hospital data verification.</small>
          <input id="meetLatitude" type="hidden"><input id="meetLongitude" type="hidden"><input id="meetAccuracy" type="hidden"><input id="meetCapturedAt" type="hidden">
        </div></details>
        <div class="flow-step-label"><span>1</span><div><strong>Meeting result</strong><small>Tap one option. Not-met automatically suggests the next slot and replacement.</small></div></div>
        <input type="hidden" name="visitOutcome" value="met">
        <div id="meetingOutcomeSelector" class="outcome-selector">
          <button type="button" class="selected" data-outcome="met">Doctor met</button><button type="button" data-outcome="not_met">Not met</button><button type="button" data-outcome="leave">On leave</button><button type="button" data-outcome="ot">In OT</button><button type="button" data-outcome="closed">Hospital closed</button><button type="button" data-outcome="timing_changed">Timing changed</button>
        </div>
        <div id="notMetIntelligence" class="intelligence-preview hidden"></div>
        <label id="notMetReasonLabel" class="hidden"><span>Reason / receptionist update</span><input name="notMetReason" placeholder="Example: doctor will come Friday evening"></label>
        <div class="flow-step-label"><span>2</span><div><strong>Product feedback</strong><small>Previous status is remembered. Tap only what changed.</small></div></div>
        <div id="meetingProductRows" class="product-status-list">${productRows(remembered)}</div>
        <label><span>Short meeting note (optional)</span><textarea name="notes" rows="2" placeholder="Commitment or next action only"></textarea></label>
        <label><span>Follow-up date (optional)</span><input name="followUpDate" type="date"></label>
        <details class="more-fields order-panel"><summary>POB / Distributor order (optional)</summary><div class="order-panel-body"><label class="toggle-line"><input id="meetingOrderPlaced" name="orderPlaced" type="checkbox"> Order placed to distributor</label><label><span>Distributor</span><select name="distributorId">${distributorOptions(preferredDistributor(chemist)?.id||'')}</select></label><div id="meetingOrderItems" class="order-items">${orderItemRow({},0)}</div><button type="button" id="addMeetingOrderItem" class="btn secondary compact">+ Add product</button><div class="order-total-line"><span>Order / POB total</span><strong data-order-total>₹0</strong></div><label><span>Order note</span><textarea name="orderNote" rows="2" placeholder="Delivery, urgency or commitment"></textarea></label></div></details>
        <details class="more-fields"><summary>More daily report items (optional)</summary><div class="inline-metrics">${METRICS.filter(([k])=>k!=='calls'&&k!=='pobValue').map(([k,label])=>`<label><span>${esc(label)}</span><input name="${k}" type="number" min="0" step="1" value="0"></label>`).join('')}<label><span>Other POB Value</span><input name="pobValue" type="number" min="0" step="0.01" value="0"></label></div></details>
        <input name="date" type="hidden" value="${esc(localISODateTime())}">
        <div class="sticky-save"><button type="submit" class="btn primary full">Save doctor visit</button></div>
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
      const saveGps=$('#meetSaveLocation').checked, updateMasterLocation=$('#meetUpdateDoctorLocation').checked,currentLat=num($('#meetLatitude').value)||'',currentLng=num($('#meetLongitude').value)||'',orderPlaced=$('#meetingOrderPlaced').checked, orderItems=collectOrderItems($('#meetingOrderItems')), distributor=distributorById(fd.get('distributorId')), orderValue=orderItems.reduce((n,x)=>n+x.value,0);
      if(saveGps&&(!currentLat||!currentLng)){toast('Wait for GPS or tap Fetch GPS before saving.');return;}
      const oldHospitalLat=num(d.latitude)||'',oldHospitalLng=num(d.longitude)||'',distanceFromSaved=saveGps&&oldHospitalLat&&oldHospitalLng?Math.round(haversineKm(currentLat,currentLng,oldHospitalLat,oldHospitalLng)*1000):'';
      if(updateMasterLocation&&distanceFromSaved&&distanceFromSaved>500&&!confirm(`Current GPS is ${distanceFromSaved.toLocaleString('en-IN')} m from the saved hospital location. Replace the hospital master location?`))return;
      if(orderPlaced&&!distributor){toast('Select distributor for the order.');return;}
      if(orderPlaced&&!orderItems.length){toast('Add at least one ordered product.');return;}
      if(form.dataset.saving==='1')return;form.dataset.saving='1';const submitBtn=$('button[type="submit"]',form);if(submitBtn){submitBtn.disabled=true;submitBtn.textContent='Saving…';}
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
      d.lastAttempt=String(row.date).slice(0,10);if(outcome==='met'){d.lastVisit=d.lastAttempt;const ne=new Date(`${d.lastVisit}T00:00:00`);ne.setDate(ne.getDate()+15);d.nextEligibleDate=localISODate(ne);d.monthlyVisitLimit=2;d.minimumVisitGapDays=15;}d.updatedAt=new Date().toISOString();
      if(c){d.linkedChemistId=c.id;d.chemistName=c.name;if(outcome==='met')c.lastVisit=d.lastAttempt;c.updatedAt=new Date().toISOString();}
      if(row.followUpDate){d.nextFollowUp=row.followUpDate;if(c)c.nextFollowUp=row.followUpDate;}
      if(row.latitude&&row.longitude&&updateMasterLocation){d.latitude=row.latitude;d.longitude=row.longitude;d.locationAccuracy=row.locationAccuracy;d.locationCapturedAt=row.locationCapturedAt;d.locationSource='Visit GPS verified';row.hospitalLatitude=row.latitude;row.hospitalLongitude=row.longitude;row.distanceFromHospitalM=0;row.locationAuditStatus='Verified at hospital';}
      if(NOT_MET_OUTCOMES.has(outcome)&&replacement)addDynamicReplacementToTodayPatch(d,replacement);
      if(NOT_MET_OUTCOMES.has(outcome)){state.reschedules.filter(r=>r.doctorId===d.id&&r.status==='pending').forEach(r=>r.status='replaced');state.reschedules.push({id:uid('res'),doctorId:d.id,doctorName:d.name,hospital:doctorHospital(d),sourceVisitId:row.id,reason:notMetReason||OUTCOME_LABELS[outcome],createdAt:new Date().toISOString(),scheduledDate:nextSuggested?.date||row.followUpDate||'',scheduledDateTime:nextSuggested?.dateTime||'',meetingFrom:nextSuggested?.from||'',meetingTo:nextSuggested?.to||'',replacementDoctorId:replacement?.doctor.id||'',replacementDoctorName:replacement?doctorDisplayName(replacement.doctor):'',status:'pending'});}
      else state.reschedules.filter(r=>r.doctorId===d.id&&r.status==='pending').forEach(r=>r.status='completed');
      const learnedAfter=learnedDoctorPattern(d);state.intelligenceLog.push({id:uid('intel'),date:new Date().toISOString(),doctorId:d.id,doctorName:d.name,outcome,action:row.intelligenceAction,learning:{samples:learnedAfter.samples,metRate:learnedAfter.metRate,confidence:learnedAfter.confidence,bestDays:learnedAfter.bestDays,bestHours:learnedAfter.bestHours}});
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
function quickOrder(distributorId='',chemistId=''){
  if(!state.distributors.length){editDistributor();return;}
  const dist=distributorById(distributorId);
  openSheet('Accept distributor order','Accepted order automatically appears in today planning until marked fulfilled.',`<form id="quickOrderForm" class="sheet-form"><label><span>Chemist</span><select name="chemistId">${chemistOptions(chemistId)}</select></label><label><span>Distributor</span><select name="distributorId">${distributorOptions(dist?.id||'')}</select></label><label><span>Planning date</span><input name="planningDate" type="date" value="${localISODate()}"></label><div id="quickOrderItems" class="order-items">${orderItemRow({},0)}</div><button type="button" id="addQuickOrderItem" class="btn secondary compact">+ Add product</button><div class="order-total-line"><span>Total POB</span><strong data-order-total>₹0</strong></div><label><span>Order note</span><textarea name="notes" rows="2"></textarea></label><button class="btn primary full" type="submit">Accept order + add distributor to planning</button></form>`);
  const wrap=$('#quickOrderItems');bindOrderItems(wrap);$('#addQuickOrderItem').addEventListener('click',()=>{wrap.insertAdjacentHTML('beforeend',orderItemRow({},wrap.children.length));});const f=$('#quickOrderForm');f.addEventListener('submit',e=>{e.preventDefault();if(f.dataset.saving==='1')return;const fd=new FormData(f),c=chemistById(fd.get('chemistId')),d=distributorById(fd.get('distributorId')),items=collectOrderItems(wrap),total=items.reduce((n,x)=>n+x.value,0);if(!c||!d||!items.length){toast('Select chemist, distributor and product.');return;}f.dataset.saving='1';const sb=$('button[type="submit"]',f);if(sb){sb.disabled=true;sb.textContent='Saving…';}const date=localISODateTime(),order={id:uid('ord'),date,planningDate:clean(fd.get('planningDate'))||localISODate(),chemistId:c.id,chemistName:c.name,distributorId:d.id,distributorName:d.name,items,totalValue:total,status:'accepted',fulfilmentStatus:'pending',notes:clean(fd.get('notes')),createdAt:new Date().toISOString()};state.orders.push(order);state.visits.push({id:uid('log'),date,entityType:'chemist',entityId:c.id,entityName:c.name,chemistId:c.id,chemistName:c.name,calls:0,inputs:0,basket:0,towel:0,conversation:0,newAvailability:0,pobValue:total,notes:`Accepted POB order to ${d.name}${order.notes?`: ${order.notes}`:''}`,productStatuses:{},orderId:order.id,createdAt:new Date().toISOString()});c.linkedDistributorId=d.id;c.distributorName=d.name;c.lastVisit=localISODate();d.lastOrderDate=localISODate();saveState();closeSheet();toast('Order accepted. Distributor added to planning.');});
}
function viewOrder(id){
  const o=state.orders.find(x=>x.id===id);if(!o)return;const d=distributorById(o.distributorId),pending=orderNeedsDistributorVisit(o),map=d?entityMapUrl(d):'';
  openSheet('Distributor order',`${prettyDate(o.date)} • ${prettyTime(o.date)}`,`<div class="detail-grid"><div class="detail-box"><small>Chemist</small><strong>${esc(o.chemistName||'—')}</strong></div><div class="detail-box"><small>Distributor</small><strong>${esc(d?.name||o.distributorName||'—')}</strong></div><div class="detail-box"><small>Status</small><strong>${esc(o.status||'placed')} / ${esc(o.fulfilmentStatus||'pending')}</strong></div><div class="detail-box"><small>Planning</small><strong>${esc(prettyDate(o.planningDate||o.date))}</strong></div><div class="detail-box"><small>Total</small><strong>₹${esc(orderTotal(o).toLocaleString('en-IN'))}</strong></div><div class="detail-box"><small>Plan visibility</small><strong>${pending?'Shown in planning':'Completed / hidden'}</strong></div></div>${map?`<a class="map-main-btn" href="${map}" target="_blank" rel="noopener">Open distributor map</a>`:''}<div class="detail-section"><h4>Products</h4>${(o.items||[]).map(x=>`<div class="order-detail-row"><strong>${esc(x.product)} • ${esc(x.pack||'')}</strong><span>Qty ${esc(x.qty||0)} • ₹${esc(num(x.value).toLocaleString('en-IN'))}${x.schemeRatio?` • ${esc(x.schemeRatio)}`:''}</span></div>`).join('')||empty('No items')}</div>${o.notes?`<div class="detail-section"><h4>Note</h4><div class="note-box">${esc(o.notes)}</div></div>`:''}<div class="button-row"><button id="toggleOrderPlanBtn" class="btn secondary">${pending?'Mark fulfilled':'Add back to planning'}</button><button id="deleteOrderBtn" class="btn danger">Delete order</button></div>`);
  $('#toggleOrderPlanBtn').addEventListener('click',()=>{if(pending){o.fulfilmentStatus='completed';o.completedAt=new Date().toISOString();}else{o.status='accepted';o.fulfilmentStatus='pending';o.planningDate=localISODate();delete o.completedAt;}saveState();closeSheet();toast(pending?'Order fulfilled; distributor removed from planning.':'Distributor added back to planning.');});
  $('#deleteOrderBtn').addEventListener('click',()=>{if(!confirm('Delete order and its POB activity?'))return;state.orders=state.orders.filter(x=>x.id!==id);state.visits=state.visits.filter(v=>v.orderId!==id);saveState();closeSheet();});
}
function planTodayRoute(){
  const eligible=state.doctors.filter(d=>todaySlot(d)&&num(d.latitude)&&num(d.longitude)&&doctorEligibility(d).eligible),distributorStops=pendingDistributorStops();
  openSheet('Today dynamic patch','Current phone GPS → strict nearest eligible hospital chain. Meeting timing is shown as a warning; it does not silently reorder a farther stop. No Maps API is required.',`<div class="location-card"><div class="location-head"><div><strong>Planning start</strong><small id="routeLocationStatus" class="location-status loading">Fetching current GPS…</small></div><button type="button" id="routeFetchLocation" class="btn secondary compact">Refresh GPS</button></div><a id="routeLocationMap" class="hidden" target="_blank" rel="noopener">View current point</a><input id="routeLatitude" type="hidden"><input id="routeLongitude" type="hidden"><input id="routeAccuracy" type="hidden"><input id="routeCapturedAt" type="hidden"></div><label class="toggle-line"><input id="includeVisitedRoute" type="checkbox"> Include doctors already attempted today</label><div id="routeResult">${eligible.length?empty('Waiting for current GPS…'):empty('No eligible doctor has both today timing and saved GPS.')}</div><div id="distributorPlanResult"></div>`);
  const renderDistributors=()=>{$('#distributorPlanResult').innerHTML=`<div class="detail-section"><h4>Accepted-order distributor stops</h4>${distributorStops.length?distributorStops.map((x,i)=>`<div class="route-stop ${x.mapReady?'':'route-risk'}"><span>${i+1}</span><div><strong>${esc(x.distributor.name)}</strong><small>${esc(`₹${x.totalValue.toLocaleString('en-IN')} • ${x.orders.length} order(s) • ${x.chemists.join(', ')||'Chemist pending'} • ${x.address||'Address missing'}${x.mapReady?' • GPS ready':' • GPS missing'}`)}</small></div></div>`).join(''):empty('No accepted order is pending fulfilment.')}</div>`;};
  const render=()=>{let lat=num($('#routeLatitude').value),lng=num($('#routeLongitude').value),source='phone GPS';if(!lat||!lng){const anchor=latestPlanningAnchor();if(anchor){lat=anchor.lat;lng=anchor.lng;source=anchor.source;}else return;}const route=groupedHospitalRouteCandidates(lat,lng,$('#includeVisitedRoute').checked);$('#routeResult').innerHTML=route.length?`<div class="notice">Start: ${esc(source)}. ${route.length} eligible stop(s). Doctors already at 2/2 this month or inside the 15-day successful-visit lock are excluded automatically.</div><div class="route-list">${route.map((x,i)=>`<div class="route-stop ${x.timingRisk?'route-risk':''}"><span>${i+1}</span><div><strong>${esc(x.hospital)}</strong><small>${esc(`${x.doctors.map(y=>doctorDisplayName(y.doctor)).join(', ')} • ETA ${minuteLabel(x.arrivalMinutes)} • ${x.distance.toFixed(1)} km straight-line • ${x.waitMinutes?`wait ${x.waitMinutes} min • `:''}${x.timingRisk?`timing risk +${x.lateMinutes} min • `:''}${doctorEligibility(x.doctor).reason}`)}</small></div><button data-action="log-record" data-type="doctor" data-id="${x.doctor.id}">Meet</button></div>`).join('')}</div><button id="saveRoutePlanBtn" class="btn primary full">Save dynamic patch</button>`:empty('No remaining eligible doctor is available with today timing and saved GPS.');$('#saveRoutePlanBtn')?.addEventListener('click',()=>{state.routePlans.push({id:uid('route'),date:localISODate(),createdAt:new Date().toISOString(),startDoctorId:'',startDoctorName:source,startLatitude:lat,startLongitude:lng,source:'Current GPS + strict nearest saved doctor GPS + 15-day/2-visit eligibility + timing warnings',stops:[...route.map((x,i)=>({order:i+1,type:'Hospital',doctorId:x.doctor.id,doctorName:x.doctors.map(y=>y.doctor.name).join('; '),hospital:x.hospital,meetingFrom:x.slot.from,meetingTo:x.slot.to,estimatedArrival:minuteLabel(x.arrivalMinutes),travelMinutes:x.travelMinutes,waitMinutes:x.waitMinutes,timingRisk:x.timingRisk?'Yes':'No',locationAccuracy:x.doctor.locationAccuracy||'',locationSource:x.doctor.locationSource||'Saved doctor GPS',latitude:x.latitude,longitude:x.longitude,distanceKm:Number(x.distance.toFixed(2))})),...distributorStops.map((x,i)=>({order:route.length+i+1,type:'Distributor',doctorName:'',hospital:x.distributor.name,meetingFrom:'',meetingTo:'',estimatedArrival:'Flexible',travelMinutes:'',waitMinutes:'',timingRisk:x.mapReady?'No':'GPS missing',locationAccuracy:'',locationSource:x.mapReady?'Saved distributor GPS':'Address only',latitude:x.latitude||'',longitude:x.longitude||'',distanceKm:''}))]});saveState(false);toast('Dynamic patch saved.');});};
  renderDistributors();$('#includeVisitedRoute').addEventListener('change',render);document.addEventListener('mr-location-ready',e=>{if(e.detail.prefix==='route')render();},{once:true});setupLocationCapture('route',true);setTimeout(()=>{if(!num($('#routeLatitude')?.value)||!num($('#routeLongitude')?.value))render();},1300);
}

function workbookData(){
  const latestRoute=state.routePlans.filter(r=>r.date===localISODate()).slice(-1)[0];
  return {sheets:[
    {name:'Summary',rows:[['MR FieldFlow Export',localISODateTime()],['HQ',state.profile.hq],['TM',state.profile.tmName],['Doctors',state.doctors.length],['Chemists',state.chemists.length],['Distributors',state.distributors.length],['Orders',state.orders.length],['Expenses',state.expenses.length],['Voice Captures',state.captures.length],['Active Schemes',state.schemes.filter(x=>schemeState(x)==='active').length],[],['Metric','Today','Month Cumulative'],...METRICS.map(([k,l])=>[l,statsForDay()[k],statsForMonth()[k]])]},
    {name:'Doctors',rows:[['Doctor Name','Hospital / Clinic','Google Place ID','Hospital Opening Hours','Under Chemist','Meeting Days','Meeting From 1','Meeting To 1','Meeting From 2','Meeting To 2','Address','Area','Latitude','Longitude','Location Source','Last Meeting','Next Follow-up','Notes'],...state.doctors.map(d=>[d.name,doctorHospital(d),d.placeId||'',(d.hospitalOpeningHours||[]).join('; '),linkedChemist(d)?.name||d.chemistName,normalizeMeetingDays(d.meetingDays).map(x=>DAY_NAMES[x]).join('; '),d.meetingFrom,d.meetingTo,d.meetingFrom2,d.meetingTo2,d.address,d.area,d.latitude,d.longitude,d.locationSource||'',d.lastVisit,d.nextFollowUp,d.notes])]},
    {name:'Chemists',rows:[['Chemist Name','Preferred Distributor','Address','Area','Latitude','Longitude','Last Meeting','Next Follow-up','Notes'],...state.chemists.map(c=>[c.name,preferredDistributor(c)?.name||c.distributorName,c.address,c.area,c.latitude,c.longitude,c.lastVisit,c.nextFollowUp,c.notes])]},
    {name:'Distributors',rows:[['Distributor Name','Mobile','Address','Area','Latitude','Longitude','Last Order','Notes'],...state.distributors.map(d=>[d.name,d.mobile,d.address,d.area,d.latitude,d.longitude,d.lastOrderDate,d.notes])]},
    {name:'Orders',rows:[['Date','Doctor','Hospital','Chemist','Distributor','Products','Packs','Quantities','Schemes','POB Value','Status','Notes','Latitude','Longitude'],...state.orders.map(o=>[o.date,o.doctorName,o.doctorHospital,o.chemistName,distributorById(o.distributorId)?.name||o.distributorName,(o.items||[]).map(x=>x.product).join('; '),(o.items||[]).map(x=>x.pack).join('; '),(o.items||[]).map(x=>x.qty).join('; '),(o.items||[]).map(x=>x.schemeRatio).join('; '),orderTotal(o),o.status,o.notes,o.latitude,o.longitude])]},
    {name:'Expenses',rows:[['Date','Type','Amount','From','To','Notes'],...state.expenses.map(x=>[x.date,x.type,x.amount,x.from,x.to,x.notes])]},
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
  function sanTokens(value){
    return String(value||'').replace(/\r/g,'\n').split(/\n|\t/).map(x=>clean(x.replace(/^\*\*|\*\*$/g,''))).filter(Boolean);
  }
  function sanHospitalScore(value){
    const v=clean(value);if(!v)return -99;let score=0;
    if(SAN_HOSPITAL_PATTERN.test(v))score+=8;
    if(!/\d/.test(v))score+=2;
    if(v.length<=75)score+=1;
    if(SAN_ADDRESS_PATTERN.test(v))score-=3;
    if(/^[A-Z .&'-]{3,}$/i.test(v))score+=1;
    return score;
  }
  function splitSanMidFields(values){
    const mid=(values||[]).map(clean).filter(Boolean);
    if(!mid.length)return {address:'',hospital:'',hospitalAddress:'',confidence:'low'};
    let best=-1,bestScore=-99;
    mid.forEach((v,i)=>{const score=sanHospitalScore(v);if(score>bestScore){best=i;bestScore=score;}});
    let hospital='',hospitalAddress='',address='',confidence='medium';
    if(bestScore>=6){
      hospital=mid[best];
      address=mid.slice(0,best).join(', ');
      hospitalAddress=mid.slice(best+1).join(', ');
      confidence=bestScore>=9?'high':'medium';
    }else if(mid.length===1){
      if(SAN_ADDRESS_PATTERN.test(mid[0]))address=mid[0];else hospital=mid[0];
      confidence='low';
    }else{
      // Be conservative: without a hospital/clinic keyword, never invent a hospital name.
      // SAN often omits empty Hospital Name cells, leaving personal and hospital addresses adjacent.
      hospital='';
      address=mid[0]||'';
      hospitalAddress=mid.slice(1).join(', ');
      confidence='low';
    }
    if(!hospitalAddress&&hospital&&address&&best===0)hospitalAddress=address;
    return {address,hospital,hospitalAddress,confidence};
  }
  function sanPhones(values){
    const out=[],invalid=[];
    for(const raw of values||[]){
      const value=clean(raw),digits=value.replace(/\D/g,'');
      if(!digits)continue;
      const parts=value.split(/[\/,&\s]+/).map(x=>x.replace(/\D/g,'')).filter(Boolean);
      let found=false;
      for(const p of parts){if(/^[6-9]\d{9}$/.test(p)){out.push(p);found=true;}}
      if(!found&&digits.length===10&&/^[6-9]/.test(digits)){out.push(digits);found=true;}
      if(!found&&digits.length>=8)invalid.push(value);
    }
    return {valid:[...new Set(out)],invalid:[...new Set(invalid)]};
  }
  function normalizeSanBrand(value){return clean(value).replace(/\s+/g,' ').toUpperCase();}
  function parseSanDoctorSection(sectionText,speciality,repName){
    const tokens=sanTokens(sectionText);
    const headerEnd=Math.max(tokens.lastIndexOf('Focus Brand 5'),tokens.lastIndexOf('Focus Brand 4'),tokens.lastIndexOf('Focus Brand 3'));
    const body=headerEnd>=0?tokens.slice(headerEnd+1):tokens;
    const anchors=[];body.forEach((v,i)=>{if(norm(v)===norm(repName))anchors.push(i);});
    const records=[];
    for(let a=0;a<anchors.length;a++){
      const start=anchors[a],end=a+1<anchors.length?anchors[a+1]:body.length;
      const row=body.slice(start,end);
      const designation=clean(row[1]),hq=clean(row[2]),name=clean(row[3]),qualification=clean(row[4]);
      if(!name||!designation||!hq||SAN_SPECIALTIES.includes(name.toUpperCase()))continue;
      const specIndex=row.findIndex((v,i)=>i>4&&SAN_SPECIALTIES.includes(clean(v).toUpperCase()));
      if(specIndex<0)continue;
      const detectedSpeciality=clean(row[specIndex]).toUpperCase()||speciality;
      let cursor=specIndex+1;
      const category=/^(?:C|NC)$/i.test(row[cursor]||'')?clean(row[cursor++]):'';
      const doctorClass=SAN_CLASSES.includes(clean(row[cursor]).toUpperCase())?clean(row[cursor++]).toUpperCase():'';
      const area=clean(row[cursor++]||'');
      const town=clean(row[cursor++]||'');
      const townType=/^(?:HQ|EX)$/i.test(row[cursor]||'')?clean(row[cursor++]).toUpperCase():'';
      const mid=splitSanMidFields(row.slice(5,specIndex));
      const tail=row.slice(cursor);
      const phoneInfo=sanPhones(tail);
      const email=clean(tail.find(v=>/@/.test(v))||'');
      const invalidEmail=email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      const focusBrands=[...new Set(tail.filter(v=>SAN_BRAND_PATTERN.test(v)).map(normalizeSanBrand))];
      const mobile=phoneInfo.valid.join('/');
      const issues=[];
      if(!mid.hospital)issues.push('Hospital missing');
      if(!mid.hospitalAddress&&!mid.address)issues.push('Address missing');
      if(phoneInfo.invalid.length)issues.push('Mobile needs review');
      if(invalidEmail)issues.push('Email needs review');
      records.push({
        name,qualification,hospital:mid.hospital,address:mid.address,hospitalAddress:mid.hospitalAddress,
        hq,area:area||town,town,townType,speciality:detectedSpeciality,category,doctorClass,
        mobile,email:invalidEmail?'':email,rawMobile:phoneInfo.invalid.join(' / '),rawEmail:invalidEmail?email:'',focusBrands,
        meetingDays:[],meetingFrom:'',meetingTo:'',linkedChemistId:'',chemistName:'',latitude:'',longitude:'',
        locationVerificationStatus:'pending',locationSource:'SAN copied address',sanConfidence:mid.confidence,
        sanIssues:issues,sourceFiles:['SAN copied doctor master'],tags:['SAN',detectedSpeciality]
      });
    }
    return records;
  }
  function parseSanDoctorMaster(text){
    const source=String(text||'').replace(/\r/g,'');
    const heading=/Listed Doctor Details\s*\(Rep:\s*([^/\n]+?)\s*\/\s*Speciality:\s*([A-Z]+)\)/gi;
    const matches=[...source.matchAll(heading)],doctors=[];let detectedRep='',detectedHq='';
    matches.forEach((m,i)=>{
      const rep=clean(m[1]),speciality=clean(m[2]).toUpperCase(),start=m.index+m[0].length,end=i+1<matches.length?matches[i+1].index:source.length;
      detectedRep=detectedRep||rep;
      doctors.push(...parseSanDoctorSection(source.slice(start,end),speciality,rep));
    });
    const seen=new Map(),duplicates=[];
    doctors.forEach((d,i)=>{
      detectedHq=detectedHq||d.hq;
      const key=`${norm(d.name)}|${norm(d.hospital)}|${norm(d.town||d.area)}`;
      if(seen.has(key))duplicates.push({first:seen.get(key),duplicate:i,key});else seen.set(key,i);
    });
    const unique=doctors.filter((_,i)=>!duplicates.some(x=>x.duplicate===i));
    const counts={};SAN_SPECIALTIES.forEach(x=>counts[x]=0);unique.forEach(d=>counts[d.speciality]=(counts[d.speciality]||0)+1);
    const issues={missingHospital:unique.filter(d=>!d.hospital).length,missingAddress:unique.filter(d=>!d.hospitalAddress&&!d.address).length,invalidMobile:unique.filter(d=>d.rawMobile).length,invalidEmail:unique.filter(d=>d.rawEmail).length,duplicates:duplicates.length};
    return {repName:detectedRep,hq:detectedHq,doctors:unique,rawCount:doctors.length,counts,issues,duplicates};
  }
  function sanBulkSummaryHtml(parsed){
    const countPills=Object.entries(parsed.counts).filter(([,v])=>v).map(([k,v])=>`<span><b>${esc(v)}</b>${esc(k)}</span>`).join('');
    const issueTotal=Object.values(parsed.issues).reduce((a,b)=>a+num(b),0);
    const samples=parsed.doctors.slice(0,8).map(d=>`<div class="san-bulk-row"><div><strong>${esc(d.name)}</strong><small>${esc([d.speciality,d.hospital||'Hospital pending',d.town||d.area].filter(Boolean).join(' • '))}</small></div><em class="${d.sanIssues.length?'review':'ready'}">${d.sanIssues.length?`${d.sanIssues.length} review`:'Ready'}</em></div>`).join('');
    return `<div class="san-bulk-hero"><small>SAN DOCTOR MASTER DETECTED</small><strong>${esc(parsed.doctors.length)} doctors ready for review</strong><p>${esc(parsed.repName||'Rep not detected')} • ${esc(parsed.hq||'HQ not detected')}</p></div><div class="san-count-pills">${countPills}</div><div class="san-bulk-metrics"><div><b>${esc(parsed.doctors.length)}</b><span>Unique doctors</span></div><div><b>${esc(issueTotal)}</b><span>Review flags</span></div><div><b>${esc(parsed.issues.duplicates)}</b><span>Duplicates merged</span></div><div><b>${esc(parsed.issues.missingHospital)}</b><span>Hospital missing</span></div><div><b>${esc(parsed.issues.invalidMobile)}</b><span>Mobile review</span></div><div><b>${esc(parsed.issues.invalidEmail)}</b><span>Email review</span></div></div><div class="detail-section"><h4>Import preview</h4><div class="san-bulk-list">${samples}</div>${parsed.doctors.length>8?`<small class="muted-line">+ ${esc(parsed.doctors.length-8)} more doctors</small>`:''}</div><div class="notice">Doctor, qualification, hospital/address, speciality, category/class and focus brands will be imported. This SAN list has no chemist mapping, meeting timing or GPS, so those fields stay pending. Profile name/HQ will not be overwritten automatically.</div>`;
  }
  function importSanDoctorMaster(parsed){
    const result={added:0,updated:0,products:0,review:0};
    parsed.doctors.forEach(rec=>{
      const mapped={...rec,address:clean(rec.hospitalAddress||rec.address),doctorAddress:clean(rec.address),hospitalAddress:clean(rec.hospitalAddress),notes:rec.sanIssues.length?`SAN import review: ${rec.sanIssues.join('; ')}`:'',campaign:'SAN Doctor Master'};
      const r=upsertDoctor(mapped);result[r.mode==='added'?'added':'updated']++;
      rec.focusBrands.forEach(name=>{if(upsertProduct(name))result.products++;});
      if(rec.sanIssues.length)result.review++;
    });
    state.imports.push({id:uid('imp'),file:'SAN copied doctor master',date:new Date().toISOString(),summary:`${result.added} doctors added, ${result.updated} updated, ${result.review} need review, ${result.products} focus brands added.`});
    saveState();return result;
  }

  function sanDetectedHtml(parsed){
    const timing=[parsed.meetingFrom&&parsed.meetingTo?`${timeLabel(parsed.meetingFrom)}–${timeLabel(parsed.meetingTo)}`:'',parsed.meetingFrom2&&parsed.meetingTo2?`${timeLabel(parsed.meetingFrom2)}–${timeLabel(parsed.meetingTo2)}`:''].filter(Boolean).join(' / ');
    const days=parsed.meetingDays?.length?parsed.meetingDays.map(x=>DAY_NAMES[x]).join(', '):'Not detected';
    const products=Object.entries(parsed.productStatuses||{}).filter(([,v])=>v).map(([k,v])=>`${k}: ${statusLabel(v)}`).join(' • ')||'No product status detected';
    return `<div class="san-detected-grid"><div><small>Doctor</small><strong>${esc(parsed.doctorName||'Not detected')}</strong></div><div><small>Hospital</small><strong>${esc(parsed.hospital||'Not detected')}</strong></div><div><small>Chemist</small><strong>${esc(parsed.chemistName||'Not detected')}</strong></div><div><small>Distributor</small><strong>${esc(parsed.distributorName||'Not detected')}</strong></div><div><small>Meeting</small><strong>${esc(`${days}${timing?` • ${timing}`:''}`)}</strong></div><div><small>POB</small><strong>${parsed.pobValue?`₹${esc(parsed.pobValue.toLocaleString('en-IN'))}`:'Not detected'}</strong></div></div><div class="note-box san-product-detection"><strong>Product detection</strong><br>${esc(products)}</div>`;
  }

  function openSanClipboardReview(text){
    text=String(text||'').trim();if(!text){toast('No copied SAN text found.');return;}
    if(isSanBulkDoctorText(text)){
      let parsed=parseSanDoctorMaster(text);
      openSheet('Import SAN doctor master','Bulk list detected. Review counts and quality flags before importing.',`<div id="sanBulkSummary">${sanBulkSummaryHtml(parsed)}</div><details class="form-disclosure"><summary>View or correct copied text</summary><label class="field-block"><span class="field-caption">Copied SAN doctor list</span><textarea id="sanClipboardText" rows="9">${esc(text)}</textarea></label></details><div class="button-row"><button id="sanReparseBtn" class="btn secondary">Re-scan list</button><button id="sanSaveInboxBtn" class="btn secondary">Save raw capture</button></div><button id="sanBulkImportBtn" class="btn primary full">Import ${esc(parsed.doctors.length)} doctors</button><div class="notice">Import merges exact doctor + hospital + town matches. Existing meetings, chemist links and verified GPS are preserved.</div>`);
      const raw=()=>String($('#sanClipboardText').value||'').trim();
      $('#sanReparseBtn').addEventListener('click',()=>{parsed=parseSanDoctorMaster(raw());$('#sanBulkSummary').innerHTML=sanBulkSummaryHtml(parsed);$('#sanBulkImportBtn').textContent=`Import ${parsed.doctors.length} doctors`;haptic();});
      $('#sanSaveInboxBtn').addEventListener('click',()=>{const value=raw();if(!value){toast('Paste text first.');return;}state.captures.push({id:uid('cap'),date:new Date().toISOString(),source:'SAN bulk doctor master',transcript:value,parsed:{bulk:true,count:parsed.doctors.length,counts:parsed.counts,issues:parsed.issues},loggedMeeting:false});saveState();haptic('strong');toast('Raw SAN list saved to capture inbox.');});
      $('#sanBulkImportBtn').addEventListener('click',()=>{parsed=parseSanDoctorMaster(raw());if(!parsed.doctors.length){toast('No doctor rows detected.');return;}const result=importSanDoctorMaster(parsed);closeSheet();haptic('strong');navigate('doctors');toast(`${result.added} doctors added, ${result.updated} updated. ${result.review} need review.`);});
      return;
    }
    const parsed=parseVoiceDetails(text);
    openSheet('Review SAN copied details','Nothing is saved until you confirm. Detected values can be checked in one place.',`<div id="sanDetectedSummary">${sanDetectedHtml(parsed)}</div><label class="field-block"><span class="field-caption">Copied SAN text</span><textarea id="sanClipboardText" rows="7">${esc(text)}</textarea></label><div class="button-row"><button id="sanReparseBtn" class="btn secondary">Re-detect details</button><button id="sanSaveInboxBtn" class="btn secondary">Save to capture inbox</button></div><button id="sanUseMeetingBtn" class="btn primary full">Use these details in Log Meeting</button><div class="notice">Single-doctor flow: SAN text Copy → return to MR → paste clipboard → Review → Log Meeting.</div>`);
    const raw=()=>clean($('#sanClipboardText').value);
    $('#sanReparseBtn').addEventListener('click',()=>{$('#sanDetectedSummary').innerHTML=sanDetectedHtml(parseVoiceDetails(raw()));haptic();});
    $('#sanSaveInboxBtn').addEventListener('click',()=>{const value=raw(),details=parseVoiceDetails(value);if(!value){toast('Paste text first.');return;}state.captures.push({id:uid('cap'),date:new Date().toISOString(),source:'SAN clipboard paste',transcript:value,doctorId:details.doctorId||'',doctorName:details.doctorName||'',hospital:details.hospital||'',chemistId:details.chemistId||'',chemistName:details.chemistName||'',parsed:details,loggedMeeting:false});saveState();closeSheet();haptic('strong');toast('SAN details saved to capture inbox.');});
    $('#sanUseMeetingBtn').addEventListener('click',()=>{const value=raw(),details=parseVoiceDetails(value);if(!value){toast('Paste text first.');return;}pendingSanClipboardText=value;closeSheet();haptic('strong');setTimeout(()=>quickMeeting(details.doctorId||'',details.chemistId||''),100);});
  }


  function restoreObject(obj){if(!obj||!Array.isArray(obj.doctors)||!Array.isArray(obj.chemists)||!Array.isArray(obj.visits))throw new Error('Not a valid MR Machine backup.');state=migrateState(obj);}
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
      const a=e.target.closest('[data-action]');if(a){const action=a.dataset.action,type=a.dataset.type,id=a.dataset.id;if(action==='work-menu')openWorkMenu();if(action==='expense')quickExpense();if(action==='day-close')openDayClose();if(action==='quick-log'||action==='add-visit'){if(!$('#editorSheet').classList.contains('hidden'))closeSheet();setTimeout(()=>quickMeeting(),30);}if(action==='chemist-visit'){const cid=id||a.dataset.chemistId||'';if(!$('#editorSheet').classList.contains('hidden'))closeSheet();setTimeout(()=>quickChemistVisit(cid),30);}if(action==='add-doctor')editRecord('doctor');if(action==='add-chemist')editRecord('chemist');if(action==='log-record'){if(type==='doctor')quickMeeting(id,'');else quickMeeting('',id);}if(action==='edit-record')editRecord(type,id);if(action==='view-record')viewRecord(type,id);if(action==='view-visit')viewVisit(id);if(action==='add-distributor')editDistributor();if(action==='edit-distributor')editDistributor(id);if(action==='manage-distributors')manageDistributors();if(action==='add-scheme')editScheme();if(action==='edit-scheme')editScheme(id);if(action==='manage-schemes')manageSchemes();if(action==='new-order')quickOrder(a.dataset.distributorId||'');if(action==='view-order')viewOrder(id);if(action==='plan-route')planTodayRoute();if(action==='nearby-hospitals')discoverNearbyHospitals();if(action==='voice-capture')voiceDataCapture();return;}
      const dc=e.target.closest('[data-doctor-chip]');if(dc){doctorFilter=dc.dataset.doctorChip;renderDoctors();return;}
      const cc=e.target.closest('[data-chemist-chip]');if(cc){chemistFilter=cc.dataset.chemistChip;renderChemists();return;}
      const vf=e.target.closest('[data-visit-filter]');if(vf){visitFilter=vf.dataset.visitFilter;renderVisits();return;}
      if(e.target.closest('[data-filter-followups="due"]')){visitFilter='due';navigate('visits');}
    });
    $('#sheetBackdrop').addEventListener('click',closeSheet);$('#quickLogBtn').addEventListener('click',openWorkMenu);$('#quickSearchBtn').addEventListener('click',globalSearch);
    $('#doctorSearch').addEventListener('input',renderDoctors);$('#chemistSearch').addEventListener('input',renderChemists);
    $('#doctorFilterBtn').addEventListener('click',()=>{doctorFilter=doctorFilter==='unlinked'?'all':'unlinked';renderDoctors();});
    $('#stockFilterBtn').addEventListener('click',()=>{chemistFilter=chemistFilter==='feedback'?'all':'feedback';renderChemists();});
    $('#workflowModeBtn').addEventListener('click',()=>{state.settings.workflowMode=state.settings.workflowMode==='collect'?'field':'collect';saveState();toast(state.settings.workflowMode==='collect'?'Data gathering mode active.':'Field work mode active.');});
    $('#machineOpenBtn').addEventListener('click',openIntelligenceCenter);$('#companyReportPackBtn').addEventListener('click',exportCompanyReportPack);
    $('#nearbyHospitalBtn')?.addEventListener('click',discoverNearbyHospitals);$('#planRouteBtn')?.addEventListener('click',planTodayRoute);$('#newOrderBtn')?.addEventListener('click',()=>quickOrder());$('#manageDistributorsBtn').addEventListener('click',manageDistributors);$('#manageSchemesBtn').addEventListener('click',manageSchemes);$('#exportXlsxBtn').addEventListener('click',exportXLSX);
    $('#copyReportBtn').addEventListener('click',async()=>{try{const text=getReportText();if(window.AndroidBridge?.copyText)window.AndroidBridge.copyText(text);else await navigator.clipboard.writeText(text);toast('Daily report copied.');}catch(_){toast('Copy failed. Use Share.');}});
    $('#shareReportBtn').addEventListener('click',async()=>{const text=getReportText();try{if(window.AndroidBridge?.shareText)window.AndroidBridge.shareText('MR Daily Report',text);else if(navigator.share)await navigator.share({title:'MR Daily Report',text});else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,'_blank');}catch(e){if(e.name!=='AbortError')toast('Share cancelled.');}});
    $('#importFile').addEventListener('change',e=>{if(e.target.files.length)importFiles([...e.target.files]);e.target.value='';});$('#loadBundledBtn').addEventListener('click',()=>{if(window.AndroidBridge){const status=$('#importStatus');status.className='notice';status.classList.remove('hidden');status.textContent='The supplied doctor, chemist and product data is already included in this Android app.';toast('Starter data is already loaded.');}else{const status=$('#importStatus');status.className='notice error';status.classList.remove('hidden');status.textContent='Bundled starter data is already embedded. Spreadsheet import requires the Android app parser.';}});
    $('#exportJsonBtn').addEventListener('click',()=>download(`MR-Daily-Auto-Backup-${localISODate()}.json`,JSON.stringify(state,null,2)));$('#exportCsvBtn').addEventListener('click',exportCSV);$('#restoreBtn').addEventListener('click',()=>$('#restoreInput').click());
    $('#restoreInput').addEventListener('change',async e=>{try{restoreObject(JSON.parse(await e.target.files[0].text()));saveState();toast('Backup restored.');}catch(err){toast(err.message);}e.target.value='';});
    $('#profileForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget);['tmName','hq','joinWorkWith','companyDivision','products'].forEach(k=>state.profile[k]=clean(fd.get(k)));saveState();toast('Profile and product buttons saved.');});
    $('#openingForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget);state.opening.monthKey=monthKey(localISODate());METRICS.forEach(([k])=>state.opening[k]=num(fd.get(k)));saveState();toast('Opening balances saved.');});
    $('#pinForm').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),p=clean(fd.get('pin')),c=clean(fd.get('confirmPin'));if(!/^\d{4,6}$/.test(p)||p!==c){toast('PIN must be matching 4–6 digits.');return;}state.settings.pinHash=await hashPin(p);saveState(false);e.currentTarget.reset();toast('PIN lock set.');});
    $('#removePinBtn').addEventListener('click',()=>{state.settings.pinHash='';saveState(false);toast('PIN removed.');});$('#unlockBtn').addEventListener('click',async()=>{const h=await hashPin($('#unlockPin').value);if(h===state.settings.pinHash){$('#lockScreen').classList.add('hidden');$('#unlockError').textContent='';$('#unlockPin').value='';}else $('#unlockError').textContent='Wrong PIN';});$('#unlockPin').addEventListener('keydown',e=>{if(e.key==='Enter')$('#unlockBtn').click();});
    $('#resetBtn').addEventListener('click',()=>{if(!confirm('Reset all local app data? Export a backup first.'))return;state=makeDefaultState();saveState();toast('App reset.');navigate('dashboard');});
    window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;});$('#installBtn').addEventListener('click',async()=>{if(window.AndroidBridge){openSheet('Android app installed','Ready to use','<div class="note-box">This is already the native Android APK. Termux and Chrome installation are not required.</div>');}else if(deferredInstallPrompt){deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;}else openSheet('Install on Android','Chrome steps','<div class="note-box">Open Chrome menu (⋮) → Add to Home screen or Install app.</div>');});
  }

  async function init(){loadEmbeddedSeed();bindEvents();renderAll();
    showLockIfNeeded();if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./service-worker.js').catch(console.warn);}
  document.addEventListener('DOMContentLoaded',init);
})();
