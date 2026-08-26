// MR-One cloud — conflict resolution.
//
// Policy: updated_at newest-wins, per row, by id.
//
// This module intentionally never deletes a local row just because it's
// missing from a remote pull, and never deletes a remote row just because
// it's missing from a local push. Deleting something you did on Phone A
// should not silently vanish data you're mid-way through entering on
// Phone B before it's had a chance to sync. That makes every table here
// effectively append-safe: prescriptions, notes and pharmacy product
// entries accumulate rather than clobber each other across devices.
//
// If you actually delete a record (e.g. remove a duplicate doctor), that
// deletion is local-only for now — it will not remove the row from
// Supabase or from other devices. A future version could add a tombstone
// table (deleted_ids) to propagate deletes safely; deliberately left out
// of this first version to avoid the risk of a bad merge wiping real data.
(function () {
  'use strict';

  function tsOf(row) {
    const v = row?.updated_at || row?.updatedAt || row?.created_at || row?.createdAt;
    const t = v ? new Date(v).getTime() : 0;
    return Number.isFinite(t) ? t : 0;
  }

  // Merge a local array and a remote array (both objects with an `id` field)
  // into a single array: newest-by-updated_at wins per id, union of both sets.
  function mergeById(localArr, remoteArr) {
    const map = new Map();
    (localArr || []).forEach((row) => { if (row && row.id) map.set(row.id, row); });
    (remoteArr || []).forEach((row) => {
      if (!row || !row.id) return;
      const existing = map.get(row.id);
      if (!existing || tsOf(row) >= tsOf(existing)) map.set(row.id, row);
    });
    return [...map.values()];
  }

  window.MRCloud = window.MRCloud || {};
  window.MRCloud.mergeById = mergeById;
})();
