import {
  applyEventTheme,
  DEFAULT_EVENT_ACCENT,
  summarizePipeTags,
} from './event_theme.js';

const state = {
  rows: [],
  filteredRows: [],
  knownBoxes: [],
  knownLocations: [],
  events: [],
  stockNullNormalizedCount: 0,
};

const dirtyState = {
  boxKey: null,
  editsByRow: {},
};

const MAX_NOTE_LENGTH = 200;
const PREVIEW_NOTE_LENGTH = 50;
const STOCK_EDITABLE_FIELD = 'stock_on_hand';
const TEAM_ADMIN_NOTES_MAX_LENGTH = 200;
const SHARED_EVENT_SCOPE_KEY = 'inventory.shared.event';

const els = {
  body: document.getElementById('rows-body'),
  statusBar: document.getElementById('status-bar'),
  refreshBtn: document.getElementById('refresh-btn'),
  searchDescription: document.getElementById('search-description'),
  boxFilter: document.getElementById('box-filter'),
  boxFilterOptions: document.getElementById('box-filter-options'),
  locationFilter: document.getElementById('location-filter'),
  locationFilterOptions: document.getElementById('location-filter-options'),
  eventFilter: document.getElementById('event-filter'),
  eventBeaconName: document.getElementById('event-beacon-name'),
  eventBeaconMeta: document.getElementById('event-beacon-meta'),
  progressCounter: document.getElementById('progress-counter'),
  teamAdminNotesInput: document.getElementById('team-admin-notes-input'),
};

init();

async function init() {
  wireEvents();
  await loadEvents();
  await loadRows();
  await loadTeamAdminNotes();
}

function wireEvents() {
  els.refreshBtn.addEventListener('click', async () => {
    if (guardDirtyRow('refreshing')) return;
    setStatus('Refreshing Event Stock Count…');
    resetFilters();
    resetNotesPanel();
    await loadEvents();
    await loadRows();
    await loadTeamAdminNotes();
  });

  els.boxFilter.addEventListener('change', () => {
    if (guardDirtyRow('changing filters')) return;
    applyFilters();
  });
  els.boxFilter.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (guardDirtyRow('changing filters')) return;
      applyFilters();
    }
  });

  els.locationFilter.addEventListener('change', () => {
    if (guardDirtyRow('changing filters')) return;
    applyFilters();
  });
  els.locationFilter.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (guardDirtyRow('changing filters')) return;
      applyFilters();
    }
  });

  els.searchDescription.addEventListener('input', () => {
    if (guardDirtyRow('changing filters')) return;
    applyFilters();
  });
  els.eventFilter.addEventListener('change', () => {
    if (guardDirtyRow('changing filters')) return;
    persistSharedEventSelection();
    renderStockCountScope();
    applyFilters();
  });

  if (els.body) {
    els.body.addEventListener('click', handleNoteAccordionClick);
    els.body.addEventListener('input', handleRowFieldInput);
    els.body.addEventListener('click', handleRowSaveClick);
  }

  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleDocumentKeydown);
  document.addEventListener('click', handlePotentialExportClick, true);

  if (els.teamAdminNotesInput) {
    const debouncedSaveTeamAdminNotes = debounce((value) => {
      saveTeamAdminNotesGlobal(value);
    }, 1000);

    els.teamAdminNotesInput.addEventListener('input', (e) => {
      const input = e.target;
      if (!(input instanceof HTMLTextAreaElement)) return;
      const constrained = constrainTeamAdminNotes(input.value);
      if (constrained !== input.value) {
        input.value = constrained;
      }
      autoSizeTeamAdminNotesInput();
      debouncedSaveTeamAdminNotes(constrained);
    });
  }
}

