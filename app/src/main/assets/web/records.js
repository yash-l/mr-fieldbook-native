// MR-One doctor & pharmacy records module — Notes / Prescriptions / Top products
// (per-doctor) and pharmacy-wise product availability (per-chemist).
//
// Phase 2 (architecture cleanup) extraction #2, same pattern as planner.js and
// cloud/*.js: dependency-injected, no shared closure with app.js. See planner.js
// for the reasoning on why this app uses this pattern instead of ES modules.
(function () {
  'use strict';
  let deps = null;
  let doctorRecordTab = 'notes';

  function doctorTopProducts(doctorId, limit = 6) {
    const { getState, num } = deps;
    const totals = {};
    getState().doctorPrescriptions.filter((x) => x.doctorId === doctorId).forEach((r) => (r.products || []).forEach((p) => { if (!p.product) return; totals[p.product] = (totals[p.product] || 0) + (num(p.qty) || 1); }));
    return Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([product, qty]) => ({ product, qty }));
  }

  function rxProductRow(item = {}) {
    const { esc, productOptions } = deps;
    return `<div class="order-item-row" data-rx-row style="grid-template-columns:1.5fr .7fr 30px"><label><span>Product</span><select name="rxProduct">${productOptions(item.product)}</select></label><label><span>Qty</span><input name="rxQty" type="number" min="1" step="1" value="${esc(item.qty || 1)}"></label><button type="button" class="remove-order-item" data-remove-rx-row aria-label="Remove">×</button></div>`;
  }

  function renderDoctorRecordsBody(doctorId) {
    const { getState, doctorById, esc, empty, prettyDate, localISODate, doctorDisplayName, initials } = deps;
    const state = getState();
    const doc = doctorById(doctorId); if (!doc) return empty('Doctor not found.');
    const notes = state.doctorNotes.filter((x) => x.doctorId === doctorId).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const rx = state.doctorPrescriptions.filter((x) => x.doctorId === doctorId).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const top = doctorTopProducts(doctorId);
    const tabs = `<div class="segmented" id="doctorRecordTabs" style="grid-template-columns:repeat(3,1fr)"><button class="${doctorRecordTab === 'notes' ? 'active' : ''}" data-record-tab="notes">Notes</button><button class="${doctorRecordTab === 'rx' ? 'active' : ''}" data-record-tab="rx">Prescriptions</button><button class="${doctorRecordTab === 'top' ? 'active' : ''}" data-record-tab="top">Top products</button></div>`;
    let body = '';
    if (doctorRecordTab === 'rx') {
      body = `<form id="addDoctorRxForm" class="sheet-form"><label><span>Date</span><input type="date" name="date" value="${localISODate()}"></label><div id="rxProductRows">${rxProductRow()}</div><button type="button" id="addRxProductRow" class="btn secondary compact">+ Another product</button><button class="btn primary full" type="submit" style="margin-top:10px">Save prescription record</button></form><div class="detail-section"><h4>Saved prescription records (${rx.length})</h4>${rx.length ? rx.map((r) => `<div class="record-card" style="margin-bottom:8px"><div class="tag-row">${(r.products || []).map((p) => `<span class="tag good">${esc(p.product)} × ${esc(p.qty)}</span>`).join('')}</div><div class="tag-row"><span class="tag">${esc(prettyDate(r.date))}</span><button data-delete-doctor-rx="${esc(r.id)}" class="tag bad" style="border:0;cursor:pointer">Delete</button></div></div>`).join('') : empty('No prescription records yet. These are kept separate from visit notes.')}</div>`;
    } else if (doctorRecordTab === 'top') {
      body = `<div class="detail-section"><h4>Most-prescribed products</h4>${top.length ? top.map((t, i) => `<div class="machine-patch-row"><span>${i + 1}</span><div><strong>${esc(t.product)}</strong><small>${esc(t.qty)} unit(s) recorded across prescription entries</small></div></div>`).join('') : empty('No prescription records saved yet. Add some in the Prescriptions tab to build this automatically.')}</div>`;
    } else {
      body = `<form id="addDoctorNoteForm" class="sheet-form"><label><span>Date</span><input type="date" name="date" value="${localISODate()}"></label><label><span>Note</span><textarea name="note" rows="3" placeholder="General note — kept separate from visit notes and prescription records"></textarea></label><button class="btn primary full" type="submit">Add note</button></form><div class="detail-section"><h4>Saved notes (${notes.length})</h4>${notes.length ? notes.map((n) => `<div class="record-card" style="margin-bottom:8px"><div class="record-note">${esc(n.note)}</div><div class="tag-row"><span class="tag">${esc(prettyDate(n.date))}</span><button data-delete-doctor-note="${esc(n.id)}" class="tag bad" style="border:0;cursor:pointer">Delete</button></div></div>`).join('') : empty('No notes yet.')}</div>`;
    }
    return `<div class="detail-hero"><div class="avatar">${esc(initials(doc.name))}</div><div><h3>${esc(doctorDisplayName(doc))}</h3><p>Structured records — never mixed with normal visit notes.</p></div></div>${tabs}${body}`;
  }

  function doctorRecordsCenter(doctorId) {
    const { doctorById, openSheet, doctorDisplayName } = deps;
    const doc = doctorById(doctorId); if (!doc) return;
    doctorRecordTab = 'notes';
    openSheet('Doctor Records', doctorDisplayName(doc), renderDoctorRecordsBody(doctorId));
    bindDoctorRecordsEvents(doctorId);
  }

  function refreshDoctorRecordsSheet(doctorId) {
    deps.$('#sheetBody').innerHTML = renderDoctorRecordsBody(doctorId);
    bindDoctorRecordsEvents(doctorId);
  }

  function bindDoctorRecordsEvents(doctorId) {
    const { $, $$, getState, saveState, toast, uid, dateOnly, localISODate, clean, num } = deps;
    const state = getState();
    $('#doctorRecordTabs')?.addEventListener('click', (e) => { const b = e.target.closest('[data-record-tab]'); if (!b) return; doctorRecordTab = b.dataset.recordTab; refreshDoctorRecordsSheet(doctorId); });
    $('#addDoctorNoteForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget), note = clean(fd.get('note'));
      if (!note) { toast('Write a note first.'); return; }
      state.doctorNotes.push({ id: uid('dnote'), doctorId, date: dateOnly(fd.get('date')) || localISODate(), note, createdAt: new Date().toISOString() });
      saveState(false); toast('Note saved.'); refreshDoctorRecordsSheet(doctorId);
    });
    $$('[data-delete-doctor-note]').forEach((b) => b.addEventListener('click', () => { state.doctorNotes = state.doctorNotes.filter((x) => x.id !== b.dataset.deleteDoctorNote); saveState(false); refreshDoctorRecordsSheet(doctorId); }));
    const rxRoot = $('#rxProductRows');
    rxRoot?.addEventListener('click', (e) => { const r = e.target.closest('[data-remove-rx-row]'); if (r) r.closest('[data-rx-row]')?.remove(); });
    $('#addRxProductRow')?.addEventListener('click', () => rxRoot.insertAdjacentHTML('beforeend', rxProductRow()));
    $('#addDoctorRxForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const products = $$('[data-rx-row]', rxRoot).map((row) => ({ product: clean($('select[name="rxProduct"]', row).value), qty: Math.max(1, num($('input[name="rxQty"]', row).value) || 1) })).filter((p) => p.product);
      if (!products.length) { toast('Select at least one product.'); return; }
      const fd = new FormData(e.currentTarget);
      state.doctorPrescriptions.push({ id: uid('drx'), doctorId, date: dateOnly(fd.get('date')) || localISODate(), products, createdAt: new Date().toISOString() });
      saveState(false); toast('Prescription record saved.'); refreshDoctorRecordsSheet(doctorId);
    });
    $$('[data-delete-doctor-rx]').forEach((b) => b.addEventListener('click', () => { state.doctorPrescriptions = state.doctorPrescriptions.filter((x) => x.id !== b.dataset.deleteDoctorRx); saveState(false); refreshDoctorRecordsSheet(doctorId); }));
  }

  function renderPharmacyProductsBody(chemistId) {
    const { getState, chemistById, esc, empty, prettyDate, initials, productOptions } = deps;
    const state = getState();
    const chem = chemistById(chemistId); if (!chem) return empty('Chemist not found.');
    const list = state.pharmacyProducts.filter((x) => x.chemistId === chemistId).sort((a, b) => a.product.localeCompare(b.product));
    return `<div class="detail-hero"><div class="avatar">${esc(initials(chem.name))}</div><div><h3>${esc(chem.name)}</h3><p>Pharmacy product availability — kept separate from visit notes.</p></div></div>
    <form id="addPharmacyProductForm" class="sheet-form"><div class="field-grid two"><label><span>Product</span><select name="product">${productOptions()}</select></label><label><span>Qty on shelf</span><input name="qty" type="number" min="0" step="1" value="0"></label></div><label class="toggle-line"><input type="checkbox" name="available" checked> Currently available</label><label><span>Note</span><input name="notes" placeholder="Optional"></label><button class="btn primary full" type="submit">Save product record</button></form>
    <div class="detail-section"><h4>Saved products (${list.length})</h4>${list.length ? list.map((p) => `<div class="mini-card" style="margin-bottom:8px"><span class="mini-icon">${p.available ? '✓' : '✕'}</span><span class="mini-copy"><h3>${esc(p.product)}</h3><p>Qty ${esc(p.qty)} • checked ${esc(prettyDate(p.lastCheckedDate))}${p.notes ? ` • ${esc(p.notes)}` : ''}</p></span><button data-delete-pharmacy-product="${esc(p.id)}" class="tag bad" style="border:0;cursor:pointer">Delete</button></div>`).join('') : empty('No products tracked for this pharmacy yet.')}</div>`;
  }

  function pharmacyProductsCenter(chemistId) {
    const { chemistById, openSheet } = deps;
    const chem = chemistById(chemistId); if (!chem) return;
    openSheet('Pharmacy Products', chem.name, renderPharmacyProductsBody(chemistId));
    bindPharmacyProductsEvents(chemistId);
  }

  function bindPharmacyProductsEvents(chemistId) {
    const { $, $$, getState, saveState, toast, uid, localISODate, clean, num, norm } = deps;
    const state = getState();
    $('#addPharmacyProductForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget), product = clean(fd.get('product'));
      if (!product) { toast('Select a product.'); return; }
      const existing = state.pharmacyProducts.find((x) => x.chemistId === chemistId && norm(x.product) === norm(product));
      const rec = existing || { id: uid('pprod'), chemistId };
      rec.product = product; rec.qty = Math.max(0, num(fd.get('qty'))); rec.available = Boolean(fd.get('available')); rec.notes = clean(fd.get('notes')); rec.lastCheckedDate = localISODate(); rec.updatedAt = new Date().toISOString();
      if (!existing) state.pharmacyProducts.push(rec);
      saveState(false); toast('Pharmacy product saved.');
      $('#sheetBody').innerHTML = renderPharmacyProductsBody(chemistId); bindPharmacyProductsEvents(chemistId);
    });
    $$('[data-delete-pharmacy-product]').forEach((b) => b.addEventListener('click', () => { state.pharmacyProducts = state.pharmacyProducts.filter((x) => x.id !== b.dataset.deletePharmacyProduct); saveState(false); $('#sheetBody').innerHTML = renderPharmacyProductsBody(chemistId); bindPharmacyProductsEvents(chemistId); }));
  }

  function init(injected) {
    deps = injected;
    return { doctorTopProducts, doctorRecordsCenter, renderDoctorRecordsBody, pharmacyProductsCenter, renderPharmacyProductsBody };
  }

  window.MRRecords = { init };
})();
