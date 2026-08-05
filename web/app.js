const worker = new Worker('./worker.js?v=wca-input-v5');
let requestId = 0;

const CORNER_BUFFER_OPTIONS = ['UFR', 'UFL', 'UBR', 'UBL', 'RDF', 'FDL'];
const EDGE_BUFFER_OPTIONS = ['UF', 'UR', 'UB', 'UL', 'FR', 'FL', 'DF', 'DB', 'DR', 'DL'];
const LEGACY_CORNER_BUFFERS = ['UFR'];
const LEGACY_EDGE_BUFFERS = ['UF'];
const THEME_STORAGE_KEY = 'ssi-theme';
const SETTINGS_STORAGE_KEY = 'ssi-settings';

const elements = {
  scrambleInput: document.getElementById('scramble-input'),
  tracingOrientation: document.getElementById('tracing-orientation'),
  dnf: document.getElementById('dnf'),
  ltct: document.getElementById('ltct'),
  flipWeight: document.getElementById('flip-weight'),
  twistWeight: document.getElementById('twist-weight'),
  actionRow: document.getElementById('action-row'),
  analyzeButton: document.getElementById('analyze-button'),
  pasteButton: document.getElementById('paste-button'),
  loadExampleButton: document.getElementById('load-example-button'),
  clearButton: document.getElementById('clear-button'),
  processedBanner: document.getElementById('processed-banner'),
  resultsSection: document.getElementById('results-section'),
  statSolves: document.getElementById('stat-solves'),
  statAverage: document.getElementById('stat-average'),
  statTotal: document.getElementById('stat-total'),
  statTwoFlips: document.getElementById('stat-two-flips'),
  statTwoTwists: document.getElementById('stat-two-twists'),
  twoFlipsMetric: document.getElementById('two-flips-metric'),
  twoTwistsMetric: document.getElementById('two-twists-metric'),
  statFloatingSaved: document.getElementById('stat-floating-saved'),
  floatingSavedMetric: document.getElementById('floating-saved-metric'),
  statLtctSaved: document.getElementById('stat-ltct-saved'),
  ltctSavedMetric: document.getElementById('ltct-saved-metric'),
  breakdownResultsTableShell: document.getElementById('breakdown-results-table-shell'),
  overviewCard: document.getElementById('overview-card'),
  breakdownCard: document.getElementById('breakdown-card'),
  compactBreakdownCard: document.getElementById('compact-breakdown-card'),
  distributionCard: document.getElementById('distribution-card'),
  distributionChart: document.getElementById('distribution-chart'),
  algGrid: document.getElementById('alg-grid'),
  showOverview: document.getElementById('show-overview'),
  showBreakdown: document.getElementById('show-breakdown'),
  showCompactBreakdown: document.getElementById('show-compact-breakdown'),
  showDistribution: document.getElementById('show-distribution'),
  partialBuffers: document.getElementById('partial-buffers'),
  cornerPills: document.getElementById('corner-pills'),
  edgePills: document.getElementById('edge-pills'),
  themeToggle: document.getElementById('theme-toggle'),
  scrambleDialog: document.getElementById('scramble-dialog'),
  scrambleDialogNumber: document.getElementById('scramble-dialog-number'),
  scrambleDialogText: document.getElementById('scramble-dialog-text'),
  scrambleDialogClose: document.getElementById('scramble-dialog-close'),
};

const state = {
  cornerBuffers: [...LEGACY_CORNER_BUFFERS],
  edgeBuffers: [...LEGACY_EDGE_BUFFERS],
  breakdownSort: { key: 'index', direction: 'asc' },
  scrambleBreakdowns: [],
  selectScramblesOnNextClick: false,
};

function getEdgeMethod() {
  return document.querySelector('input[name="edge-method"]:checked').value;
}

function getBufferMode() {
  return document.querySelector('input[name="buffer-mode"]:checked').value;
}

function setCheckedRadio(name, value) {
  const input = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (input) input.checked = true;
}