async function loadRows() {
  setTableState('loading', 'Loading stock count data…');
  setStatus('Loading stock count data…');

  try {
    const res = await fetch('/api/event-stock-count');
    const data = await res.json();
    if (!res.ok) {
      setTableState('error', data.error || 'Failed to load stock count data. Try again.');
      setStatus(data.error || 'Load failed. Use Refresh to retry.', true);
      return;
    }
    let nullNormalizedCount = 0;
    state.rows = (Array.isArray(data) ? data : []).map((row) => {
      const normalized = { ...row };
      const raw = normalized.stock_on_hand;
      const asNumber = Number(raw);
      if (raw == null || raw === '' || Number.isNaN(asNumber)) {
        nullNormalizedCount += 1;
        normalized.stock_on_hand = 0;
      } else {
        normalized.stock_on_hand = asNumber;
      }
      return normalized;
    });
    state.stockNullNormalizedCount = nullNormalizedCount;
    refreshBoxOptions();
    refreshLocationOptions();
    applyFilters();
    setStatus(`Loaded ${state.rows.length} active rows.`);
  } catch (err) {
    setTableState('error', `Unable to reach server: ${err.message}. Check app is running and Refresh.`);
    setStatus('Load failed. Use Refresh to retry.', true);
  }
}

function resetFilters() {
  if (els.searchDescription) els.searchDescription.value = '';
  if (els.boxFilter) els.boxFilter.value = '';
  if (els.locationFilter) els.locationFilter.value = '';
  // eventFilter intentionally preserved on refresh
}

function resetNotesPanel() {
  closeAllExpandedNotes();
}

async function loadEvents() {
  try {
    const res = await fetch('/api/events');
    state.events = (await res.json()) || [];
    populateEventFilter();
    renderStockCountScope();
  } catch (err) {
    console.error('Error loading events:', err);
  }
}

function getSelectedEventDefinition() {
  const selected = els.eventFilter?.value || '';
  if (!selected) return null;
  return state.events.find((entry) => entry.event_name === selected) || null;
}

function renderStockCountScope() {
  const selectedEvent = getSelectedEventDefinition();
  const accent = selectedEvent?.theme_accent_hex || DEFAULT_EVENT_ACCENT;
  applyEventTheme(accent);
  setEventChooserWaitingState(!selectedEvent);

  if (!els.eventBeaconName || !els.eventBeaconMeta) return;

  if (!selectedEvent) {
    els.eventBeaconName.textContent = '';
    els.eventBeaconMeta.textContent = 'Select Event to begin stock count.';
    return;
  }

  els.eventBeaconName.textContent = selectedEvent.event_name;
  els.eventBeaconMeta.textContent = `Locked to ${summarizePipeTags(selectedEvent.tags)}`;
}

function setEventChooserWaitingState(isWaiting) {
  if (!els.eventFilter) return;
  els.eventFilter.classList.toggle('is-waiting-event', Boolean(isWaiting));
}

function populateEventFilter() {
  if (!els.eventFilter) return;
  const previous = sessionStorage.getItem(SHARED_EVENT_SCOPE_KEY) || els.eventFilter.value;

  const options = state.events
    .filter((e) => String(e.event_name || '').trim() && e.event_name !== 'All')
    .map((e) => {
      const opt = document.createElement('option');
      opt.value = e.event_name;
      opt.textContent = e.event_name;
      return opt;
    });

  els.eventFilter.innerHTML = '<option value="">WHICH EVENT AM I HELPING YOU WITH</option>';

  options.forEach((opt) => els.eventFilter.appendChild(opt));

  // Restore previous selection if it still exists in the refreshed list
  if (previous && state.events.some((e) => e.event_name === previous && e.event_name !== 'All')) {
    els.eventFilter.value = previous;
  }

  persistSharedEventSelection();
}

function persistSharedEventSelection() {
  if (!els.eventFilter) return;
  sessionStorage.setItem(SHARED_EVENT_SCOPE_KEY, els.eventFilter.value || '');
}

function refreshBoxOptions() {
  if (!els.boxFilterOptions) return;

  state.knownBoxes = Array.from(new Set(
    state.rows
      .map((r) => normalizeBoxValue(r.box_number || ''))
      .filter(Boolean),
  )).sort(sortBoxesAlphanumericHierarchical);

  els.boxFilterOptions.innerHTML = '';

  for (const box of state.knownBoxes) {
    const opt = document.createElement('option');
    opt.value = box;
    els.boxFilterOptions.appendChild(opt);
  }
}

function refreshLocationOptions() {
  if (!els.locationFilterOptions) return;

  state.knownLocations = Array.from(new Set(
    state.rows
      .map((r) => (r.storage_location || '').trim().toUpperCase())
      .filter(Boolean),
  )).sort((a, b) => a.localeCompare(b));

  els.locationFilterOptions.innerHTML = '';

  for (const location of state.knownLocations) {
    const opt = document.createElement('option');
    opt.value = location;
    els.locationFilterOptions.appendChild(opt);
  }
}

