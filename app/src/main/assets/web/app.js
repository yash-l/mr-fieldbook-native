(() => {
  'use strict';

  const STORE_KEY = 'mr-daily-auto-v3';
  const STORE_BACKUP_KEY = 'mr-daily-auto-v3-last-good';
  const APP_VERSION = 1.42;
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
  const debounce=(fn,delay=90)=>{let timer;return (...args)=>{clearTimeout(timer);timer=setTimeout(()=>fn(...args),delay);};};
  const GENERIC_AHMEDABAD=/^(?:AHMEDABAD(?:-\d+)?|AREA PENDING)$/i;
  const AHMEDABAD_AREA_RULES=[
    ['Nava Naroda',['NAVA NARODA','NEW NARODA','HARIDARSHAN','HANSAPURA']],
    ['Nikol',['NIKOL','RAS PAN','RASPAN','PANCHAM MALL','NIKOL GAM','NIKOL-NARODA']],
    ['Bapunagar',['BAPUNAGAR','BAPU NAGAR','INDIA COLONY']],
    ['Krishnanagar',['KRISHNANAGAR','KRISHNA NAGAR','VIJAY PARK']],
    ['Saijpur Bogha',['SAIJPUR BOGHA','SAIJPUR']],
    ['Odhav',['ODHAV','SONI NI CHAWL','SONI-NI-CHAWL']],
    ['Thakkarnagar',['THAKKARNAGAR','THAKKAR NAGAR']],
    ['Thakkarbapa Nagar',['THAKKARBAPA','THAKKAR BAPA']],
    ['Viratnagar',['VIRATNAGAR','VIRAT NAGAR','MANMOHAN CHAR RASTA']],
    ['Naroda',['NARODA','GALAXY CINEMA','NARODA PATIA']],
    ['Kubernagar',['KUBERNAGAR','KUBER NAGAR']],
    ['Hirawadi',['HIRAWADI','HIRA WADI']],
    ['Asarva',['ASARVA','CIVIL HOSPITAL ROAD','B.J. MEDICAL','BJ MEDICAL']],
    ['Dariyapur',['DARIYAPUR']],
    ['Girdharnagar',['GIRDHARNAGAR','GIRDHER NAGAR']],
    ['Noblenagar',['NOBLENAGAR','NOBLE NAGAR']],
    ['Kotarpur',['KOTARPUR']],
    ['Sardarnagar',['SARDARNAGAR','SARDAR NAGAR']],
    ['Subhashnagar',['SUBHASHNAGAR','SUBHAS NAGAR','SUBHAS NAGAR']],
    ['Shahibaug',['SHAHIBAUG','SHAHI BAUG']],
    ['Meghaninagar',['MEGHANINAGAR','MEGHANI NAGAR']],
    ['Saraspur',['SARASPUR']],
    ['Rakhial',['RAKHIAL','RAKHIYAL']],
    ['Amraiwadi',['AMRAIWADI','RABARI COLONY']],
    ['CTM',['CTM']],
    ['Hatkeshwar',['HATKESHWAR']],
    ['Vastral',['VASTRAL']],
    ['Maninagar',['MANINAGAR']],
    ['Isanpur',['ISANPUR']],
    ['Ghodasar',['GHODASAR']],
    ['Narol',['NAROL']],
    ['Vatva',['VATVA']],
    ['Chandkheda',['CHANDKHEDA']],
    ['Motera',['MOTERA']],
    ['Sabarmati',['SABARMATI']],
    ['Naranpura',['NARANPURA']],
    ['Navrangpura',['NAVRANGPURA']],
    ['Paldi',['PALDI']],
    ['Satellite',['SATELLITE']],
    ['Bopal',['BOPAL']]
  ];
  function inferDoctorArea(doctor){
    const current=clean(doctor?.area),hq=clean(doctor?.hq);
    if(current&&!GENERIC_AHMEDABAD.test(current))return current;
    if(!current&&hq&&!GENERIC_AHMEDABAD.test(hq))return hq;
    const hay=[doctor?.address,doctor?.hospitalAddress,doctorHospital(doctor),doctor?.notes].map(clean).join(' ').toUpperCase();
    for(const [area,terms] of AHMEDABAD_AREA_RULES)if(terms.some(term=>hay.includes(term)))return area;
    if((!current||GENERIC_AHMEDABAD.test(current))&&(!hq||GENERIC_AHMEDABAD.test(hq)))return 'Area pending';
    return current||hq||'Area pending';
  }
  function doctorType(doctor){
    const raw=clean(doctor?.speciality||doctor?.specialty).toUpperCase();
    if(/GYNA|GYN/.test(raw))return 'GYNAEC';
    if(/PED|PAED/.test(raw))return 'PEDIA';
    if(/MATRON/.test(raw))return 'MATRON';
    if(/GENPHY|GPHY|CONPHY|(^|[^A-Z])GP([^A-Z]|$)/.test(raw))return 'GP';
    return raw||'OTHER';
  }
  let suggestionCatalogCache=null;
  const SPECIALTY_PRODUCT_MAP={
    GYNAEC:['Zefrich','Zefrich HP'],
    GP:['Zefrich','Zefrich HP'],
    PEDIA:['MumMum 1','MumMum 2','Simyl MCT'],
    MATRON:['MumMum 1','MumMum 2','Simyl MCT']
  };
  function suggestedProductsForDoctor(doctor){
    const mapped=SPECIALTY_PRODUCT_MAP[doctorType(doctor)]||[];
    const focus=(doctor?.focusBrands||[]).map(clean).filter(Boolean);
    const catalog=suggestionCatalogCache||(suggestionCatalogCache=[...focusProducts(),...state.products.map(p=>clean(p.name)),...state.schemes.map(x=>clean(x.product))].filter(Boolean));
    const resolve=name=>catalog.find(x=>norm(x)===norm(name)||norm(x).startsWith(norm(name))||norm(name).startsWith(norm(x)))||name;
    return [...new Set([...mapped.map(resolve),...focus.map(resolve)].filter(Boolean))].slice(0,6);
  }
  function googleDoctorSearchUrl(doctor){
    const q=[doctor?.name,doctorHospital(doctor),inferDoctorArea(doctor),'Ahmedabad'].filter(Boolean).join(' ');
    return q?`https://www.google.com/search?q=${encodeURIComponent(q)}`:'';
  }
  function googleAddressSearchUrl(doctor){
    const q=[doctor?.address,doctorHospital(doctor),inferDoctorArea(doctor),'Ahmedabad'].filter(Boolean).join(' ');
    return q?`https://www.google.com/search?q=${encodeURIComponent(q)}`:'';
  }
  const doctorHasTiming=doctor=>normalizeMeetingDays(doctor?.meetingDays).length>0&&doctorMeetingSlots(doctor).length>0;
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
  function legacyClockFromText(value){
    const raw=clean(value),m=raw.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);if(!m)return '';
    return normalizeTime(`${m[1]}:${m[2]||'00'} ${m[3].toUpperCase()}`);
  }
  function inferredLegacyClinicSystem(doctor){
    const note=clean(doctor?.notes);
    if(/\bappointment\b/i.test(note))return 'appointment';
    if(/\bcard\b/i.test(note))return 'card_later';
    return 'direct';
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
  function doctorTodayAvailability(doctor,at=now()){
    const date=localISODate(at),clock=at.getHours()*60+at.getMinutes(),visited=rowsForDay(date).some(v=>v.doctorId===doctor.id),eligibility=doctorEligibilityForDate(doctor,date),access=doctorAccessForDate(doctor,date);
    if(visited)return {available:false,state:'visited',label:'Already met today',access,eligibility};
    if(!eligibility.eligible&&!access.fixed)return {available:false,state:'not_due',label:eligibility.reason,access,eligibility};
    if(access.fixed){
      const slot=access.slots[0];
      if(!slot||slot.end<clock)return {available:false,state:'closed',label:'Appointment time passed',access,eligibility};
      return {available:true,state:clock>=slot.start?'available':'appointment',label:clock>=slot.start?`Appointment now • until ${timeLabel(slot.to)}`:`Appointment ${timeLabel(slot.from)}`,slot,access,eligibility,fixed:true};
    }
    if(access.system==='appointment')return {available:false,state:'appointment_pending',label:access.reason||'Confirmed appointment required',access,eligibility};
    const remaining=doctorSlotsForDate(doctor,date).filter(slot=>{const arrival=Math.max(clock,slot.start);return arrival+12<=slot.end;}).sort((a,b)=>a.start-b.start);
    if(!remaining.length)return {available:false,state:'closed',label:'No usable meeting window left today',access,eligibility};
    if(access.system==='card_later'&&!cardDroppedForDate(doctor.id,date)){
      return {available:true,state:'card_task',label:`Card ${timeLabel(doctorCardDropTime(doctor))} → meet today`,slot:remaining[0],access,eligibility,cardTask:true};
    }
    if(!access.ready)return {available:false,state:'blocked',label:access.reason||'Clinic access pending',access,eligibility};
    const active=remaining.find(slot=>clock>=slot.start&&clock<=slot.end),slot=active||remaining[0];
    return {available:true,state:active?'available':'upcoming',label:active?`Available now • until ${timeLabel(slot.to)}`:`Today ${timeLabel(slot.from)}–${timeLabel(slot.to)}`,slot,access,eligibility};
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
  function effectiveSuccessfulDoctorVisits(doctor){
    const rows=successfulDoctorVisits(doctor.id).slice();
    const firstDate=dateOnly(doctor?.firstMeetingDate);
    if(doctor?.firstMeetingDone&&firstDate&&!rows.some(v=>dateOnly(v.date)===firstDate)){
      rows.push({id:`first-meeting:${doctor.id}`,doctorId:doctor.id,date:firstDate,outcome:'met',outcomeLabel:'Doctor met',source:'firstMeetingDone'});
      rows.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    }
    return rows;
  }
  function doctorVisitPolicy(doctor){
    const target=Math.max(1,Math.min(4,Math.round(num(doctor?.monthlyVisitTarget)||2)));
    const automaticGap=target===1?0:target===2?15:target===3?9:7;
    const gap=Math.max(0,Math.round(num(doctor?.minVisitGapDays)||automaticGap));
    return {target,gap,label:`${target}× / month${gap?` • ${gap}d gap`:''}`};
  }
  function doctorEligibilityForDate(doctor,date=localISODate()){
    const policy=doctorVisitPolicy(doctor),month=monthKey(date),allRows=effectiveSuccessfulDoctorVisits(doctor),rows=allRows.filter(v=>monthKey(v.date)===month),count=rows.length,last=allRows.slice(-1)[0]||null;
    if(count>=policy.target)return {eligible:false,reason:`${count}/${policy.target} monthly visits completed`,count,...policy,last};
    if(policy.gap&&last&&daysBetween(last.date,date)<policy.gap)return {eligible:false,reason:`Gap ${daysBetween(last.date,date)}/${policy.gap} days`,count,...policy,last};
    return {eligible:true,reason:`Visit ${count+1}/${policy.target} due`,count,...policy,last};
  }
  function doctorCompleteness(doctor){
    const system=doctorClinicSystem(doctor),timingReady=system==='appointment'||(normalizeMeetingDays(doctor?.meetingDays).length&&doctorMeetingSlots(doctor).length),accessReady=system!=='card_later'||Boolean(normalizeTime(doctor?.cardDropTime));
    const checks=[['Hospital',doctorHospital(doctor)],['Chemist',linkedChemist(doctor)],['Clinic system',system],['Meeting timing',timingReady],['Card drop time',accessReady],['Hospital GPS',num(doctor?.latitude)&&num(doctor?.longitude)]];
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
    if(!doctorEligibilityForDate(doctor).eligible&&!doctorAccessForDate(doctor).fixed)return -10000;
    const access=doctorAccessForDate(doctor);if(!access.ready)return -10000;
    const timing=doctorMeetingStatus(doctor),complete=doctorCompleteness(doctor),last=latestDoctorVisit(doctor.id,true),days=last?daysBetween(last.date,localISODate()):999,notMet=recentNotMetCount(doctor.id),due=doctor.nextFollowUp&&doctor.nextFollowUp<=localISODate(),rescheduled=state.reschedules.some(r=>r.doctorId===doctor.id&&r.status==='pending'&&r.scheduledDate<=localISODate()),location=doctorLocationVerification(doctor),distance=doctorDistanceFromCurrent(doctor);
    let score=0;if(timing.state==='available')score+=100;else if(timing.state==='upcoming')score+=65;else if(timing.state==='scheduled')score+=30;else score-=35;
    if(due)score+=75;if(rescheduled)score+=85;score+=Math.min(55,Math.max(0,days));score+=Math.min(30,notMet*8);score+=complete.score/10;if(location.verified)score+=45;else if(location.hasGps)score-=35;else score-=110;if(distance!==null){score+=Math.max(-70,28-distance*7);if(distance<=1)score+=18;}
    const opportunity=productOpportunity(doctor);if(opportunity.level==='high')score+=45;else if(opportunity.level==='medium')score+=22;
    return score;
  }
  function intelligenceReasons(doctor){
    const reasons=[],access=doctorAccessForDate(doctor),timing=doctorMeetingStatus(doctor),quality=doctorCompleteness(doctor),opportunity=productOpportunity(doctor),last=latestDoctorVisit(doctor.id,true),notMet=recentNotMetCount(doctor.id),location=doctorLocationVerification(doctor),distance=doctorDistanceFromCurrent(doctor);
    if(access.fixed)reasons.push(`fixed appointment ${timeLabel(access.appointment.time)}`);else if(doctorClinicSystem(doctor)==='card_later')reasons.push('card given • later meeting ready');
    if(timing.state==='available')reasons.push('available now');else if(timing.state==='upcoming')reasons.push(timing.label.toLowerCase());else if(timing.state==='unset')reasons.push('meeting timing missing');
    if(doctor.nextFollowUp&&doctor.nextFollowUp<=localISODate())reasons.push('follow-up due');
    if(last){const gap=daysBetween(last.date,localISODate());if(gap>=14)reasons.push(`${gap} days since met`);}else reasons.push('no confirmed meeting history');
    if(notMet)reasons.push(`${notMet} recent not-met`);
    reasons.push(location.label);if(distance!==null)reasons.push(distance<1?`${Math.round(distance*1000)} m from you`:`${distance.toFixed(1)} km from you`);
    if(opportunity.level!=='normal')reasons.push(opportunity.label);
    if(quality.missing.length)reasons.push(`missing ${quality.missing.slice(0,2).join(' + ')}`);
    return reasons.slice(0,4);
  }
  function smartPatchCandidates(limit=10){
    return state.doctors.map(doctor=>({doctor,score:intelligenceScore(doctor),timing:doctorMeetingStatus(doctor),quality:doctorCompleteness(doctor),opportunity:productOpportunity(doctor),reasons:intelligenceReasons(doctor)})).filter(x=>x.score>-9000).sort((a,b)=>b.score-a.score||doctorDisplayName(a.doctor).localeCompare(doctorDisplayName(b.doctor))).slice(0,limit);
  }
  function replacementDoctor(excludeId){return smartPatchCandidates(20).find(x=>x.doctor.id!==excludeId&&['available','upcoming'].includes(x.timing.state))||smartPatchCandidates(20).find(x=>x.doctor.id!==excludeId)||null;}
  function dataQualitySummary(){
    const missingHospital=state.doctors.filter(d=>!doctorHospital(d)).length,missingChemist=state.doctors.filter(d=>!linkedChemist(d)).length,missingTiming=state.doctors.filter(d=>doctorClinicSystem(d)!=='appointment'&&(!normalizeMeetingDays(d.meetingDays).length||!doctorMeetingSlots(d).length)).length,missingGps=state.doctors.filter(d=>!num(d.latitude)||!num(d.longitude)).length;
    const keyCounts=new Map();state.doctors.forEach(d=>{const key=`${norm(d.name)}|${norm(doctorHospital(d))}`;if(norm(d.name))keyCounts.set(key,(keyCounts.get(key)||0)+1);});
    const duplicates=[...keyCounts.values()].filter(n=>n>1).reduce((a,n)=>a+n,0),complete=state.doctors.filter(d=>doctorCompleteness(d).score===100).length;
    return {complete,missingHospital,missingChemist,missingTiming,missingGps,duplicates,total:state.doctors.length};
  }
  function renderMachineDashboard(){
    const box=$('#machineTopList'),quality=dataQualitySummary(),patch=smartPatchCandidates(3);if(!box)return;
    const gpsVerified=state.doctors.filter(d=>doctorLocationVerification(d).verified).length;$('#machineQualityText').textContent=`${gpsVerified}/${quality.total} location verified • ${quality.missingTiming} timing pending • ${state.reschedules.filter(r=>r.status==='pending').length} rescheduled`;
    box.innerHTML=patch.length?patch.map((x,i)=>`<button class="machine-call plain-button" data-action="log-record" data-type="doctor" data-id="${esc(x.doctor.id)}"><span>${i+1}</span><div><strong>${esc(doctorDisplayName(x.doctor))}</strong><small>${esc([x.timing.label,...x.reasons].filter(Boolean).join(' • '))}</small></div><b>${Math.max(0,Math.round(x.score))}</b></button>`).join(''):empty('No pending doctor call. Add doctor timings or follow-up data.');
  }
  function openIntelligenceCenter(){
    const patch=smartPatchCandidates(12),q=dataQualitySummary(),pending=state.reschedules.filter(r=>r.status==='pending').sort((a,b)=>String(a.scheduledDate).localeCompare(String(b.scheduledDate))),distributorStops=pendingDistributorStops();
    openSheet('Field AI','Local decision engine: clinic access + timing + visit gap + current GPS + verified address. It is not a generative AI model.',`<div class="machine-summary-grid"><div><strong>${patch.length}</strong><small>Doctor calls</small></div><div><strong>${distributorStops.length}</strong><small>Distributor stops</small></div><div><strong>${q.complete}/${q.total}</strong><small>Verified data</small></div></div><div class="detail-section"><h4>Today smart patch</h4><div class="machine-patch-list">${patch.length?patch.map((x,i)=>`<div class="machine-patch-row"><span>${i+1}</span><div><strong>${esc(doctorDisplayName(x.doctor))}</strong><small>${esc(x.reasons.join(' • ')||x.timing.label)}</small><em>${esc(x.opportunity.label)}</em></div><button data-action="log-record" data-type="doctor" data-id="${esc(x.doctor.id)}">Meet</button></div>`).join(''):empty('No pending calls.')}</div></div><div class="detail-section"><h4>Accepted orders → distributor planning</h4>${distributorStops.length?distributorStops.map((x,i)=>`<div class="machine-reschedule"><strong>${i+1}. ${esc(x.distributor.name)} • ₹${esc(x.totalValue.toLocaleString('en-IN'))}</strong><small>${esc(`${x.orders.length} order(s) • ${x.chemists.join(', ')||'Chemist pending'} • ${x.address||'Address missing'}${x.mapReady?' • map ready':' • map pin missing'}`)}</small></div>`).join(''):empty('No accepted order is pending distributor fulfilment.')}</div><button id="confirmMachinePatchBtn" class="btn primary full">Confirm doctor + distributor plan</button><div class="detail-section"><h4>Pending reschedules</h4>${pending.length?pending.map(r=>`<div class="machine-reschedule"><strong>${esc(r.doctorName)}</strong><small>${esc(`${prettyDate(r.scheduledDate)} • ${timeLabel(r.meetingFrom)}–${timeLabel(r.meetingTo)} • ${r.reason}`)}</small></div>`).join(''):empty('No pending reschedule.')}</div><div class="detail-section"><h4>Data quality</h4><div class="quality-grid"><div><b>${q.missingHospital}</b><span>Hospital missing</span></div><div><b>${q.missingChemist}</b><span>Chemist missing</span></div><div><b>${q.missingTiming}</b><span>Timing missing</span></div><div><b>${q.missingGps}</b><span>GPS verification pending</span></div><div><b>${q.duplicates}</b><span>Possible duplicate</span></div></div></div>`);
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
      appointments: [],
      clinicActions: [],
      rcpa: [],
      salesMonths: [],
      opening: {monthKey: monthKey(today), calls:0, inputs:0, basket:0, towel:0, conversation:0, newAvailability:0, pobValue:0},
      imports: [],
      settings: {bundledImportAttempted:false, embeddedSeedLoaded:false, pinHash:'', installedHintSeen:false, workflowMode:'field', nearbyRadiusMeters:1000, expenseRatePerKm:0, theme:'system', haptics:true}
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
      appointments: Array.isArray(raw?.appointments) ? raw.appointments : [],
      clinicActions: Array.isArray(raw?.clinicActions) ? raw.clinicActions : [],
      rcpa: Array.isArray(raw?.rcpa) ? raw.rcpa : [],
      salesMonths: Array.isArray(raw?.salesMonths) ? raw.salesMonths : [],
      imports: Array.isArray(raw?.imports) ? raw.imports : []
    };
    out.doctors.forEach(d => {
      if (!d.id) d.id = uid('dr');
      d.name = clean(d.name);
      d.hospital = doctorHospital(d);
      d.address = clean(d.address);
      d.area = inferDoctorArea(d) || clean(d.area || d.hq);
      d.speciality = clean(d.speciality || d.specialty);
      d.specialty = clean(d.specialty || d.speciality);
      d.meetingDays = normalizeMeetingDays(d.meetingDays);
      d.meetingFrom = normalizeTime(d.meetingFrom); d.meetingTo = normalizeTime(d.meetingTo);
      d.meetingFrom2 = normalizeTime(d.meetingFrom2); d.meetingTo2 = normalizeTime(d.meetingTo2);
      if (!d.linkedChemistId && d.chemistId) d.linkedChemistId = d.chemistId;
      if (d.chemistName) d.chemistName = cleanChemistName(d.chemistName);
      d.monthlyVisitTarget = Math.max(1,Math.min(4,Math.round(num(d.monthlyVisitTarget)||2)));
      d.minVisitGapDays = Math.max(0,Math.round(num(d.minVisitGapDays)||0));
      const savedClinicSystem=clean(d.clinicSystem);
      d.clinicSystem = ['direct','appointment','card_later'].includes(savedClinicSystem) ? savedClinicSystem : inferredLegacyClinicSystem(d);
      d.cardDropTime = normalizeTime(d.cardDropTime)||(d.clinicSystem==='card_later'?legacyClockFromText(d.notes):'');
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
    out.appointments.forEach(x=>{if(!x.id)x.id=uid('apt');x.date=dateOnly(x.date||localISODate());x.time=normalizeTime(x.time);x.reminderDate=dateOnly(x.reminderDate||x.date||localISODate());x.reminderTime=normalizeTime(x.reminderTime);x.durationMinutes=Math.max(5,Math.min(60,Math.round(num(x.durationMinutes)||12)));x.status=clean(x.status||'Requested');x.shortDescription=clean(x.shortDescription||x.description||'');x.doctorId=clean(x.doctorId);const d=out.doctors.find(y=>y.id===x.doctorId);if(d){x.doctorName=d.name;x.hospital=doctorHospital(d);}else{x.doctorName=clean(x.doctorName);x.hospital=clean(x.hospital);}});
    out.clinicActions.forEach(x=>{if(!x.id)x.id=uid('access');x.date=dateOnly(x.date||localISODate());x.doctorId=clean(x.doctorId);x.type=clean(x.type||'card_drop');x.completedAt=clean(x.completedAt);});
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
  let doctorFilters = {todayAvailable:false,timing:'',addressMissing:false,types:new Set(),areas:new Set()};
  function resetDoctorFilters(){doctorFilters={todayAvailable:false,timing:'',addressMissing:false,types:new Set(),areas:new Set()};}
  function doctorFiltersActive(){return doctorFilters.todayAvailable||Boolean(doctorFilters.timing)||doctorFilters.addressMissing||doctorFilters.types.size>0||doctorFilters.areas.size>0;}
  function doctorFilterCount(){return (doctorFilters.todayAvailable?1:0)+(doctorFilters.timing?1:0)+(doctorFilters.addressMissing?1:0)+doctorFilters.types.size+doctorFilters.areas.size;}
  function doctorFilterHas(key){
    if(key==='all')return !doctorFiltersActive();
    if(key==='today_available')return doctorFilters.todayAvailable;
    if(key==='timing'||key==='no_timing')return doctorFilters.timing===key;
    if(key==='address_missing')return doctorFilters.addressMissing;
    if(key.startsWith('type:'))return doctorFilters.types.has(key.slice(5));
    if(key.startsWith('area:'))return doctorFilters.areas.has(key.slice(5));
    return false;
  }
  function toggleDoctorFilter(key){
    if(!key||key==='all'){resetDoctorFilters();return;}
    if(key==='today_available'){doctorFilters.todayAvailable=!doctorFilters.todayAvailable;return;}
    if(key==='timing'||key==='no_timing'){doctorFilters.timing=doctorFilters.timing===key?'':key;return;}
    if(key==='address_missing'){doctorFilters.addressMissing=!doctorFilters.addressMissing;return;}
    if(key.startsWith('type:')){const v=key.slice(5);doctorFilters.types.has(v)?doctorFilters.types.delete(v):doctorFilters.types.add(v);return;}
    if(key.startsWith('area:')){const v=key.slice(5);doctorFilters.areas.has(v)?doctorFilters.areas.delete(v):doctorFilters.areas.add(v);}
  }
  let chemistFilter = 'all';
  let visitFilter = 'all';
  let doctorRenderLimit = 60;
  let doctorRouteSelectMode = false;
  let selectedRouteDoctorIds = new Set();
  let lastRenderedDoctorIds = [];
  let chemistRenderLimit = 60;
  let deferredInstallPrompt = null;
  let pendingSanClipboardText = "";
  const nearbyPlaceCache = new Map();
  let proximityDismissedUntil = 0;
  let lastProximityDoctorId = '';
  let lastFieldLocation = null;
  let appUpdateInfo = null;

  function saveState(render = true) {
    try {
      const current=localStorage.getItem(STORE_KEY);
      if(current) localStorage.setItem(STORE_BACKUP_KEY,current);
      state.version=APP_VERSION;
      suggestionCatalogCache=null;
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
      `RCPA Today/Month: ${state.rcpa.filter(x=>dateOnly(x.date)===date).length}/${state.rcpa.filter(x=>monthKey(x.date)===monthKey(date)).length}`
    ].join('\n');
  }

  function mapUrl(lat, lng, address='') {
    if (lat && lng) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
    const q=clean(address); return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : '';
  }
  function entityMapUrl(r) { return mapUrl(r.latitude, r.longitude, [r.address,r.area,r.hq].filter(Boolean).join(', ')); }
  function visitMapUrl(v) { return mapUrl(v.latitude, v.longitude); }
  function doctorGoogleQuery(doctor,place=null){const address=place?.address||doctor?.address||doctor?.hospitalAddress||'';const parts=[doctor?.name,place?.name||doctorHospital(doctor),address||inferDoctorArea(doctor),address?'':(doctor?.hq||state.profile.hq),address?'':'Gujarat',address?'':'India'];return parts.map(cleanGpsQueryPart).filter(Boolean).join(', ');}
  function googleDoctorVerifyUrl(doctor,place=null){const q=doctorGoogleQuery(doctor,place);return q?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`:'';}
  function doctorLocationVerification(doctor){const hasGps=Boolean(num(doctor?.latitude)&&num(doctor?.longitude)),hasAddress=Boolean(clean(doctor?.address||doctor?.hospitalAddress)),source=norm(doctor?.locationSource),mode=norm(doctor?.gpsResolutionMode);const googleAuto=Boolean(doctor?.googleCrossCheckedAt||doctor?.placeId&&(source.includes('google')||mode.includes('google'))),visitVerified=source.includes('visitgpsverified')||norm(doctor?.locationVerificationStatus)==='verified';const manual=Boolean(doctor?.googleManualCheckedAt),addressChecked=Boolean(doctor?.googleAddressCheckedAt&&hasAddress);const verified=hasGps&&(googleAuto||visitVerified||manual);return {hasGps,hasAddress,verified,addressChecked,level:verified?'verified':addressChecked?'review':hasGps?'review':'missing',label:verified?'Google/GPS verified':addressChecked?'Google address checked':hasGps?'Google cross-check pending':hasAddress?'Address ready • Google check pending':'GPS/address missing'};}
  function doctorDistanceFromCurrent(doctor){if(!lastFieldLocation||!num(doctor?.latitude)||!num(doctor?.longitude))return null;return haversineKm(lastFieldLocation.latitude,lastFieldLocation.longitude,num(doctor.latitude),num(doctor.longitude));}
  let locationVerifyContext=null;
  function openDoctorLocationVerification(id,place=null){
    const d=doctorById(id);if(!d)return;
    const lat=num(place?.latitude||d.latitude),lng=num(place?.longitude||d.longitude),address=clean(place?.address||d.address||d.hospitalAddress||''),query=doctorGoogleQuery(d,place),status=doctorLocationVerification(d),googleUrl=googleDoctorVerifyUrl(d,place),canManualConfirm=Boolean((lat&&lng)||address);
    locationVerifyContext={doctorId:id,place:place||null,latitude:lat,longitude:lng,address,query};
    openSheet('Verify doctor location','Cross-check doctor name + hospital/clinic + address before MR One trusts this location.',`<div class="verification-card"><span class="verification-badge ${status.level}">${esc(status.label)}</span><h3>${esc(d.name)} <em>${esc(doctorType(d))}</em></h3><p>${esc(place?.name||doctorHospital(d)||'Hospital not linked')}</p><small>${esc(address||'Address not entered')}</small></div><div class="note-box"><strong>Google query</strong><br>${esc(query)}</div><div class="button-row"><a class="btn secondary" href="${googleUrl}" target="_blank" rel="noopener">Open Google Maps</a>${hasOptionalGooglePlaces()?'<button id="autoGoogleCrossCheckBtn" class="btn primary" type="button">Auto cross-check</button>':''}</div>${lat&&lng?`<a class="btn secondary full" href="${mapUrl(lat,lng)}" target="_blank" rel="noopener">Open saved/selected pin</a>`:''}<button id="manualGoogleConfirmBtn" class="btn primary full" type="button" ${canManualConfirm?'':'disabled'}>I checked Google — location matches ✓</button><div id="googleCrossCheckResults" class="card-list compact-list"></div><small class="muted-line">Free mode opens the official Google Maps search for Doctor + Hospital + Address. With a Places key, Auto cross-check can return a Google candidate and save its Place ID/GPS.</small>`);
    $('#manualGoogleConfirmBtn')?.addEventListener('click',()=>{const ctx=locationVerifyContext,doc=doctorById(ctx?.doctorId);if(!ctx||!doc||(!(ctx.latitude&&ctx.longitude)&&!ctx.address))return;if(ctx.place){doc.hospital=clean(ctx.place.name)||doc.hospital;doc.address=clean(ctx.place.address)||doc.address;if(ctx.latitude&&ctx.longitude){doc.latitude=ctx.latitude;doc.longitude=ctx.longitude;}if(ctx.place.osmId)doc.osmId=ctx.place.osmId;}if(ctx.latitude&&ctx.longitude){doc.googleManualCheckedAt=new Date().toISOString();doc.locationVerificationStatus='verified';}else{doc.googleAddressCheckedAt=new Date().toISOString();doc.locationVerificationStatus='address_verified';}doc.locationSource='Google Maps manual cross-check: doctor + hospital + address';doc.updatedAt=new Date().toISOString();saveState(false);closeSheet();haptic('success');toast(ctx.latitude&&ctx.longitude?'Google + GPS location verified.':'Google address confirmed. Route can use this address; add GPS later for distance optimization.');});
    $('#autoGoogleCrossCheckBtn')?.addEventListener('click',()=>{const out=$('#googleCrossCheckResults');if(out)out.innerHTML='<div class="notice">Checking Google Places…</div>';window.AndroidBridge?.searchDoctorPlaces?.('location-verify',query);});
  }
  function crossCheckScore(row,ctx){
    const d=doctorById(ctx?.doctorId);if(!d)return 0;
    const candidateText=clean(`${row.name||''} ${row.address||''} ${row.primaryType||''}`).toLowerCase(),candidate=norm(candidateText),doctorName=norm(d.name),hospital=norm(ctx?.place?.name||doctorHospital(d)),address=clean(ctx?.place?.address||d.address||d.hospitalAddress||'').toLowerCase();
    let score=0;
    if(doctorName&&candidate.includes(doctorName))score+=20;
    if(hospital&&candidate.includes(hospital))score+=35;
    const words=[...new Set(address.split(/[^a-z0-9]+/).filter(w=>w.length>=4))],overlap=words.filter(w=>candidateText.includes(w)).length;
    if(overlap>=4)score+=30;else if(overlap>=2)score+=18;else if(overlap===1)score+=8;
    const baseLat=num(ctx?.latitude||d.latitude),baseLng=num(ctx?.longitude||d.longitude);if(baseLat&&baseLng&&num(row.latitude)&&num(row.longitude)){const km=haversineKm(baseLat,baseLng,num(row.latitude),num(row.longitude));if(km<=.1)score+=35;else if(km<=.3)score+=28;else if(km<=.8)score+=16;else if(km<=2)score+=5;}
    return score;
  }
  let pendingDoctorGpsId='';
  let pendingDoctorGpsRows=[];
  let pendingDoctorGpsProvider='osm';
  function cleanGpsQueryPart(value){return clean(value).replace(/https?:\/\/\S+/gi,' ').replace(/\s+/g,' ').trim();}
  function doctorGpsQuery(doctor){
    if(!doctor)return '';
    const address=cleanGpsQueryPart(doctor.address||doctor.hospitalAddress||'');
    const hospital=cleanGpsQueryPart(doctorHospital(doctor));
    const area=cleanGpsQueryPart(inferDoctorArea(doctor)||doctor.area||'');
    const hq=cleanGpsQueryPart(doctor.hq||state.profile.hq||'');
    const primary=hospital||doctorDisplayName(doctor);
    return [primary,address,area,hq,'Gujarat','India'].filter(Boolean).join(', ');
  }
  function osmMapUrl(lat,lng){return `https://www.openstreetmap.org/?mlat=${encodeURIComponent(lat)}&mlon=${encodeURIComponent(lng)}#map=18/${encodeURIComponent(lat)}/${encodeURIComponent(lng)}`;}
  function hasOptionalGooglePlaces(){try{return !!window.AndroidBridge?.hasPlacesApi?.();}catch(_){return false;}}
  function renderDoctorGpsSearchShell(doctor,query,provider){
    const isGoogle=provider==='google';
    openSheet('Find clinic GPS',isGoogle?'Optional Google Places lookup. Nothing is saved until you choose a result.':'FREE OpenStreetMap address lookup. Search runs only when you tap it; confirmed results are cached for offline planning.',`<div class="detail-section"><h4>${esc(doctorDisplayName(doctor))}</h4><div class="detail-address">${esc(doctor.address||doctor.hospitalAddress||'')}</div></div><div class="notice">${isGoogle?'Google Places (optional)':'OpenStreetMap / Nominatim (free)'} • Query: ${esc(query)}</div><div id="doctorGpsResults" class="card-list compact-list"><div class="empty-state"><strong>Searching online…</strong><span>${isGoogle?'Checking Google clinic/address matches.':'Checking OpenStreetMap address matches. Same query is cached after the first successful lookup.'}</span></div></div>${!isGoogle&&hasOptionalGooglePlaces()?'<div class="button-row"><button id="doctorGpsGoogleFallback" class="btn secondary" type="button">Try Google Places instead</button></div>':''}<div class="osm-attribution">${isGoogle?'Google Places is optional.':'© OpenStreetMap contributors • Nominatim public service • manual address lookup only'}</div>`);
    $('#doctorGpsGoogleFallback')?.addEventListener('click',()=>startDoctorGpsLookup(doctor.id,'google'));
  }
  function startDoctorGpsLookup(id,provider='osm'){
    const doctor=doctorById(id);if(!doctor)return;
    const query=doctorGpsQuery(doctor);
    if(!clean(doctor.address||doctor.hospitalAddress)){toast('Add clinic address first.');return;}
    pendingDoctorGpsId=id;pendingDoctorGpsRows=[];pendingDoctorGpsProvider=provider;
    renderDoctorGpsSearchShell(doctor,query,provider);
    try{
      if(provider==='google'){
        if(!window.AndroidBridge?.searchDoctorPlaces){throw new Error('Google Places is not available in this build.');}
        window.AndroidBridge.searchDoctorPlaces('doctor-gps',query);
      }else{
        if(!window.AndroidBridge?.searchDoctorOpenStreetMap){throw new Error('Free GPS lookup needs the Android app build.');}
        window.AndroidBridge.searchDoctorOpenStreetMap('doctor-gps-osm',query);
      }
    }catch(error){const out=$('#doctorGpsResults');if(out)out.innerHTML=`<div class="notice error">${esc(error?.message||'Could not start GPS search.')}</div>`;}
  }
  function resolveDoctorGpsOnline(id){startDoctorGpsLookup(id,'osm');}
  function useDoctorGpsResult(index){
    const doctor=doctorById(pendingDoctorGpsId),row=pendingDoctorGpsRows[index];if(!doctor||!row)return;
    const lat=num(row.latitude),lng=num(row.longitude);if(!lat||!lng){toast('This result has no GPS pin.');return;}
    const provider=clean(row.provider||pendingDoctorGpsProvider||'osm').toLowerCase();
    doctor.latitude=lat;doctor.longitude=lng;doctor.locationAccuracy='';doctor.locationCapturedAt=new Date().toISOString();doctor.resolvedPlaceName=clean(row.name);doctor.resolvedFormattedAddress=clean(row.address);doctor.updatedAt=new Date().toISOString();
    if(provider==='google'){
      doctor.placeId=clean(row.placeId);doctor.locationSource='Google Places address match';doctor.gpsResolutionMode='google_address_confirmed';
    }else{
      doctor.placeId='';doctor.osmId=clean(row.osmId);doctor.locationSource='OpenStreetMap Nominatim address match';doctor.gpsResolutionMode='osm_address_confirmed_cached';
    }
    saveState(false);closeSheet();toast('Clinic GPS saved. Daily nearest/planner can reuse this pin offline.');
  }
  function renderDoctorGpsRows(rows,provider){
    const out=$('#doctorGpsResults');if(!out)return;
    pendingDoctorGpsProvider=provider;pendingDoctorGpsRows=(rows||[]).filter(x=>num(x.latitude)&&num(x.longitude)).map(x=>({...x,provider}));
    out.innerHTML=pendingDoctorGpsRows.length?pendingDoctorGpsRows.map((x,i)=>`<article class="record-card"><div class="record-title"><h3>${esc(x.name||'Clinic / address')}</h3>${x.address?`<p>${esc(x.address)}</p>`:''}</div><div class="tag-row"><span class="tag">${esc(provider==='google'?'Google':(x.primaryType||'OSM'))}</span><span class="tag">${esc(Number(x.latitude).toFixed(5))}, ${esc(Number(x.longitude).toFixed(5))}</span></div><div class="record-actions"><a href="${provider==='osm'?osmMapUrl(x.latitude,x.longitude):mapUrl(x.latitude,x.longitude)}" target="_blank" rel="noopener">Check map</a><button data-action="use-doctor-gps" data-index="${i}">Use this GPS</button></div></article>`).join(''):empty('No confident address match found. Keep the saved address; do not save a guessed pin.');
  }
  window.__mrDoctorOpenStreetMapResults=(prefix,ok,json,error,cached)=>{
    if(prefix!=='doctor-gps-osm')return;const out=$('#doctorGpsResults');if(!out)return;
    if(!ok){out.innerHTML=`<div class="notice error">${esc(error||'Free OpenStreetMap lookup failed. Existing address/GPS was not changed.')}</div><div class="notice">Daily planner still works offline for doctors whose GPS was already saved.</div>`;return;}
    let rows=[];try{rows=JSON.parse(json||'[]');}catch(_){rows=[];}renderDoctorGpsRows(rows,'osm');
    const note=document.createElement('div');note.className='notice';note.textContent=cached?'Loaded from local OpenStreetMap lookup cache — no new network request.':'OpenStreetMap result received. Choose the correct clinic/address to save its pin offline.';out.prepend(note);
  };
  window.__mrDoctorPlaceResults=(prefix,ok,json,error)=>{
    if(prefix==='location-verify'){const out=$('#googleCrossCheckResults');if(!out)return;if(!ok){out.innerHTML=`<div class="notice error">${esc(error||'Google cross-check failed. Use Open Google Maps and confirm manually.')}</div>`;return;}let rows=[];try{rows=JSON.parse(json||'[]');}catch(_){rows=[];}rows=rows.map(x=>({...x,score:crossCheckScore(x,locationVerifyContext)})).sort((a,b)=>b.score-a.score);out.innerHTML=rows.length?rows.map((x,i)=>`<article class="record-card"><div class="record-title"><h3>${esc(x.name||'Google place')}</h3><p>${esc(x.address||'')}</p></div><div class="tag-row"><span class="tag ${x.score>=60?'good':'due'}">Match ${esc(x.score)}</span></div><div class="record-actions"><a href="${mapUrl(x.latitude,x.longitude)}" target="_blank" rel="noopener">Map</a><button class="primary-action" data-action="confirm-google-candidate" data-index="${i}">Confirm</button></div></article>`).join(''):empty('No Google candidate found. Use manual Google Maps check.');locationVerifyContext.googleRows=rows;return;}
    if(prefix!=='doctor-gps')return;const out=$('#doctorGpsResults');if(!out)return;
    if(!ok){out.innerHTML=`<div class="notice error">${esc(error||'Optional Google GPS search failed. Existing address/GPS was not changed.')}</div>`;return;}
    let rows=[];try{rows=JSON.parse(json||'[]');}catch(_){rows=[];}renderDoctorGpsRows(rows,'google');
  };

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
  const timing=state.doctors.filter(d=>doctorClinicSystem(d)==='appointment'||(doctorMeetingSlots(d).length&&normalizeMeetingDays(d.meetingDays).length)).length;
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
  const list=state.doctors.map(d=>{const access=doctorAccessForDate(d),slot=access.fixed?access.slots[0]:todaySlot(d);return {doctor:d,slot,access,eligibility:doctorEligibilityForDate(d)};}).filter(x=>(x.eligibility.eligible||x.access.fixed)&&x.access.ready&&x.slot&&x.doctor.latitude&&x.doctor.longitude&&(includeVisited||!visited.has(x.doctor.id)));
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
    const eligibility=doctorEligibilityForDate(doctor),access=doctorAccessForDate(doctor),appointment=access.appointment||null,slot=access.fixed?access.slots[0]:todaySlot(doctor);if((!eligibility.eligible&&!access.fixed)||!access.ready||!slot||!num(doctor.latitude)||!num(doctor.longitude)||(visited.has(doctor.id)&&!includeVisited))return;
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
    const key=d.placeId?`place:${d.placeId}`:d.osmId?`osm:${d.osmId}`:`name:${norm(hospital)}:${Number(d.latitude).toFixed(4)}:${Number(d.longitude).toFixed(4)}`;
    if(!groups.has(key))groups.set(key,{id:`saved:${key}`,source:'saved',placeId:d.placeId||'',osmId:d.osmId||'',name:hospital,address:d.address||d.area||'',latitude:num(d.latitude),longitude:num(d.longitude),openingHours:d.hospitalOpeningHours||[],doctorIds:[]});
    groups.get(key).doctorIds.push(d.id);
  });
  return [...groups.values()].map(x=>({...x,distanceKm:haversineKm(lat,lng,x.latitude,x.longitude)})).filter(x=>x.distanceKm*1000<=radiusMeters).sort((a,b)=>a.distanceKm-b.distanceKm);
}
function nearbySourceLabel(source){return source==='google'?'Google':source==='osm'?'OpenStreetMap':'Saved';}
function nearbyResultCard(x){
  const doctors=(x.doctorIds||[]).map(doctorById).filter(Boolean),timings=doctors.map(doctorMeetingStatus),available=timings.filter(t=>t.state==='available').length;
  const timingText=available?`${available} doctor${available===1?'':'s'} available now`:doctors.length?`${doctors.length} linked doctor${doctors.length===1?'':'s'}`:'No linked doctor yet';
  const hours=(x.openingHours||[]).slice(0,2).join(' • ');
  return `<button class="nearby-place-card plain-button" data-nearby-place-id="${esc(x.id)}"><div class="nearby-place-distance">${esc(x.distanceKm.toFixed(2))}<small>km</small></div><div class="nearby-place-copy"><h3>${esc(x.name)}</h3>${x.address?`<p>${esc(x.address)}</p>`:''}<small>${esc(timingText)}${hours?` • ${esc(hours)}`:''}</small></div><span class="source-pill ${x.source==='saved'?'':'live'}">${esc(nearbySourceLabel(x.source))}</span></button>`;
}
function mergeNearbyPlaces(saved,live,lat,lng,radiusMeters){
  const all=[],seen=new Set();
  [...saved,...live].forEach(x=>{
    const distanceKm=x.distanceKm??haversineKm(lat,lng,x.latitude,x.longitude);if(distanceKm*1000>radiusMeters)return;
    const key=x.placeId?`p:${x.placeId}`:x.osmId?`o:${x.osmId}`:`n:${norm(x.name)}:${Number(x.latitude).toFixed(3)}:${Number(x.longitude).toFixed(3)}`;
    if(seen.has(key))return;seen.add(key);const savedMatch=saved.find(s=>(x.placeId&&s.placeId===x.placeId)||(x.osmId&&s.osmId===x.osmId)||(!x.placeId&&!x.osmId&&norm(s.name)===norm(x.name)&&haversineKm(s.latitude,s.longitude,x.latitude,x.longitude)<0.12));
    all.push({...x,distanceKm,doctorIds:savedMatch?.doctorIds||x.doctorIds||[],source:savedMatch?'saved':x.source});
  });
  return all.sort((a,b)=>a.distanceKm-b.distanceKm);
}
function applyNearbyProviderResults(prefix,ok,json,error,provider='google',cached=false){
  const quick=prefix==='quickdoc',out=$(quick?'#quickNearbyResults':'#nearbyResults'),status=$(quick?'#quickdocLocationStatus':'#nearbyLiveStatus');if(!out)return;
  if(!ok){if(status&&!quick)status.textContent=error||'Nearby hospital search unavailable.';return;}
  try{
    const live=JSON.parse(json||'[]').filter(x=>Number.isFinite(Number(x.latitude))&&Number.isFinite(Number(x.longitude))).map((x,i)=>({...x,latitude:num(x.latitude),longitude:num(x.longitude),id:`${provider}:${x.osmId||x.placeId||i}`,source:provider,doctorIds:[]}));
    live.forEach(x=>nearbyPlaceCache.set(x.id,x));
    const lat=num($(quick?'#quickdocLatitude':'#nearbyLatitude').value),lng=num($(quick?'#quickdocLongitude':'#nearbyLongitude').value),radius=quick?2000:(num($('#nearbyRadius').value)||1000),saved=savedHospitalGroups(lat,lng,radius),merged=mergeNearbyPlaces(saved,live,lat,lng,radius);
    merged.forEach(x=>nearbyPlaceCache.set(x.id,x));
    if(quick){out.innerHTML=merged.length?merged.slice(0,12).map(x=>`<button type="button" class="nearby-place-card plain-button" data-quick-nearby-place="${esc(x.id)}"><div class="nearby-place-distance">${esc(x.distanceKm.toFixed(2))}<small>km</small></div><div class="nearby-place-copy"><h3>${esc(x.name)}</h3>${x.address?`<p>${esc(x.address)}</p>`:''}<small>${esc((x.doctorIds||[]).length)} saved doctor(s) • ${esc(nearbySourceLabel(x.source))}</small></div></button>`).join(''):empty('No hospital or clinic found within 2 km.');}
    else{out.innerHTML=merged.length?merged.map(nearbyResultCard).join(''):empty('No hospital or clinic found in this radius.');if(status)status.textContent=provider==='osm'?`${live.length} OpenStreetMap places received${cached?' • local cache':''}`:`${live.length} Google places received`;}
  }catch(e){if(status&&!quick)status.textContent=`Could not read nearby results: ${e.message}`;}
}
window.__mrNearbyPlaces=(prefix,ok,json,error)=>applyNearbyProviderResults(prefix,ok,json,error,'google',false);
window.__mrNearbyOpenStreetMapPlaces=(prefix,ok,json,error,cached)=>applyNearbyProviderResults(prefix,ok,json,error,'osm',cached);
function chooseNearbyHospital(place){
  if(!place)return;const linked=(place.doctorIds||[]).map(doctorById).filter(Boolean);
  openSheet(place.name,`${place.distanceKm.toFixed(2)} km away • ${place.source==='google'?'Google place':place.source==='osm'?'OpenStreetMap place':'saved master location'}`,`<div class="detail-section"><h4>Hospital details</h4><div class="note-box">${place.address?`${esc(place.address)}<br>`:''}<a href="${mapUrl(place.latitude,place.longitude)}" target="_blank" rel="noopener">Open exact map</a></div></div><div class="detail-section"><h4>Which doctor do you want to meet?</h4><div id="nearbyDoctorResults">${linked.length?linked.map(d=>`<button class="mini-card plain-button" data-nearby-doctor-id="${d.id}"><span class="mini-icon">⚕</span><span class="mini-copy"><h3>${esc(d.name)}</h3><p>${esc([doctorMeetingStatus(d).label,linkedChemist(d)?.name].filter(Boolean).join(' • '))}</p></span></button>`).join(''):empty('No doctor is linked to this hospital yet. Search the accurate doctor below.')}</div><label class="search-box nearby-doctor-search"><span>⌕</span><input id="nearbyDoctorSearch" type="search" placeholder="Search accurate doctor name…"></label><div id="nearbyDoctorSearchResults" class="search-results lookup-results hidden"></div></div><div class="google-attribution">© OpenStreetMap contributors when OSM data is shown • Google attribution applies when Google data is shown.</div>`);
  const selectDoctor=id=>{const d=doctorById(id);if(!d)return;closeSheet();openDoctorLocationVerification(id,place);};
  $('#nearbyDoctorResults').addEventListener('click',e=>{const b=e.target.closest('[data-nearby-doctor-id]');if(b)selectDoctor(b.dataset.nearbyDoctorId);});
  const input=$('#nearbyDoctorSearch'),results=$('#nearbyDoctorSearchResults');input.addEventListener('input',()=>{const q=clean(input.value).toLowerCase();if(!q){results.classList.add('hidden');return;}const list=state.doctors.filter(d=>[d.name,doctorHospital(d),inferDoctorArea(d),doctorType(d),d.address].join(' ').toLowerCase().includes(q)).slice(0,12);results.innerHTML=list.length?list.map(d=>`<button type="button" data-nearby-doctor-id="${d.id}"><strong>${esc(d.name)}</strong><small>${esc(doctorHospital(d)||'Hospital not linked')}</small></button>`).join(''):empty('No doctor match. Add the doctor first from Doctors.');results.classList.remove('hidden');});
  results.addEventListener('click',e=>{const b=e.target.closest('[data-nearby-doctor-id]');if(b)selectDoctor(b.dataset.nearbyDoctorId);});
}
function discoverNearbyHospitals(){
  nearbyPlaceCache.clear();const defaultRadius=num(state.settings.nearbyRadiusMeters)||1000;
  openSheet('Nearby hospitals','GPS first → hospital/clinic → accurate doctor → Google cross-check → save verified pin.',`<div class="location-card"><div class="location-head"><div><strong>My current location</strong><small id="nearbyLocationStatus" class="location-status loading">Preparing GPS…</small></div><button type="button" id="nearbyFetchLocation" class="btn secondary compact">Fetch GPS</button></div><a id="nearbyLocationMap" class="hidden" target="_blank" rel="noopener">View my map</a><input id="nearbyLatitude" type="hidden"><input id="nearbyLongitude" type="hidden"><input id="nearbyAccuracy" type="hidden"><input id="nearbyCapturedAt" type="hidden"></div><div class="nearby-controls"><label><span>Search radius</span><select id="nearbyRadius"><option value="500" ${defaultRadius===500?'selected':''}>500 m</option><option value="1000" ${defaultRadius===1000?'selected':''}>1 km</option><option value="2000" ${defaultRadius===2000?'selected':''}>2 km</option><option value="5000" ${defaultRadius===5000?'selected':''}>5 km</option></select></label><button id="nearbyFreeSearchBtn" type="button" class="btn primary">Search nearby FREE</button></div>${hasOptionalGooglePlaces()?'<div class="button-row"><button id="nearbyGoogleSearchBtn" type="button" class="btn secondary">Optional Google search</button></div>':''}<small id="nearbyLiveStatus" class="muted-line">Free live search uses OpenStreetMap for hospitals, clinics and doctor offices. Results are cached; saved pins continue offline.</small><div id="nearbyResults">${empty('Fetching current location…')}</div><div class="google-attribution">© OpenStreetMap contributors • Overpass public service • manual search only • saved pins work offline.</div>`);
  const renderSaved=()=>{const lat=num($('#nearbyLatitude').value),lng=num($('#nearbyLongitude').value),radius=num($('#nearbyRadius').value)||1000;if(!lat||!lng)return;state.settings.nearbyRadiusMeters=radius;saveState(false);const saved=savedHospitalGroups(lat,lng,radius);saved.forEach(x=>nearbyPlaceCache.set(x.id,x));$('#nearbyResults').innerHTML=saved.length?saved.map(nearbyResultCard).join(''):empty('No saved hospital in this radius. Tap Search nearby FREE.');};
  document.addEventListener('mr-location-ready',e=>{if(e.detail.prefix==='nearby')renderSaved();},{once:true});
  $('#nearbyRadius').addEventListener('change',renderSaved);$('#nearbyResults').addEventListener('click',e=>{const b=e.target.closest('[data-nearby-place-id]');if(b)chooseNearbyHospital(nearbyPlaceCache.get(b.dataset.nearbyPlaceId));});
  $('#nearbyFreeSearchBtn').addEventListener('click',()=>{const lat=num($('#nearbyLatitude').value),lng=num($('#nearbyLongitude').value),radius=num($('#nearbyRadius').value)||1000;if(!lat||!lng){toast('Fetch current GPS first.');return;}const status=$('#nearbyLiveStatus');status.textContent='Searching OpenStreetMap hospitals, clinics and doctor offices…';if(window.AndroidBridge?.searchNearbyOpenStreetMap){window.AndroidBridge.searchNearbyOpenStreetMap('nearby-osm',lat,lng,radius);return;}status.textContent='Free nearby search needs the Android APK. Saved nearby hospitals are shown above.';});
  $('#nearbyGoogleSearchBtn')?.addEventListener('click',()=>{const lat=num($('#nearbyLatitude').value),lng=num($('#nearbyLongitude').value),radius=num($('#nearbyRadius').value)||1000;if(!lat||!lng){toast('Fetch current GPS first.');return;}const status=$('#nearbyLiveStatus');status.textContent='Searching optional Google Places…';if(window.AndroidBridge?.searchNearbyHospitals){window.AndroidBridge.searchNearbyHospitals('nearby',lat,lng,radius);return;}status.textContent='Google Places is unavailable in this build.';});
  setupLocationCapture('nearby',true);
}

  function resolvedTheme(){const saved=clean(state.settings.theme||'system');if(saved==='system')return window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';return ['light','dark','black'].includes(saved)?saved:'light';}
  function applyTheme(){const theme=resolvedTheme();document.documentElement.dataset.theme=theme;const meta=$('#themeColorMeta');if(meta)meta.content=theme==='black'?'#000000':theme==='dark'?'#0b0d10':'#f7f8fa';$$('[data-theme-choice]').forEach(b=>b.classList.toggle('active',b.dataset.themeChoice===(state.settings.theme||'system')));const ht=$('#hapticsToggle');if(ht)ht.checked=state.settings.haptics!==false;}
  function setThemeChoice(value){state.settings.theme=['system','light','dark','black'].includes(value)?value:'system';saveState(false);applyTheme();haptic('selection');}

  function renderActivePage(){
    if(activePage==='dashboard')renderDashboard();
    else if(activePage==='doctors')renderDoctors();
    else if(activePage==='chemists')renderChemists();
    else if(activePage==='visits')renderVisits();
    else if(activePage==='tools')renderTools();
  }
  function renderAll() { renderHeader(); renderActivePage(); }
  function renderHeader() {
    $('#profileLine').textContent = `${state.profile.hq || 'My HQ'} • ${state.profile.tmName || 'TM'}`;
    const h=now().getHours();
    $('#greeting').textContent = h<12?'Good morning':h<17?'Good afternoon':'Good evening';
    $('#todayLabel').textContent = now().toLocaleDateString('en-IN',{weekday:'short',day:'2-digit',month:'short'}).toUpperCase();
    $('#routeLabel').textContent = state.settings.workflowMode==='collect'?'Setup: doctor → hospital → timing → GPS verify.':'Doctor call → chemist/RCPA → POB → report.';
  }
  function renderDashboard() {
    const today=localISODate(), t=statsForDay(today), c=statsForMonth(today);
    $('#reportPeriod').textContent=`Today / ${now().toLocaleDateString('en-IN',{month:'long'})} cumulative`;
    $('#reportKpis').innerHTML=METRICS.map(([k,label])=>`<div class="report-kpi"><small>${esc(label)}</small><strong>${esc(formatMetric(k,t[k]))} <span>/ ${esc(formatMetric(k,c[k]))}</span></strong></div>`).join('');
    $('#doctorCount').textContent=state.doctors.length;
    $('#chemistCount').textContent=state.chemists.length;
    $('#todayVisitCount').textContent=rowsForDay(today).filter(v=>v.doctorId||v.chemistId).length;
    const due=dueEntities(); $('#dueCount').textContent=due.length;
    const todayAppointments=appointmentsForDate(today).filter(x=>!['Cancelled','Not available'].includes(x.status)),sale=salesForMonth(monthKey(today)),salesPct=sale?.target?Math.round(num(sale.secondary)/num(sale.target)*100):0;
    if($('#todayAppointmentCount'))$('#todayAppointmentCount').textContent=String(todayAppointments.length);
    renderCallReminders();
    renderNextCallPanel();
    if($('#salesProgressText'))$('#salesProgressText').textContent=sale?.target?`${salesPct}% • ₹${num(sale.secondary).toLocaleString('en-IN')}`:'Not set';
    const activities=rowsForDay(today).filter(v=>v.doctorId||v.chemistId).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,6);
    $('#todayActivityList').innerHTML=activities.length?activities.map(miniActivity).join(''):empty('No meeting logged today. Tap + to start.');
    $('#nextActionsList').innerHTML=due.length?due.slice(0,6).map(miniDue).join(''):empty('No follow-ups due.');
    const cov=collectionCoverage(), mode=state.settings.workflowMode||'collect';
    $('#collectionModeTitle').textContent=mode==='collect'?'Data gathering mode':'Field work mode';
    $('#collectionModeText').textContent=mode==='collect'?'Confirm doctor, hospital, timing and one accurate GPS pin. Field AI uses it for the next-call patch.':'Field AI now uses saved clinic access, timing, follow-up and verified GPS to guide the day.';
    $('#collectionProgressBar').style.width=`${Math.min(100,cov.score)}%`;
    $('#collectionProgressText').textContent=`${cov.score}% ready • ${cov.gps}/${cov.total} GPS • ${cov.timing}/${cov.total} timings • ${cov.linked}/${cov.total} chemist links`;
    $('#workflowModeBtn').textContent=mode==='collect'?'Switch to field work':'Back to data gathering';
    const routeReady=state.doctors.filter(d=>num(d.latitude)&&num(d.longitude)).length;
    $('#nearbyReadyCount').textContent=state.doctors.filter(d=>doctorHospital(d)&&d.latitude&&d.longitude).length;
    $('#routeReadyCount').textContent=routeReady;
    $('#routeReadyText').textContent=routeReady?`${routeReady} doctors have GPS ready • filter and select exactly who you want`:`Add/verify doctor GPS, then filter and select your route`;
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

  function selectedRouteDoctors(){return [...selectedRouteDoctorIds].map(doctorById).filter(Boolean);}
  let selectedRouteGpsListener=null;
  function setSelectedRouteDoctorOrder(doctors){
    selectedRouteDoctorIds=new Set(doctors.map(d=>d.id));
  }
  function moveSelectedRouteDoctor(id,delta){
    const list=selectedRouteDoctors(),from=list.findIndex(d=>d.id===id);if(from<0)return;
    const to=Math.max(0,Math.min(list.length-1,from+delta));if(to===from)return;
    const [item]=list.splice(from,1);list.splice(to,0,item);setSelectedRouteDoctorOrder(list);rerenderSelectedRouteFromSheet();
  }
  function moveSelectedRouteDoctorTo(id){
    const list=selectedRouteDoctors(),from=list.findIndex(d=>d.id===id);if(from<0)return;
    const raw=prompt(`Move ${doctorDisplayName(list[from])} to position 1–${list.length}`,String(from+1));if(raw===null)return;
    const pos=Math.max(1,Math.min(list.length,Math.round(Number(raw)||0)));if(!pos)return;
    const [item]=list.splice(from,1);list.splice(pos-1,0,item);setSelectedRouteDoctorOrder(list);rerenderSelectedRouteFromSheet();
  }
  function renderDoctorRouteSelectionUi(){
    const bar=$('#doctorRouteBar'),btn=$('#doctorRouteSelectBtn');if(!bar||!btn)return;
    const count=selectedRouteDoctorIds.size;
    btn.textContent=doctorRouteSelectMode?(count?`Done (${count})`:'Done'):(count?`Route (${count})`:'Route');
    btn.classList.toggle('active',doctorRouteSelectMode||count>0);
    if(!doctorRouteSelectMode&&!count){bar.classList.add('hidden');bar.innerHTML='';return;}
    bar.classList.remove('hidden');
    bar.innerHTML=`<div class="route-selection-copy"><strong>${esc(count)} selected</strong><small>${doctorRouteSelectMode?'Tap + on doctor cards. Filters/search can change; selected doctors stay selected.':'Selection saved. Open Route to continue selecting.'}</small></div><div class="route-selection-actions"><button type="button" class="btn secondary compact" data-action="select-shown-route-doctors">Select shown</button><button type="button" class="btn secondary compact" data-action="clear-route-doctors" ${count?'':'disabled'}>Clear</button><button type="button" class="btn primary compact" data-action="build-selected-doctor-route" ${count?'':'disabled'}>Build route</button></div>`;
  }
  function startDoctorRouteSelection(){doctorRouteSelectMode=true;navigate('doctors');renderDoctorRouteSelectionUi();toast('Filter/search, then select every doctor you want. One full route list will keep all selections.');}
  function toggleDoctorRouteMode(){doctorRouteSelectMode=!doctorRouteSelectMode;renderDoctors();}
  function toggleSelectedRouteDoctor(id){if(!doctorById(id))return;selectedRouteDoctorIds.has(id)?selectedRouteDoctorIds.delete(id):selectedRouteDoctorIds.add(id);renderDoctors();}
  function clearSelectedRouteDoctors(){selectedRouteDoctorIds.clear();renderDoctors();}
  function selectShownRouteDoctors(){lastRenderedDoctorIds.forEach(id=>selectedRouteDoctorIds.add(id));doctorRouteSelectMode=true;renderDoctors();}
  function doctorRouteAddress(doctor){return clean(doctor?.address||doctor?.hospitalAddress||'');}
  function doctorRouteGoogleQuery(doctor){
    if(!doctor)return '';
    const name=cleanGpsQueryPart(doctor.name),hospital=cleanGpsQueryPart(doctorHospital(doctor)),address=cleanGpsQueryPart(doctorRouteAddress(doctor));
    const type=cleanGpsQueryPart(doctorType(doctor)),area=cleanGpsQueryPart(inferDoctorArea(doctor)),hq=cleanGpsQueryPart(doctor.hq||state.profile.hq||'Ahmedabad');
    if(address)return [name,hospital,address].filter(Boolean).join(', ');
    return [name,hospital,type,area,hq,'Gujarat','India'].filter(Boolean).join(', ');
  }
  function doctorRouteGoogleUrl(doctor){const q=doctorRouteGoogleQuery(doctor);return q?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`:'';}
  function doctorRouteHasGps(doctor){return Boolean(num(doctor?.latitude)&&num(doctor?.longitude));}
  function doctorRouteHasAddress(doctor){return Boolean(doctorRouteAddress(doctor));}
  function doctorRouteRoutable(doctor){return doctorRouteHasGps(doctor)||doctorRouteHasAddress(doctor);}
  function doctorRouteOperand(doctor){
    if(!doctor)return '';
    const status=doctorLocationVerification(doctor);
    if(doctorRouteHasGps(doctor)&&(status.verified||!doctorRouteHasAddress(doctor)))return `${num(doctor.latitude)},${num(doctor.longitude)}`;
    return doctorRouteGoogleQuery(doctor)||`${num(doctor.latitude)},${num(doctor.longitude)}`;
  }
  function doctorRouteNavigateUrl(doctor){
    const destination=doctorRouteOperand(doctor);if(!destination)return '';
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving&dir_action=navigate`;
  }
  function selectedRouteDistance(order,start){if(!order.length||!start)return 0;let total=0,lat=num(start.latitude),lng=num(start.longitude),seen=false;for(const d of order){if(!doctorRouteHasGps(d))continue;total+=smartRoadKm(lat,lng,d.latitude,d.longitude);lat=num(d.latitude);lng=num(d.longitude);seen=true;}return seen?total:0;}
  function selectedDoctorsGoogleMapsUrl(doctors){
    const list=(doctors||[]).filter(Boolean);
    if(!list.length||list.length>9||list.some(d=>!doctorRouteRoutable(d)))return '';
    if(list.length===1)return doctorRouteNavigateUrl(list[0]);
    const first=list[0],last=list[list.length-1],middle=list.slice(1,-1);
    const origin=doctorRouteOperand(first),destination=doctorRouteOperand(last);
    if(!origin||!destination)return '';
    const params=[`api=1`,`origin=${encodeURIComponent(origin)}`,`destination=${encodeURIComponent(destination)}`];
    if(clean(first.placeId))params.push(`origin_place_id=${encodeURIComponent(clean(first.placeId))}`);
    if(clean(last.placeId))params.push(`destination_place_id=${encodeURIComponent(clean(last.placeId))}`);
    if(middle.length){
      params.push(`waypoints=${encodeURIComponent(middle.map(doctorRouteOperand).join('|'))}`);
      if(middle.every(d=>clean(d.placeId)))params.push(`waypoint_place_ids=${encodeURIComponent(middle.map(d=>clean(d.placeId)).join('|'))}`);
    }
    params.push('travelmode=driving');
    return `https://www.google.com/maps/dir/?${params.join('&')}`;
  }
  function rerenderSelectedRouteFromSheet(){
    const lat=num($('#selectedrouteLatitude')?.value),lng=num($('#selectedrouteLongitude')?.value),accuracy=num($('#selectedrouteAccuracy')?.value);
    if(lat&&lng)renderSelectedDoctorRoutePreview(lat,lng,accuracy);else renderSelectedDoctorRoutePreview(0,0,0);
  }
  function renderSelectedDoctorRoutePreview(latitude,longitude,accuracy=0){
    const out=$('#selectedRouteResults');if(!out)return;
    const selected=selectedRouteDoctors();
    if(!selected.length){out.innerHTML=empty('No doctors selected.');return;}
    const routable=selected.filter(doctorRouteRoutable),needsLocation=selected.filter(d=>!doctorRouteRoutable(d));
    const start=latitude&&longitude?{latitude:num(latitude),longitude:num(longitude)}:null,totalKm=start?selectedRouteDistance(selected,start):0;
    const googleMultiUrl=selectedDoctorsGoogleMapsUrl(selected),withinGoogleLimit=selected.length<=9;
    const routeRows=selected.map((d,i)=>{
      const v=doctorLocationVerification(d),hasGps=doctorRouteHasGps(d),hasAddress=doctorRouteHasAddress(d),mode=hasGps?(v.verified?'Verified GPS':'Saved GPS'):(hasAddress?'Address':'Find address'),query=doctorRouteGoogleQuery(d);
      return `<div class="route-stop ${!doctorRouteRoutable(d)?'route-risk':''}"><span>${i<26?String.fromCharCode(65+i):String(i+1)}</span><div><strong>${esc(doctorDisplayName(d))}</strong><small>${esc([mode,doctorHospital(d),doctorRouteAddress(d)||inferDoctorArea(d),doctorType(d)].filter(Boolean).join(' • '))}</small><em>${esc(query)}</em></div><div class="route-stop-actions"><button class="btn secondary compact" data-action="route-move-up" data-id="${esc(d.id)}" ${i===0?'disabled':''}>↑</button><button class="btn secondary compact" data-action="route-move-down" data-id="${esc(d.id)}" ${i===selected.length-1?'disabled':''}>↓</button><button class="btn secondary compact" data-action="route-move-to" data-id="${esc(d.id)}">Move</button><a class="btn secondary compact" href="${doctorRouteGoogleUrl(d)}" target="_blank" rel="noopener">${hasAddress||hasGps?'Google check':'Find address'}</a></div></div>`;
    }).join('');
    let mapAction='';
    if(!withinGoogleLimit){
      mapAction=`<div class="notice route-limit"><strong>Google Maps limit:</strong> Android Google Maps accepts up to 9 stops in one multi-stop route. MR One kept all ${esc(selected.length)} selected doctors together and did not split or drop any doctor. To open the exact A/B/C draggable Maps screen, select 9 or fewer doctors.</div>`;
    }else if(needsLocation.length){
      mapAction=`<div class="notice"><strong>Confirm ${esc(needsLocation.length)} location${needsLocation.length===1?'':'s'} first.</strong> Use Find address / Google check. After every selected doctor has a saved address or GPS, this same button opens the complete A/B/C route in Google Maps.</div>`;
    }else if(googleMultiUrl){
      mapAction=`<a class="btn primary full" href="${googleMultiUrl}" target="_blank" rel="noopener">Open all ${esc(selected.length)} selected doctor${selected.length===1?'':'s'} in Google Maps</a><small class="muted-line">Google Maps opens the selected doctors as one editable multi-stop route in this exact order. Drag the stops inside Maps to rearrange them.</small>`;
    }
    out.innerHTML=`<div class="manager-summary"><div><small>SELECTED</small><strong>${esc(selected.length)}</strong></div><div><small>LOCATION READY</small><strong>${esc(routable.length)}</strong></div><div><small>NEEDS ADDRESS</small><strong>${esc(needsLocation.length)}</strong></div></div><div class="notice"><strong>Selected doctors → Google Maps multi-stop route.</strong> Your manual order becomes A → B → C → D… in Maps. Google resolves each stop from confirmed Place ID when available, otherwise saved GPS/address.${totalKm?` Saved-GPS chain is about ${esc(totalKm.toFixed(1))} km before Google road calculation.`:''}${accuracy?` Current GPS accuracy ±${esc(Math.round(accuracy))} m.`:''}</div>${mapAction}<div class="selected-route-list">${routeRows}</div>${needsLocation.length?`<div class="notice">Address missing means only “not saved yet.” Search uses Doctor + Hospital/Clinic + Type + Area/City, confirm the correct Google result, save address/GPS, then reopen the selected route.</div>`:''}`;
  }

  function buildSelectedDoctorRoute(){
    const selected=selectedRouteDoctors();if(!selected.length){toast('Select at least one doctor first.');return;}
    openSheet('Selected doctor route',`${selected.length} doctors • manual order → Google Maps`,`<div class="notice"><strong>Google Maps route:</strong> selected doctors stay in your manual order. With 9 or fewer location-ready doctors, Open in Google Maps launches the editable A/B/C multi-stop screen.</div><div class="location-card"><div class="location-head"><div><strong>My current location</strong><small id="selectedrouteLocationStatus" class="location-status loading">Fetching current GPS…</small></div><button type="button" id="selectedrouteFetchLocation" class="btn secondary compact">Refresh GPS</button></div><a id="selectedrouteLocationMap" class="hidden" target="_blank" rel="noopener">View my location</a><input id="selectedrouteLatitude" type="hidden"><input id="selectedrouteLongitude" type="hidden"><input id="selectedrouteAccuracy" type="hidden"><input id="selectedrouteCapturedAt" type="hidden"></div><div id="selectedRouteResults">${empty('Preparing your full selected route…')}</div>`);
    if(selectedRouteGpsListener)document.removeEventListener('mr-location-ready',selectedRouteGpsListener);selectedRouteGpsListener=e=>{if(e.detail?.prefix!=='selectedroute')return;renderSelectedDoctorRoutePreview(e.detail.latitude,e.detail.longitude,e.detail.accuracy||0);};document.addEventListener('mr-location-ready',selectedRouteGpsListener);
    if(lastFieldLocation){$('#selectedrouteLatitude').value=lastFieldLocation.latitude;$('#selectedrouteLongitude').value=lastFieldLocation.longitude;$('#selectedrouteAccuracy').value=lastFieldLocation.accuracy||'';renderSelectedDoctorRoutePreview(lastFieldLocation.latitude,lastFieldLocation.longitude,lastFieldLocation.accuracy||0);}else renderSelectedDoctorRoutePreview(0,0,0);
    setupLocationCapture('selectedroute',true);
  }

  function renderDoctors() {
    const searchEl=$('#doctorSearch');if(!searchEl)return;
    const q=clean(searchEl.value).toLowerCase();
    const areaCounts=new Map();
    state.doctors.forEach(d=>{const a=inferDoctorArea(d)||clean(d.area||d.hq)||'Other';areaCounts.set(a,(areaCounts.get(a)||0)+1);});
    const topAreas=[...areaCounts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,6).map(([a])=>a);
    const chips=[
      ['all','All'],
      ['today_available','Today’s Available'],
      ['timing','Timing ✓'],
      ['no_timing','Timing missing'],
      ['address_missing','Address missing'],
      ['type:PEDIA','Pedia'],
      ['type:GYNAEC','Gynaec'],
      ['type:GP','GP'],
      ...topAreas.map(a=>[`area:${a}`,a])
    ];
    $('#doctorChips').innerHTML=chips.map(([key,label])=>`<button class="chip ${doctorFilterHas(key)?'active':''}" data-doctor-chip="${esc(key)}">${esc(label)}</button>`).join('');
    let list=state.doctors.filter(d=>{
      const ch=linkedChemist(d),area=inferDoctorArea(d),type=doctorType(d);
      const hay=[d.name,doctorHospital(d),d.address,area,d.hq,ch?.name,d.notes,type,...suggestedProductsForDoctor(d)].join(' ').toLowerCase();
      if(q&&!hay.includes(q))return false;
      if(doctorFilters.todayAvailable&&!doctorTodayAvailability(d).available)return false;
      if(doctorFilters.timing==='timing'&&!doctorHasTiming(d))return false;
      if(doctorFilters.timing==='no_timing'&&doctorHasTiming(d))return false;
      if(doctorFilters.addressMissing&&clean(d.address||d.hospitalAddress))return false;
      if(doctorFilters.types.size&&!doctorFilters.types.has(type))return false;
      if(doctorFilters.areas.size&&!doctorFilters.areas.has(area))return false;
      return true;
    }).sort((a,b)=>{
      if(!q&&!doctorFiltersActive()){const aa=inferDoctorArea(a),bb=inferDoctorArea(b);return aa.localeCompare(bb)||a.name.localeCompare(b.name);}
      if(doctorFilters.todayAvailable){
        const rank=x=>{const st=doctorTodayAvailability(x);return st.state==='available'?0:st.state==='appointment'?1:st.state==='upcoming'?2:st.state==='card_task'?3:4;},ta=doctorTodayAvailability(a),tb=doctorTodayAvailability(b),sa=ta.slot?.start??9999,sb=tb.slot?.start??9999;
        return rank(a)-rank(b)||sa-sb||inferDoctorArea(a).localeCompare(inferDoctorArea(b))||a.name.localeCompare(b.name);
      }
      const rank=x=>doctorMeetingStatus(x).state==='available'?0:doctorMeetingStatus(x).state==='upcoming'?1:2;
      return rank(a)-rank(b)||a.name.localeCompare(b.name);
    });
    const filterCount=doctorFilterCount();
    if($('#doctorFilterBtn'))$('#doctorFilterBtn').textContent=filterCount?`Filter (${filterCount})`:'Filter';
    $('#doctorSubtitle').textContent=doctorFilters.todayAvailable?`${list.length} doctors match • available today + ${Math.max(0,filterCount-1)} other filter${filterCount===2?'':'s'}`:`${list.length} of ${state.doctors.length} records${filterCount?` • ${filterCount} filter${filterCount===1?'':'s'} active`:''} • ${list.filter(doctorHasTiming).length} timing ready`;
    const visible=list.slice(0,doctorRenderLimit);
    lastRenderedDoctorIds=visible.map(d=>d.id);
    renderDoctorRouteSelectionUi();
    if(!visible.length){$('#doctorList').innerHTML=empty('No doctors match this filter combination. Remove one filter or reset all.');return;}
    let html='';
    if(!q&&!doctorFiltersActive()){
      const groups=new Map();
      visible.forEach(d=>{const area=inferDoctorArea(d)||'Other';if(!groups.has(area))groups.set(area,[]);groups.get(area).push(d);});
      html=[...groups.entries()].map(([area,rows])=>`<section class="area-group"><div class="area-group-head"><div><span>${esc(area)}</span><small>${esc(areaCounts.get(area)||rows.length)} doctors</small></div></div>${rows.map(d=>recordCard(d,'doctor')).join('')}</section>`).join('');
    }else html=visible.map(d=>recordCard(d,'doctor')).join('');
    if(list.length>visible.length)html+=`<button class="btn secondary full load-more-btn" data-action="show-more-doctors">Show ${Math.min(60,list.length-visible.length)} more • ${list.length-visible.length} remaining</button>`;
    $('#doctorList').innerHTML=html;
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
    const visible=list.slice(0,chemistRenderLimit);
    $('#chemistList').innerHTML=visible.length?visible.map(c=>recordCard(c,'chemist')).join('')+(list.length>visible.length?`<button class="btn secondary full load-more-btn" data-action="show-more-chemists">Show ${Math.min(60,list.length-visible.length)} more • ${list.length-visible.length} remaining</button>`:''):empty('No matching chemists. Import Excel or add one.');
  }
  function recordCard(r,type) {
    const isDoctor=type==='doctor';
    const ch=isDoctor?linkedChemist(r):null;
    const fb=!isDoctor?statusCountsForChemist(r.id):null;
    const map=entityMapUrl(r);
    const area=isDoctor?inferDoctorArea(r):clean(r.area||r.hq);
    const doctorKind=isDoctor?doctorType(r):'';
    const products=isDoctor?suggestedProductsForDoctor(r):[];
    const subtitle=isDoctor?[ch?.name||'Chemist not linked',area].filter(Boolean).join(' • '):[`${linkedDoctorCount(r.id)} doctors`,area].filter(Boolean).join(' • ');
    const timing=isDoctor?doctorMeetingStatus(r):null;
    const tags=isDoctor?
      [doctorClinicSystemLabel(r),doctorVisitPolicy(r).label,r.needsCompletion&&'Needs completion',r.latitude&&'Clinic GPS',r.lastVisit&&`Last ${prettyDate(r.lastVisit)}`,r.nextFollowUp&&`Due ${prettyDate(r.nextFollowUp)}`].filter(Boolean):
      [fb.prescribed&&`${fb.prescribed} prescribed`,fb.notPrescribed&&`${fb.notPrescribed} not prescribed`,r.latitude&&'Shop GPS'].filter(Boolean);
    const todayAvailability=isDoctor&&doctorFilters.todayAvailable?doctorTodayAvailability(r):null;
    const timingTag=isDoctor?`<span class="tag timing ${timing.state==='available'?'good':timing.state==='unset'?'missing':''}">${esc(doctorClinicSystem(r)==='appointment'?'Appointment access':doctorClinicSystem(r)==='card_later'?(cardDroppedForDate(r.id)?'Card given • meeting ready':`Card ${timeLabel(doctorCardDropTime(r))}`):(timing.state==='unset'?'Timing missing':timing.label))}</span>`:'';
    const todayAvailabilityTag=isDoctor&&doctorFilters.todayAvailable?`<span class="tag ${todayAvailability?.state==='available'?'good':''}">${esc(todayAvailability?.label||'Available today')}</span>`:'';
    const typeTag=isDoctor?`<span class="tag specialty">${esc(doctorKind)}</span>`:'';
    const productTags=isDoctor?products.slice(0,3).map(t=>`<span class="tag product-fit">${esc(t)}</span>`).join(''):'';
    const locationAction=map?`<a href="${map}" target="_blank" rel="noopener">Map</a>`:`<button data-action="edit-record" data-type="${type}" data-id="${r.id}">Location</button>`;
    const verification=isDoctor?doctorLocationVerification(r):null;
    const verifyAction=isDoctor?`<button data-action="verify-doctor-location" data-id="${r.id}">${verification.verified?'Verified':'Verify'}</button>`:'';
    const actions=isDoctor?`${verifyAction}${locationAction}<button class="primary-action" data-action="log-record" data-type="doctor" data-id="${r.id}">Call</button><button data-action="view-record" data-type="doctor" data-id="${r.id}">View</button>`:`${locationAction}<button class="primary-action" data-action="chemist-visit" data-id="${r.id}">Visit</button><button data-action="quick-rcpa" data-id="${r.id}">RCPA</button><button data-action="view-record" data-type="chemist" data-id="${r.id}">View</button>`;
    const routeSelected=isDoctor&&selectedRouteDoctorIds.has(r.id),routePick=isDoctor&&doctorRouteSelectMode?`<button type="button" class="route-pick ${routeSelected?'selected':''}" data-action="toggle-route-doctor" data-id="${esc(r.id)}" aria-pressed="${routeSelected?'true':'false'}" aria-label="${routeSelected?'Remove from':'Add to'} route">${routeSelected?'✓':'＋'}</button>`:'';
    return `<article class="record-card ${routeSelected?'route-selected':''}"><div class="record-top"><div class="avatar">${esc(initials(r.name))}</div><div class="record-title"><div class="title-line"><h3>${esc(isDoctor?doctorDisplayName(r):r.name)}</h3>${typeTag}</div><p>${esc(subtitle||'Details not added')}</p></div>${routePick}</div>${r.address?`<p class="record-note">${esc(r.address).slice(0,180)}</p>`:''}<div class="tag-row">${todayAvailabilityTag}${timingTag}${isDoctor?`<span class="tag ${verification?.verified?'good':verification?.hasGps?'due':''}">${esc(verification?.label||'')}</span>`:''}${productTags}${tags.slice(0,1).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div><div class="record-actions ${isDoctor?'doctor-actions-four':'chemist-actions-four'}">${actions}</div></article>`;
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
    const sale=salesForMonth();
    if($('#rcpaToolText'))$('#rcpaToolText').textContent=`${state.rcpa.filter(x=>monthKey(x.date)===monthKey()).length} RCPA this month`;
    if($('#salesToolText'))$('#salesToolText').textContent=sale?.target?`₹${num(sale.secondary).toLocaleString('en-IN')} / ₹${num(sale.target).toLocaleString('en-IN')}`:'Monthly target not set';
    if($('#appUpdateToolText')){const v=nativeAppVersion();$('#appUpdateToolText').textContent=`v${v.versionName||'—'} • Check & install direct`; }
  }

  function navigate(page) {
    activePage=page;
    $$('.page').forEach(p=>p.classList.toggle('active',p.dataset.page===page));
    $$('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.nav===page));
    window.scrollTo({top:0,behavior:'auto'});
    if(page==='dashboard')renderDashboard();
    if(page==='doctors'){doctorRenderLimit=60;renderDoctors();}
    if(page==='chemists'){chemistRenderLimit=60;renderChemists();}
    if(page==='visits')renderVisits(); if(page==='tools')renderTools();
  }
  window.__mrHandleBack=()=>{
    if(!$('#editorSheet')?.classList.contains('hidden')){closeSheet();return 'handled';}
    if(activePage!=='dashboard'){navigate('dashboard');return 'handled';}
    return 'exit';
  };
  function openSheet(title,subtitle,body) {
    $('#sheetTitle').textContent=title; $('#sheetSubtitle').textContent=subtitle||''; $('#sheetBody').innerHTML=body;
    $('#sheetBackdrop').classList.remove('hidden'); $('#editorSheet').classList.remove('hidden'); document.body.style.overflow='hidden';
  }
  function closeSheet(){ if(window.AndroidBridge?.stopVoiceCapture)window.AndroidBridge.stopVoiceCapture();voiceHandlers?.clear?.();$('#sheetBackdrop').classList.add('hidden');$('#editorSheet').classList.add('hidden');document.body.style.overflow=''; }
  function toast(text){const el=$('#toast');el.textContent=text;el.classList.remove('hidden');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.add('hidden'),2600);}

  function nativeAppVersion(){
    try{return window.AndroidBridge?.getAppVersionInfo?JSON.parse(window.AndroidBridge.getAppVersionInfo()):{versionName:'web',versionCode:0};}
    catch(_){return {versionName:'unknown',versionCode:0};}
  }
  function humanBytes(value){const n=num(value);if(!n)return '';if(n<1024*1024)return `${Math.max(1,Math.round(n/1024))} KB`;return `${(n/1024/1024).toFixed(1)} MB`;}
  function updateStatusText(text,kind=''){
    const el=$('#appUpdateStatus');if(!el)return;el.className=`notice${kind?` ${kind}`:''}`;el.textContent=text;
  }
  function manageAppUpdate(){
    const current=nativeAppVersion();
    openSheet('App update',`Installed MR One v${current.versionName||'unknown'}`,`<div class="note-box">Future updates can be checked and installed here. No Termux artifact download is needed after the stable-signed update channel is installed.</div><div id="appUpdateStatus" class="notice">Ready to check GitHub Release.</div><div id="appUpdateRelease" class="detail-section hidden"></div><div class="detail-actions"><button class="btn primary" id="checkAppUpdateBtn">Check update</button><button class="btn secondary hidden" id="downloadAppUpdateBtn">Download & update</button><button class="btn secondary hidden" id="installDownloadedUpdateBtn">Install downloaded update</button></div><small class="muted-line">Android always asks you to confirm the final app update. The first time, Android may also ask permission to install updates from MR One.</small>`);
    $('#checkAppUpdateBtn')?.addEventListener('click',()=>{
      if(!window.AndroidBridge?.checkAppUpdate){updateStatusText('Direct update requires the Android APK.','error');return;}
      updateStatusText('Checking latest MR One release…');
      window.AndroidBridge.checkAppUpdate();
    });
    $('#downloadAppUpdateBtn')?.addEventListener('click',()=>{
      const x=appUpdateInfo;if(!x?.downloadUrl){updateStatusText('Check update first.','error');return;}
      updateStatusText('Starting update download…');
      window.AndroidBridge?.downloadAppUpdate?.(x.downloadUrl,x.assetName||'',x.digest||'',x.latestVersion||'');
    });
    $('#installDownloadedUpdateBtn')?.addEventListener('click',()=>window.AndroidBridge?.installDownloadedUpdate?.());
    setTimeout(()=>$('#checkAppUpdateBtn')?.click(),120);
  }
  window.__mrAppUpdateCheck=(ok,data,error)=>{
    if(!ok){appUpdateInfo=null;updateStatusText(error||'Could not check for update.','error');return;}
    appUpdateInfo=data||{};
    const current=clean(appUpdateInfo.installedVersion),latest=clean(appUpdateInfo.latestVersion),size=humanBytes(appUpdateInfo.size);
    const box=$('#appUpdateRelease');if(box){box.classList.remove('hidden');const notes=clean(appUpdateInfo.releaseNotes).slice(0,900);box.innerHTML=`<h4>${appUpdateInfo.updateAvailable?'Update available':'You are up to date'}</h4><div class="detail-address">Installed v${esc(current||'—')} • Latest v${esc(latest||'—')}${size?` • ${esc(size)}`:''}</div>${notes?`<div class="note-box">${esc(notes)}</div>`:''}`;}
    const download=$('#downloadAppUpdateBtn');if(download)download.classList.toggle('hidden',!appUpdateInfo.updateAvailable);
    updateStatusText(appUpdateInfo.updateAvailable?`MR One v${latest} is ready.`:`MR One v${current} is already latest.`,appUpdateInfo.updateAvailable?'':'good');
  };
  window.__mrAppUpdateState=(stateName,message)=>{
    const kind=stateName==='error'?'error':stateName==='installer'?'good':'';updateStatusText(message||stateName,kind);
    const install=$('#installDownloadedUpdateBtn');if(install)install.classList.toggle('hidden',!['permission','ready','installer'].includes(stateName));
    if(stateName==='downloading')toast('Update downloading…');
    if(stateName==='installer')toast('Confirm Update in Android installer.');
  };

  function doctorOptions(selected='') {
    return `<option value="">Select doctor</option>${state.doctors.slice().sort((a,b)=>doctorDisplayName(a).localeCompare(doctorDisplayName(b))).map(d=>`<option value="${esc(d.id)}" ${d.id===selected?'selected':''}>${esc(doctorDisplayName(d))} • ${esc(doctorType(d))} • ${esc(inferDoctorArea(d))}</option>`).join('')}`;
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



  // ---- Doctor appointments / doctor-will-call reminders ----
  const APPOINTMENT_STATUSES=['Confirmed','Doctor will call','Requested','Tentative','Completed','Cancelled','Not available'];
  const CLINIC_SYSTEM_LABELS={direct:'Direct timed meeting',appointment:'Appointment required',card_later:'Card drop → later meeting'};
  function doctorClinicSystem(doctor){const value=clean(doctor?.clinicSystem);return ['direct','appointment','card_later'].includes(value)?value:'direct';}
  function doctorClinicSystemLabel(doctor){return CLINIC_SYSTEM_LABELS[doctorClinicSystem(doctor)]||CLINIC_SYSTEM_LABELS.direct;}
  function doctorCardDropTime(doctor){return normalizeTime(doctor?.cardDropTime)||'10:00';}
  function cardDropActionForDate(doctorId,date=localISODate()){return state.clinicActions.find(x=>x.doctorId===doctorId&&x.type==='card_drop'&&dateOnly(x.date)===date)||null;}
  function cardDroppedForDate(doctorId,date=localISODate()){return Boolean(cardDropActionForDate(doctorId,date));}
  function markCardDropped(doctorId,date=localISODate()){
    const d=doctorById(doctorId);if(!d)return;
    let action=cardDropActionForDate(doctorId,date);
    if(!action){action={id:uid('access'),doctorId,date,type:'card_drop',completedAt:new Date().toISOString(),createdAt:new Date().toISOString()};state.clinicActions.push(action);}
    else action.completedAt=new Date().toISOString();
    saveState();toast(`Card given to ${d.name}. Later meeting is now eligible.`);
  }
  function activeAppointmentForDoctor(doctorId){return upcomingAppointments().find(x=>x.doctorId===doctorId)||null;}
  function doctorAccessForDate(doctor,date=localISODate()){
    const system=doctorClinicSystem(doctor),confirmed=appointmentForDoctorDate(doctor.id,date,true),fixed=appointmentSlot(confirmed);
    if(fixed)return {system,label:'Confirmed appointment',ready:true,slots:[fixed],appointment:confirmed,fixed:true};
    if(system==='appointment'){
      const pending=activeAppointmentForDoctor(doctor.id),status=pending?.status||'Appointment required';
      return {system,label:status,ready:false,slots:[],appointment:pending||null,reason:status==='Doctor will call'?'Waiting for doctor call':status==='Requested'?'Appointment request pending':'Confirmed appointment required'};
    }
    const slots=doctorSlotsForDate(doctor,date);
    if(system==='card_later'&&!cardDroppedForDate(doctor.id,date))return {system,label:'Card drop required',ready:false,slots:[],cardTask:true,cardDropTime:doctorCardDropTime(doctor),reason:`Give card around ${timeLabel(doctorCardDropTime(doctor))}, then meet in saved window`};
    return {system,label:system==='card_later'?'Card given • meeting ready':'Direct meeting',ready:slots.length>0,slots,cardTask:false,reason:slots.length?'':'No usable meeting window for this day'};
  }
  function clinicAccessSummary(doctor,date=localISODate()){
    const access=doctorAccessForDate(doctor,date);
    if(access.fixed)return `Appointment ${timeLabel(access.appointment.time)}`;
    if(access.system==='appointment')return access.label;
    if(access.system==='card_later')return cardDroppedForDate(doctor.id,date)?`Card given • ${doctorMeetingTiming(doctor)||'meeting timing pending'}`:`Card ${timeLabel(doctorCardDropTime(doctor))} → ${doctorMeetingTiming(doctor)||'later meeting'}`;
    return doctorMeetingTiming(doctor)||'Timing not set';
  }
  function appointmentRank(status){return status==='Confirmed'?0:status==='Doctor will call'?1:status==='Tentative'?2:status==='Requested'?3:status==='Completed'?4:status==='Cancelled'?5:6;}
  function reminderStamp(x){
    const date=dateOnly(x?.reminderDate||x?.date),time=normalizeTime(x?.reminderTime);
    if(!date||!time)return Number.MAX_SAFE_INTEGER;
    const d=new Date(`${date}T${time}:00`);return Number.isNaN(d.getTime())?Number.MAX_SAFE_INTEGER:d.getTime();
  }
  function pendingDoctorCallReminders(){
    return state.appointments.filter(x=>x.status==='Doctor will call').sort((a,b)=>reminderStamp(a)-reminderStamp(b)||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
  }
  function appointmentsForDate(date=localISODate()){return state.appointments.filter(x=>dateOnly(x.date)===date&&x.status!=='Doctor will call').sort((a,b)=>appointmentRank(a.status)-appointmentRank(b.status)||(timeMinutes(a.time)??9999)-(timeMinutes(b.time)??9999)||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));}
  function appointmentForDoctorDate(doctorId,date=localISODate(),confirmedOnly=false){return appointmentsForDate(date).filter(x=>x.doctorId===doctorId&&(!confirmedOnly||x.status==='Confirmed')&&!['Cancelled','Not available'].includes(x.status))[0]||null;}
  function upcomingAppointments(){
    const today=localISODate();
    return state.appointments.filter(x=>!['Completed','Cancelled','Not available'].includes(x.status)&&(x.status==='Doctor will call'||dateOnly(x.date)>=today)).sort((a,b)=>{
      if(a.status==='Doctor will call'||b.status==='Doctor will call')return reminderStamp(a)-reminderStamp(b);
      return String(a.date).localeCompare(String(b.date))||(timeMinutes(a.time)??9999)-(timeMinutes(b.time)??9999);
    });
  }
  function legacyAppointmentCandidates(){
    const active=new Set(state.appointments.filter(x=>!['Completed','Cancelled','Not available'].includes(x.status)).map(x=>x.doctorId));
    return state.doctors.filter(d=>/\bappointment\b/i.test(clean(d.notes))&&!active.has(d.id));
  }
  function appointmentSlot(appointment){if(!appointment||appointment.status!=='Confirmed'||!appointment.time)return null;const start=timeMinutes(appointment.time),duration=Math.max(5,Math.min(60,Math.round(num(appointment.durationMinutes)||SMART_VISIT_MINUTES||12)));return start===null?null:{from:appointment.time,to:`${pad(Math.floor((start+duration)/60)%24)}:${pad((start+duration)%60)}`,start,end:start+duration,appointment:true};}
  function doctorFromAppointmentInput(value){const q=norm(value);if(!q)return null;return state.doctors.find(d=>norm(doctorDisplayName(d))===q||norm(d.name)===q)||state.doctors.find(d=>norm(doctorDisplayName(d)).includes(q)||norm(d.name).includes(q));}
  function completeAppointmentsForVisit(doctorId,date){state.appointments.filter(x=>x.doctorId===doctorId&&dateOnly(x.date)===date&&!['Cancelled','Not available'].includes(x.status)).forEach(x=>{x.status='Completed';x.completedAt=new Date().toISOString();x.updatedAt=x.completedAt;});}
  function renderCallReminders(){
    const panel=$('#callReminderPanel'),list=$('#callReminderList'),count=$('#callReminderCount');if(!panel||!list||!count)return;
    const rows=pendingDoctorCallReminders(),nowMs=Date.now();
    if(!rows.length){panel.classList.add('hidden');list.innerHTML='';count.textContent='0';return;}
    panel.classList.remove('hidden');count.textContent=String(rows.length);
    list.innerHTML=rows.slice(0,4).map(x=>{
      const d=doctorById(x.doctorId),due=reminderStamp(x)<=nowMs,products=d?suggestedProductsForDoctor(d).slice(0,2):[];
      return `<article class="call-reminder-card ${due?'due':''}"><div class="call-reminder-copy"><div class="reminder-status"><span>${due?'DUE NOW':'WAITING'}</span><small>${esc(prettyDate(x.reminderDate||x.date))} • ${esc(timeLabel(x.reminderTime)||'Reminder time missing')}</small></div><strong>${esc(x.doctorName||d?.name||'Doctor')} <em>${esc(d?doctorType(d):'')}</em></strong><p>${esc([doctorHospital(d),inferDoctorArea(d),x.shortDescription].filter(Boolean).join(' • '))}</p>${products.length?`<div class="tag-row">${products.map(p=>`<span class="tag product-fit">${esc(p)}</span>`).join('')}</div>`:''}</div><div class="call-reminder-actions"><button class="btn primary compact" data-action="doctor-called-now" data-id="${esc(x.id)}">Doctor called → Add time</button><button class="text-btn" data-action="edit-appointment" data-id="${esc(x.id)}">Edit reminder</button></div></article>`;
    }).join('');
  }
  function manageAppointments(){
    const today=appointmentsForDate(),upcoming=upcomingAppointments(),confirmed=upcoming.filter(x=>x.status==='Confirmed').length,waiting=pendingDoctorCallReminders(),legacy=legacyAppointmentCandidates();
    const upcomingHtml=upcoming.length?upcoming.slice(0,50).map(x=>{const d=doctorById(x.doctorId),map=d?entityMapUrl(d):'',when=x.status==='Doctor will call'?`Reminder ${prettyDate(x.reminderDate||x.date)}${x.reminderTime?` • ${timeLabel(x.reminderTime)}`:''}`:`${prettyDate(x.date)}${x.time?` • ${timeLabel(x.time)}`:''}`;return `<div class="ledger-row appointment-ledger ${x.status==='Doctor will call'?'waiting':''}"><div class="copy"><strong>${esc(x.doctorName||d?.name||'Doctor')} • ${esc(when)}</strong><small>${esc([x.status,d&&doctorType(d),x.shortDescription,x.hospital,x.contactPerson,x.notes].filter(Boolean).join(' • '))}</small></div><div class="value">${x.status==='Doctor will call'?`<button data-action="doctor-called-now" data-id="${esc(x.id)}">Called</button>`:''}${map?`<a href="${map}" target="_blank" rel="noopener">Map</a>`:''}<button data-action="edit-appointment" data-id="${esc(x.id)}">Edit</button></div></div>`;}).join(''):empty('No pending appointment or doctor-call reminder.');
    const legacyHtml=legacy.length?legacy.slice(0,20).map(d=>`<div class="ledger-row legacy-appointment"><div class="copy"><strong>${esc(doctorDisplayName(d))} • ${esc(doctorType(d))}</strong><small>${esc([inferDoctorArea(d),d.notes].filter(Boolean).join(' • '))}</small></div><div class="value"><button data-action="add-appointment" data-doctor-id="${esc(d.id)}">Set status/time</button></div></div>`).join(''):empty('No appointment notes waiting for review.');
    openSheet('Appointments','Confirmed appointments lock into Smart Plan. “Doctor will call” stays pending until you enter the time.',`<div class="manager-summary"><div><small>TODAY</small><strong>${esc(today.filter(x=>!['Cancelled','Not available'].includes(x.status)).length)}</strong></div><div><small>WAITING CALL</small><strong>${esc(waiting.length)}</strong></div><div><small>CONFIRMED</small><strong>${esc(confirmed)}</strong></div><div><small>OLD NOTES</small><strong>${esc(legacy.length)}</strong></div></div><div class="button-row"><button class="btn primary" data-action="add-appointment">+ Appointment / Doctor will call</button></div><div class="detail-section"><h4>Pending & upcoming</h4>${upcomingHtml}</div><div class="detail-section"><h4>Appointment notes from old doctor data</h4><p class="muted-line">These are candidates only. MR One never guesses that an old note is a confirmed appointment.</p>${legacyHtml}</div>`);
  }
  function editAppointment(id='',doctorId=''){
    const old=state.appointments.find(x=>x.id===id)||{},preset=doctorById(old.doctorId||doctorId),doctorList=state.doctors.slice().sort((a,b)=>doctorDisplayName(a).localeCompare(doctorDisplayName(b))),defaultDoctor=preset?doctorDisplayName(preset):'',defaultDate=dateOnly(old.date)||localISODate(),defaultTime=normalizeTime(old.time)||'',defaultStatus=old.status||'Confirmed',defaultReminderDate=dateOnly(old.reminderDate)||localISODate(),defaultReminderTime=normalizeTime(old.reminderTime)||'';
    openSheet(id?'Edit appointment':'Appointment','If time is fixed, save it now. If doctor says “I will call you”, choose that option and set when MR One should remind you.',`<form id="appointmentForm" class="sheet-form"><label><span>Find doctor / hospital</span><input name="doctorSearch" type="search" list="appointmentDoctors" value="${esc(defaultDoctor)}" placeholder="Type doctor or hospital" required><datalist id="appointmentDoctors">${doctorList.map(d=>`<option value="${esc(doctorDisplayName(d))}">${esc([doctorType(d),inferDoctorArea(d),doctorMeetingTiming(d)].filter(Boolean).join(' • '))}</option>`).join('')}</datalist></label><div class="appointment-mode-grid"><label class="appointment-mode"><input type="radio" name="status" value="Confirmed" ${defaultStatus==='Confirmed'?'checked':''}><span><b>Appointment fixed</b><small>Ask date + exact time</small></span></label><label class="appointment-mode"><input type="radio" name="status" value="Doctor will call" ${defaultStatus==='Doctor will call'?'checked':''}><span><b>Doctor will call</b><small>Keep pending + reminder</small></span></label><label class="appointment-mode"><input type="radio" name="status" value="Requested" ${!['Confirmed','Doctor will call'].includes(defaultStatus)?'checked':''}><span><b>Request pending</b><small>No fixed slot yet</small></span></label></div><div id="appointmentFixedFields" class="field-grid two"><label><span>Appointment date</span><input name="date" type="date" value="${esc(defaultDate)}"></label><label><span>Exact appointment time</span><input name="time" type="time" value="${esc(defaultTime)}"></label></div><div id="appointmentReminderFields" class="field-grid two"><label><span>Remind me on</span><input name="reminderDate" type="date" value="${esc(defaultReminderDate)}"></label><label><span>Reminder time</span><input name="reminderTime" type="time" value="${esc(defaultReminderTime)}"></label></div><div class="field-grid two"><label><span>Call duration min</span><input name="durationMinutes" type="number" min="5" max="60" step="1" value="${esc(num(old.durationMinutes)||12)}"></label><label><span>Contact / source</span><input name="contactPerson" type="search" list="appointmentContacts" value="${esc(old.contactPerson||'')}" placeholder="Reception / Doctor / Assistant"><datalist id="appointmentContacts"><option value="Reception"></option><option value="Doctor"></option><option value="Assistant"></option><option value="Nurse"></option><option value="Phone call"></option><option value="WhatsApp"></option></datalist></label></div><label><span>Short description</span><input name="shortDescription" type="text" maxlength="80" value="${esc(old.shortDescription||'')}" placeholder="e.g. MumMum 1 follow-up"></label><label><span>Note</span><textarea name="notes" rows="2" placeholder="Token, person name, instructions…">${esc(old.notes||'')}</textarea></label><div id="appointmentDoctorHint" class="notice">${preset?esc([doctorType(preset),doctorHospital(preset),inferDoctorArea(preset),doctorMeetingTiming(preset)].filter(Boolean).join(' • ')):'Select doctor to see type, area and saved timing.'}</div><div class="sticky-save"><button class="btn primary full" type="submit">Save</button></div></form>${id?`<div class="button-row"><button id="deleteAppointmentBtn" class="btn danger">Delete</button></div>`:''}`);
    const form=$('#appointmentForm'),hint=$('#appointmentDoctorHint'),fixed=$('#appointmentFixedFields'),reminder=$('#appointmentReminderFields');
    const status=()=>form.querySelector('input[name="status"]:checked')?.value||'Requested';
    const syncMode=()=>{const st=status();fixed.classList.toggle('hidden',st==='Doctor will call');reminder.classList.toggle('hidden',st!=='Doctor will call');};
    const showHint=()=>{const d=doctorFromAppointmentInput(form.elements.doctorSearch.value);hint.textContent=d?[doctorType(d),doctorHospital(d),inferDoctorArea(d),doctorMeetingTiming(d),`Products: ${suggestedProductsForDoctor(d).join(', ')}`].filter(Boolean).join(' • '):'Doctor not matched yet. Keep typing an existing doctor/hospital.';};
    form.elements.doctorSearch.addEventListener('input',showHint);form.elements.doctorSearch.addEventListener('change',showHint);$$('input[name="status"]',form).forEach(x=>x.addEventListener('change',syncMode));syncMode();
    form.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(form),d=doctorFromAppointmentInput(fd.get('doctorSearch')),st=status(),time=normalizeTime(fd.get('time')),reminderDate=dateOnly(fd.get('reminderDate')),reminderTime=normalizeTime(fd.get('reminderTime'));if(!d){toast('Select an existing doctor from search.');return;}if(st==='Confirmed'&&(!dateOnly(fd.get('date'))||!time)){toast('Appointment needs date and exact time.');return;}if(st==='Doctor will call'&&(!reminderDate||!reminderTime)){toast('Set reminder date and time while waiting for doctor call.');return;}d.clinicSystem='appointment';const rec={...old,id:id||uid('apt'),doctorId:d.id,doctorName:d.name,hospital:doctorHospital(d),date:st==='Doctor will call'?(old.date||reminderDate):(dateOnly(fd.get('date'))||localISODate()),time:st==='Doctor will call'?'':time,reminderDate:st==='Doctor will call'?reminderDate:'',reminderTime:st==='Doctor will call'?reminderTime:'',durationMinutes:Math.max(5,Math.min(60,Math.round(num(fd.get('durationMinutes'))||12))),status:st,contactPerson:clean(fd.get('contactPerson')),shortDescription:clean(fd.get('shortDescription')),notes:clean(fd.get('notes')),updatedAt:new Date().toISOString()};if(id)Object.assign(old,rec);else{rec.createdAt=new Date().toISOString();state.appointments.push(rec);}saveState();closeSheet();toast(st==='Confirmed'?'Appointment fixed and added to Smart Plan.':st==='Doctor will call'?'Waiting for doctor call — reminder added on Home.':'Appointment request saved as pending.');});
    $('#deleteAppointmentBtn')?.addEventListener('click',()=>{if(!confirm('Delete this appointment/reminder?'))return;state.appointments=state.appointments.filter(x=>x.id!==id);saveState();closeSheet();toast('Deleted.');});
  }
  function doctorCalledNow(id){
    const x=state.appointments.find(a=>a.id===id);if(!x)return;const d=doctorById(x.doctorId),current=now();
    openSheet('Doctor called — fix appointment time','Enter the time doctor just gave you. Once saved, this doctor takes the correct fixed position in Smart Monthly Plan.',`<form id="doctorCalledForm" class="sheet-form"><div class="detail-hero compact"><div class="avatar">${esc(initials(x.doctorName||d?.name))}</div><div><h3>${esc(x.doctorName||d?.name||'Doctor')}</h3><p>${esc([d&&doctorType(d),doctorHospital(d),inferDoctorArea(d)].filter(Boolean).join(' • '))}</p></div></div><div class="field-grid two"><label><span>Appointment date</span><input name="date" type="date" value="${esc(localISODate())}" required></label><label><span>Exact time</span><input name="time" type="time" required></label></div><label><span>Short description</span><input name="shortDescription" value="${esc(x.shortDescription||'')}" maxlength="80"></label><div class="sticky-save"><button class="btn primary full" type="submit">Confirm & place in route</button></div></form>`);
    $('#doctorCalledForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget),time=normalizeTime(fd.get('time'));if(!time){toast('Enter exact appointment time.');return;}x.status='Confirmed';x.date=dateOnly(fd.get('date'))||localISODate();x.time=time;x.reminderDate='';x.reminderTime='';x.shortDescription=clean(fd.get('shortDescription'));x.updatedAt=new Date().toISOString();saveState();closeSheet();toast('Confirmed — Smart Plan will place this doctor at the fixed time.');});
  }


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
    if(start===null||end===null||end<start)return {rows:[],badWindow:true,missingTiming:0,notDue:0,outsideWindow:0,alreadyVisited:0,accessPending:0,cardTasks:[],excluded:[]};
    let missingTiming=0,notDue=0,outsideWindow=0,alreadyVisited=0,accessPending=0;
    const rows=[],excluded=[],cardTasks=[];
    state.doctors.forEach(doctor=>{
      if(key&&!norm(doctorPlanSearchText(doctor)).includes(key))return;
      const eligibility=doctorEligibilityForDate(doctor,date),access=doctorAccessForDate(doctor,date),fixedSlot=access.fixed?access.slots[0]:null;
      if(!eligibility.eligible&&!fixedSlot){notDue++;excluded.push({doctor,reason:`Monthly target/gap complete (${eligibility.count}/${eligibility.target})`});return;}
      if(visited.has(doctor.id)&&!includeVisited){alreadyVisited++;excluded.push({doctor,reason:'Already called on selected date'});return;}
      if(access.cardTask){accessPending++;cardTasks.push({doctor,time:access.cardDropTime,reason:access.reason,eligibility});excluded.push({doctor,reason:access.reason});return;}
      if(!access.ready||!access.slots.length){accessPending++;const reason=access.reason||'Clinic access is not ready';excluded.push({doctor,reason});return;}
      const slots=access.slots;
      const overlap=slots.filter(slot=>slot.start<=end&&slot.end>=start).sort((a,b)=>a.start-b.start)[0];
      if(!overlap){outsideWindow++;excluded.push({doctor,reason:access.fixed?`Confirmed appointment ${timeLabel(access.appointment.time)} is outside selected window`:`Meeting time outside ${timeLabel(from)}–${timeLabel(to)}`});return;}
      const due=Boolean(doctor.nextFollowUp&&doctor.nextFollowUp<=date),last=latestDoctorVisit(doctor.id,true),days=last?daysBetween(last.date,date):999;
      rows.push({doctor,slot:overlap,appointment:access.appointment||null,access,visited:visited.has(doctor.id),due,last,days,chemist:linkedChemist(doctor),map:entityMapUrl(doctor),eligibility:{...eligibility,eligible:true,appointmentOverride:!!fixedSlot}});
    });
    rows.sort((a,b)=>a.visited-b.visited||Number(Boolean(b.access?.fixed))-Number(Boolean(a.access?.fixed))||a.slot.start-b.slot.start||Number(b.due)-Number(a.due)||b.days-a.days||doctorDisplayName(a.doctor).localeCompare(doctorDisplayName(b.doctor)));
    cardTasks.sort((a,b)=>(timeMinutes(a.time)??9999)-(timeMinutes(b.time)??9999)||doctorDisplayName(a.doctor).localeCompare(doctorDisplayName(b.doctor)));
    return {rows,badWindow:false,missingTiming,notDue,outsideWindow,alreadyVisited,accessPending,cardTasks,excluded};
  }
  const SMART_VISIT_MINUTES=12;
  const SMART_ROAD_FACTOR=1.24;
  const SMART_IDLE_LEG_MINUTES=120;
  function smartRoadKm(aLat,aLng,bLat,bLng){
    const straight=haversineKm(aLat,aLng,bLat,bLng);
    return straight?Math.max(straight,straight*SMART_ROAD_FACTOR+0.05):0;
  }
  function smartTravelMinutes(aLat,aLng,bLat,bLng){
    const km=smartRoadKm(aLat,aLng,bLat,bLng);
    return Math.max(3,Math.round(km/22*60));
  }
  function bestNextDoctorCandidates(latitude,longitude,at=now()){
    const lat=num(latitude),lng=num(longitude);if(!lat||!lng)return [];
    const date=localISODate(at),clock=at.getHours()*60+at.getMinutes(),visited=new Set(rowsForDay(date).map(v=>v.doctorId).filter(Boolean)),rows=[];
    state.doctors.forEach(doctor=>{
      if(visited.has(doctor.id)||!num(doctor.latitude)||!num(doctor.longitude))return;
      const access=doctorAccessForDate(doctor,date),eligibility=doctorEligibilityForDate(doctor,date),fixed=Boolean(access.fixed);
      if(!eligibility.eligible&&!fixed)return;
      if(!access.ready||!access.slots.length)return;
      const distance=smartRoadKm(lat,lng,doctor.latitude,doctor.longitude),travel=smartTravelMinutes(lat,lng,doctor.latitude,doctor.longitude);
      let best=null;
      access.slots.forEach(slot=>{
        if(slot.end<clock)return;
        const rawArrival=clock+travel,arrival=Math.max(rawArrival,slot.start),visitMinutes=slot.appointment?Math.max(5,slot.end-slot.start):SMART_VISIT_MINUTES,finish=arrival+visitMinutes;
        if(finish>slot.end)return;
        const wait=Math.max(0,slot.start-rawArrival),active=clock>=slot.start&&clock<=slot.end,closing=Math.max(0,slot.end-finish),appointmentSoon=slot.appointment&&slot.start-clock<=30;
        const score=(active?0:120)+wait*2.2+distance*9+Math.min(90,closing)*0.08-(appointmentSoon?80:0)-(fixed?15:0);
        const row={doctor,access,eligibility,slot,distance,travelMinutes:travel,arrivalMinutes:arrival,finishMinutes:finish,waitMinutes:wait,active,closingMinutes:closing,score};
        if(!best||row.score<best.score)best=row;
      });
      if(best)rows.push(best);
    });
    return rows.sort((a,b)=>a.score-b.score||a.arrivalMinutes-b.arrivalMinutes||a.distance-b.distance);
  }
  function cardDropCandidates(latitude,longitude,at=now()){
    const lat=num(latitude),lng=num(longitude),date=localISODate(at),clock=at.getHours()*60+at.getMinutes();if(!lat||!lng)return [];
    return state.doctors.filter(d=>doctorClinicSystem(d)==='card_later'&&!cardDroppedForDate(d.id,date)&&num(d.latitude)&&num(d.longitude)&&doctorEligibilityForDate(d,date).eligible&&doctorSlotsForDate(d,date).length&&!rowsForDay(date).some(v=>v.doctorId===d.id)).map(d=>{const distance=smartRoadKm(lat,lng,d.latitude,d.longitude),travel=smartTravelMinutes(lat,lng,d.latitude,d.longitude),target=timeMinutes(doctorCardDropTime(d))??600,late=Math.max(0,clock-target);return {doctor:d,distance,travelMinutes:travel,targetMinutes:target,late,score:distance*10+Math.abs(clock-target)*0.25};}).sort((a,b)=>a.score-b.score||a.distance-b.distance);
  }
  function nextCallStateLabel(x,at=now()){
    const clock=at.getHours()*60+at.getMinutes();
    if(x.slot.appointment)return `Fixed appointment • ${timeLabel(x.slot.from)}`;
    if(x.active)return `Available now • until ${timeLabel(x.slot.to)}`;
    const mins=Math.max(0,x.slot.start-clock);return mins<=60?`Available in ${mins} min • ${timeLabel(x.slot.from)}–${timeLabel(x.slot.to)}`:`Today ${timeLabel(x.slot.from)}–${timeLabel(x.slot.to)}`;
  }
  function renderNextCallPanel(){
    const panel=$('#nextCallPanel'),list=$('#nextCallList'),status=$('#nextCallStatus');if(!panel||!list||!status)return;
    panel.classList.remove('hidden');
    if(!lastFieldLocation){status.textContent='GPS needed to compare distance + time-window feasibility';list.innerHTML='<div class="next-call-empty">Fetching current GPS…</div>';return;}
    const calls=bestNextDoctorCandidates(lastFieldLocation.latitude,lastFieldLocation.longitude).slice(0,3),cards=cardDropCandidates(lastFieldLocation.latitude,lastFieldLocation.longitude).slice(0,2);
    status.textContent=calls.length?`${calls.length} feasible next call${calls.length===1?'':'s'} • ranked by access, timing and travel`:'No doctor call is reachable inside a valid window right now';
    const callHtml=calls.map((x,i)=>{const d=x.doctor,products=suggestedProductsForDoctor(d).slice(0,3),meters=Math.round(x.distance*1000);return `<article class="next-call-card ${i===0?'best':''}"><div class="next-rank">${i===0?'BEST':i+1}</div><div class="next-call-copy"><div class="title-line"><strong>${esc(doctorDisplayName(d))}</strong><span class="specialty-pill">${esc(doctorType(d))}</span></div><small>${esc(inferDoctorArea(d))} • ${esc(doctorClinicSystemLabel(d))}</small><p><b>${esc(nextCallStateLabel(x))}</b> • ${meters<1000?`${esc(meters)} m`:`${esc(x.distance.toFixed(1))} km`} • ~${esc(x.travelMinutes)} min travel</p>${products.length?`<div class="tag-row">${products.map(p=>`<span class="tag product-fit">${esc(p)}</span>`).join('')}</div>`:''}</div><div class="next-call-actions"><button class="btn primary compact" data-action="start-next-call" data-id="${esc(d.id)}">Start call</button>${entityMapUrl(d)?`<a class="btn secondary compact" href="${entityMapUrl(d)}" target="_blank" rel="noopener">Map</a>`:''}</div></article>`;}).join('');
    const cardHtml=cards.length?`<div class="access-task-head"><strong>Card-drop tasks</strong><small>Complete these before the later doctor window</small></div>${cards.map(x=>`<article class="next-call-card access"><div class="next-rank">CARD</div><div class="next-call-copy"><strong>${esc(doctorDisplayName(x.doctor))}</strong><small>${esc(inferDoctorArea(x.doctor))} • target ${esc(timeLabel(doctorCardDropTime(x.doctor)))}</small><p>${x.distance<1?`${esc(Math.round(x.distance*1000))} m`:`${esc(x.distance.toFixed(1))} km`} • later meet ${esc(doctorMeetingTiming(x.doctor)||'timing pending')}</p></div><div class="next-call-actions"><button class="btn secondary compact" data-action="mark-card-given" data-id="${esc(x.doctor.id)}">Card given ✓</button></div></article>`).join('')}`:'';
    list.innerHTML=(callHtml||'<div class="next-call-empty">No feasible doctor meeting from current GPS/time.</div>')+cardHtml;
  }
  function updateFieldLocation(latitude,longitude,accuracy=0){const lat=num(latitude),lng=num(longitude),acc=num(accuracy);if(!lat||!lng)return;lastFieldLocation={latitude:lat,longitude:lng,accuracy:acc,capturedAt:new Date().toISOString()};if(activePage==='dashboard')renderNextCallPanel();}
  function smartBacktrackPenalty(route,pLat,pLng,cLat,cLng){
    if(route.length<2)return 0;
    const prev=route[route.length-2],aLat=num(prev.doctor.latitude),aLng=num(prev.doctor.longitude);
    const vx=pLng-aLng,vy=pLat-aLat,wx=cLng-pLng,wy=cLat-pLat,vm=Math.hypot(vx,vy),wm=Math.hypot(wx,wy);
    if(!vm||!wm)return 0;
    const cos=(vx*wx+vy*wy)/(vm*wm);
    return cos<-.2?Math.abs(cos)*smartRoadKm(pLat,pLng,cLat,cLng):0;
  }
  function smartNearestNextKm(candidate,remaining){
    let best=Infinity;
    remaining.forEach(x=>{if(x.doctor.id===candidate.doctor.id)return;const d=smartRoadKm(candidate.doctor.latitude,candidate.doctor.longitude,x.doctor.latitude,x.doctor.longitude);if(d<best)best=d;});
    return Number.isFinite(best)?best:0;
  }
  function smartStrandedCount(candidate,remaining,finishMinutes){
    let stranded=0;
    remaining.forEach(x=>{
      if(x.doctor.id===candidate.doctor.id)return;
      const travel=smartTravelMinutes(candidate.doctor.latitude,candidate.doctor.longitude,x.doctor.latitude,x.doctor.longitude);
      const arrival=Math.max(finishMinutes+travel,x.slot.start),visitMinutes=x.slot.appointment?Math.max(5,x.slot.end-x.slot.start):SMART_VISIT_MINUTES;
      if(arrival+visitMinutes>x.slot.end)stranded++;
    });
    return stranded;
  }
  function simulateSmartRoute(order,startLat,startLng,from,date){
    const route=[];let pLat=num(startLat),pLng=num(startLng),clock=timeMinutes(from)||0,totalRoadKm=0,totalTravelMinutes=0,totalWaitMinutes=0;
    if(date===localISODate())clock=Math.max(clock,now().getHours()*60+now().getMinutes());
    for(const x of order){
      const roadKm=smartRoadKm(pLat,pLng,x.doctor.latitude,x.doctor.longitude),travel=smartTravelMinutes(pLat,pLng,x.doctor.latitude,x.doctor.longitude),rawArrival=clock+travel,arrival=Math.max(rawArrival,x.slot.start),wait=Math.max(0,x.slot.start-rawArrival),visitMinutes=x.slot.appointment?Math.max(5,x.slot.end-x.slot.start):SMART_VISIT_MINUTES,finish=arrival+visitMinutes;
      if(finish>x.slot.end)return {feasible:false,route,totalRoadKm,totalTravelMinutes,totalWaitMinutes,failed:x};
      route.push({...x,distance:roadKm,roadDistanceKm:roadKm,travelMinutes:travel,arrivalMinutes:arrival,finishMinutes:finish,waitMinutes:wait,lateMinutes:0,timingRisk:false});
      totalRoadKm+=roadKm;totalTravelMinutes+=travel;totalWaitMinutes+=wait;pLat=num(x.doctor.latitude);pLng=num(x.doctor.longitude);clock=finish;
    }
    return {feasible:true,route,totalRoadKm,totalTravelMinutes,totalWaitMinutes};
  }
  function splitSmartRouteLegs(route){
    const legs=[];let current=[];
    route.forEach(x=>{
      const prev=current[current.length-1];
      if(prev&&x.arrivalMinutes-prev.finishMinutes>=SMART_IDLE_LEG_MINUTES){legs.push(current);current=[];}
      current.push(x);
    });
    if(current.length)legs.push(current);
    return legs;
  }
  function googleRouteUrlCurrent(route){
    if(!route.length)return '';
    const points=route.filter(x=>num(x.latitude||x.doctor?.latitude)&&num(x.longitude||x.doctor?.longitude)).slice(0,9);if(!points.length)return '';
    const coord=x=>`${num(x.latitude||x.doctor?.latitude)},${num(x.longitude||x.doctor?.longitude)}`,dest=points[points.length-1],waypoints=points.slice(0,-1).map(coord).join('|');
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(coord(dest))}${waypoints?`&waypoints=${encodeURIComponent(waypoints)}`:''}&travelmode=driving`;
  }
  function smartMonthlyRoute(rows,startLat,startLng,from,date){
    if(!num(startLat)||!num(startLng))return {route:[],unroutable:rows.map(x=>({...x,routeReason:'Start GPS unavailable'})),missingStart:true,legs:[]};
    const remaining=rows.filter(x=>num(x.doctor.latitude)&&num(x.doctor.longitude)).map(x=>({...x})),picked=[];
    const unroutable=rows.filter(x=>!num(x.doctor.latitude)||!num(x.doctor.longitude)).map(x=>({...x,routeReason:'Hospital/clinic GPS missing'}));
    let pLat=num(startLat),pLng=num(startLng),clock=timeMinutes(from)||0;
    if(date===localISODate())clock=Math.max(clock,now().getHours()*60+now().getMinutes());
    while(remaining.length){
      const ranked=remaining.map(x=>{
        const roadKm=smartRoadKm(pLat,pLng,x.doctor.latitude,x.doctor.longitude),travel=smartTravelMinutes(pLat,pLng,x.doctor.latitude,x.doctor.longitude),rawArrival=clock+travel,arrival=Math.max(rawArrival,x.slot.start),wait=Math.max(0,x.slot.start-rawArrival),visitMinutes=x.slot.appointment?Math.max(5,x.slot.end-x.slot.start):SMART_VISIT_MINUTES,finish=arrival+visitMinutes,late=Math.max(0,finish-x.slot.end),slack=Math.max(0,x.slot.end-finish),urgency=Math.max(0,60-slack),nextKm=smartNearestNextKm(x,remaining),backtrackKm=smartBacktrackPenalty(picked,pLat,pLng,num(x.doctor.latitude),num(x.doctor.longitude)),stranded=smartStrandedCount(x,remaining,finish);
        const score=(late?100000+late*1500:0)+roadKm*12+nextKm*4.5+backtrackKm*24+wait*.40+stranded*180-urgency*1.5-(x.due?14:0)-(x.slot.appointment?90:0);
        return {...x,distance:roadKm,roadDistanceKm:roadKm,travelMinutes:travel,arrivalMinutes:arrival,finishMinutes:finish,waitMinutes:wait,lateMinutes:late,timingRisk:late>0,nextKm,backtrackKm,stranded,score};
      }).sort((a,b)=>a.score-b.score||a.slot.end-b.slot.end||a.distance-b.distance);
      const chosen=ranked.find(x=>!x.timingRisk);
      if(!chosen){
        remaining.forEach(x=>{
          const travel=smartTravelMinutes(pLat,pLng,x.doctor.latitude,x.doctor.longitude),arrival=Math.max(clock+travel,x.slot.start);
          unroutable.push({...x,routeReason:`Cannot finish call before ${minuteLabel(x.slot.end)} from current route`});
        });
        break;
      }
      remaining.splice(remaining.findIndex(x=>x.doctor.id===chosen.doctor.id),1);picked.push(chosen);pLat=num(chosen.doctor.latitude);pLng=num(chosen.doctor.longitude);clock=chosen.finishMinutes;
    }
    // Preserve the timing-feasible greedy chain; splitting long idle periods avoids one giant zig-zag Maps route.
    const route=simulateSmartRoute(picked,startLat,startLng,from,date).route,legs=splitSmartRouteLegs(route);
    const totalRoadKm=route.reduce((n,x)=>n+num(x.roadDistanceKm||x.distance),0),totalTravelMinutes=route.reduce((n,x)=>n+num(x.travelMinutes),0);
    let totalWaitMinutes=0,totalIdleGapMinutes=0;
    route.forEach((x,i)=>{const prev=i?route[i-1]:null,gap=prev?Math.max(0,x.arrivalMinutes-prev.finishMinutes):0;if(prev&&gap>=SMART_IDLE_LEG_MINUTES)totalIdleGapMinutes+=gap;else totalWaitMinutes+=num(x.waitMinutes);});
    return {route,unroutable,missingStart:false,legs,totalRoadKm,totalTravelMinutes,totalWaitMinutes,totalIdleGapMinutes,visitMinutes:SMART_VISIT_MINUTES};
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
    if(!result.rows.length){const cardHtml=result.cardTasks?.length?`<div class="detail-section"><h4>Card drop required first</h4>${result.cardTasks.map(x=>`<div class="ledger-row"><div class="copy"><strong>${esc(doctorDisplayName(x.doctor))}</strong><small>${esc(inferDoctorArea(x.doctor))} • Card around ${esc(timeLabel(x.time))} → meet later</small></div><div class="value"><button data-action="mark-card-given" data-id="${esc(x.doctor.id)}">Card given</button></div></div>`).join('')}</div>`:'';box.innerHTML=`${empty(`No due doctor meeting matches ${values.area} for this date/time window.`)}${cardHtml}${result.accessPending?`<div class="notice">${esc(result.accessPending)} doctor(s) need clinic access first (appointment/card drop).</div>`:''}${result.missingTiming?`<div class="notice">${esc(result.missingTiming)} doctor(s) have no usable meeting timing.</div>`:''}${result.outsideWindow?`<div class="notice">${esc(result.outsideWindow)} doctor(s) are outside the selected time window.</div>`:''}${result.notDue?`<div class="notice">${esc(result.notDue)} doctor(s) are already complete for monthly frequency/gap.</div>`:''}`;return;}
    const start=resolveSmartPlanStart(values.startSearch,values.startLat,values.startLng),planned=start?smartMonthlyRoute(result.rows,start.latitude,start.longitude,values.from,values.date):null,ordered=planned?.route?.length?planned.route:result.rows;
    const routeMeta=new Map((planned?.route||[]).map(x=>[x.doctor.id,x]));
    const fullGoogleUrl=start&&planned?.route?.length&&(planned?.legs||[]).length<=1?googleRouteUrl(start.latitude,start.longitude,planned.route):'';
    const totalKm=planned?Number(planned.totalRoadKm||0).toFixed(1):'',travelMin=planned?Math.round(num(planned.totalTravelMinutes)):0,waitMin=planned?Math.round(num(planned.totalWaitMinutes)):0,idleGapMin=planned?Math.round(num(planned.totalIdleGapMinutes)):0;
    const legBreaks=new Map();
    (planned?.legs||[]).forEach((leg,i)=>{if(leg[0])legBreaks.set(leg[0].doctor.id,{index:i+1,leg});});
    const rowsHtml=ordered.map((x,i)=>{
      const d=x.doctor,m=routeMeta.get(d.id),policy=x.eligibility||doctorEligibilityForDate(d,values.date),leg=legBreaks.get(d.id),prev=i?routeMeta.get(ordered[i-1].doctor.id):null,idle=m&&prev?Math.max(0,m.arrivalMinutes-prev.finishMinutes):0;
      const labels=[x.appointment?`APPOINTMENT ${x.appointment.status} • ${timeLabel(x.appointment.time)}`:`${timeLabel(x.slot.from)}–${timeLabel(x.slot.to)}`,m?`Call ${minuteLabel(m.arrivalMinutes)}–${minuteLabel(m.finishMinutes)}`:'',m?`${m.distance.toFixed(1)} km approx road`:'',m&&m.travelMinutes?`${m.travelMinutes} min travel`:'' ,m&&m.waitMinutes?`wait ${m.waitMinutes} min`:'',`${policy.count}/${policy.target} done this month`,policy.appointmentOverride?'confirmed appointment override':(policy.gap?`${policy.gap}d gap`:'1× monthly'),doctorHospital(d),x.chemist?.name,x.due?'Follow-up due':'',x.map?'GPS ready':'GPS pending'].filter(Boolean);
      const legTitle=leg&&leg.index>1?`<div class="notice smart-leg-break"><b>${leg.index===2?'Evening / later leg':`Leg ${leg.index}`}</b>${idle>=SMART_IDLE_LEG_MINUTES?` • ${esc(Math.floor(idle/60))}h ${esc(idle%60)}m idle gap before this stop`:''}</div>`:'';
      return `${legTitle}<article class="area-time-plan-row"><div class="plan-seq">${i+1}</div><div class="plan-doctor-copy"><strong>${esc(doctorDisplayName(d))}</strong><small>${esc(labels.join(' • '))}</small></div><div class="plan-doctor-actions">${x.map?`<a href="${x.map}" target="_blank" rel="noopener">Map</a>`:''}<button data-action="view-record" data-type="doctor" data-id="${esc(d.id)}">View</button><button class="primary-action" data-action="log-record" data-type="doctor" data-id="${esc(d.id)}">Meet</button></div></article>`;
    }).join('');
    const legButtons=(planned?.legs||[]).length>1?(planned.legs||[]).map((leg,i)=>{const url=i===0&&start?googleRouteUrl(start.latitude,start.longitude,leg):googleRouteUrlCurrent(leg);return url?`<a class="btn ${i===0?'primary':'secondary'} full" href="${url}" target="_blank" rel="noopener">Open ${i===0?'main':'later'} leg ${i+1} in Maps</a>`:'';}).join(''):'';
    const routeExcluded=(planned?.unroutable||[]).map(x=>({doctor:x.doctor,reason:x.routeReason||'Could not fit route'}));
    const cardTaskIds=new Set((result.cardTasks||[]).map(x=>x.doctor.id)),allExcluded=[...routeExcluded,...(result.excluded||[]).filter(x=>!cardTaskIds.has(x.doctor?.id))];
    const uniqueExcluded=[];const seenExcluded=new Set();allExcluded.forEach(x=>{const id=x.doctor?.id||`${x.reason}:${x.doctor?.name}`;if(!seenExcluded.has(id)){seenExcluded.add(id);uniqueExcluded.push(x);}});
    const excludedHtml=uniqueExcluded.length?`<div class="detail-section"><h4>Excluded / needs attention</h4>${uniqueExcluded.slice(0,12).map(x=>`<div class="ledger-row"><div class="copy"><strong>${esc(doctorDisplayName(x.doctor))}</strong><small>${esc(x.reason)}</small></div>${x.doctor?.id?`<div class="value"><button data-action="view-record" data-type="doctor" data-id="${esc(x.doctor.id)}">View</button></div>`:''}</div>`).join('')}${uniqueExcluded.length>12?`<div class="muted-line">+${esc(uniqueExcluded.length-12)} more excluded doctor(s)</div>`:''}</div>`:'';
    box.innerHTML=`<div class="plan-result-head"><strong>${esc(ordered.length)} doctor${ordered.length===1?'':'s'} routed</strong><small>${esc(prettyDate(values.date))} • ${esc(timeLabel(values.from))}–${esc(timeLabel(values.to))} • ${esc(values.area)}</small></div>${start?`<div class="notice">Starts from <b>${esc(start.label)}</b>. Priority: clinic access ready → confirmed appointments → monthly eligibility → meeting-window feasibility → travel ETA → urgent closing windows → low-backtracking nearby cluster. Each call reserves ${SMART_VISIT_MINUTES} min.</div>`:'<div class="notice">GPS/start point unavailable, so doctors are shown timing-wise. Fetch GPS or search a saved doctor/hospital to optimize distance.</div>'}${result.cardTasks?.length?`<div class="detail-section"><h4>Card drop before later meeting</h4>${result.cardTasks.map(x=>`<div class="ledger-row"><div class="copy"><strong>${esc(doctorDisplayName(x.doctor))}</strong><small>${esc(inferDoctorArea(x.doctor))} • ${esc(timeLabel(x.time))} card drop</small></div><div class="value"><button data-action="mark-card-given" data-id="${esc(x.doctor.id)}">Card given ✓</button></div></div>`).join('')}</div>`:''}${planned?`<div class="manager-summary"><div><small>ROUTED</small><strong>${esc(ordered.length)}</strong></div><div><small>APPROX ROAD</small><strong>${esc(totalKm)} km</strong></div><div><small>TRAVEL</small><strong>${esc(travelMin)} min</strong></div><div><small>FIELD WAIT</small><strong>${esc(waitMin)} min</strong></div>${idleGapMin?`<div><small>LATER GAP</small><strong>${esc(Math.floor(idleGapMin/60))}h ${esc(idleGapMin%60)}m</strong></div>`:''}</div><div class="muted-line">Road km/time are offline estimates for ordering; Google Maps calculates exact road geometry when opened.</div>`:''}<div class="area-time-plan-list">${rowsHtml}</div>${fullGoogleUrl?`<a class="btn primary full" href="${fullGoogleUrl}" target="_blank" rel="noopener">Open full planned order in Maps</a>`:''}${legButtons}${excludedHtml}`;
  }
  function areaTimeDoctorPlan(){
    const tp=latestTourPlan(),areas=[...new Set(state.doctors.flatMap(d=>[clean(d.area),clean(d.town),clean(d.hq)]).filter(Boolean))].sort((a,b)=>a.localeCompare(b)),starts=state.doctors.filter(d=>num(d.latitude)&&num(d.longitude)).slice().sort((a,b)=>doctorDisplayName(a).localeCompare(doctorDisplayName(b))),defaultArea=clean(tp?.area||state.profile.hq||areas[0]||''),current=now(),defaultFrom=`${pad(current.getHours())}:${current.getMinutes()<30?'00':'30'}`;
    const endDate=new Date(current);endDate.setHours(Math.min(23,current.getHours()+4),current.getMinutes()<30?0:30,0,0);const defaultTo=`${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;
    openSheet('Smart Monthly Doctor Plan','Monthly eligibility + doctor timing + low-backtracking route legs. Current GPS fetch starts automatically.',`<form id="areaTimePlanForm" class="sheet-form"><label><span>Find area / town</span><input name="area" type="search" list="areaTimePlanAreas" value="${esc(defaultArea)}" placeholder="Type Nikol / Naroda / Ahmedabad" required><datalist id="areaTimePlanAreas">${areas.map(a=>`<option value="${esc(a)}"></option>`).join('')}</datalist></label><label><span>Find starting doctor / hospital (optional)</span><input name="startSearch" type="search" list="smartPlanStarts" placeholder="Leave blank = current GPS"><datalist id="smartPlanStarts">${starts.map(d=>`<option value="${esc(doctorDisplayName(d))}">${esc(doctorHospital(d)||d.area||'')}</option>`).join('')}</datalist></label><div class="location-card"><div class="location-head"><div><strong>Current start GPS</strong><small id="smartplanLocationStatus" class="location-status">Fetching automatically…</small></div><button type="button" id="smartplanFetchLocation" class="btn secondary compact">Refresh GPS</button></div><a id="smartplanLocationMap" class="hidden" target="_blank" rel="noopener">View start map</a><input id="smartplanLatitude" type="hidden"><input id="smartplanLongitude" type="hidden"><input id="smartplanAccuracy" type="hidden"><input id="smartplanCapturedAt" type="hidden"></div><div class="field-grid two"><label><span>Date</span><input name="date" type="date" value="${localISODate()}" required></label><label><span>Already called</span><input name="includeVisitedSearch" type="search" list="includeCalledChoices" value="No"><datalist id="includeCalledChoices"><option value="No"></option><option value="Yes"></option></datalist></label><label><span>From</span><input name="from" type="time" value="${defaultFrom}" required></label><label><span>To</span><input name="to" type="time" value="${defaultTo}" required></label></div><button class="btn primary full" type="submit">Build intelligent doctor route</button></form><div id="areaTimePlanResults" class="detail-section"></div>`);
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

  function productRows(statuses={},doctor=null) {
    const products=doctor?suggestedProductsForDoctor(doctor):focusProducts();
    return products.length?products.map((p,i)=>{
      const s=statuses[p]||'';
      return `<div class="product-status-row" data-product="${esc(p)}"><div class="product-name"><strong>${esc(p)}</strong><small>Tap only if status changed</small></div><div class="status-buttons"><button type="button" data-status="prescribed" class="${s==='prescribed'?'selected prescribed':''}">✓ Prescribed</button><button type="button" data-status="not_prescribed" class="${s==='not_prescribed'?'selected not-prescribed':''}">× Not</button><button type="button" data-status="" class="clear-status ${!s?'selected':''}">—</button></div><input type="hidden" name="productStatus_${i}" value="${esc(s)}"></div>`;
    }).join(''):empty('No product suggestion for this doctor type. Add focus products in Tools → Profile.');
  }
  function meetingSummaryHtml(doctor,chemist) {
    if(!doctor)return '<div class="meeting-summary muted-card">Search and choose a doctor. Stored chemist, address and meeting timing will appear here.</div>';
    const map=entityMapUrl(doctor),timing=doctorMeetingStatus(doctor),fullTiming=doctorMeetingTiming(doctor),access=clinicAccessSummary(doctor);
    return `<div class="meeting-summary"><div><small>DOCTOR / HOSPITAL</small><strong>${esc(doctorDisplayName(doctor))}</strong><p>${esc(doctor.address||doctor.area||'Address not added')}</p></div><div><small>UNDER CHEMIST</small><strong>${esc(chemist?.name||'Select once below')}</strong><p>${esc(chemist?.address||chemist?.area||'')}</p></div><div class="meeting-timing-cell ${esc(timing.state)}"><small>CLINIC ACCESS / MEETING</small><strong>${esc(doctorClinicSystemLabel(doctor))}</strong><p>${esc(access||fullTiming||timing.label)}</p></div>${map?`<a href="${map}" target="_blank" rel="noopener">Open stored map</a>`:''}</div>`;
  }

  function hideProximityCall(){
    const banner=$('#proximityCallBanner');if(banner)banner.classList.add('hidden');
    lastProximityDoctorId='';
  }
  function handleProximityLocation(latitude,longitude,accuracy=0){
    const banner=$('#proximityCallBanner');if(!banner||Date.now()<proximityDismissedUntil)return;
    const lat=num(latitude),lng=num(longitude),acc=num(accuracy);updateFieldLocation(lat,lng,acc);
    if(!lat||!lng||(acc&&acc>80)){hideProximityCall();return;}
    const date=localISODate(),clock=now().getHours()*60+now().getMinutes(),visited=new Set(rowsForDay().filter(v=>v.doctorId).map(v=>v.doctorId));
    const nearby=state.doctors.filter(d=>num(d.latitude)&&num(d.longitude)&&!visited.has(d.id)).map(d=>({doctor:d,meters:Math.round(haversineKm(lat,lng,num(d.latitude),num(d.longitude))*1000)})).filter(x=>x.meters<=50).sort((a,b)=>a.meters-b.meters);
    let hit=null,action='';
    for(const x of nearby){const d=x.doctor,access=doctorAccessForDate(d,date),elig=doctorEligibilityForDate(d,date);if(!elig.eligible&&!access.fixed)continue;if(access.cardTask){hit=x;action='card';break;}if(access.ready&&access.slots.some(s=>clock>=s.start&&clock<=s.end&&clock+SMART_VISIT_MINUTES<=s.end)){hit=x;action='call';break;}}
    if(!hit){hideProximityCall();return;}
    const d=hit.doctor,products=suggestedProductsForDoctor(d).slice(0,2);
    if(lastProximityDoctorId===`${d.id}:${action}`&&!banner.classList.contains('hidden'))return;
    lastProximityDoctorId=`${d.id}:${action}`;
    const accessText=action==='card'?`Card drop due around ${timeLabel(doctorCardDropTime(d))}`:`Meeting window active • ${doctorMeetingStatus(d).label}`;
    banner.innerHTML=`<div class="proximity-icon">◎</div><div class="proximity-copy"><small>YOU ARE AT A SAVED DOCTOR LOCATION • ${esc(hit.meters)} m</small><strong>${esc(doctorDisplayName(d))} <em>${esc(doctorType(d))}</em></strong><p>${esc([inferDoctorArea(d),accessText,...products].filter(Boolean).join(' • '))}</p></div><div class="proximity-actions">${action==='card'?`<button class="btn primary compact" data-action="mark-card-given" data-id="${esc(d.id)}">Card given ✓</button>`:`<button class="btn primary compact" data-action="start-proximity-call" data-id="${esc(d.id)}">Start doctor call</button>`}<button class="icon-btn" data-action="dismiss-proximity" aria-label="Dismiss">×</button></div>`;
    banner.classList.remove('hidden');
  }
  function requestProximityCheck(){
    if(document.visibilityState==='hidden')return;
    try{window.AndroidBridge?.fetchLocation?.('proximity');}catch(_){}
  }

  window.__mrNativeLocation=(prefix,ok,latitude,longitude,acc,error)=>{
    if(ok){updateFieldLocation(latitude,longitude,acc);handleProximityLocation(latitude,longitude,acc);}
    const status=$(`#${prefix}LocationStatus`),map=$(`#${prefix}LocationMap`),button=$(`#${prefix}FetchLocation`),lat=$(`#${prefix}Latitude`),lng=$(`#${prefix}Longitude`),accuracy=$(`#${prefix}Accuracy`),captured=$(`#${prefix}CapturedAt`);
    if(!status||!button){if(ok)document.dispatchEvent(new CustomEvent('mr-location-ready',{detail:{prefix,latitude,longitude,accuracy:acc}}));return;}
    if(ok){lat.value=latitude;lng.value=longitude;accuracy.value=Math.round(acc||0);captured.value=new Date().toISOString();status.textContent=`GPS ready • accuracy about ${Math.round(acc||0)} m`;status.className='location-status success';map.href=mapUrl(latitude,longitude);map.classList.remove('hidden');button.textContent='Refresh GPS';document.dispatchEvent(new CustomEvent('mr-location-ready',{detail:{prefix,latitude,longitude,accuracy:acc}}));}
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
          <div class="clinic-meeting-inline field-grid two">
            <label><span>Clinic meeting system</span><select id="meetingClinicSystem" name="clinicSystem"><option value="direct" ${doctorClinicSystem(doctor)==='direct'?'selected':''}>Direct timed meeting</option><option value="appointment" ${doctorClinicSystem(doctor)==='appointment'?'selected':''}>Appointment required</option><option value="card_later" ${doctorClinicSystem(doctor)==='card_later'?'selected':''}>Card drop → meet later</option></select></label>
            <label id="meetingCardDropField" class="${doctorClinicSystem(doctor)==='card_later'?'':'hidden'}"><span>Card drop time</span><input name="cardDropTime" type="time" value="${esc(doctorCardDropTime(doctor))}"></label>
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
        <div id="meetingProductRows" class="product-status-list">${productRows(remembered,doctor)}</div>
        <label><span>Short meeting note (optional)</span><textarea name="notes" rows="2" placeholder="Commitment or next action only"></textarea></label>
        <label><span>Follow-up date (optional)</span><input name="followUpDate" type="date"></label>
        <details class="more-fields sample-panel"><summary>Samples given (optional)</summary><div class="order-panel-body"><div id="meetingSampleRows">${state.sampleItems.length?sampleIssueRow():empty('No sample stock added yet. Use Tools → Samples.')}</div>${state.sampleItems.length?'<button type="button" id="addMeetingSampleRow" class="btn secondary compact">+ Another sample</button>':''}<small class="muted-line">Sample balance is checked before saving and distribution is linked to this doctor visit.</small></div></details>
        <details class="more-fields order-panel"><summary>POB / Distributor order (optional)</summary><div class="order-panel-body"><label class="toggle-line"><input id="meetingOrderPlaced" name="orderPlaced" type="checkbox"> Order placed to distributor</label><label><span>Distributor</span><select name="distributorId">${distributorOptions(preferredDistributor(chemist)?.id||'')}</select></label><div id="meetingOrderItems" class="order-items">${orderItemRow({},0)}</div><button type="button" id="addMeetingOrderItem" class="btn secondary compact">+ Add product</button><div class="order-total-line"><span>Order / POB total</span><strong data-order-total>₹0</strong></div><label><span>Order note</span><textarea name="orderNote" rows="2" placeholder="Delivery, urgency or commitment"></textarea></label></div></details>
        <details class="more-fields"><summary>More daily report items (optional)</summary><div class="inline-metrics">${METRICS.filter(([k])=>k!=='calls'&&k!=='pobValue').map(([k,label])=>`<label><span>${esc(label)}</span><input name="${k}" type="number" min="0" step="1" value="0"></label>`).join('')}<label><span>Other POB Value</span><input name="pobValue" type="number" min="0" step="0.01" value="0"></label></div></details>
        <input name="date" type="hidden" value="${esc(localISODateTime())}">
        <div class="sticky-save"><button type="submit" class="btn primary full">Save meeting + 1 call</button></div>
      </form>`);
    const form=$('#meetingForm'), doctorInput=$('#meetingDoctorSearch'), doctorIdInput=$('#meetingDoctorId'), doctorResults=$('#meetingDoctorResults'), chemistSelect=form.elements.chemistId, chemistInput=$('#meetingChemistSearch'), chemistResults=$('#meetingChemistResults'), orderDistributorSelect=form.elements.distributorId, hospitalInput=form.elements.hospital, timingPending=$('#meetingTimingPending'), clinicSystemSelect=$('#meetingClinicSystem'), cardDropField=$('#meetingCardDropField');
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
      doctorResults.innerHTML=items.length?items.map(d=>{const lc=linkedChemist(d),timing=doctorMeetingStatus(d),access=clinicAccessSummary(d);return `<button type="button" class="search-result doctor-search-result" data-meeting-doctor-id="${esc(d.id)}"><strong>${esc(doctorDisplayName(d))}</strong><small><span class="result-timing ${esc(timing.state)}">${esc(doctorClinicSystemLabel(d))}</span> • ${esc(access)} • ${esc([lc?.name,d.area||d.hq,d.address].filter(Boolean).join(' • ')||'No extra details')}</small></button>`;}).join(''):`<div class="lookup-empty">No doctor or hospital found.</div>`;
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
      const appointmentOnly=clinicSystemSelect?.value==='appointment',disabled=timingPending.checked||appointmentOnly;
      ['meetingFrom','meetingTo','meetingFrom2','meetingTo2'].forEach(name=>{form.elements[name].disabled=disabled;});
      $('#meetingDaySelector').classList.toggle('disabled',disabled);
      $('.schedule-quick',form)?.classList.toggle('disabled',appointmentOnly);
    };
    const syncMeetingClinicSystem=()=>{
      const system=clinicSystemSelect?.value||'direct';
      cardDropField?.classList.toggle('hidden',system!=='card_later');
      if(system==='appointment')timingPending.checked=true;
      setTimingDisabled();
    };
    const fillMasterFields=d=>{
      hospitalInput.value=doctorHospital(d);
      setMeetingDays(normalizeMeetingDays(d?.meetingDays));
      form.elements.meetingFrom.value=normalizeTime(d?.meetingFrom);
      form.elements.meetingTo.value=normalizeTime(d?.meetingTo);
      form.elements.meetingFrom2.value=normalizeTime(d?.meetingFrom2);
      form.elements.meetingTo2.value=normalizeTime(d?.meetingTo2);
      clinicSystemSelect.value=doctorClinicSystem(d);
      form.elements.cardDropTime.value=doctorCardDropTime(d);
      timingPending.checked=doctorClinicSystem(d)==='appointment'||!(doctorMeetingSlots(d).length&&normalizeMeetingDays(d?.meetingDays).length);
      syncMeetingClinicSystem();
    };
    const previewDoctor=()=>{
      const base=doctorById(doctorIdInput.value);if(!base)return null;
      return {...base,hospital:clean(hospitalInput.value),clinicSystem:clinicSystemSelect?.value||doctorClinicSystem(base),cardDropTime:normalizeTime(form.elements.cardDropTime?.value)||doctorCardDropTime(base),meetingDays:selectedMeetingDays(),meetingFrom:normalizeTime(form.elements.meetingFrom.value),meetingTo:normalizeTime(form.elements.meetingTo.value),meetingFrom2:normalizeTime(form.elements.meetingFrom2.value),meetingTo2:normalizeTime(form.elements.meetingTo2.value)};
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
      $('#meetingProductRows').innerHTML=productRows(latestStatuses(d.id,c?.id||''),d);
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
    clinicSystemSelect?.addEventListener('change',()=>{syncMeetingClinicSystem();refreshSummary();refreshOutcomeIntelligence();});
    timingPending.addEventListener('change',()=>{setTimingDisabled();refreshSummary();refreshOutcomeIntelligence();});
    $$('input[name="meetingDays"], input[name="meetingFrom"], input[name="meetingTo"], input[name="meetingFrom2"], input[name="meetingTo2"]',form).forEach(x=>x.addEventListener('change',()=>{refreshSummary();refreshOutcomeIntelligence();}));
    syncMeetingClinicSystem();
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
      const hospital=clean(fd.get('hospital')),clinicSystem=clean(fd.get('clinicSystem'))||'direct',cardDropTime=normalizeTime(fd.get('cardDropTime')),days=fd.getAll('meetingDays').map(Number),from=normalizeTime(fd.get('meetingFrom')),to=normalizeTime(fd.get('meetingTo')),from2=normalizeTime(fd.get('meetingFrom2')),to2=normalizeTime(fd.get('meetingTo2')),isTimingPending=fd.get('timingPending')==='on'||clinicSystem==='appointment';
      if(!hospital){toast('Enter hospital or clinic name.');hospitalInput.focus();return;}
      if(!c){toast('Type and select the pharmacy / chemist under this doctor.');chemistInput.focus();showChemistResults();return;}
      if(clinicSystem==='card_later'&&!cardDropTime){toast('Add card drop time for this clinic system.');return;}
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
      const meetingDoctor={...d,hospital,clinicSystem,cardDropTime,meetingDays:days,meetingFrom:from,meetingTo:to,meetingFrom2:from2,meetingTo2:to2},nextSuggested=NOT_MET_OUTCOMES.has(outcome)?nextMeetingOccurrence(meetingDoctor,now(),true):null,replacement=NOT_MET_OUTCOMES.has(outcome)?replacementDoctor(d.id):null,autoFollowUp=clean(fd.get('followUpDate'))||(nextSuggested?.date||'');
      const row={
        id:uid('log'),date:fd.get('date')||localISODateTime(),entityType:'doctor',entityId:d.id,entityName:d.name,
        doctorId:d.id,doctorName:d.name,doctorHospital:hospital,chemistId:c?.id||'',chemistName:c?.name||'',productStatuses,
        notes:clean(fd.get('notes')),followUpDate:autoFollowUp,calls:1,outcome,outcomeLabel:OUTCOME_LABELS[outcome]||outcome,notMetReason,rescheduledFor:nextSuggested?.dateTime||'',replacementDoctorId:replacement?.doctor.id||'',replacementDoctorName:replacement?doctorDisplayName(replacement.doctor):'',intelligenceAction:NOT_MET_OUTCOMES.has(outcome)?[nextSuggested?`Rescheduled ${nextSuggested.label}`:'Timing pending',replacement?`Replacement ${doctorDisplayName(replacement.doctor)}`:'No replacement'].join(' • '):productOpportunity(d).label,
        inputs:num(fd.get('inputs')),basket:num(fd.get('basket')),towel:num(fd.get('towel')),conversation:num(fd.get('conversation')),newAvailability:num(fd.get('newAvailability')),pobValue:orderPlaced?(orderValue||num(fd.get('pobValue'))):num(fd.get('pobValue')),
        latitude:saveGps?currentLat:'',longitude:saveGps?currentLng:'',locationAccuracy:saveGps?num($('#meetAccuracy').value)||'':'',locationCapturedAt:saveGps?$('#meetCapturedAt').value:'',
        hospitalLatitude:oldHospitalLat||'',hospitalLongitude:oldHospitalLng||'',distanceFromHospitalM:distanceFromSaved,locationAuditStatus:!saveGps?'Missing visit GPS':!oldHospitalLat?'Hospital GPS pending':distanceFromSaved<=250?'Verified at hospital':distanceFromSaved<=750?'Review location':'Location mismatch',sampleIssues:sampleIssues.map(x=>({sampleItemId:x.sampleItemId,product:sampleItemById(x.sampleItemId)?.product||'',qty:x.qty})),tourPlanId:latestTourPlan(dateOnly(fd.get('date')||localISODate()))?.id||'',createdAt:new Date().toISOString()
      };
      state.visits.push(row);
      if(outcome==='met')completeAppointmentsForVisit(d.id,dateOnly(row.date));
      if(sampleIssues.length)commitSampleIssues(sampleIssues,{date:row.date,doctor:d,chemist:c,visitId:row.id,notes:'Doctor visit distribution'});
      if(orderPlaced){const order={id:uid('ord'),date:row.date,doctorId:d.id,doctorName:d.name,doctorHospital:hospital,chemistId:c?.id||'',chemistName:c?.name||'',distributorId:distributor.id,distributorName:distributor.name,items:orderItems,totalValue:row.pobValue,status:'placed',notes:clean(fd.get('orderNote')),visitId:row.id,latitude:row.latitude,longitude:row.longitude,createdAt:new Date().toISOString()};state.orders.push(order);row.orderId=order.id;if(c){c.linkedDistributorId=distributor.id;c.distributorName=distributor.name;}distributor.lastOrderDate=String(row.date).slice(0,10);}
      d.hospital=hospital;d.clinicSystem=clinicSystem;d.cardDropTime=clinicSystem==='card_later'?cardDropTime:'';
      if(outcome==='met'&&clinicSystem==='card_later'&&!cardDroppedForDate(d.id,dateOnly(row.date))){state.clinicActions.push({id:uid('clinic'),date:dateOnly(row.date),doctorId:d.id,type:'card_drop',completedAt:new Date().toISOString(),source:'Meeting logged'});}
      if(!isTimingPending){d.meetingDays=days;d.meetingFrom=from;d.meetingTo=to;d.meetingFrom2=from2;d.meetingTo2=to2;}
      d.lastAttempt=String(row.date).slice(0,10);if(outcome==='met')d.lastVisit=d.lastAttempt;d.updatedAt=new Date().toISOString();
      if(c){d.linkedChemistId=c.id;d.chemistName=c.name;if(outcome==='met')c.lastVisit=d.lastAttempt;c.updatedAt=new Date().toISOString();}
      if(row.followUpDate){d.nextFollowUp=row.followUpDate;if(c)c.nextFollowUp=row.followUpDate;}
      if(row.latitude&&row.longitude&&updateMasterLocation){d.latitude=row.latitude;d.longitude=row.longitude;d.locationAccuracy=row.locationAccuracy;d.locationCapturedAt=row.locationCapturedAt;d.locationSource='Visit GPS verified';row.hospitalLatitude=row.latitude;row.hospitalLongitude=row.longitude;row.distanceFromHospitalM=0;row.locationAuditStatus='Verified at hospital';}
      if(NOT_MET_OUTCOMES.has(outcome)){state.reschedules.filter(r=>r.doctorId===d.id&&r.status==='pending').forEach(r=>r.status='replaced');state.reschedules.push({id:uid('res'),doctorId:d.id,doctorName:d.name,hospital:doctorHospital(d),sourceVisitId:row.id,reason:notMetReason||OUTCOME_LABELS[outcome],createdAt:new Date().toISOString(),scheduledDate:nextSuggested?.date||row.followUpDate||'',scheduledDateTime:nextSuggested?.dateTime||'',meetingFrom:nextSuggested?.from||'',meetingTo:nextSuggested?.to||'',replacementDoctorId:replacement?.doctor.id||'',replacementDoctorName:replacement?doctorDisplayName(replacement.doctor):'',status:'pending'});}
      else state.reschedules.filter(r=>r.doctorId===d.id&&r.status==='pending').forEach(r=>r.status='completed');
      state.intelligenceLog.push({id:uid('intel'),date:new Date().toISOString(),doctorId:d.id,doctorName:d.name,outcome,action:row.intelligenceAction});
      d.needsCompletion=!(doctorHospital(d)&&linkedChemist(d)&&d.latitude&&d.longitude&&(doctorClinicSystem(d)==='appointment'||(doctorMeetingSlots(d).length&&normalizeMeetingDays(d.meetingDays).length))&&(doctorClinicSystem(d)!=='card_later'||doctorCardDropTime(d)));
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
    return state.doctors.filter(d=>!key||[d.name,doctorHospital(d),inferDoctorArea(d),d.hq,d.address,d.mobile,doctorType(d),...suggestedProductsForDoctor(d)].join(' ').toLowerCase().includes(key)).sort((a,b)=>doctorDisplayName(a).localeCompare(doctorDisplayName(b))).slice(0,35);
  }
  function quickChemistSearchMatches(q){
    const key=clean(q).toLowerCase();
    return state.chemists.filter(c=>!key||[c.name,c.area,c.hq,c.address].join(' ').toLowerCase().includes(key)).sort((a,b)=>a.name.localeCompare(b.name)).slice(0,35);
  }
  function quickCompleteDoctor(){
    const hospitals=[...new Set(state.doctors.map(doctorHospital).filter(Boolean))].sort((a,b)=>a.localeCompare(b)),areas=[...new Set(state.doctors.flatMap(d=>[clean(d.area),clean(d.town),clean(d.hq)]).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    openSheet('Quick Doctor Details','Search existing doctor, fill only what you know. GPS starts automatically and nearby saved hospitals are suggested.',`<form id="quickDoctorForm" class="sheet-form"><div class="lookup-label field-block"><span class="field-caption">Find doctor</span><div class="lookup-field"><input id="quickDoctorSearch" type="search" autocomplete="off" placeholder="Type doctor / hospital / area…"><input id="quickDoctorId" name="doctorId" type="hidden"><div id="quickDoctorResults" class="search-results lookup-results hidden"></div></div></div><div id="quickDoctorSelected" class="notice">Select a doctor to complete details.</div><label><span>Find hospital / clinic</span><input id="quickHospital" name="hospital" type="search" list="quickHospitalList" placeholder="Type hospital"><datalist id="quickHospitalList">${hospitals.map(x=>`<option value="${esc(x)}"></option>`).join('')}</datalist></label><label><span>Find area / place</span><input id="quickArea" name="area" type="search" list="quickAreaList" placeholder="Type area"><datalist id="quickAreaList">${areas.map(x=>`<option value="${esc(x)}"></option>`).join('')}</datalist></label><label><span>Address</span><textarea id="quickAddress" name="address" rows="2" placeholder="Clinic address if known"></textarea></label><div class="lookup-label field-block"><span class="field-caption">Find chemist under doctor</span><div class="lookup-field"><input id="quickChemistSearch" type="search" autocomplete="off" placeholder="Type chemist / area…"><input id="quickChemistId" name="linkedChemistId" type="hidden"><div id="quickChemistResults" class="search-results lookup-results hidden"></div></div></div><div class="schedule-card"><div class="form-section-title"><h3>Monthly visit rule</h3><p>Planner uses this before suggesting the doctor.</p></div><label><span>Find / choose frequency</span><input id="quickFrequency" name="monthlyVisitTargetText" type="search" list="quickFrequencyList" value="2× / month"><datalist id="quickFrequencyList"><option value="1× / month"></option><option value="2× / month"></option><option value="3× / month"></option><option value="4× / month"></option></datalist></label><label><span>Minimum gap days (0 = automatic)</span><input id="quickGap" name="minVisitGapDays" type="number" min="0" max="31" step="1" value="0"></label></div><div class="schedule-card clinic-system-card"><div class="form-section-title"><h3>Clinic meeting system</h3><p>Choose how this clinic actually allows MR meetings.</p></div><label><span>Clinic system</span><select id="quickClinicSystem" name="clinicSystem"><option value="direct">Direct meeting in saved days/time</option><option value="appointment">Appointment required</option><option value="card_later">Card drop first → later meeting</option></select></label><div id="quickCardDropFields" class="field-grid two hidden"><label><span>Card drop time</span><input name="cardDropTime" type="time" value="10:00"></label><div class="notice">After Card given ✓, doctor becomes eligible in the saved later meeting window.</div></div></div><div id="quickMeetingTimingCard" class="schedule-card"><div class="form-section-title"><h3>Meeting timing</h3><p>Direct/card-later: set exact days and time. Appointment: fixed time comes from Appointments.</p></div><label><span>Find timing preset</span><input id="quickTimingPreset" type="search" list="quickTimingPresets" placeholder="Morning / Lunch / Evening"><datalist id="quickTimingPresets"><option value="Morning 10–12"></option><option value="Lunch 12–2"></option><option value="Afternoon 2–5"></option><option value="Evening 5–8"></option><option value="Morning + Evening"></option></datalist></label><div class="schedule-quick"><button type="button" id="quickMonSat">Mon–Sat</button><button type="button" id="quickEveryDay">Every day</button><button type="button" id="quickClearDays">Clear days</button></div><div class="day-selector" id="quickDaySelector">${DAY_NAMES.map((day,i)=>`<label class="day-option"><input type="checkbox" name="meetingDays" value="${i}"><span>${day}</span></label>`).join('')}</div><div class="field-grid two timing-grid"><label><span>From</span><input name="meetingFrom" type="time"></label><label><span>To</span><input name="meetingTo" type="time"></label><label><span>Second from</span><input name="meetingFrom2" type="time"></label><label><span>Second to</span><input name="meetingTo2" type="time"></label></div></div><div class="location-card"><div class="location-head"><div><strong>Automatic nearby GPS</strong><small id="quickdocLocationStatus" class="location-status">Fetching automatically…</small></div><button type="button" id="quickdocFetchLocation" class="btn secondary compact">Refresh GPS</button></div><a id="quickdocLocationMap" class="hidden" target="_blank" rel="noopener">View current map</a><input id="quickdocLatitude" type="hidden"><input id="quickdocLongitude" type="hidden"><input id="quickdocAccuracy" type="hidden"><input id="quickdocCapturedAt" type="hidden"><label class="toggle-line"><input id="quickUseGps" type="checkbox" checked> Save current GPS as this doctor/hospital location</label></div><div class="detail-section"><h4>Nearby saved hospitals / doctors</h4><div id="quickNearbyResults">Waiting for GPS…</div></div><div class="sticky-save"><button class="btn primary full" type="submit">Save doctor details</button></div></form>`);
    const form=$('#quickDoctorForm'),doctorSearch=$('#quickDoctorSearch'),doctorId=$('#quickDoctorId'),doctorResults=$('#quickDoctorResults'),chemistSearch=$('#quickChemistSearch'),chemistId=$('#quickChemistId'),chemistResults=$('#quickChemistResults');
    const selectedDays=()=>form.elements.meetingDays?[...form.elements.meetingDays].filter(x=>x.checked).map(x=>Number(x.value)):[];
    const setDays=days=>$$('input[name="meetingDays"]',form).forEach(x=>x.checked=days.includes(Number(x.value)));
    const setTimes=(a,b,c='',d='')=>{form.elements.meetingFrom.value=a;form.elements.meetingTo.value=b;form.elements.meetingFrom2.value=c;form.elements.meetingTo2.value=d;};
    const syncQuickClinicSystem=()=>{const system=$('#quickClinicSystem').value;$('#quickCardDropFields').classList.toggle('hidden',system!=='card_later');$('#quickMeetingTimingCard').classList.toggle('appointment-mode-muted',system==='appointment');};
    const frequencyText=n=>`${Math.max(1,Math.min(4,Math.round(num(n)||2)))}× / month`;
    const parseFrequency=v=>{const m=clean(v).match(/[1-4]/);return m?Number(m[0]):2;};
    const showDoctors=()=>{const items=quickDoctorSearchMatches(doctorSearch.value);doctorResults.innerHTML=items.length?items.map(d=>`<button type="button" class="search-result" data-quick-doctor-id="${esc(d.id)}"><strong>${esc(doctorDisplayName(d))} <em class="inline-specialty">${esc(doctorType(d))}</em></strong><small>${esc([inferDoctorArea(d)||d.hq,doctorMeetingTiming(d)||'Timing pending',suggestedProductsForDoctor(d).slice(0,2).join(', '),doctorVisitPolicy(d).label].filter(Boolean).join(' • '))}</small></button>`).join(''):`<div class="lookup-empty">No doctor found.</div>`;doctorResults.classList.remove('hidden');};
    const showChemists=()=>{const items=quickChemistSearchMatches(chemistSearch.value);chemistResults.innerHTML=items.length?items.map(c=>`<button type="button" class="search-result" data-quick-chemist-id="${esc(c.id)}"><strong>${esc(c.name)}</strong><small>${esc([c.area||c.hq,c.address].filter(Boolean).join(' • '))}</small></button>`).join(''):`<div class="lookup-empty">No chemist found.</div>`;chemistResults.classList.remove('hidden');};
    const loadDoctor=d=>{if(!d)return;doctorId.value=d.id;doctorSearch.value=doctorDisplayName(d);doctorResults.classList.add('hidden');$('#quickDoctorSelected').innerHTML=`<b>${esc(doctorDisplayName(d))}</b> • ${esc(doctorType(d))} • ${esc(doctorEligibilityForDate(d).reason)} • ${esc(suggestedProductsForDoctor(d).slice(0,3).join(', '))}`;$('#quickHospital').value=doctorHospital(d);$('#quickArea').value=inferDoctorArea(d)||d.hq||'';$('#quickAddress').value=d.address||d.hospitalAddress||'';const c=linkedChemist(d);chemistId.value=c?.id||'';chemistSearch.value=c?.name||'';$('#quickFrequency').value=frequencyText(d.monthlyVisitTarget);$('#quickGap').value=num(d.minVisitGapDays)||0;setDays(normalizeMeetingDays(d.meetingDays));setTimes(normalizeTime(d.meetingFrom),normalizeTime(d.meetingTo),normalizeTime(d.meetingFrom2),normalizeTime(d.meetingTo2));$('#quickClinicSystem').value=doctorClinicSystem(d);form.elements.cardDropTime.value=doctorCardDropTime(d);syncQuickClinicSystem();};
    const renderNearby=(lat,lng)=>{const out=$('#quickNearbyResults'),groups=savedHospitalGroups(lat,lng,2000).slice(0,12);out.innerHTML=groups.length?groups.map(g=>{const d=(g.doctorIds||[]).map(doctorById).filter(Boolean)[0];return `<button type="button" class="nearby-place-card plain-button" data-quick-nearby-doctor="${esc(d?.id||'')}"><div class="nearby-place-distance">${esc(g.distanceKm.toFixed(2))}<small>km</small></div><div class="nearby-place-copy"><h3>${esc(g.name)}</h3><p>${esc(g.address||'')}</p><small>${esc((g.doctorIds||[]).length)} saved doctor(s)</small></div></button>`;}).join(''):empty('No saved hospital within 2 km. Current GPS can still be saved to the selected doctor.');};
    doctorSearch.addEventListener('focus',showDoctors);doctorSearch.addEventListener('input',()=>{doctorId.value='';showDoctors();});doctorResults.addEventListener('click',e=>{const b=e.target.closest('[data-quick-doctor-id]');if(b)loadDoctor(doctorById(b.dataset.quickDoctorId));});
    chemistSearch.addEventListener('focus',showChemists);chemistSearch.addEventListener('input',()=>{chemistId.value='';showChemists();});chemistResults.addEventListener('click',e=>{const b=e.target.closest('[data-quick-chemist-id]');if(!b)return;const c=chemistById(b.dataset.quickChemistId);if(c){chemistId.value=c.id;chemistSearch.value=c.name;chemistResults.classList.add('hidden');}});
    $('#quickClinicSystem').addEventListener('change',syncQuickClinicSystem);syncQuickClinicSystem();
    $('#quickMonSat').addEventListener('click',()=>setDays([1,2,3,4,5,6]));$('#quickEveryDay').addEventListener('click',()=>setDays([0,1,2,3,4,5,6]));$('#quickClearDays').addEventListener('click',()=>setDays([]));
    $('#quickTimingPreset').addEventListener('change',e=>{const q=clean(e.target.value).toLowerCase();if(q.includes('morning +'))setTimes('10:00','12:00','17:00','20:00');else if(q.includes('morning'))setTimes('10:00','12:00');else if(q.includes('lunch'))setTimes('12:00','14:00');else if(q.includes('afternoon'))setTimes('14:00','17:00');else if(q.includes('evening'))setTimes('17:00','20:00');});
    $('#quickNearbyResults').addEventListener('click',e=>{const p=e.target.closest('[data-quick-nearby-place]');if(p){const place=nearbyPlaceCache.get(p.dataset.quickNearbyPlace);if(!place)return;$('#quickHospital').value=place.name||'';$('#quickAddress').value=place.address||'';$('#quickdocLatitude').value=place.latitude||'';$('#quickdocLongitude').value=place.longitude||'';$('#quickdocCapturedAt').value=new Date().toISOString();$('#quickdocLocationStatus').textContent=`Nearby hospital selected • ${place.name}`;return;}const b=e.target.closest('[data-quick-nearby-doctor]');if(!b)return;const d=doctorById(b.dataset.quickNearbyDoctor);if(!d)return;$('#quickHospital').value=doctorHospital(d);$('#quickArea').value=d.area||d.hq||'';$('#quickAddress').value=d.address||d.hospitalAddress||'';$('#quickdocLatitude').value=d.latitude||'';$('#quickdocLongitude').value=d.longitude||'';$('#quickdocAccuracy').value=d.locationAccuracy||'';$('#quickdocCapturedAt').value=d.locationCapturedAt||'';$('#quickdocLocationStatus').textContent=`Nearby saved hospital selected • ${doctorHospital(d)}`;});
    const gpsListener=e=>{if(e.detail?.prefix!=='quickdoc')return;renderNearby(e.detail.latitude,e.detail.longitude);if(window.AndroidBridge?.searchNearbyHospitals)window.AndroidBridge.searchNearbyHospitals('quickdoc',e.detail.latitude,e.detail.longitude,2000);};document.addEventListener('mr-location-ready',gpsListener,{once:true});setupLocationCapture('quickdoc',true);
    form.addEventListener('submit',e=>{e.preventDefault();const d=doctorById(doctorId.value);if(!d){toast('Search and select a doctor first.');showDoctors();return;}const fd=new FormData(form),clinicSystem=clean(fd.get('clinicSystem'))||'direct',cardDropTime=normalizeTime(fd.get('cardDropTime')),days=selectedDays(),from=normalizeTime(fd.get('meetingFrom')),to=normalizeTime(fd.get('meetingTo')),from2=normalizeTime(fd.get('meetingFrom2')),to2=normalizeTime(fd.get('meetingTo2'));if((from&&!to)||(!from&&to)||(from2&&!to2)||(!from2&&to2)){toast('Complete both From and To for each timing.');return;}if((from&&timeMinutes(to)<=timeMinutes(from))||(from2&&timeMinutes(to2)<=timeMinutes(from2))){toast('Meeting To must be later than From.');return;}if((from||from2)&&!days.length){toast('Select meeting day(s).');return;}if(clinicSystem==='card_later'&&!cardDropTime){toast('Set card drop time.');return;}d.clinicSystem=clinicSystem;d.cardDropTime=clinicSystem==='card_later'?cardDropTime:'';d.hospital=clean(fd.get('hospital'));d.address=clean(fd.get('address'));d.area=clean(fd.get('area'))||inferDoctorArea(d)||d.area||d.hq;d.monthlyVisitTarget=parseFrequency(fd.get('monthlyVisitTargetText'));d.minVisitGapDays=Math.max(0,Math.round(num(fd.get('minVisitGapDays'))));d.meetingDays=days;d.meetingFrom=from;d.meetingTo=to;d.meetingFrom2=from2;d.meetingTo2=to2;d.linkedChemistId=clean(fd.get('linkedChemistId'));d.chemistName=chemistById(d.linkedChemistId)?.name||'';if($('#quickUseGps').checked){const lat=num($('#quickdocLatitude').value),lng=num($('#quickdocLongitude').value),acc=num($('#quickdocAccuracy').value);if(lat&&lng){if(acc>200&&!confirm(`GPS accuracy is about ${Math.round(acc)} m. Save this hospital location anyway?`))return;d.latitude=lat;d.longitude=lng;d.locationAccuracy=acc||'';d.locationCapturedAt=$('#quickdocCapturedAt').value||new Date().toISOString();d.locationSource='Quick doctor GPS';}}d.updatedAt=new Date().toISOString();d.needsCompletion=doctorCompleteness(d).score<100;saveState();closeSheet();toast(`Doctor details saved • ${doctorVisitPolicy(d).label}`);});
  }

  function editRecord(type,id='') {
    const arr=type==='doctor'?state.doctors:state.chemists, old=arr.find(x=>x.id===id)||{}, isDoctor=type==='doctor';
    const existingChemist=isDoctor?(linkedChemist(old)?.id||''):'';
    openSheet(`${id?'Edit':'Add'} ${isDoctor?'doctor':'chemist'}`,isDoctor?'Doctor name, hospital/clinic, address and linked chemist are saved once.':'Only shop name and location are needed.',`
      <form id="recordForm" class="sheet-form">
        <label><span>${isDoctor?'Doctor name':'Chemist name'}</span><input name="name" required value="${esc(old.name||'')}"></label>
        ${!isDoctor?`<label><span>Preferred distributor (optional)</span><select name="linkedDistributorId">${distributorOptions(preferredDistributor(old)?.id||'')}</select></label>`:''}
        ${isDoctor?`<label><span>Hospital / clinic name</span><input name="hospital" value="${esc(doctorHospital(old))}" placeholder="Example: Sterling Hospital"></label><div class="lookup-label field-block"><span class="field-caption">Doctor under chemist</span><div class="lookup-field"><input id="recordChemistSearch" type="search" autocomplete="off" value="${esc(linkedChemist(old)?.name||'')}" placeholder="Search chemist name or area…"><input id="recordChemistId" name="linkedChemistId" type="hidden" value="${esc(existingChemist)}"><div id="recordChemistResults" class="search-results lookup-results hidden"></div></div></div><div class="field-grid two"><label><span>Monthly visits</span><select name="monthlyVisitTarget"><option value="1" ${doctorVisitPolicy(old).target===1?'selected':''}>1× / month</option><option value="2" ${doctorVisitPolicy(old).target===2?'selected':''}>2× / month</option><option value="3" ${doctorVisitPolicy(old).target===3?'selected':''}>3× / month</option><option value="4" ${doctorVisitPolicy(old).target===4?'selected':''}>4× / month</option></select></label><label><span>Custom minimum gap days</span><input name="minVisitGapDays" type="number" min="0" max="31" value="${esc(num(old.minVisitGapDays)||0)}" placeholder="0 = automatic"></label></div><div class="schedule-card clinic-system-card"><div class="form-section-title"><h3>Clinic meeting system</h3><p>Field access comes before route planning.</p></div><label><span>Clinic system</span><select id="recordClinicSystem" name="clinicSystem"><option value="direct" ${doctorClinicSystem(old)==='direct'?'selected':''}>Direct meeting in saved days/time</option><option value="appointment" ${doctorClinicSystem(old)==='appointment'?'selected':''}>Appointment required</option><option value="card_later" ${doctorClinicSystem(old)==='card_later'?'selected':''}>Card drop first → later meeting</option></select></label><div id="recordCardDropFields" class="field-grid two ${doctorClinicSystem(old)==='card_later'?'':'hidden'}"><label><span>Card drop time</span><input name="cardDropTime" type="time" value="${esc(doctorCardDropTime(old))}"></label><div class="notice">Mark Card given ✓ on the day. Only then later meeting enters the route.</div></div></div><div id="recordMeetingTimingCard" class="schedule-card ${doctorClinicSystem(old)==='appointment'?'appointment-mode-muted':''}"><div class="form-section-title"><h3>Doctor meeting timing</h3><p>Direct/card-later use this window. Appointment-only doctors can leave regular timing blank.</p></div><div class="schedule-quick"><button type="button" id="monSatDaysBtn">Mon–Sat</button><button type="button" id="allDaysBtn">Every day</button><button type="button" id="clearDaysBtn">Clear</button></div><div class="day-selector">${DAY_NAMES.map((day,i)=>`<label class="day-option"><input type="checkbox" name="meetingDays" value="${i}" ${normalizeMeetingDays(old.meetingDays).includes(i)?'checked':''}><span>${day}</span></label>`).join('')}</div><div class="field-grid two timing-grid"><label><span>First timing from</span><input name="meetingFrom" type="time" value="${esc(normalizeTime(old.meetingFrom))}"></label><label><span>First timing to</span><input name="meetingTo" type="time" value="${esc(normalizeTime(old.meetingTo))}"></label><label><span>Second timing from (optional)</span><input name="meetingFrom2" type="time" value="${esc(normalizeTime(old.meetingFrom2))}"></label><label><span>Second timing to (optional)</span><input name="meetingTo2" type="time" value="${esc(normalizeTime(old.meetingTo2))}"></label></div></div>`:''}
        <label><span>Address</span><textarea name="address" rows="2" placeholder="Clinic / shop full address">${esc(old.address||'')}</textarea></label>
        <label><span>Area / place</span><input name="area" value="${esc((isDoctor?inferDoctorArea(old):old.area)||old.hq||state.profile.hq||'')}"></label>
        ${isDoctor?`<div class="location-card">
          <div class="location-head"><div><strong>Doctor / hospital GPS verification</strong><small id="recordLocationStatus" class="location-status">${old.latitude&&old.longitude?`Verified • ${esc(old.latitude)}, ${esc(old.longitude)}`:'Optional — verify once at hospital'}</small></div><button type="button" id="recordFetchLocation" class="btn secondary compact">${old.latitude?'Refresh verification':'Verify hospital GPS'}</button></div>
          <a id="recordLocationMap" class="${old.latitude?'':'hidden'}" href="${old.latitude?mapUrl(old.latitude,old.longitude):''}" target="_blank" rel="noopener">View map</a>
          <input id="recordLatitude" type="hidden" value="${esc(old.latitude||'')}"><input id="recordLongitude" type="hidden" value="${esc(old.longitude||'')}"><input id="recordAccuracy" type="hidden" value="${esc(old.locationAccuracy||'')}"><input id="recordCapturedAt" type="hidden" value="${esc(old.locationCapturedAt||'')}">
        </div>`:`<div class="notice">GPS is not collected for chemists. Only doctor/hospital location verification uses GPS.</div>`}
        <label><span>Short note (optional)</span><textarea name="notes" rows="2">${esc(old.notes||'')}</textarea></label>
        <div class="button-row">${id?`<button type="button" class="btn danger" id="deleteRecordBtn">Delete</button>`:''}<button type="submit" class="btn primary">Save once</button></div>
      </form>`);
    if(isDoctor){
      const syncRecordClinicSystem=()=>{const system=$('#recordClinicSystem').value;$('#recordCardDropFields').classList.toggle('hidden',system!=='card_later');$('#recordMeetingTimingCard').classList.toggle('appointment-mode-muted',system==='appointment');};$('#recordClinicSystem').addEventListener('change',syncRecordClinicSystem);syncRecordClinicSystem();
      const chemistInput=$('#recordChemistSearch'),chemistIdInput=$('#recordChemistId'),chemistResults=$('#recordChemistResults');
      const showChemists=()=>{const q=clean(chemistInput.value).toLowerCase();const items=state.chemists.filter(c=>!q||[c.name,c.area,c.hq,c.address].join(' ').toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name)).slice(0,25);chemistResults.innerHTML=items.length?items.map(c=>`<button type="button" class="search-result" data-record-chemist-id="${esc(c.id)}"><strong>${esc(c.name)}</strong><small>${esc([c.area||c.hq,c.address].filter(Boolean).join(' • '))}</small></button>`).join(''):`<div class="lookup-empty">No chemist found.</div>`;chemistResults.classList.remove('hidden');};
      chemistInput.addEventListener('focus',showChemists);chemistInput.addEventListener('input',()=>{chemistIdInput.value='';showChemists();});chemistResults.addEventListener('click',e=>{const b=e.target.closest('[data-record-chemist-id]');if(!b)return;const c=chemistById(b.dataset.recordChemistId);if(!c)return;chemistIdInput.value=c.id;chemistInput.value=c.name;chemistResults.classList.add('hidden');});
      const setDays=days=>$$('input[name="meetingDays"]',$('#recordForm')).forEach(x=>x.checked=days.includes(Number(x.value)));
      $('#monSatDaysBtn').addEventListener('click',()=>setDays([1,2,3,4,5,6]));$('#allDaysBtn').addEventListener('click',()=>setDays([0,1,2,3,4,5,6]));$('#clearDaysBtn').addEventListener('click',()=>setDays([]));
    }
    if(isDoctor)setupLocationCapture('record',false);
    const form=$('#recordForm');
    form.addEventListener('submit',e=>{
      e.preventDefault();const fd=new FormData(form),rec={...old,id:id||uid(isDoctor?'dr':'ch'),updatedAt:new Date().toISOString()};
      rec.name=clean(fd.get('name'));rec.address=clean(fd.get('address'));rec.area=clean(fd.get('area'));rec.hq=rec.hq||state.profile.hq;rec.notes=clean(fd.get('notes'));if(isDoctor){rec.hospital=clean(fd.get('hospital'));rec.area=rec.area||inferDoctorArea(rec)||rec.hq;rec.needsCompletion=!(rec.name&&norm(rec.name)!==norm(rec.hospital));}
      if(!isDoctor){rec.linkedDistributorId=clean(fd.get('linkedDistributorId'));const dist=distributorById(rec.linkedDistributorId);rec.distributorName=dist?.name||'';}
      if(isDoctor){rec.latitude=num($('#recordLatitude').value)||'';rec.longitude=num($('#recordLongitude').value)||'';rec.locationAccuracy=num($('#recordAccuracy').value)||'';rec.locationCapturedAt=$('#recordCapturedAt').value||'';}
      if(isDoctor){
        const days=fd.getAll('meetingDays').map(Number),from=normalizeTime(fd.get('meetingFrom')),to=normalizeTime(fd.get('meetingTo')),from2=normalizeTime(fd.get('meetingFrom2')),to2=normalizeTime(fd.get('meetingTo2'));
        const anyTime=from||to||from2||to2;if(anyTime&&!days.length){toast('Choose doctor meeting day(s).');return;}if((from&&!to)||(!from&&to)||(from2&&!to2)||(!from2&&to2)){toast('Complete both From and To for each timing.');return;}if((from&&timeMinutes(to)<=timeMinutes(from))||(from2&&timeMinutes(to2)<=timeMinutes(from2))){toast('Meeting To time must be later than From time.');return;}if(days.length&&!anyTime){toast('Add at least one meeting time or clear the selected days.');return;}
        rec.meetingDays=days;rec.meetingFrom=from;rec.meetingTo=to;rec.meetingFrom2=from2;rec.meetingTo2=to2;
        rec.clinicSystem=clean(fd.get('clinicSystem'))||'direct';rec.cardDropTime=rec.clinicSystem==='card_later'?normalizeTime(fd.get('cardDropTime')):'';if(rec.clinicSystem==='card_later'&&!rec.cardDropTime){toast('Set card drop time.');return;}
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
    if(isDoctor){
      const timing=doctorMeetingStatus(r),elig=doctorEligibilityForDate(r),apt=upcomingAppointments().find(x=>x.doctorId===r.id),products=suggestedProductsForDoctor(r),kind=doctorType(r);
      const aptWhen=apt?(apt.status==='Doctor will call'?`Waiting for doctor call • reminder ${prettyDate(apt.reminderDate||apt.date)}${apt.reminderTime?` • ${timeLabel(apt.reminderTime)}`:''}`:`${apt.status} • ${prettyDate(apt.date)}${apt.time?` • ${timeLabel(apt.time)}`:''}`):'No upcoming appointment';
      extra=`<div class="detail-section"><h4>Clinic meeting system</h4><div class="doctor-fit-card"><div><span class="specialty-pill">${esc(doctorClinicSystemLabel(r))}</span><strong>${esc(clinicAccessSummary(r))}</strong><small>${doctorClinicSystem(r)==='card_later'?(cardDroppedForDate(r.id)?'Card already given today':'Card must be given before later meeting'):doctorClinicSystem(r)==='appointment'?'Only confirmed appointment becomes a fixed route slot':'Available on saved meeting days/time'}</small></div></div></div><div class="detail-section"><h4>Doctor type & product focus</h4><div class="doctor-fit-card"><div><span class="specialty-pill">${esc(kind)}</span><strong>${esc(products.join(' • ')||'No mapped product')}</strong><small>Suggested from doctor section + saved focus brands</small></div></div></div><div class="detail-section"><h4>Appointment</h4><div class="detail-address"><strong>${esc(aptWhen)}</strong>${apt?.shortDescription?`<br><span class="muted-line">${esc(apt.shortDescription)}</span>`:''}${apt?.notes?`<br>${esc(apt.notes)}`:''}</div>${apt?.status==='Doctor will call'?`<button class="btn primary compact" data-action="doctor-called-now" data-id="${esc(apt.id)}">Doctor called → add time</button>`:''}<button class="btn secondary compact" data-action="add-appointment" data-doctor-id="${esc(r.id)}">${apt?'New / change appointment':'Get appointment'}</button></div><div class="detail-section"><h4>Monthly visit rule</h4><div class="detail-address"><strong>${esc(doctorVisitPolicy(r).label)}</strong><br>${esc(elig.reason)}</div></div><div class="detail-section"><h4>Doctor meeting timing</h4><div class="detail-address timing-detail ${esc(timing.state)}"><strong>${esc(timing.label)}</strong>${doctorMeetingTiming(r)?`<br>${esc(doctorMeetingTiming(r))}`:'<br>Not set yet'}</div></div><div class="detail-section"><h4>Under chemist</h4><div class="detail-address">${esc(ch?.name||'Not linked yet')}</div></div><div class="detail-section"><h4>Latest product status</h4>${statusTags(latestStatuses(r.id,ch?.id||''))}</div>`;
    }else{
      const docs=state.doctors.filter(d=>d.linkedChemistId===id),dist=preferredDistributor(r);
      extra=`<div class="detail-section"><h4>Preferred distributor</h4><div class="detail-address">${esc(dist?.name||'Not set')}</div></div><div class="detail-section"><h4>Doctors under this chemist</h4>${docs.length?docs.map(d=>`<button class="linked-doctor-row" data-action="view-record" data-type="doctor" data-id="${d.id}"><strong>${esc(doctorDisplayName(d))}</strong><small>${esc(inferDoctorArea(d)||'')} • ${esc(doctorType(d))}</small></button>`).join(''):empty('No doctor linked yet.')}</div>`;
    }
    const area=isDoctor?inferDoctorArea(r):(r.area||r.hq||'—');
    const googleTools=isDoctor?`<div class="google-search-actions"><a class="btn secondary" href="${googleDoctorSearchUrl(r)}" target="_blank" rel="noopener">Google doctor name</a><a class="btn secondary" href="${googleAddressSearchUrl(r)}" target="_blank" rel="noopener">Google address</a>${clean(r.address||r.hospitalAddress)?`<button class="btn primary" data-action="resolve-doctor-gps" data-id="${esc(r.id)}">${r.latitude&&r.longitude?'Recheck GPS FREE':'Find GPS FREE'}</button>`:''}</div>`:'';
    openSheet(isDoctor?doctorDisplayName(r):r.name,isDoctor?`${doctorType(r)} • Doctor profile`:'Chemist profile',`<div class="detail-hero"><div class="avatar">${esc(initials(r.name))}</div><div><div class="title-line"><h3>${esc(isDoctor?doctorDisplayName(r):r.name)}</h3>${isDoctor?`<span class="specialty-pill">${esc(doctorType(r))}</span>`:''}</div><p>${esc(isDoctor?(ch?.name||'Chemist not linked'):`${linkedDoctorCount(r.id)} doctors linked`)}</p></div></div><div class="detail-grid"><div class="detail-box"><small>Area</small><strong>${esc(area)}</strong></div><div class="detail-box"><small>Last meeting</small><strong>${esc(prettyDate(r.lastVisit))}</strong></div></div>${isDoctor&&doctorHospital(r)?`<div class="detail-section"><h4>Hospital / clinic</h4><div class="detail-address">${esc(doctorHospital(r))}</div></div>`:''}<div class="detail-section"><h4>Address</h4><div class="detail-address">${esc(r.address||'Not added')}</div></div>${googleTools}${map?`<a class="map-main-btn" href="${map}" target="_blank" rel="noopener">Open map location</a>`:''}${extra}${r.notes?`<div class="detail-section"><h4>Note</h4><div class="note-box">${esc(r.notes)}</div></div>`:''}<div class="detail-actions"><button data-action="log-record" data-type="${type}" data-id="${id}">${isDoctor?'Start doctor call':'Log meeting'}</button><button data-action="edit-record" data-type="${type}" data-id="${id}">Edit once</button><button data-close-sheet>Close</button></div><div class="detail-section"><h4>Meeting history</h4>${history.length?history.map(miniActivity).join(''):empty('No meetings yet.')}</div>`);
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
  const eligible=state.doctors.filter(d=>{const access=doctorAccessForDate(d),slot=access.fixed?access.slots[0]:todaySlot(d),eligibility=doctorEligibilityForDate(d);return access.ready&&slot&&num(d.latitude)&&num(d.longitude)&&(eligibility.eligible||access.fixed);}),distributorStops=pendingDistributorStops(),preferred=smartPatchCandidates(30).find(x=>eligible.some(d=>d.id===x.doctor.id))?.doctor||eligible[0]||null;
  openSheet('Today location-wise planning','Clinic-access-aware route: only ready doctors enter the chain; confirmed appointments are fixed and card-drop doctors wait until Card given ✓.',`${eligible.length?`<label class="sheet-form"><span>Start from saved doctor / hospital</span><select id="routeStartDoctor">${eligible.map(d=>`<option value="${esc(d.id)}" ${d.id===preferred?.id?'selected':''}>${esc(doctorDisplayName(d))}</option>`).join('')}</select></label><label class="toggle-line"><input id="includeVisitedRoute" type="checkbox"> Include doctors already called today</label><div id="routeResult"></div>`:empty('No doctor has both today timing and verified hospital GPS. Distributor planning is still shown below.')}<div id="distributorPlanResult"></div>`);
  const renderDistributors=()=>{$('#distributorPlanResult').innerHTML=`<div class="detail-section"><h4>Accepted-order distributor stops</h4>${distributorStops.length?distributorStops.map((x,i)=>`<div class="route-stop ${x.mapReady?'':'route-risk'}"><span>${i+1}</span><div><strong>${esc(x.distributor.name)}</strong><small>${esc(`₹${x.totalValue.toLocaleString('en-IN')} • ${x.orders.length} order(s) • ${x.chemists.join(', ')||'Chemist pending'} • ${x.address||'Address missing'}${x.mapReady?' • map pin ready':' • add map pin in Distributor'}`)}</small></div>${entityMapUrl(x.distributor)?`<a class="btn secondary compact" href="${entityMapUrl(x.distributor)}" target="_blank" rel="noopener">Map</a>`:''}</div>`).join(''):empty('No accepted order is pending fulfilment.')}</div>`;};
  renderDistributors();if(!eligible.length)return;
  const render=()=>{const startDoctor=doctorById($('#routeStartDoctor').value)||preferred;if(!startDoctor)return;const lat=num(startDoctor.latitude),lng=num(startDoctor.longitude),route=groupedHospitalRouteCandidates(lat,lng,$('#includeVisitedRoute').checked),mappedDistributors=distributorStops.filter(x=>x.mapReady).map(x=>({type:'distributor',latitude:x.latitude,longitude:x.longitude,distributor:x.distributor})),url=googleRouteUrl(lat,lng,[...route,...mappedDistributors]);$('#routeResult').innerHTML=route.length?`<div class="notice">Start: ${esc(doctorDisplayName(startDoctor))}. Order is built as a true chain from each previous stop; same-hospital doctors are combined. Timing conflicts are shown but do not jump over a nearer stop.</div><div class="route-list">${route.map((x,i)=>`<div class="route-stop ${x.timingRisk?'route-risk':''}"><span>${i+1}</span><div><strong>${esc(x.hospital)}</strong><small>${esc(`${x.doctors.map(y=>doctorDisplayName(y.doctor)).join(', ')} • ETA ${minuteLabel(x.arrivalMinutes)} • ${x.distance.toFixed(1)} km approximate • ${x.waitMinutes?`wait ${x.waitMinutes} min • `:''}${x.timingRisk?`timing conflict +${x.lateMinutes} min • `:''}verified hospital pin`)}</small></div><button data-action="log-record" data-type="doctor" data-id="${x.doctor.id}">Meet</button></div>`).join('')}</div><div class="button-row">${url?`<a class="btn primary" href="${url}" target="_blank" rel="noopener">Open doctors + mapped distributors in Maps</a>`:''}<button id="saveRoutePlanBtn" class="btn secondary">Save plan</button></div>`:empty('No unvisited doctor is available with today timing and verified hospital GPS.');$('#saveRoutePlanBtn')?.addEventListener('click',()=>{state.routePlans.push({id:uid('route'),date:localISODate(),createdAt:new Date().toISOString(),startDoctorId:startDoctor.id,startDoctorName:doctorDisplayName(startDoctor),startLatitude:lat,startLongitude:lng,source:'Strict nearest-chain verified hospital GPS + accepted distributor orders',stops:[...route.map((x,i)=>({order:i+1,type:'Hospital',doctorId:x.doctor.id,doctorName:x.doctors.map(y=>y.doctor.name).join('; '),hospital:x.hospital,meetingFrom:x.slot.from,meetingTo:x.slot.to,estimatedArrival:minuteLabel(x.arrivalMinutes),travelMinutes:x.travelMinutes,waitMinutes:x.waitMinutes,timingRisk:x.timingRisk?'Yes':'No',locationAccuracy:x.doctor.locationAccuracy||'',locationSource:x.doctor.locationSource||'Verified hospital GPS',latitude:x.latitude,longitude:x.longitude,distanceKm:Number(x.distance.toFixed(2))})),...distributorStops.map((x,i)=>({order:route.length+i+1,type:'Distributor',doctorName:'',hospital:x.distributor.name,meetingFrom:'',meetingTo:'',estimatedArrival:'Flexible',travelMinutes:'',waitMinutes:'',timingRisk:x.mapReady?'No':'Map pin missing',locationAccuracy:'',locationSource:x.mapReady?'Manual verified map pin':'Address only',latitude:x.latitude||'',longitude:x.longitude||'',distanceKm:''}))]});saveState(false);toast('Doctor and distributor plan added to Excel.');});};
  $('#routeStartDoctor').addEventListener('change',render);$('#includeVisitedRoute').addEventListener('change',render);render();
}
function workbookData(){
  const latestRoute=state.routePlans.filter(r=>r.date===localISODate()).slice(-1)[0];
  return {sheets:[
    {name:'Summary',rows:[['MR One Export',localISODateTime()],['HQ',state.profile.hq],['TM',state.profile.tmName],['Doctors',state.doctors.length],['Chemists',state.chemists.length],['Distributors',state.distributors.length],['Orders',state.orders.length],['RCPA',state.rcpa.length],['Sample Items',state.sampleItems.length],['Sample Balance',state.sampleItems.reduce((n,x)=>n+sampleBalance(x),0)],['Expenses This Month',expenseTotal(expensesForMonth())],['Voice Captures',state.captures.length],['Active Schemes',state.schemes.filter(x=>schemeState(x)==='active').length],[],['Metric','Today','Month Cumulative'],...METRICS.map(([k,l])=>[l,statsForDay()[k],statsForMonth()[k]]),['Samples Issued',sampleIssuedForDay(),sampleIssuedForMonth()],['Expenses',expenseTotal(expensesForDay()),expenseTotal(expensesForMonth())],['RCPA',state.rcpa.filter(x=>dateOnly(x.date)===localISODate()).length,state.rcpa.filter(x=>monthKey(x.date)===monthKey()).length]]},
    {name:'Doctors',rows:[['Doctor Name','Hospital / Clinic','Google Place ID','Hospital Opening Hours','Under Chemist','Clinic System','Card Drop Time','Monthly Visit Target','Minimum Gap Days','Meeting Days','Meeting From 1','Meeting To 1','Meeting From 2','Meeting To 2','Address','Area','Latitude','Longitude','Location Source','Last Meeting','Next Follow-up','Notes'],...state.doctors.map(d=>[d.name,doctorHospital(d),d.placeId||'',(d.hospitalOpeningHours||[]).join('; '),linkedChemist(d)?.name||d.chemistName,doctorClinicSystemLabel(d),doctorClinicSystem(d)==='card_later'?doctorCardDropTime(d):'',doctorVisitPolicy(d).target,doctorVisitPolicy(d).gap,normalizeMeetingDays(d.meetingDays).map(x=>DAY_NAMES[x]).join('; '),d.meetingFrom,d.meetingTo,d.meetingFrom2,d.meetingTo2,d.address,d.area,d.latitude,d.longitude,d.locationSource||'',d.lastVisit,d.nextFollowUp,d.notes])]},
    {name:'Chemists',rows:[['Chemist Name','Preferred Distributor','Address','Area','Latitude','Longitude','Last Meeting','Next Follow-up','Notes'],...state.chemists.map(c=>[c.name,preferredDistributor(c)?.name||c.distributorName,c.address,c.area,c.latitude,c.longitude,c.lastVisit,c.nextFollowUp,c.notes])]},
    {name:'Distributors',rows:[['Distributor Name','Mobile','Address','Area','Latitude','Longitude','Last Order','Notes'],...state.distributors.map(d=>[d.name,d.mobile,d.address,d.area,d.latitude,d.longitude,d.lastOrderDate,d.notes])]},
    {name:'Orders',rows:[['Date','Doctor','Hospital','Chemist','Distributor','Products','Packs','Quantities','Schemes','POB Value','Status','Notes','Latitude','Longitude'],...state.orders.map(o=>[o.date,o.doctorName,o.doctorHospital,o.chemistName,distributorById(o.distributorId)?.name||o.distributorName,(o.items||[]).map(x=>x.product).join('; '),(o.items||[]).map(x=>x.pack).join('; '),(o.items||[]).map(x=>x.qty).join('; '),(o.items||[]).map(x=>x.schemeRatio).join('; '),orderTotal(o),o.status,o.notes,o.latitude,o.longitude])]},
    {name:'Expenses',rows:[['Date','Category','From','To','Distance Km','Rate per Km','Amount','Notes'],...state.expenses.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).map(x=>[x.date,x.category,x.fromPlace,x.toPlace,x.km,x.ratePerKm,x.amount,x.notes])]},
    {name:'Sample Stock',rows:[['Product','Pack','Batch','Expiry','Opening Qty','Received Qty','Issued Qty','Balance','Notes'],...state.sampleItems.map(x=>[x.product,x.pack,x.batch,x.expiry,x.openingQty,state.sampleTransactions.filter(t=>t.sampleItemId===x.id&&t.type==='receive').reduce((n,t)=>n+num(t.qty),0),state.sampleTransactions.filter(t=>t.sampleItemId===x.id&&t.type==='issue').reduce((n,t)=>n+num(t.qty),0),sampleBalance(x),x.notes])]},
    {name:'Sample Distribution',rows:[['Date','Doctor','Chemist','Product','Pack','Batch','Qty','Visit ID','Notes'],...state.sampleTransactions.filter(x=>x.type==='issue').map(x=>[x.date,x.doctorName,x.chemistName,x.product,x.pack,x.batch,x.qty,x.visitId,x.notes])]},
    {name:'RCPA',rows:[['Date','Chemist','Doctor','Our Brand','Our Availability','Competitor Brand','Competitor Company','Rx / Units','Notes'],...state.rcpa.map(x=>[x.date,x.chemistName,x.doctorName,x.ourBrand,x.ourAvailability,x.competitorBrand,x.competitorCompany,x.rxQty,x.notes])]},
    {name:'Tour Program',rows:[['Date','Work Type','Area / Town','Joint Work With','Objective','Notes'],...state.tourPlans.map(x=>[x.date,x.workType,x.area,x.jointWorkWith,x.objective,x.notes])]},
    {name:'Clinic Access',rows:[['Date','Doctor','Action','Completed At'],...state.clinicActions.map(x=>[x.date,doctorById(x.doctorId)?.name||x.doctorId,x.type,x.completedAt])]},
    {name:'Appointments',rows:[['Date','Time','Doctor','Hospital','Status','Duration Min','Contact / Source','Short Description','Notes'],...state.appointments.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.time).localeCompare(String(b.time))).map(x=>[x.date,x.time,x.doctorName,x.hospital,x.status,x.durationMinutes,x.contactPerson,x.shortDescription,x.notes])]},
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

  function openDoctorFilterPanel(){
    const counts=new Map();state.doctors.forEach(d=>{const a=inferDoctorArea(d)||'Other';counts.set(a,(counts.get(a)||0)+1);});
    const areas=[...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,18);
    const chip=(value,label)=>`<button class="chip ${doctorFilterHas(value)?'active':''}" data-action="toggle-doctor-filter" data-value="${esc(value)}">${esc(label)}</button>`;
    openSheet('Doctor filters','Select multiple filters. Different groups combine together; multiple doctor types or areas match either selected option.',`<div class="filter-section"><small>AVAILABILITY</small><div class="chip-row wrap">${chip('today_available','Today’s Available')}</div></div><div class="filter-section"><small>TIMING</small><div class="chip-row wrap">${chip('timing','Timing added')}${chip('no_timing','Without timing')}</div></div><div class="filter-section"><small>ADDRESS</small><div class="chip-row wrap">${chip('address_missing','Address missing')}</div></div><div class="filter-section"><small>DOCTOR TYPE</small><div class="chip-row wrap">${chip('type:PEDIA','Pedia')}${chip('type:GYNAEC','Gynaec')}${chip('type:GP','GP')}${chip('type:MATRON','Matron')}</div></div><div class="filter-section"><small>AREA</small><div class="area-filter-grid">${areas.map(([a,n])=>`<button class="${doctorFilterHas(`area:${a}`)?'active':''}" data-action="toggle-doctor-filter" data-value="area:${esc(a)}"><strong>${esc(a)}</strong><small>${esc(n)} doctors</small></button>`).join('')}</div></div><div class="sticky-save filter-actions"><button class="btn secondary" data-action="reset-doctor-filters" type="button">Reset all</button><button class="btn primary" data-action="apply-doctor-filters" type="button">Apply ${doctorFilterCount()?`(${doctorFilterCount()})`:''}</button></div>`);
  }

  function globalSearch() {
    openSheet('Search','Fast search across doctor, hospital, area, type, product and chemist.',`<label class="sheet-form"><span>Search</span><input id="globalSearchInput" autofocus placeholder="Type doctor, hospital, area, Pedia, GP, Zefrich…"></label><div id="globalSearchResults" class="stack-list">${empty('Start typing to search.')}</div>`);
    const input=$('#globalSearchInput'),out=$('#globalSearchResults');
    const run=()=>{
      const q=clean(input.value).toLowerCase();if(!q){out.innerHTML=empty('Start typing to search.');return;}
      const items=[];
      for(const d of state.doctors){
        const ch=linkedChemist(d),area=inferDoctorArea(d),type=doctorType(d),products=suggestedProductsForDoctor(d);
        if([d.name,doctorHospital(d),d.address,area,d.hq,ch?.name,d.notes,type,...products].join(' ').toLowerCase().includes(q)){
          items.push({record:d,type:'doctor',chemist:ch?.name||'',area,doctorType:type,products});
          if(items.length>=30)break;
        }
      }
      if(items.length<30)for(const c of state.chemists){
        if([c.name,c.address,c.area,c.hq,c.notes].join(' ').toLowerCase().includes(q)){items.push({record:c,type:'chemist'});if(items.length>=30)break;}
      }
      out.innerHTML=items.length?items.map(item=>{const x=item.record,timing=item.type==='doctor'?doctorMeetingStatus(x):null;return `<button class="mini-card plain-button" data-action="view-record" data-type="${item.type}" data-id="${x.id}"><span class="mini-icon">${item.type==='doctor'?'⚕':'✚'}</span><span class="mini-copy"><h3>${esc(item.type==='doctor'?doctorDisplayName(x):x.name)}${item.type==='doctor'?` <em class="inline-specialty">${esc(item.doctorType)}</em>`:''}</h3><p>${esc(item.type==='doctor'?([timing.label,item.area,item.products.slice(0,2).join(', ')].filter(Boolean).join(' • ')):(x.area||`${linkedDoctorCount(x.id)} doctors`))}</p></span></button>`;}).join(''):empty('No matches.');
    };
    input.addEventListener('input',debounce(run,70));
    setTimeout(()=>input.focus(),80);
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
    const incoming={...(rec||{})};incoming.area=inferDoctorArea(incoming)||clean(incoming.area||incoming.hq);
    const key=norm(incoming.name),hospital=norm(incoming.hospital),place=norm(incoming.area||incoming.hq);let old=state.doctors.find(x=>norm(x.name)===key&&hospital&&norm(doctorHospital(x))===hospital);if(!old&&hospital)old=state.doctors.find(x=>norm(x.name)===key&&!doctorHospital(x)&&(!place||norm(inferDoctorArea(x)||x.hq)===place));if(!old&&!hospital)old=state.doctors.find(x=>norm(x.name)===key&&(!place||norm(inferDoctorArea(x)||x.hq)===place))||state.doctors.find(x=>norm(x.name)===key&&!doctorHospital(x));
    if(!old){const created={...incoming,id:uid('dr'),createdAt:new Date().toISOString()};created.area=inferDoctorArea(created)||created.area||created.hq;state.doctors.push(created);return {mode:'added',record:created};}
    const protectedFields=['notes','lastVisit','nextFollowUp','createdAt','id','latitude','longitude','locationCapturedAt'];Object.entries(incoming).forEach(([k,v])=>{if(protectedFields.includes(k)||v===''||v==null)return;if(Array.isArray(v))old[k]=mergeArrays(old[k],v);else old[k]=v;});old.area=inferDoctorArea(old)||old.area||old.hq;old.sourceFiles=mergeArrays(old.sourceFiles,incoming.sourceFiles);old.updatedAt=new Date().toISOString();return {mode:'updated',record:old};
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

  function haptic(kind='selection'){try{if(state?.settings?.haptics===false)return;if(window.AndroidBridge?.haptic)window.AndroidBridge.haptic(kind);}catch(_){}}

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
      if(e.target.closest('button,.btn,[data-nav]'))haptic(e.target.closest('.danger')?'error':e.target.closest('.primary,[type="submit"]')?'confirm':'selection');
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
        if(action==='manage-appointments')manageAppointments();
        if(action==='add-appointment')editAppointment('',a.dataset.doctorId||'');
        if(action==='edit-appointment')editAppointment(id);
        if(action==='doctor-called-now')doctorCalledNow(id);
        if(action==='mark-card-given'){hideProximityCall();markCardDropped(id);}
        if(action==='start-next-call')quickMeeting(id,'');
        if(action==='refresh-next-call'){requestProximityCheck();toast('Refreshing current GPS…');}
        if(action==='resolve-doctor-gps')resolveDoctorGpsOnline(id);
        if(action==='verify-doctor-location')openDoctorLocationVerification(id);
        if(action==='use-doctor-gps')useDoctorGpsResult(Number(a.dataset.index));
        if(action==='confirm-google-candidate'){const row=locationVerifyContext?.googleRows?.[Number(a.dataset.index)],d=doctorById(locationVerifyContext?.doctorId);if(row&&d){d.hospital=clean(row.name)||d.hospital;d.address=clean(row.address)||d.address;d.latitude=num(row.latitude);d.longitude=num(row.longitude);d.placeId=clean(row.placeId);d.googleCrossCheckedAt=new Date().toISOString();d.locationVerificationStatus='verified';d.locationSource='Google Places cross-check: doctor + hospital + address';d.gpsResolutionMode='google_cross_checked';d.updatedAt=new Date().toISOString();saveState(false);closeSheet();haptic('success');toast('Google candidate confirmed. Field AI pin verified.');}}
        if(action==='start-proximity-call'){hideProximityCall();quickMeeting(id,'');}
        if(action==='dismiss-proximity'){proximityDismissedUntil=Date.now()+15*60*1000;hideProximityCall();}
        if(action==='show-more-doctors'){doctorRenderLimit+=60;renderDoctors();}
        if(action==='show-more-chemists'){chemistRenderLimit+=60;renderChemists();}
        if(action==='toggle-doctor-filter'){toggleDoctorFilter(a.dataset.value||'');doctorRenderLimit=60;openDoctorFilterPanel();renderDoctors();}
        if(action==='reset-doctor-filters'){resetDoctorFilters();doctorRenderLimit=60;openDoctorFilterPanel();renderDoctors();}
        if(action==='apply-doctor-filters'){doctorRenderLimit=60;closeSheet();renderDoctors();}
        if(action==='toggle-route-doctor')toggleSelectedRouteDoctor(id);
        if(action==='select-shown-route-doctors')selectShownRouteDoctors();
        if(action==='clear-route-doctors')clearSelectedRouteDoctors();
        if(action==='build-selected-doctor-route')buildSelectedDoctorRoute();
        if(action==='route-move-up')moveSelectedRouteDoctor(id,-1);
        if(action==='route-move-down')moveSelectedRouteDoctor(id,1);
        if(action==='route-move-to')moveSelectedRouteDoctorTo(id);
        if(action==='quick-complete-doctor')quickCompleteDoctor();
        if(action==='area-time-plan')areaTimeDoctorPlan();
        if(action==='edit-tour-plan')editTourPlan(id);
        if(action==='manage-sales')manageSales();
        if(action==='app-update')manageAppUpdate();
        if(action==='edit-sales')editSales();
        if(action==='add-doctor')editRecord('doctor');if(action==='add-chemist')editRecord('chemist');
        if(action==='log-record'){if(type==='doctor')quickMeeting(id,'');else quickChemistVisit(id);}
        if(action==='edit-record')editRecord(type,id);if(action==='view-record')viewRecord(type,id);if(action==='view-visit')viewVisit(id);if(action==='add-distributor')editDistributor();if(action==='edit-distributor')editDistributor(id);if(action==='manage-distributors')manageDistributors();if(action==='add-scheme')editScheme();if(action==='edit-scheme')editScheme(id);if(action==='manage-schemes')manageSchemes();if(action==='new-order')quickOrder(a.dataset.distributorId||'');if(action==='view-order')viewOrder(id);if(action==='plan-route')startDoctorRouteSelection();if(action==='nearby-hospitals')discoverNearbyHospitals();if(action==='voice-capture')voiceDataCapture();return;}
      const dc=e.target.closest('[data-doctor-chip]');if(dc){toggleDoctorFilter(dc.dataset.doctorChip);doctorRenderLimit=60;renderDoctors();haptic('selection');return;}
      const cc=e.target.closest('[data-chemist-chip]');if(cc){chemistFilter=cc.dataset.chemistChip;chemistRenderLimit=60;renderChemists();return;}
      const vf=e.target.closest('[data-visit-filter]');if(vf){visitFilter=vf.dataset.visitFilter;renderVisits();return;}
      if(e.target.closest('[data-filter-followups="due"]')){visitFilter='due';navigate('visits');}
    });
    $('#sheetBackdrop').addEventListener('click',closeSheet);$('#quickLogBtn').addEventListener('click',()=>quickMeeting());$('#quickSearchBtn').addEventListener('click',globalSearch);
    const debouncedDoctorSearch=debounce(()=>{doctorRenderLimit=60;renderDoctors();},80),debouncedChemistSearch=debounce(()=>{chemistRenderLimit=60;renderChemists();},80);
    $('#doctorSearch').addEventListener('input',debouncedDoctorSearch);$('#chemistSearch').addEventListener('input',debouncedChemistSearch);
    $('#doctorFilterBtn').addEventListener('click',openDoctorFilterPanel);
    $('#doctorRouteSelectBtn').addEventListener('click',toggleDoctorRouteMode);
    $('#stockFilterBtn').addEventListener('click',()=>{chemistFilter=chemistFilter==='feedback'?'all':'feedback';renderChemists();});
    $('#workflowModeBtn').addEventListener('click',()=>{state.settings.workflowMode=state.settings.workflowMode==='collect'?'field':'collect';saveState();toast(state.settings.workflowMode==='collect'?'Data gathering mode active.':'Field work mode active.');});
    $('#machineOpenBtn').addEventListener('click',openIntelligenceCenter);$('#companyReportPackBtn').addEventListener('click',exportCompanyReportPack);$('#sanOverlayBtn').addEventListener('click',openSanOverlayManager);
    $('#nearbyHospitalBtn').addEventListener('click',discoverNearbyHospitals);$('#planRouteBtn').addEventListener('click',startDoctorRouteSelection);$('#newOrderBtn').addEventListener('click',()=>quickOrder());$('#manageDistributorsBtn').addEventListener('click',manageDistributors);$('#manageSchemesBtn').addEventListener('click',manageSchemes);$('#exportXlsxBtn').addEventListener('click',exportXLSX);
    $('#copyReportBtn').addEventListener('click',async()=>{try{const text=getReportText();if(window.AndroidBridge?.copyText)window.AndroidBridge.copyText(text);else await navigator.clipboard.writeText(text);toast('Daily report copied.');}catch(_){toast('Copy failed. Use Share.');}});
    $('#shareReportBtn').addEventListener('click',async()=>{const text=getReportText();try{if(window.AndroidBridge?.shareText)window.AndroidBridge.shareText('MR Daily Report',text);else if(navigator.share)await navigator.share({title:'MR Daily Report',text});else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,'_blank');}catch(e){if(e.name!=='AbortError')toast('Share cancelled.');}});
    $('#importFile').addEventListener('change',e=>{if(e.target.files.length)importFiles([...e.target.files]);e.target.value='';});$('#loadBundledBtn').addEventListener('click',()=>{if(window.AndroidBridge){const status=$('#importStatus');status.className='notice';status.classList.remove('hidden');status.textContent='The supplied doctor, chemist and product data is already included in this Android app.';toast('Starter data is already loaded.');}else loadBundledFiles(false);});
    $('#exportJsonBtn').addEventListener('click',()=>download(`MR-Daily-Auto-Backup-${localISODate()}.json`,JSON.stringify(state,null,2)));$('#exportCsvBtn').addEventListener('click',exportCSV);$('#restoreBtn').addEventListener('click',()=>$('#restoreInput').click());
    $('#restoreInput').addEventListener('change',async e=>{try{const info=restoreObject(JSON.parse(await e.target.files[0].text()));saveState();toast(`Backup v${info.sourceVersion} restored • ${info.doctors} doctors • ${info.chemists} chemists • ${info.visits} activities.`);}catch(err){toast(err.message);}e.target.value='';});
    $('#profileForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget);['tmName','hq','joinWorkWith','companyDivision','products'].forEach(k=>state.profile[k]=clean(fd.get(k)));saveState();toast('Profile and product buttons saved.');});
    $('#openingForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget);state.opening.monthKey=monthKey(localISODate());METRICS.forEach(([k])=>state.opening[k]=num(fd.get(k)));saveState();toast('Opening balances saved.');});
    $('#pinForm').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),p=clean(fd.get('pin')),c=clean(fd.get('confirmPin'));if(!/^\d{4,6}$/.test(p)||p!==c){toast('PIN must be matching 4–6 digits.');return;}state.settings.pinHash=await hashPin(p);saveState(false);e.currentTarget.reset();toast('PIN lock set.');});
    $('#themeChoice')?.addEventListener('click',e=>{const b=e.target.closest('[data-theme-choice]');if(b)setThemeChoice(b.dataset.themeChoice);});$('#hapticsToggle')?.addEventListener('change',e=>{state.settings.haptics=Boolean(e.target.checked);saveState(false);if(state.settings.haptics)haptic('confirm');});
    $('#removePinBtn').addEventListener('click',()=>{state.settings.pinHash='';saveState(false);toast('PIN removed.');});$('#unlockBtn').addEventListener('click',async()=>{const h=await hashPin($('#unlockPin').value);if(h===state.settings.pinHash){$('#lockScreen').classList.add('hidden');$('#unlockError').textContent='';$('#unlockPin').value='';}else $('#unlockError').textContent='Wrong PIN';});$('#unlockPin').addEventListener('keydown',e=>{if(e.key==='Enter')$('#unlockBtn').click();});
    $('#resetBtn').addEventListener('click',()=>{if(!confirm('Reset all local app data? Export a backup first.'))return;state=makeDefaultState();saveState();toast('App reset.');navigate('dashboard');});
    document.addEventListener('mr-location-ready',e=>{if(e.detail?.latitude&&e.detail?.longitude)handleProximityLocation(e.detail.latitude,e.detail.longitude,e.detail.accuracy||0);});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&activePage==='dashboard')setTimeout(requestProximityCheck,350);});
    window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;});window.matchMedia?.('(prefers-color-scheme: dark)')?.addEventListener?.('change',()=>{if((state.settings.theme||'system')==='system')applyTheme();});
  }

  async function init(){loadEmbeddedSeed();applyTheme();bindEvents();renderAll();showLockIfNeeded();if(window.AndroidBridge?.consumeSanOverlayText){const pending=clean(window.AndroidBridge.consumeSanOverlayText());if(pending)setTimeout(()=>openSanClipboardReview(pending),500);}if(window.AndroidBridge?.fetchLocation)setTimeout(requestProximityCheck,700);if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./service-worker.js').catch(console.warn);if(!state.settings.bundledImportAttempted&&location.protocol!=='file:')setTimeout(()=>loadBundledFiles(true),900);}
  document.addEventListener('DOMContentLoaded',init);
})();