function getCurrentSettingsForStorage() {
  return {
    edgeMethod: getEdgeMethod(),
    bufferMode: getBufferMode(),
    cornerBuffers: [...state.cornerBuffers],
    edgeBuffers: [...state.edgeBuffers],
    dnf: elements.dnf.checked,
    ltct: elements.ltct.checked,
    tracingOrientation: elements.tracingOrientation.value,
    flipWeight: elements.flipWeight.value,
    twistWeight: elements.twistWeight.value,
    resultSections: {
      overview: elements.showOverview.checked,
      breakdown: elements.showBreakdown.checked,
      compactBreakdown: elements.showCompactBreakdown.checked,
      distribution: elements.showDistribution.checked,
    },
  };
}

function saveSettings() {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(getCurrentSettingsForStorage()));
}

function readSavedSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY));
    return saved && typeof saved === 'object' ? saved : null;
  } catch {
    return null;
  }
}

function restoreSettings() {
  const saved = readSavedSettings();
  if (!saved) return;

  setCheckedRadio('edge-method', saved.edgeMethod);
  setCheckedRadio('buffer-mode', saved.bufferMode);
  elements.dnf.checked = Boolean(saved.dnf);
  elements.ltct.checked = Boolean(saved.ltct);
  elements.tracingOrientation.value = saved.tracingOrientation || '';
  elements.flipWeight.value = saved.flipWeight || '1';
  elements.twistWeight.value = saved.twistWeight || '1';

  if (saved.resultSections && typeof saved.resultSections === 'object') {
    if (typeof saved.resultSections.overview === 'boolean') {
      elements.showOverview.checked = saved.resultSections.overview;
    }
    const savedBreakdown = typeof saved.resultSections.breakdown === 'boolean'
      ? saved.resultSections.breakdown
      : saved.resultSections.detailedBreakdown;
    if (typeof savedBreakdown === 'boolean') {
      elements.showBreakdown.checked = savedBreakdown;
    }
    if (typeof saved.resultSections.compactBreakdown === 'boolean') {
      elements.showCompactBreakdown.checked = saved.resultSections.compactBreakdown;
    }
    if (typeof saved.resultSections.distribution === 'boolean') {
      elements.showDistribution.checked = saved.resultSections.distribution;
    }
  }

  if (Array.isArray(saved.cornerBuffers) && saved.cornerBuffers.length) {
    const cornerBuffers = saved.cornerBuffers.filter((buffer) => CORNER_BUFFER_OPTIONS.includes(buffer));
    if (cornerBuffers.length) state.cornerBuffers = cornerBuffers;
  }

  if (Array.isArray(saved.edgeBuffers) && saved.edgeBuffers.length) {
    const edgeBuffers = saved.edgeBuffers.filter((buffer) => EDGE_BUFFER_OPTIONS.includes(buffer));
    if (edgeBuffers.length) state.edgeBuffers = edgeBuffers;
  }
}

function updateBufferModeUI() {
  const mode = getBufferMode();
  elements.partialBuffers.classList.toggle('is-hidden', mode !== 'partial');

  if (mode === 'standard') {
    state.cornerBuffers = [...LEGACY_CORNER_BUFFERS];
    state.edgeBuffers = [...LEGACY_EDGE_BUFFERS];
  } else if (mode === 'full') {
    state.cornerBuffers = [...CORNER_BUFFER_OPTIONS];
    state.edgeBuffers = [...EDGE_BUFFER_OPTIONS];
  }

  syncPills();
  saveSettings();
}

function createPills(container, options, selectedValues, group) {
  container.innerHTML = '';
  for (const option of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `pill${selectedValues.includes(option) ? ' is-active' : ''}`;
    button.textContent = option;
    button.dataset.value = option;
    button.dataset.group = group;
    button.addEventListener('click', () => toggleBuffer(group, option));
    container.appendChild(button);
  }
}

function syncPills() {
  createPills(elements.cornerPills, CORNER_BUFFER_OPTIONS, state.cornerBuffers, 'corner');
  createPills(elements.edgePills, EDGE_BUFFER_OPTIONS, state.edgeBuffers, 'edge');
}

function toggleBuffer(group, value) {
  const current = group === 'corner' ? state.cornerBuffers : state.edgeBuffers;
  const index = current.indexOf(value);

  if (index >= 0) {
    current.splice(index, 1);
  } else {
    current.push(value);
  }

  syncPills();
  saveSettings();
}