function applyFilters() {
  const desc = els.searchDescription.value.trim().toLowerCase();
  const box = normalizeBoxValue(els.boxFilter.value || '');
  const boxKey = canonicalBoxKey(box);
  const location = (els.locationFilter.value || '').trim().toUpperCase();
  const selectedEvent = getSelectedEventDefinition();
  const selectedEventTags = selectedEvent ? parsePipeTags(selectedEvent.tags) : [];

  if (!selectedEvent) {
    state.filteredRows = [];
    updateProgress();
    renderRows();
    return;
  }

  state.filteredRows = state.rows.filter((r) => {
    if (desc && !(r.description || '').toLowerCase().includes(desc)) return false;
    if (boxKey && canonicalBoxKey(r.box_number) !== boxKey) return false;
    if (location && (r.storage_location || '').trim().toUpperCase() !== location) return false;
    const rowTags = parsePipeTags(r.event_tags);
    const matchesEvent = selectedEventTags.length
      ? selectedEventTags.some((tag) => rowTags.includes(tag))
      : false;
    if (!matchesEvent) return false;
    return true;
  });

  updateProgress();
  renderRows();
}

function renderRows() {
  els.body.innerHTML = '';

  // Group rows by box number
  const groupsByBox = {};
  for (const row of state.filteredRows) {
    const boxKey = (row.box_number || '').trim().toUpperCase();
    if (!groupsByBox[boxKey]) {
      groupsByBox[boxKey] = [];
    }
    groupsByBox[boxKey].push(row);
  }

  // Sort box keys alphanumerically
  const sortedBoxKeys = Object.keys(groupsByBox).sort(sortBoxesAlphanumericHierarchical);

  // Render each box group with header and collapsible items
  for (const boxKey of sortedBoxKeys) {
    const itemsInBox = groupsByBox[boxKey];
    const firstRow = itemsInBox[0];
    const itemCount = itemsInBox.length;
    const boxNumber = normalizeBoxValue(firstRow.box_number || '');
    const rawLabel = String(firstRow.box_label || '').trim();
    const boxLabel = (rawLabel && rawLabel !== 'LABEL_PENDING') ? rawLabel : '';
    const locationLabel = String(firstRow.storage_location || '').trim().toUpperCase();
    const baseHeaderLine = boxLabel
      ? `${escapeHtml(boxNumber)} — <span>${escapeHtml(boxLabel)}</span>`
      : escapeHtml(boxNumber);
    const headerLine = baseHeaderLine;
    // Create collapsible box header row (collapsed on first render)
    const headerTr = document.createElement('tr');
    headerTr.classList.add('box-group-header');
    if (dirtyState.boxKey && dirtyState.boxKey === boxKey) {
      headerTr.classList.add('is-dirty-box');
    }
    headerTr.dataset.boxKey = boxKey;
    headerTr.dataset.itemCount = String(itemCount);

    headerTr.innerHTML = `
      <td colspan="10" class="box-header-cell">
        <button class="box-group-toggle" type="button" data-box-key="${escapeHtml(boxKey)}" aria-expanded="false" title="Open box">
          <span class="box-header-mini">
            <span class="box-header-merged">
              <span class="box-toggle-icon">▶</span>
              <span class="box-header-display">${headerLine}</span>
            </span>
            <span class="box-header-col-head box-header-col-head--right">${escapeHtml(locationLabel)}</span>
          </span>
        </button>
      </td>
    `;
    els.body.appendChild(headerTr);

    const subheadTr = document.createElement('tr');
    subheadTr.classList.add('box-group-subhead');
    subheadTr.dataset.boxKey = boxKey;
    subheadTr.innerHTML = `
      <td class="box-subhead-cell box-subhead-cell--description" colspan="6">ITEM DESCRIPTION</td>
      <td class="box-subhead-cell box-subhead-cell--qty" colspan="1">QTY REQD</td>
      <td class="box-subhead-cell box-subhead-cell--stock" colspan="1">QTY IN BOX</td>
      <td class="box-subhead-cell box-subhead-cell--action" colspan="2">ACTION</td>
    `;
    els.body.appendChild(subheadTr);

    // Create item rows under this box (hidden by default)
    for (const row of itemsInBox) {
      const itemTr = document.createElement('tr');
      itemTr.classList.add('box-group-item');
      itemTr.dataset.boxKey = boxKey;
      itemTr.dataset.rowId = String(row.row_id || '');

      const dirtyEdits = getDirtyEditsForRow(Number(row.row_id));
      const qtyRequired = dirtyEdits.qty_required ?? row.qty_required ?? 0;
      const stockOnHand = dirtyEdits.stock_on_hand ?? row.stock_on_hand ?? 0;

      itemTr.innerHTML = `
        <td class="col-description col-mvp-description" colspan="6">${escapeHtml(row.description || '')}</td>
        <td class="mono col-mvp-qty" colspan="1">${escapeHtml(String(qtyRequired))}</td>
        <td class="mono col-mvp-stock" colspan="1"><input class="row-edit-input" data-row-id="${row.row_id}" data-field="stock_on_hand" type="number" step="1" min="0" value="${escapeHtml(String(stockOnHand))}" /></td>
        <td class="mono box-row-action col-mvp-action" colspan="2"><button class="btn save-row-btn" type="button" data-row-id="${row.row_id}">Save</button></td>
      `;
      els.body.appendChild(itemTr);
    }
  }

  if (!state.filteredRows.length) {
    if (!getSelectedEventDefinition()) {
      setTableState('empty', 'Select Event to begin stock count.');
      return;
    }

    const hasFilters = [
      els.searchDescription?.value,
      els.boxFilter?.value,
      els.locationFilter?.value,
      els.eventFilter?.value,
    ].some((v) => (v || '').trim());
    const msg = hasFilters
      ? 'No active rows match the current filters. Try clearing filters or selecting a different event.'
      : 'No active inventory rows found.';
    setTableState('empty', msg);
  }

  syncDirtyUi();
  wireBoxGroupToggles();
}

