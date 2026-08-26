// MR-One planner module — date-wise auto patch, automatic daily plan, 30-day advance plan.
//
// This is Phase 2 (architecture cleanup) of v1.9.0. It is deliberately NOT an ES module
// (this app runs from file:///android_asset/ in the Android WebView, where `type="module"`
// script loading is unreliable under the file: protocol) — instead it's a plain IIFE that
// receives every dependency it needs (state accessor, save function, DOM helpers, other
// pure helper functions) through an explicit `init(deps)` call from app.js. Nothing in this
// file reaches into app.js's closure directly, and nothing in app.js reaches into this
// file's internals — the only contact surface is the object init() returns. That's what
// makes this file independently readable, testable, and safe to change without risking the
// rest of the app, which is the whole point of splitting it out.
(function () {
  'use strict';
  let deps = null;
  let planningPickedDate = '';

  function generateDateWisePlan(startDate, days = 30, perDayCap = 0) {
    const { getState, num, effectiveSuccessfulDoctorVisits, monthKey, normalizeMeetingDays, doctorVisitPolicy, daysBetween, doctorDisplayName, doctorHospital, localISODate } = deps;
    const state = getState();
    startDate = startDate || localISODate();
    const cap = perDayCap || Math.max(1, num(state.settings.dailyPlanCap) || 8);
    const start = new Date(`${startDate}T00:00:00`);
    const lastVisitDate = {};
    state.doctors.forEach((d) => { const rows = effectiveSuccessfulDoctorVisits(d); lastVisitDate[d.id] = rows.length ? rows[rows.length - 1].date : null; });
    const monthCounts = {};
    state.doctors.forEach((d) => { effectiveSuccessfulDoctorVisits(d).forEach((v) => { const k = `${monthKey(v.date)}|${d.id}`; monthCounts[k] = (monthCounts[k] || 0) + 1; }); });
    const plan = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      const dateStr = localISODate(d), weekday = d.getDay(), mKey = monthKey(dateStr);
      const candidates = state.doctors.filter((doc) => {
        const wDays = normalizeMeetingDays(doc.meetingDays);
        if (wDays.length && !wDays.includes(weekday)) return false;
        const policy = doctorVisitPolicy(doc), countKey = `${mKey}|${doc.id}`;
        if ((monthCounts[countKey] || 0) >= policy.target) return false;
        const last = lastVisitDate[doc.id];
        if (policy.gap && last && daysBetween(last, dateStr) < policy.gap) return false;
        return true;
      });
      candidates.sort((a, b) => {
        const coreA = String(a.coreCategory).toUpperCase() === 'C' ? 0 : 1, coreB = String(b.coreCategory).toUpperCase() === 'C' ? 0 : 1;
        if (coreA !== coreB) return coreA - coreB;
        const gapA = lastVisitDate[a.id] ? daysBetween(lastVisitDate[a.id], dateStr) : 9999, gapB = lastVisitDate[b.id] ? daysBetween(lastVisitDate[b.id], dateStr) : 9999;
        return gapB - gapA || doctorDisplayName(a).localeCompare(doctorDisplayName(b));
      });
      const picked = candidates.slice(0, cap);
      const items = picked.map((doc, idx) => ({ order: idx + 1, doctorId: doc.id, doctorName: doctorDisplayName(doc), hospital: doctorHospital(doc), core: String(doc.coreCategory || '').toUpperCase(), reason: lastVisitDate[doc.id] ? `${daysBetween(lastVisitDate[doc.id], dateStr)}d since last visit` : 'No visit history yet' }));
      picked.forEach((doc) => { lastVisitDate[doc.id] = dateStr; const k = `${mKey}|${doc.id}`; monthCounts[k] = (monthCounts[k] || 0) + 1; });
      plan.push({ date: dateStr, weekday, items });
    }
    return plan;
  }

  function refresh30DayPlan() {
    const { getState, saveState, localISODate } = deps;
    const state = getState();
    state.thirtyDayPlan = generateDateWisePlan(localISODate(), 30);
    state.thirtyDayPlanGeneratedAt = new Date().toISOString();
    saveState(false);
  }

  function planForDate(dateStr) {
    const state = deps.getState();
    const found = (state.thirtyDayPlan || []).find((p) => p.date === dateStr);
    return found || generateDateWisePlan(dateStr, 1)[0];
  }

  function pushPlanToPatch(dateStr) {
    const { getState, saveState, toast, uid, prettyDate } = deps;
    const state = getState();
    const day = planForDate(dateStr);
    if (!day || !day.items.length) { toast('No eligible doctors for this date.'); return; }
    state.patchPlans.push({ id: uid('patch'), date: dateStr, createdAt: new Date().toISOString(), status: 'confirmed', items: day.items.map((x) => ({ order: x.order, type: 'Doctor', doctorId: x.doctorId, doctorName: x.doctorName, hospital: x.hospital, timing: 'Advance plan', score: '', reason: x.reason, productAction: '' })) });
    saveState();
    toast(`${day.items.length} doctor call(s) pushed to patch plan for ${prettyDate(dateStr)}.`);
  }

  function renderPlanningBody() {
    const { getState, esc, empty, prettyDate, localISODate } = deps;
    const state = getState();
    if (!planningPickedDate) planningPickedDate = localISODate();
    const today = planForDate(localISODate()), picked = planForDate(planningPickedDate), plan30 = state.thirtyDayPlan || [];
    const genAt = state.thirtyDayPlanGeneratedAt ? new Date(state.thirtyDayPlanGeneratedAt).toLocaleString('en-IN') : 'Not generated yet';
    return `<div class="detail-section"><h4>Automatic Daily Planning — Today</h4>${today.items.length ? today.items.map((x) => `<div class="machine-patch-row"><span>${x.order}</span><div><strong>${esc(x.doctorName)}</strong><small>${esc(x.reason)}${x.core ? ` • ${x.core === 'C' ? 'CORE' : 'NON-CORE'}` : ''}</small></div></div>`).join('') : empty('No eligible doctors today (targets met or gap not elapsed).')}<button class="btn primary compact" id="pushTodayPatchBtn" style="margin-top:10px">Push today to Smart Patch</button></div>
    <div class="detail-section"><h4>Date-wise Auto Patch Setup</h4><div class="field-grid two"><label><span>Pick a date</span><input type="date" id="planDatePicker" value="${esc(planningPickedDate)}"></label></div><div id="planDateResult" style="margin-top:8px">${picked.items.length ? picked.items.map((x) => `<div class="machine-patch-row"><span>${x.order}</span><div><strong>${esc(x.doctorName)}</strong><small>${esc(x.reason)}</small></div></div>`).join('') : empty('No eligible doctors on this date.')}</div><button class="btn secondary compact" id="pushPickedPatchBtn" style="margin-top:8px">Push this date to Smart Patch</button></div>
    <div class="detail-section"><h4>Next 30 Days Advance Planning</h4><small class="muted-line">Generated: ${esc(genAt)} • uses visit gap, monthly target and CORE priority. Never edits doctor records — only planning entries.</small><button class="btn primary full" id="recalc30Btn" style="margin:8px 0">Recalculate 30-day plan</button>${plan30.length ? plan30.map((day) => `<details style="margin-bottom:6px"><summary>${esc(prettyDate(day.date))} — ${day.items.length} call(s)</summary>${day.items.length ? day.items.map((x) => `<div class="order-detail-row"><strong>${esc(x.doctorName)}</strong><span>${esc(x.reason)}</span></div>`).join('') : empty('No calls planned.')}</details>`).join('') : empty('Tap "Recalculate 30-day plan" to generate.')}</div>`;
  }

  function advancePlanningCenter() {
    const { openSheet, localISODate } = deps;
    planningPickedDate = localISODate();
    openSheet('Advance Planning', 'Date-wise auto patch • automatic daily plan • 30-day advance plan', renderPlanningBody());
    bindPlanningEvents();
  }

  function bindPlanningEvents() {
    const { $, dateOnly, localISODate } = deps;
    $('#pushTodayPatchBtn')?.addEventListener('click', () => pushPlanToPatch(localISODate()));
    $('#pushPickedPatchBtn')?.addEventListener('click', () => pushPlanToPatch(planningPickedDate));
    $('#planDatePicker')?.addEventListener('change', (e) => { planningPickedDate = dateOnly(e.target.value) || localISODate(); $('#sheetBody').innerHTML = renderPlanningBody(); bindPlanningEvents(); });
    $('#recalc30Btn')?.addEventListener('click', () => { refresh30DayPlan(); deps.toast('30-day plan recalculated.'); $('#sheetBody').innerHTML = renderPlanningBody(); bindPlanningEvents(); });
  }

  function init(injected) {
    deps = injected;
    return { generateDateWisePlan, refresh30DayPlan, planForDate, pushPlanToPatch, renderPlanningBody, advancePlanningCenter, bindPlanningEvents };
  }

  window.MRPlanner = { init };
})();