function selectScramblesForReplacement() {
  if (!state.selectScramblesOnNextClick) return;

  state.selectScramblesOnNextClick = false;
  elements.scrambleInput.select();
}

async function pasteScrambles() {
  if (!navigator.clipboard?.readText) {
    throw new Error('Direct paste is not supported in this browser.');
  }

  const text = await navigator.clipboard.readText();
  if (!text) throw new Error('The clipboard is empty.');

  state.selectScramblesOnNextClick = false;
  elements.scrambleInput.value = text;
  elements.scrambleInput.focus();
  elements.scrambleInput.setSelectionRange(text.length, text.length);
}

function applyTheme(theme) {
  const nextTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);

  const isDark = nextTheme === 'dark';
  elements.themeToggle.setAttribute('aria-pressed', String(isDark));
  elements.themeToggle.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`);
  elements.themeToggle.querySelector('.theme-toggle__text').textContent = isDark ? 'Light' : 'Dark';
}

function initializeTheme() {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const currentTheme = document.documentElement.dataset.theme || storedTheme || 'light';
  applyTheme(currentTheme);

  elements.themeToggle.addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });
}

function resetResults() {
  state.breakdownSort = { key: 'index', direction: 'asc' };
  state.scrambleBreakdowns = [];
  closeScrambleDialog();
  elements.resultsSection.classList.add('is-hidden');
  elements.processedBanner.textContent = '';
  elements.statSolves.textContent = '0';
  elements.statAverage.textContent = '0.00';
  elements.statTotal.textContent = '0';
  elements.statTwoFlips.textContent = '0';
  elements.statTwoTwists.textContent = '0';
  elements.twoFlipsMetric.classList.add('is-hidden');
  elements.twoTwistsMetric.classList.add('is-hidden');
  elements.statFloatingSaved.textContent = '0';
  elements.floatingSavedMetric.classList.add('is-hidden');
  elements.statLtctSaved.textContent = '0';
  elements.ltctSavedMetric.classList.add('is-hidden');
  elements.breakdownResultsTableShell.innerHTML = '';
  elements.distributionChart.className = 'distribution-chart empty-state';
  elements.distributionChart.textContent = 'Run an analysis to see the distribution.';
  elements.algGrid.className = 'alg-grid empty-state';
  elements.algGrid.textContent = 'Run an analysis to see per-scramble alg counts.';
  applyResultSectionVisibility();
}

function applyResultSectionVisibility() {
  elements.overviewCard.classList.toggle('is-hidden', !elements.showOverview.checked);
  elements.breakdownCard.classList.toggle('is-hidden', !elements.showBreakdown.checked);
  elements.compactBreakdownCard.classList.toggle('is-hidden', !elements.showCompactBreakdown.checked);
  elements.distributionCard.classList.toggle('is-hidden', !elements.showDistribution.checked);
}

function renderDistributionChart(distribution) {
  const entries = Object.entries(distribution)
    .map(([key, value]) => ({ algs: Number(key), value }))
    .sort((a, b) => a.algs - b.algs);

  if (!entries.length) {
    elements.distributionChart.className = 'distribution-chart empty-state';
    elements.distributionChart.textContent = 'No distribution data.';
    return;
  }

  const width = 780;
  const height = 280;
  const paddingLeft = 18;
  const paddingBottom = 38;
  const paddingTop = 18;
  const gap = 12;
  const plotWidth = width - paddingLeft - 18;
  const plotHeight = height - paddingTop - paddingBottom;
  const maxValue = Math.max(...entries.map((entry) => entry.value));
  const barWidth = Math.max(18, (plotWidth - gap * (entries.length - 1)) / entries.length);

  const gridLines = Array.from({ length: 5 }, (_, index) => {
    const y = paddingTop + (plotHeight / 4) * index;
    return `<line x1="${paddingLeft}" y1="${y}" x2="${width - 8}" y2="${y}" stroke="var(--chart-grid)"></line>`;
  }).join('');

  const bars = entries.map((entry, index) => {
    const barHeight = maxValue === 0 ? 0 : (entry.value / maxValue) * plotHeight;
    const x = paddingLeft + index * (barWidth + gap);
    const y = paddingTop + plotHeight - barHeight;
    return `
      <g>
        <rect class="chart-bar" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="6"></rect>
        <text class="chart-axis-label" x="${x + barWidth / 2}" y="${height - 8}" text-anchor="middle">${entry.algs} algs</text>
        <text class="chart-value-label" x="${x + barWidth / 2}" y="${Math.max(y - 8, 12)}" text-anchor="middle">${entry.value}</text>
      </g>`;
  }).join('');

  elements.distributionChart.className = 'distribution-chart';
  elements.distributionChart.innerHTML = `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Distribution chart">
      <defs>
        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--chart-start)"></stop>
          <stop offset="100%" stop-color="var(--chart-end)"></stop>
        </linearGradient>
      </defs>
      ${gridLines}
      ${bars}
    </svg>`;
}

function closeScrambleDialog() {
  if (typeof elements.scrambleDialog.close === 'function') {
    if (elements.scrambleDialog.open) elements.scrambleDialog.close();
    return;
  }
  elements.scrambleDialog.removeAttribute('open');
}

function openScrambleDialog(index) {
  const breakdown = state.scrambleBreakdowns[index];
  if (!breakdown?.scramble) return;

  elements.scrambleDialogNumber.textContent = String(index + 1);
  elements.scrambleDialogText.textContent = breakdown.scramble;
  if (typeof elements.scrambleDialog.showModal === 'function') {
    elements.scrambleDialog.showModal();
  } else {
    elements.scrambleDialog.setAttribute('open', '');
  }
}

function openScrambleFromTarget(target) {
  if (!(target instanceof Element)) return false;
  const opener = target.closest('[data-scramble-index]');
  if (!opener) return false;
  openScrambleDialog(Number(opener.dataset.scrambleIndex));
  return true;
}

function renderAlgGrid(scrambleBreakdowns, showComparisons = false) {
  if (!scrambleBreakdowns.length) {
    elements.algGrid.className = 'alg-grid empty-state';
    elements.algGrid.textContent = 'No per-scramble data.';
    return;
  }

  const showIndexes = scrambleBreakdowns.length > 5;
  elements.algGrid.className = 'alg-grid';
  elements.algGrid.innerHTML = scrambleBreakdowns
    .map(
      (result, index) => `
        <button class="alg-cell${showIndexes ? '' : ' alg-cell--unindexed'}${result.dnf ? ' alg-cell--dnf' : ''}" type="button" data-scramble-index="${index}" aria-label="View scramble ${index + 1}${result.dnf ? ', DNF' : ''}" title="View scramble ${index + 1}${result.dnf ? ' (DNF)' : ''}">
          ${result.dnf ? '<span class="dnf-badge alg-cell__dnf">DNF</span>' : ''}
          ${showIndexes ? `<div class="alg-cell__index">${index + 1}</div>` : ''}
          <div class="alg-cell__value">${renderMetricValue(result.total_algs, result.baseline_total_algs, showComparisons)}</div>
          <div class="alg-cell__split" aria-label="${result.corner_algs} corner algs plus ${result.edge_algs} edge algs">
            <span>${result.corner_algs}</span>
            <span class="alg-cell__plus">+</span>
            <span>${result.edge_algs}</span>
          </div>
        </button>`
    )
    .join('');
}

function renderMetricValue(actual, baseline, comparisonsEnabled, annotation = '') {
  const renderedValue = comparisonsEnabled && Number.isFinite(baseline) && baseline > actual
    ? `<span class="metric-comparison">
        <span class="metric-comparison__from">${baseline}</span>
        <span class="metric-comparison__arrow" aria-hidden="true">→</span>
        <span>${actual}</span>
      </span>`
    : String(actual);

  if (!annotation) return renderedValue;
  return `<span class="metric-annotated-value">
    ${renderedValue}
    <span class="metric-annotation">${annotation}</span>
  </span>`;
}

function getBreakdownSortValue(entry, key) {
  if (key === 'index') return entry.originalIndex;
  return entry.result[key];
}

function renderBreakdownSortHeader(label, key, className = '', accessibleLabel = label) {
  const isActive = state.breakdownSort.key === key;
  const direction = state.breakdownSort.direction;
  const ariaSort = isActive ? ` aria-sort="${direction === 'asc' ? 'ascending' : 'descending'}"` : '';
  const indicator = isActive ? (direction === 'asc' ? '↑' : '↓') : '↕';
  const currentDirection = isActive ? `, currently ${direction === 'asc' ? 'ascending' : 'descending'}` : '';
  return `
    <th class="${className}${className ? ' ' : ''}breakdown-results-table__sortable" scope="col"${ariaSort}>
      <button class="breakdown-results-table__sort-button" type="button" data-breakdown-sort="${key}" aria-label="Sort by ${accessibleLabel}${currentDirection}">
        <span>${label}</span>
        <span class="breakdown-results-table__sort-indicator${isActive ? '' : ' breakdown-results-table__sort-indicator--inactive'}" aria-hidden="true">${indicator}</span>
      </button>
    </th>`;
}

function renderBreakdown(scrambleBreakdowns) {
  const showIndexes = scrambleBreakdowns.length > 5;
  const sortDirection = state.breakdownSort.direction === 'asc' ? 1 : -1;
  const sortedEntries = scrambleBreakdowns
    .map((result, originalIndex) => ({ result, originalIndex }))
    .sort((first, second) => {
      const difference = getBreakdownSortValue(first, state.breakdownSort.key)
        - getBreakdownSortValue(second, state.breakdownSort.key);
      return difference ? difference * sortDirection : first.originalIndex - second.originalIndex;
    });
  const rows = sortedEntries.map(({ result, originalIndex }) => {
    const showSavings = Number.isFinite(result.baseline_total_algs)
      && result.baseline_total_algs > result.total_algs;
    return `
      <tr tabindex="0" data-scramble-index="${originalIndex}" aria-label="View scramble ${originalIndex + 1}${result.dnf ? ', DNF' : ''}" title="View scramble ${originalIndex + 1}${result.dnf ? ' (DNF)' : ''}">
        ${showIndexes ? `<td class="breakdown-results-table__index">${originalIndex + 1}</td>` : ''}
        <td class="breakdown-results-table__primary"><span class="breakdown-results-table__primary-content"><strong class="metric-value breakdown-results-table__value">${renderMetricValue(result.total_algs, result.baseline_total_algs, showSavings)}</strong>${result.dnf ? '<span class="dnf-badge">DNF</span>' : ''}</span></td>
        <td class="breakdown-results-table__group-start"><strong class="metric-value breakdown-results-table__value">${renderMetricValue(result.corner_algs, result.baseline_corner_algs, showSavings, result.ltct_used ? 'LTCT' : '')}</strong></td>
        <td><strong class="metric-value breakdown-results-table__value">${renderMetricValue(result.edge_algs, result.baseline_edge_algs, showSavings)}</strong></td>
        <td class="breakdown-results-table__minor breakdown-results-table__group-start"><strong class="metric-value breakdown-results-table__value">${result.two_flips}</strong></td>
        <td class="breakdown-results-table__minor"><strong class="metric-value breakdown-results-table__value">${result.two_twists}</strong></td>
      </tr>`;
  }).join('');

  elements.breakdownResultsTableShell.innerHTML = `
    <table class="breakdown-results-table${showIndexes ? ' breakdown-results-table--indexed' : ''}" aria-label="Per-scramble breakdown">
      <colgroup>
        ${showIndexes ? '<col class="breakdown-results-table__col breakdown-results-table__col--index" />' : ''}
        <col class="breakdown-results-table__col breakdown-results-table__col--primary" />
        <col class="breakdown-results-table__col breakdown-results-table__col--component" />
        <col class="breakdown-results-table__col breakdown-results-table__col--component" />
        <col class="breakdown-results-table__col breakdown-results-table__col--minor" />
        <col class="breakdown-results-table__col breakdown-results-table__col--minor" />
      </colgroup>
      <thead>
        <tr>
          ${showIndexes ? renderBreakdownSortHeader('#', 'index', 'breakdown-results-table__index', 'scramble number') : ''}
          ${renderBreakdownSortHeader('Algs', 'total_algs', 'breakdown-results-table__primary')}
          ${renderBreakdownSortHeader('Corner algs', 'corner_algs', 'breakdown-results-table__group-start')}
          ${renderBreakdownSortHeader('Edge algs', 'edge_algs')}
          <th class="breakdown-results-table__minor breakdown-results-table__group-start" scope="col">F-2-flip</th>
          <th class="breakdown-results-table__minor" scope="col">F-2-twist</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  elements.breakdownResultsTableShell
    .querySelectorAll('[data-breakdown-sort]')
    .forEach((button) => {
      button.addEventListener('click', (event) => {
        const scrollTop = elements.breakdownResultsTableShell.scrollTop;
        const scrollLeft = elements.breakdownResultsTableShell.scrollLeft;
        const key = button.dataset.breakdownSort;
        state.breakdownSort = state.breakdownSort.key === key
          ? { key, direction: state.breakdownSort.direction === 'asc' ? 'desc' : 'asc' }
          : { key, direction: 'asc' };
        renderBreakdown(scrambleBreakdowns);
        elements.breakdownResultsTableShell.scrollTop = scrollTop;
        elements.breakdownResultsTableShell.scrollLeft = scrollLeft;
        if (event.detail === 0) {
          elements.breakdownResultsTableShell
            .querySelector(`[data-breakdown-sort="${key}"]`)
            ?.focus({ preventScroll: true });
        }
      });
    });
}