function handleRowSaveClick(event) {
  const button = event.target.closest('.save-row-btn');
  if (!button || !els.body?.contains(button)) return;

  const rowId = Number(button.dataset.rowId || 0);
  if (!rowId) return;

  const row = state.rows.find((r) => Number(r.row_id) === rowId);
  if (!row) {
    setStatus(`Row ${rowId} not found. Refresh and retry.`, true);
    return;
  }

  const rowBoxKey = canonicalBoxKey(row.box_number);
  if (hasDirtyBox() && canonicalBoxKey(dirtyState.boxKey) !== rowBoxKey) {
    guardDirtyRow('saving another box');
    return;
  }
  if (hasDirtyBox() && !dirtyState.editsByRow[String(rowId)]) {
    guardDirtyRow('saving a different item — save the highlighted item first');
    return;
  }

  saveRow(rowId);
}

async function saveRow(rowId) {
  const row = state.rows.find((r) => Number(r.row_id) === rowId);
  if (!row) {
    setStatus(`Row ${rowId} not found. Refresh and retry.`, true);
    return;
  }

  const edits = getDirtyEditsForRow(rowId);
  if (!Object.keys(edits).length) {
    setStatus(`Row ${rowId}: no changes to save.`);
    return;
  }

  const stockOnlyEdits = {};
  if (Object.prototype.hasOwnProperty.call(edits, STOCK_EDITABLE_FIELD)) {
    stockOnlyEdits[STOCK_EDITABLE_FIELD] = Number(edits[STOCK_EDITABLE_FIELD] || 0);
  }
  if (!Object.keys(stockOnlyEdits).length) {
    setStatus(`Row ${rowId}: only STOCK can be saved from this view.`);
    return;
  }

  const payload = {
    version: row.version,
    ...stockOnlyEdits,
  };

  try {
    const res = await fetch(`/api/master/${rowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    const idx = state.rows.findIndex((r) => Number(r.row_id) === rowId);
    if (idx >= 0) {
      state.rows[idx] = { ...state.rows[idx], ...data.row };
    }

    delete dirtyState.editsByRow[String(rowId)];
    if (!Object.keys(dirtyState.editsByRow).length) {
      clearDirtyState();
    }

    setStatus(`Row ${rowId} saved.`);
    applyFilters();
  } catch (err) {
    setStatus(`Save failed for row ${rowId}: ${err.message}`, true);
  }
}

function guardDirtyRow(actionLabel = 'continuing') {
  if (!hasDirtyBox()) return false;
  flashDirtyRow();
  setStatus(`NO PROCEED: save pending rows in BOX ${dirtyState.boxKey} before ${actionLabel}.`, true);
  return true;
}

function hasDirtyBox() {
  return Boolean(dirtyState.boxKey && Object.keys(dirtyState.editsByRow).length);
}

function getDirtyEditsForRow(rowId) {
  return dirtyState.editsByRow[String(rowId)] || {};
}

function getDirtyRowIdsForBox(boxKey) {
  return Object.keys(dirtyState.editsByRow)
    .map((id) => Number(id))
    .filter((rowId) => {
      const row = state.rows.find((r) => Number(r.row_id) === rowId);
      if (!row) return false;
      return canonicalBoxKey(row.box_number) === canonicalBoxKey(boxKey);
    });
}

function clearDirtyState() {
  dirtyState.boxKey = null;
  dirtyState.editsByRow = {};
}

function wireBoxGroupToggles() {
  if (!els.body) return;

  const toggles = els.body.querySelectorAll('.box-group-toggle');
  toggles.forEach((toggle) => {
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const boxKey = toggle.dataset.boxKey;
      const headerRow = toggle.closest('.box-group-header');
      const detailRows = els.body.querySelectorAll(`.box-group-subhead[data-box-key="${boxKey}"], .box-group-item[data-box-key="${boxKey}"]`);

      if (hasDirtyBox()) {
        if (dirtyState.boxKey !== boxKey) {
          guardDirtyRow('opening another box');
          return;
        }
        if (headerRow.classList.contains('is-expanded')) {
          guardDirtyRow('closing this box');
          return;
        }
      }

      const isExpanded = headerRow.classList.contains('is-expanded');

      if (isExpanded) {
        // Collapse
        headerRow.classList.remove('is-expanded');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.querySelector('.box-toggle-icon').textContent = '▶';
        toggle.setAttribute('title', 'Open box');
        detailRows.forEach((row) => row.classList.remove('is-visible'));
      } else {
        // Expand
        headerRow.classList.add('is-expanded');
        toggle.setAttribute('aria-expanded', 'true');
        toggle.querySelector('.box-toggle-icon').textContent = '▼';
        toggle.setAttribute('title', 'Close box');
        detailRows.forEach((row) => row.classList.add('is-visible'));
      }
    });
  });
}

function sortBoxesAlphanumericHierarchical(a, b) {
  const aText = normalizeBoxValue(a);
  const bText = normalizeBoxValue(b);

  const aStartsDigit = /^\d/.test(aText);
  const bStartsDigit = /^\d/.test(bText);

  if (aStartsDigit && !bStartsDigit) return -1;
  if (!aStartsDigit && bStartsDigit) return 1;

  return aText.localeCompare(bText, undefined, { numeric: true, sensitivity: 'base' });
}

function flashDirtyRow() {
  if (!els.body || !hasDirtyBox()) return;
  const trs = els.body.querySelectorAll(`tr.box-group-item[data-box-key="${dirtyState.boxKey}"]`);
  trs.forEach((tr) => {
    tr.classList.remove('row-dirty-flash');
    void tr.offsetWidth;
    tr.classList.add('row-dirty-flash');
  });
}

function handleRowFieldInput(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  if (!input.classList.contains('row-edit-input')) return;

  const rowId = Number(input.dataset.rowId || 0);
  if (!rowId) return;

  const tr = input.closest('tr[data-row-id]');
  const rowBoxKey = tr?.dataset.boxKey || '';
  if (!rowBoxKey) return;

  if (hasDirtyBox() && dirtyState.boxKey !== rowBoxKey) {
    guardDirtyRow('editing another box');
    return;
  }
  if (hasDirtyBox() && !dirtyState.editsByRow[String(rowId)]) {
    guardDirtyRow('editing a different item — save the highlighted item first');
    // Revert input to last saved value
    const origRow = state.rows.find((r) => Number(r.row_id) === rowId);
    if (origRow) input.value = String(origRow[input.dataset.field] ?? 0);
    return;
  }

  const field = input.dataset.field;
  if (!field) return;
  if (field !== STOCK_EDITABLE_FIELD) return;

  if (!hasDirtyBox()) {
    dirtyState.boxKey = rowBoxKey;
    dirtyState.editsByRow = {};
  }

  const row = state.rows.find((r) => Number(r.row_id) === rowId);
  if (!row) return;

  const rowKey = String(rowId);
  const nextRowEdits = {
    ...(dirtyState.editsByRow[rowKey] || {}),
  };

  const nextValue = Number(input.value || 0);
  const originalValue = Number(row[field] ?? 0);

  if (nextValue === originalValue) {
    delete nextRowEdits[field];
  } else {
    nextRowEdits[field] = nextValue;
  }

  if (Object.keys(nextRowEdits).length) {
    dirtyState.editsByRow[rowKey] = nextRowEdits;
  } else {
    delete dirtyState.editsByRow[rowKey];
  }

  if (!Object.keys(dirtyState.editsByRow).length) {
    clearDirtyState();
  }

  syncDirtyUi();
  if (hasDirtyBox()) {
    setStatus(`Box ${dirtyState.boxKey} has unsaved changes. Use Save in the Action column.`);
  } else {
    setStatus('No unsaved changes.');
  }
}

function syncDirtyUi() {
  if (!els.body) return;

  const hasDirty = hasDirtyBox();
  const rows = els.body.querySelectorAll('tr[data-row-id]');
  rows.forEach((tr) => {
    const rowId = Number(tr.dataset.rowId || 0);
    const rowBoxKey = tr.dataset.boxKey || '';
    const isDirtyRow = Boolean(getDirtyEditsForRow(rowId) && Object.keys(getDirtyEditsForRow(rowId)).length);
    const isBlockedRow = hasDirty && dirtyState.boxKey !== rowBoxKey;

    tr.classList.toggle('row-dirty', isDirtyRow);
    tr.querySelectorAll('.row-edit-input, .save-row-btn').forEach((el) => {
      el.disabled = isBlockedRow;
    });
  });
}

function updateProgress() {
  if (!els.progressCounter) return;
  if (!getSelectedEventDefinition()) {
    els.progressCounter.textContent = '';
    return;
  }
  els.progressCounter.textContent = `Showing ${state.filteredRows.length} of ${state.rows.length}`;
}

function setStatus(message, isError = false) {
  if (els.statusBar) {
    els.statusBar.textContent = message;
    if (isError) {
      els.statusBar.classList.add('error');
    } else {
      els.statusBar.classList.remove('error');
    }
  }
}

/**
 * Render a shared table placeholder row for loading, error, or empty states.
 * @param {'loading'|'error'|'empty'} type
 * @param {string} message
 */
function setTableState(type, message) {
  if (!els.body) return;
  const colSpan = 10;
  els.body.innerHTML = `<tr><td colspan="${colSpan}" class="table-state table-state--${type}">
    <span class="table-state-icon">${type === 'loading' ? '⏳' : type === 'error' ? '⚠️' : 'ℹ️'}</span>
    <span class="table-state-msg">${escapeHtml(String(message))}</span>
    ${type === 'error' ? '<button class="btn secondary table-state-retry" type="button">Retry</button>' : ''}
  </td></tr>`;

  if (type === 'error') {
    els.body.querySelector('.table-state-retry')?.addEventListener('click', () => {
      loadRows();
    });
  }
}

function formatPreview(value) {
  const text = limitNoteText(value, PREVIEW_NOTE_LENGTH);
  if (!text) return '';
  return text;
}

function normalizeLegacyNoteValue(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const upper = text.toUpperCase();
  if (upper === 'NONE' || upper === '0') return '';
  return text;
}

function parsePipeTags(value) {
  return String(value || '')
    .split('|')
    .map((tag) => tag.trim().toUpperCase())
    .filter(Boolean);
}

function normalizeBoxValue(value) {
  return String(value || '').trim().replace(/\s{2,}/g, ' ').toUpperCase();
}

function canonicalBoxKey(value) {
  return normalizeBoxValue(value).replace(/[^A-Z0-9]/g, '');
}

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function limitNoteText(value, maxLength = MAX_NOTE_LENGTH) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function renderExpandableNoteCell(kind, value) {
  const preview = formatPreview(value);
  const fullText = limitNoteText(value, MAX_NOTE_LENGTH);
  const isEmpty = fullText === '';
  const bubbleBody = escapeHtml(fullText).replace(/\n/g, '<br />');
  return `
    <button
      type="button"
      class="note-accordion${isEmpty ? ' is-empty' : ''}"
      data-note-kind="${escapeHtml(kind)}"
      aria-expanded="false"
    >
      <span class="note-accordion-preview">${escapeHtml(preview)}</span>
      <span class="note-accordion-bubble" hidden>
        <span class="note-accordion-title">${escapeHtml(kind)}</span>
        <span class="note-accordion-body">${bubbleBody}</span>
      </span>
    </button>
  `;
}

function handleNoteAccordionClick(event) {
  const button = event.target.closest('.note-accordion');
  if (!button || !els.body?.contains(button)) return;

  event.preventDefault();
  event.stopPropagation();

  const isExpanded = button.classList.contains('is-expanded');
  closeAllExpandedNotes();

  if (!isExpanded) {
    button.classList.add('is-expanded');
    button.setAttribute('aria-expanded', 'true');
    const bubble = button.querySelector('.note-accordion-bubble');
    if (bubble) bubble.hidden = false;
  }
}

function handleDocumentClick(event) {
  if (event.target.closest('.note-accordion')) return;
  closeAllExpandedNotes();
}

function handlePotentialExportClick(event) {
  const exportTrigger = event.target.closest('#export-btn, .export-btn, [data-action="export"], [data-role="export"]');
  if (!exportTrigger) return;
  if (!validateStockColumnBeforeExport()) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function validateStockColumnBeforeExport() {
  const invalidRows = state.rows.filter((row) => {
    const raw = row.stock_on_hand;
    return raw == null || raw === '' || Number.isNaN(Number(raw));
  });

  if (invalidRows.length > 0) {
    setStatus(`Export blocked: ${invalidRows.length} STOCK value(s) are NULL/blank. Set STOCK to 0 before export.`, true);
    return false;
  }

  if (state.stockNullNormalizedCount > 0) {
    setStatus(`Export check: ${state.stockNullNormalizedCount} STOCK NULL value(s) were normalized to 0.`, false);
  }
  return true;
}

function handleDocumentKeydown(event) {
  if (event.key === 'Escape') {
    closeAllExpandedNotes();
  }
}

function closeAllExpandedNotes() {
  document.querySelectorAll('.note-accordion.is-expanded').forEach((button) => {
    button.classList.remove('is-expanded');
    button.setAttribute('aria-expanded', 'false');
    const bubble = button.querySelector('.note-accordion-bubble');
    if (bubble) bubble.hidden = true;
  });
}

function constrainTeamAdminNotes(value) {
  return String(value ?? '').slice(0, TEAM_ADMIN_NOTES_MAX_LENGTH);
}

function autoSizeTeamAdminNotesInput() {
  const input = els.teamAdminNotesInput;
  if (!input) return;

  const styles = window.getComputedStyle(input);
  const lineHeight = Number.parseFloat(styles.lineHeight) || 18.24;
  const minHeight = (lineHeight * 2) + 22;

  input.style.height = 'auto';
  const withSpareLine = input.scrollHeight + lineHeight;
  input.style.height = `${Math.ceil(Math.max(minHeight, withSpareLine))}px`;
}

async function saveTeamAdminNotesGlobal(notes) {
  const constrained = constrainTeamAdminNotes(notes);
  try {
    const res = await fetch('/api/ui-rules/team-admin-notes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: constrained }),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    setStatus('Team / Admin Notes saved.');
  } catch (err) {
    console.error('Error saving team admin notes:', err);
    setStatus('Error saving Team / Admin Notes.', true);
  }
}

async function loadTeamAdminNotes() {
  if (!els.teamAdminNotesInput) return;

  try {
    const res = await fetch('/api/ui-rules/team-admin-notes');
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const payload = await res.json();
    els.teamAdminNotesInput.value = constrainTeamAdminNotes(payload.notes || '');
    autoSizeTeamAdminNotesInput();
  } catch (err) {
    console.error('Error loading team admin notes:', err);
    els.teamAdminNotesInput.value = '';
    autoSizeTeamAdminNotesInput();
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