function renderResult(rawResult) {
  const [
    numberOfSolves,
    distribution,
    average,
    total,
    totalTwoFlips,
    totalTwoTwists,
  ] = rawResult;
  const scrambleBreakdowns = rawResult[9];
  const comparisonMetadata = rawResult[10];
  const hasComparison = Boolean(comparisonMetadata);
  const floatingSavedAlgs = comparisonMetadata?.floating_saved_algs ?? 0;
  const ltctSavedAlgs = comparisonMetadata?.ltct_saved_algs ?? 0;

  elements.resultsSection.classList.remove('is-hidden');
  elements.processedBanner.textContent = `Processed ${numberOfSolves} scramble${numberOfSolves === 1 ? '' : 's'}.`;
  elements.statSolves.textContent = String(numberOfSolves);
  elements.statTotal.textContent = String(total);
  elements.statAverage.textContent = Number(average).toFixed(2);
  elements.statTwoFlips.textContent = String(totalTwoFlips);
  elements.statTwoTwists.textContent = String(totalTwoTwists);
  elements.twoFlipsMetric.classList.toggle('is-hidden', totalTwoFlips <= 0);
  elements.twoTwistsMetric.classList.toggle('is-hidden', totalTwoTwists <= 0);
  elements.statFloatingSaved.textContent = String(floatingSavedAlgs);
  elements.floatingSavedMetric.classList.toggle('is-hidden', floatingSavedAlgs <= 0);
  elements.statLtctSaved.textContent = String(ltctSavedAlgs);
  elements.ltctSavedMetric.classList.toggle('is-hidden', ltctSavedAlgs <= 0);
  state.breakdownSort = { key: 'index', direction: 'asc' };
  state.scrambleBreakdowns = scrambleBreakdowns;
  state.selectScramblesOnNextClick = true;

  renderBreakdown(scrambleBreakdowns);
  renderAlgGrid(scrambleBreakdowns, hasComparison);
  renderDistributionChart(distribution);
  applyResultSectionVisibility();

  requestAnimationFrame(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const preferredScrollTop = window.scrollY + elements.actionRow.getBoundingClientRect().top - 20;
    const visibleResultCards = [
      elements.overviewCard,
      elements.breakdownCard,
      elements.compactBreakdownCard,
      elements.distributionCard,
    ].filter((card) => !card.classList.contains('is-hidden'));
    const lastVisibleResult = visibleResultCards.at(-1) || elements.processedBanner;
    const resultBottom = window.scrollY + lastVisibleResult.getBoundingClientRect().bottom;
    const maximumScrollTop = Math.max(0, resultBottom - window.innerHeight);
    window.scrollTo({
      top: Math.max(0, Math.min(preferredScrollTop, maximumScrollTop)),
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  });
}

function collectSettings() {
  const bufferMode = getBufferMode();
  const cornerBuffers = bufferMode === 'partial' ? state.cornerBuffers : [...state.cornerBuffers];
  const edgeBuffers = bufferMode === 'partial' ? state.edgeBuffers : [...state.edgeBuffers];

  if (!cornerBuffers.length) throw new Error('Select at least one corner buffer.');
  if (!edgeBuffers.length) throw new Error('Select at least one edge buffer.');

  return {
    scrambles: elements.scrambleInput.value,
    bufferMode,
    tracingOrientation: elements.tracingOrientation.value.trim(),
    edgeMethod: getEdgeMethod(),
    flipWeight: Number(elements.flipWeight.value),
    twistWeight: Number(elements.twistWeight.value),
    ltct: elements.ltct.checked,
    dnf: elements.dnf.checked,
    cornerBuffers,
    edgeBuffers,
  };
}

async function analyze() {
  const settings = collectSettings();
  if (!settings.scrambles.trim()) throw new Error('Paste some scrambles first.');
  elements.analyzeButton.disabled = true;
  elements.pasteButton.disabled = true;
  const id = ++requestId;

  return new Promise((resolve, reject) => {
    const handleMessage = (event) => {
      if (event.data.id !== id) return;
      worker.removeEventListener('message', handleMessage);
      elements.analyzeButton.disabled = false;
      elements.pasteButton.disabled = false;
      if (event.data.ok) {
        renderResult(event.data.result);
        resolve();
      } else {
        reject(new Error(event.data.error));
      }
    };

    worker.addEventListener('message', handleMessage);
    worker.postMessage({ id, type: 'analyze', payload: settings });
  });
}

async function loadExample() {
  const response = await fetch('./examples/testing-10k-scrams.txt');
  if (!response.ok) throw new Error('Could not load bundled example scrambles.');
  const scrambles = (await response.text())
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const randomScrambles = [...scrambles]
    .sort(() => Math.random() - 0.5)
    .slice(0, 100);

  elements.scrambleInput.value = randomScrambles.join('\n');
  state.selectScramblesOnNextClick = false;
}

function initialize() {
  initializeTheme();
  resetResults();
  restoreSettings();
  syncPills();
  updateBufferModeUI();

  document.querySelectorAll('input[name="buffer-mode"]').forEach((input) => {
    input.addEventListener('change', updateBufferModeUI);
  });

  document.querySelectorAll('input[name="edge-method"]').forEach((input) => {
    input.addEventListener('change', saveSettings);
  });

  [
    elements.showOverview,
    elements.showBreakdown,
    elements.showCompactBreakdown,
    elements.showDistribution,
  ].forEach((input) => {
    input.addEventListener('change', () => {
      saveSettings();
      applyResultSectionVisibility();
    });
  });

  [elements.dnf, elements.ltct, elements.tracingOrientation, elements.flipWeight, elements.twistWeight].forEach((input) => {
    input.addEventListener('input', saveSettings);
    input.addEventListener('change', saveSettings);
  });

  elements.scrambleInput.addEventListener('click', selectScramblesForReplacement);

  elements.breakdownResultsTableShell.addEventListener('click', (event) => {
    openScrambleFromTarget(event.target);
  });

  elements.breakdownResultsTableShell.addEventListener('keydown', (event) => {
    if (!['Enter', ' '].includes(event.key)) return;
    if (!openScrambleFromTarget(event.target)) return;
    event.preventDefault();
  });

  elements.algGrid.addEventListener('click', (event) => {
    openScrambleFromTarget(event.target);
  });

  elements.scrambleDialogClose.addEventListener('click', closeScrambleDialog);
  elements.scrambleDialog.addEventListener('click', (event) => {
    if (event.target === elements.scrambleDialog) closeScrambleDialog();
  });

  elements.pasteButton.addEventListener('click', async () => {
    try {
      await pasteScrambles();
    } catch (error) {
      elements.scrambleInput.focus();
      elements.scrambleInput.select();
      alert(`${error.message} Press Ctrl/Cmd+V to paste manually.`);
      return;
    }

    try {
      await analyze();
    } catch (error) {
      alert(error.message);
    }
  });

  elements.clearButton.addEventListener('click', () => {
    state.selectScramblesOnNextClick = false;
    elements.scrambleInput.value = '';
    resetResults();
  });

  elements.loadExampleButton.addEventListener('click', async () => {
    try {
      await loadExample();
    } catch (error) {
      alert(error.message);
    }
  });

  elements.analyzeButton.addEventListener('click', async () => {
    try {
      await analyze();
    } catch (error) {
      alert(error.message);
    }
  });
}

initialize();
