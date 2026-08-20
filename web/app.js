const worker = new Worker('./worker.js?v=fixed-5x5-orientation-v1');
let requestId = 0;

const {
  bufferCountThroughFurthest,
  CORNER_BUFFER_ORDER: CORNER_BUFFER_OPTIONS,
  cornerBuffersThroughCount,
  EDGE_BUFFER_ORDER: EDGE_BUFFER_OPTIONS,
  edgeBuffersThroughCount,
  isPseudoswapUbException,
  selectEdgeBufferLevel,
} = window.SsiBufferSelection;
const LEGACY_CORNER_BUFFERS = ['UFR'];
const LEGACY_EDGE_BUFFERS = ['UF'];
const BIG_CUBE_ORIENTATION_STICKERS = [
  'UFR', 'RUF', 'FUR', 'UBR', 'BUR', 'RUB',
  'UBL', 'LUB', 'BUL', 'UFL', 'FUL', 'LUF',
  'DFR', 'FDR', 'RDF', 'DFL', 'LDF', 'FDL',
  'DBR', 'RDB', 'BDR', 'DBL', 'BDL', 'LDB',
];
const THEME_STORAGE_KEY = 'ssi-theme';
const SETTINGS_STORAGE_KEY = 'ssi-settings';

const elements = {
  scrambleInput: document.getElementById('scramble-input'),
  standardBufferLabel: document.getElementById('standard-buffer-label'),
  tracingOrientation: document.getElementById('tracing-orientation'),
  threeByThreeOrientationSetting: document.getElementById('three-by-three-orientation-setting'),
  bigCubeOrientationSetting: document.getElementById('big-cube-orientation-setting'),
  bigCubeOrientation: document.getElementById('big-cube-orientation'),
  compareOptimalOrientationOption: document.getElementById('compare-optimal-orientation-option'),
  compareOptimalOrientation: document.getElementById('compare-optimal-orientation'),
  edgeBufferSubtitle: document.getElementById('edge-buffer-subtitle'),
  wingParitySettings: document.getElementById('wing-parity-settings'),
  dnf: document.getElementById('dnf'),
  cornerFloatingParityOption: document.getElementById('corner-floating-parity-option'),
  cornerFloatingParity: document.getElementById('corner-floating-parity'),
  weak2e2eCapabilityOption: document.getElementById('weak-2e2e-capability-option'),
  edgeParityAlgsetLabel: document.getElementById('weak-2e2e-label'),
  ltefOption: document.getElementById('ltef-option'),
  ltef: document.getElementById('ltef'),
  edgeMethodSettings: document.getElementById('edge-method-settings'),
  edgeBufferSubgroup: document.getElementById('edge-buffer-subgroup'),
  flipWeightSetting: document.getElementById('flip-weight-setting'),
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
  statFinishSaved: document.getElementById('stat-finish-saved'),
  finishSavedLabel: document.getElementById('finish-saved-label'),
  finishSavedMetric: document.getElementById('finish-saved-metric'),
  statOrientationMissed: document.getElementById('stat-orientation-missed'),
  orientationMissedMetric: document.getElementById('orientation-missed-metric'),
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
  edgeBufferExceptionHint: document.getElementById('edge-buffer-exception-hint'),
  themeToggle: document.getElementById('theme-toggle'),
  scrambleDialog: document.getElementById('scramble-dialog'),
  scrambleDialogNumber: document.getElementById('scramble-dialog-number'),
  scrambleDialogText: document.getElementById('scramble-dialog-text'),
  scrambleDialogClose: document.getElementById('scramble-dialog-close'),
  terminalWeightInputs: Object.fromEntries([
    'parity',
    'ltct',
    't2c',
    'corner-floating-parity',
    '2e2e',
    'f2e',
    'ff2e',
    'ltef',
  ].map((type) => [type, document.getElementById(`weight-${type}`)])),
  terminalWeightRows: Object.fromEntries(
    [...document.querySelectorAll('[data-terminal-weight]')]
      .map((row) => [row.dataset.terminalWeight, row]),
  ),
};

const state = {
  cornerBufferCount: LEGACY_CORNER_BUFFERS.length,
  edgeBufferCount: LEGACY_EDGE_BUFFERS.length,
  edgeUbWithoutUr: false,
  breakdownSort: { key: 'index', direction: 'asc' },
  scrambleBreakdowns: [],
  selectScramblesOnNextClick: false,
};

function getPuzzle() {
  return document.querySelector('input[name="puzzle"]:checked').value;
}

function getEdgeMethod() {
  return document.querySelector('input[name="edge-method"]:checked').value;
}

function getEffectiveEdgeMethod() {
  return getPuzzle() === '5x5' ? 'pseudoswap' : getEdgeMethod();
}

function getBufferMode() {
  return document.querySelector('input[name="buffer-mode"]:checked').value;
}

function getFinishCapability() {
  return document.querySelector('input[name="finish-capability"]:checked').value;
}

function getWeak2e2eCapability() {
  return document.querySelector('input[name="weak-2e2e-capability"]:checked').value;
}

function getWingParityCapability() {
  return document.querySelector('input[name="wing-parity-capability"]:checked').value;
}

function getTerminalWeights() {
  return Object.fromEntries(Object.entries(elements.terminalWeightInputs)
    .filter(([, input]) => !input.disabled)
    .map(([type, input]) => [type, Number(input.value)]));
}

function syncTerminalWeightVisibility() {
  const finishCapability = getFinishCapability();
  const edgeCapability = elements.weak2e2eCapabilityOption.classList.contains('is-hidden')
    ? 'none'
    : getWeak2e2eCapability();
  const edgeCapabilityRank = ['none', '2e2e', 'f2e', 'ff2e'].indexOf(edgeCapability);
  const knownTerminals = {
    parity: true,
    ltct: finishCapability === 'ltct' || finishCapability === 't2c',
    t2c: finishCapability === 't2c',
    'corner-floating-parity': !elements.cornerFloatingParity.disabled
      && elements.cornerFloatingParity.checked,
    '2e2e': edgeCapabilityRank >= 1,
    f2e: edgeCapabilityRank >= 2,
    ff2e: edgeCapabilityRank >= 3,
    ltef: !elements.ltef.disabled && elements.ltef.checked,
  };

  for (const [type, row] of Object.entries(elements.terminalWeightRows)) {
    const isKnown = Boolean(knownTerminals[type]);
    row.classList.toggle('is-hidden', !isKnown);
    elements.terminalWeightInputs[type].disabled = !isKnown;
  }
}

function setCheckedRadio(name, value) {
  const input = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (input) input.checked = true;
}

function selectedCornerBuffers() {
  return cornerBuffersThroughCount(state.cornerBufferCount);
}

function selectedEdgeBuffers(edgeMethod = getEffectiveEdgeMethod()) {
  return edgeBuffersThroughCount(
    state.edgeBufferCount,
    edgeMethod,
    state.edgeUbWithoutUr,
  );
}

function savedBufferCount(value, options, fallbackBuffers) {
  if (Number.isInteger(value) && value >= 1 && value <= options.length) return value;
  return bufferCountThroughFurthest(options, fallbackBuffers);
}

function getCurrentSettingsForStorage() {
  return {
    puzzle: getPuzzle(),
    edgeMethod: getEdgeMethod(),
    bufferMode: getBufferMode(),
    cornerBufferCount: state.cornerBufferCount,
    edgeBufferCount: state.edgeBufferCount,
    edgeUbWithoutUr: state.edgeUbWithoutUr,
    dnf: elements.dnf.checked,
    finishCapability: getFinishCapability(),
    weak2e2eCapability: getWeak2e2eCapability(),
    cornerFloatingParity: elements.cornerFloatingParity.checked,
    ltef: elements.ltef.checked,
    terminalWeights: Object.fromEntries(Object.entries(elements.terminalWeightInputs).map(
      ([type, input]) => [type, input.value],
    )),
    tracingOrientation: elements.tracingOrientation.value,
    bigCubeOrientation: elements.bigCubeOrientation.value,
    compareOptimalOrientation: elements.compareOptimalOrientation.checked,
    wingParityCapability: getWingParityCapability(),
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

  setCheckedRadio('puzzle', saved.puzzle || '3x3');
  setCheckedRadio('edge-method', saved.edgeMethod);
  setCheckedRadio('buffer-mode', saved.bufferMode);
  elements.dnf.checked = Boolean(saved.dnf);
  setCheckedRadio(
    'finish-capability',
    saved.finishCapability || (saved.ltct ? 'ltct' : 'none'),
  );
  setCheckedRadio(
    'weak-2e2e-capability',
    saved.weak2e2eCapability === '2e2e-prime'
      ? 'ff2e'
      : saved.weak2e2eCapability || (saved.weak2e2ePrime ? 'ff2e' : '2e2e'),
  );
  elements.cornerFloatingParity.checked = Boolean(saved.cornerFloatingParity);
  elements.ltef.checked = Boolean(saved.ltef);
  for (const [type, input] of Object.entries(elements.terminalWeightInputs)) {
    input.value = saved.terminalWeights?.[type] || '1';
  }
  elements.tracingOrientation.value = saved.tracingOrientation || '';
  elements.bigCubeOrientation.value = saved.bigCubeOrientation
    || saved.fourByFourOrientation
    || 'UFR';
  elements.compareOptimalOrientation.checked = Boolean(saved.compareOptimalOrientation);
  setCheckedRadio('wing-parity-capability', saved.wingParityCapability || 'basic');
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

  state.cornerBufferCount = savedBufferCount(
    saved.cornerBufferCount,
    CORNER_BUFFER_OPTIONS,
    saved.cornerBuffers,
  );
  state.edgeBufferCount = savedBufferCount(
    saved.edgeBufferCount,
    EDGE_BUFFER_OPTIONS,
    saved.edgeBuffers,
  );
  const restoredEdgeMethod = saved.puzzle === '5x5' ? 'pseudoswap' : getEdgeMethod();
  state.edgeUbWithoutUr = restoredEdgeMethod === 'pseudoswap'
    && state.edgeBufferCount === 3
    && (saved.edgeUbWithoutUr === true || isPseudoswapUbException(saved.edgeBuffers));
}

function updateBufferModeUI() {
  const mode = getBufferMode();
  const isFourByFour = getPuzzle() === '4x4';
  const isBigCube = getPuzzle() !== '3x3';
  const effectiveEdgeMethod = getEffectiveEdgeMethod();
  elements.partialBuffers.classList.toggle('is-hidden', mode !== 'partial');
  elements.edgeMethodSettings.classList.toggle('is-hidden', isBigCube);
  elements.edgeBufferSubgroup.classList.toggle('is-hidden', isFourByFour);
  elements.edgeBufferExceptionHint.classList.toggle(
    'is-hidden',
    isFourByFour || effectiveEdgeMethod !== 'pseudoswap',
  );
  if (mode === 'standard') {
    state.cornerBufferCount = LEGACY_CORNER_BUFFERS.length;
    state.edgeBufferCount = LEGACY_EDGE_BUFFERS.length;
    state.edgeUbWithoutUr = false;
  } else if (mode === 'full') {
    state.cornerBufferCount = CORNER_BUFFER_OPTIONS.length;
    state.edgeBufferCount = EDGE_BUFFER_OPTIONS.length;
    state.edgeUbWithoutUr = false;
  } else if (effectiveEdgeMethod === 'weakswap' && state.edgeUbWithoutUr) {
    state.edgeUbWithoutUr = false;
  }

  syncPills();
  saveSettings();
}

function updatePuzzleUI() {
  const puzzle = getPuzzle();
  const isFourByFour = puzzle === '4x4';
  const isFiveByFive = puzzle === '5x5';
  const isBigCube = isFourByFour || isFiveByFive;
  elements.standardBufferLabel.textContent = isFourByFour ? 'UFR' : 'UF/UFR';
  elements.threeByThreeOrientationSetting.classList.toggle('is-hidden', isBigCube);
  elements.bigCubeOrientationSetting.classList.toggle('is-hidden', !isFourByFour);
  const optimalOrientationOption = elements.bigCubeOrientation
    .querySelector('option[value="optimal"]');
  if (optimalOrientationOption) {
    optimalOrientationOption.disabled = !isFourByFour;
    optimalOrientationOption.hidden = !isFourByFour;
  }
  if (!isFourByFour && elements.bigCubeOrientation.value === 'optimal') {
    elements.bigCubeOrientation.value = 'UFR';
  }
  syncOptimalOrientationComparisonUI();
  elements.wingParitySettings.classList.toggle('is-hidden', !isBigCube);
  elements.edgeBufferSubtitle.textContent = isFiveByFive ? 'Midge buffers' : 'Edge buffers';
  elements.edgeParityAlgsetLabel.textContent = isFiveByFive
    ? 'Midge parity algset'
    : 'Edge parity algset';
  elements.flipWeightSetting.classList.toggle('is-hidden', isFourByFour);
  elements.loadExampleButton.classList.toggle('is-hidden', isBigCube);
  elements.scrambleInput.placeholder = isBigCube
    ? `Paste one or more ${isFourByFour ? '4×4' : '5×5'} scrambles`
    : 'Paste from csTimer: Session Statistics / Round Statistics / ScrambleGenerator, or WCA archive';
  if (isFourByFour) state.edgeUbWithoutUr = false;
  updateBufferModeUI();
}

function syncOptimalOrientationComparisonUI() {
  const available = getPuzzle() === '4x4' && elements.bigCubeOrientation.value !== 'optimal';
  elements.compareOptimalOrientationOption.classList.toggle('is-hidden', !available);
  elements.compareOptimalOrientation.disabled = !available;
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
    button.setAttribute('aria-pressed', String(selectedValues.includes(option)));
    const requiredBuffers = group === 'corner' ? LEGACY_CORNER_BUFFERS : LEGACY_EDGE_BUFFERS;
    if (requiredBuffers.includes(option)) button.title = 'Primary buffer (click to reset)';
    if (
      group === 'edge'
      && option === 'UR'
      && getEffectiveEdgeMethod() === 'pseudoswap'
      && state.edgeBufferCount === 3
    ) {
      button.title = 'Toggle the UF + UB without UR exception';
    }
    button.addEventListener('click', () => selectBufferLevel(group, option));
    container.appendChild(button);
  }
}

function syncPills() {
  const isFourByFour = getPuzzle() === '4x4';
  createPills(elements.cornerPills, CORNER_BUFFER_OPTIONS, selectedCornerBuffers(), 'corner');
  createPills(elements.edgePills, EDGE_BUFFER_OPTIONS, selectedEdgeBuffers(), 'edge');
  const selectedEdges = selectedEdgeBuffers();
  const supportsWeak2e2e = getPuzzle() === '3x3'
    && getBufferMode() !== 'standard'
    && selectedEdges.length >= 3
    && selectedEdges.includes('UR');
  elements.weak2e2eCapabilityOption.classList.toggle('is-hidden', !supportsWeak2e2e);
  document.querySelectorAll('input[name="weak-2e2e-capability"]').forEach((input) => {
    input.disabled = !supportsWeak2e2e;
  });
  const supportsCornerFloatingParity = getBufferMode() !== 'standard'
    && state.cornerBufferCount >= 2;
  elements.cornerFloatingParityOption.classList.toggle(
    'is-hidden',
    !supportsCornerFloatingParity,
  );
  elements.cornerFloatingParity.disabled = !supportsCornerFloatingParity;
  const supportsLtef = getPuzzle() === '3x3' && getEdgeMethod() === 'weakswap';
  elements.ltefOption.classList.toggle('is-hidden', !supportsLtef);
  elements.ltef.disabled = !supportsLtef;
  syncTerminalWeightVisibility();
}

function selectBufferLevel(group, value) {
  if (group === 'corner') {
    state.cornerBufferCount = CORNER_BUFFER_OPTIONS.indexOf(value) + 1;
  } else {
    const selection = selectEdgeBufferLevel(
      state.edgeBufferCount,
      state.edgeUbWithoutUr,
      getEffectiveEdgeMethod(),
      value,
    );
    state.edgeBufferCount = selection.count;
    state.edgeUbWithoutUr = selection.ubWithoutUr;
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
  elements.statFinishSaved.textContent = '0';
  elements.finishSavedMetric.classList.add('is-hidden');
  elements.statOrientationMissed.textContent = '0';
  elements.orientationMissedMetric.classList.add('is-hidden');
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

  elements.algGrid.className = 'alg-grid';
  elements.algGrid.innerHTML = scrambleBreakdowns
    .map((result, index) => {
      const isFourByFour = result.puzzle === '4x4';
      const isFiveByFive = result.puzzle === '5x5';
      const componentValues = isFiveByFive
        ? [
            ['corner', 'corner_algs'],
            ['midge', 'midge_algs'],
            ['wing', 'wing_algs'],
            ['xcenter', 'xcenter_algs'],
            ['+center', 'pluscenter_algs'],
          ]
        : isFourByFour
          ? [
              ['corner', 'corner_algs'],
              ['wing', 'wing_algs'],
              ['xcenter', 'xcenter_algs'],
            ]
          : [
              ['corner', 'corner_algs'],
              ['edge', 'edge_algs'],
            ];
      const splitLabel = componentValues
        .map(([label, key]) => `${result[key]} ${label} algs`)
        .join(' plus ');
      const split = componentValues
        .map(([, key]) => `<span>${isFourByFour || isFiveByFive
          ? renderBigCubeMetric(result, key)
          : result[key]}</span>`)
        .join('<span class="alg-cell__plus">+</span>');
      const total = isFourByFour || isFiveByFive
        ? renderBigCubeMetric(result, 'total_algs')
        : renderMetricValue(result.total_algs, result.baseline_total_algs, showComparisons);
      return `
        <button class="alg-cell${result.dnf ? ' alg-cell--dnf' : ''}" type="button" data-scramble-index="${index}" aria-label="View scramble ${index + 1}${result.dnf ? ', DNF' : ''}" title="View scramble ${index + 1}${result.dnf ? ' (DNF)' : ''}">
          ${result.dnf ? '<span class="dnf-badge alg-cell__dnf">DNF</span>' : ''}
          ${result.finish_types?.length ? `<span class="metric-annotation alg-cell__finish">${result.finish_types.map(formatFinishType).join(' + ')}</span>` : ''}
          <div class="alg-cell__index">${index + 1}</div>
          <div class="alg-cell__value">${total}</div>
          <div class="alg-cell__split" aria-label="${splitLabel}">${split}</div>
        </button>`;
    })
    .join('');
}

function formatFinishType(type) {
  if (type === 'corner-floating-parity') return '2E2C';
  return String(type).toUpperCase();
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

function renderMetricSequence(values, format = String) {
  const sequence = values
    .filter(Number.isFinite)
    .filter((value, index, all) => index === 0 || value !== all[index - 1]);
  if (sequence.length <= 1) return format(sequence[0] ?? '');
  return `<span class="metric-comparison">${sequence.map((value, index) => (
    `${index ? '<span class="metric-comparison__arrow" aria-hidden="true">→</span>' : ''}`
      + `<span${index === 0 ? ' class="metric-comparison__from"' : ''}>${format(value)}</span>`
  )).join('')}</span>`;
}

function renderBigCubeMetric(result, key) {
  return renderMetricSequence([
    result[`finish_baseline_${key}`],
    result[key],
    result[`optimal_${key}`],
  ]);
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
  if (scrambleBreakdowns[0]?.puzzle === '4x4') {
    renderFourByFourBreakdown(scrambleBreakdowns);
    return;
  }
  if (scrambleBreakdowns[0]?.puzzle === '5x5') {
    renderFiveByFiveBreakdown(scrambleBreakdowns);
    return;
  }
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
        <td class="breakdown-results-table__index">${originalIndex + 1}</td>
        <td class="breakdown-results-table__primary"><span class="breakdown-results-table__primary-content"><strong class="metric-value breakdown-results-table__value">${renderMetricValue(result.total_algs, result.baseline_total_algs, showSavings)}</strong>${result.dnf ? '<span class="dnf-badge">DNF</span>' : ''}</span></td>
        <td class="breakdown-results-table__group-start"><strong class="metric-value breakdown-results-table__value">${renderMetricValue(result.corner_algs, result.baseline_corner_algs, showSavings, result.finish_type ? formatFinishType(result.finish_type) : '')}</strong></td>
        <td><strong class="metric-value breakdown-results-table__value">${renderMetricValue(result.edge_algs, result.baseline_edge_algs, showSavings, result.edge_finish_type ? formatFinishType(result.edge_finish_type) : '')}</strong></td>
        <td class="breakdown-results-table__minor breakdown-results-table__group-start"><strong class="metric-value breakdown-results-table__value">${result.two_flips}</strong></td>
        <td class="breakdown-results-table__minor"><strong class="metric-value breakdown-results-table__value">${result.two_twists}</strong></td>
      </tr>`;
  }).join('');

  elements.breakdownResultsTableShell.innerHTML = `
    <table class="breakdown-results-table breakdown-results-table--indexed" aria-label="Per-scramble breakdown">
      <colgroup>
        <col class="breakdown-results-table__col breakdown-results-table__col--index" />
        <col class="breakdown-results-table__col breakdown-results-table__col--primary" />
        <col class="breakdown-results-table__col breakdown-results-table__col--component" />
        <col class="breakdown-results-table__col breakdown-results-table__col--component" />
        <col class="breakdown-results-table__col breakdown-results-table__col--minor" />
        <col class="breakdown-results-table__col breakdown-results-table__col--minor" />
      </colgroup>
      <thead>
        <tr>
          ${renderBreakdownSortHeader('#', 'index', 'breakdown-results-table__index', 'scramble number')}
          ${renderBreakdownSortHeader('Algs', 'total_algs', 'breakdown-results-table__primary')}
          ${renderBreakdownSortHeader('Corner algs', 'corner_algs', 'breakdown-results-table__group-start')}
          ${renderBreakdownSortHeader('Edge algs', 'edge_algs')}
          <th class="breakdown-results-table__minor breakdown-results-table__group-start" scope="col">F-2-flip</th>
          <th class="breakdown-results-table__minor" scope="col">F-2-twist</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  bindBreakdownSort(scrambleBreakdowns);
}

function bindBreakdownSort(scrambleBreakdowns) {
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

function renderFourByFourBreakdown(scrambleBreakdowns) {
  const sortDirection = state.breakdownSort.direction === 'asc' ? 1 : -1;
  const sortedEntries = scrambleBreakdowns
    .map((result, originalIndex) => ({ result, originalIndex }))
    .sort((first, second) => {
      const difference = getBreakdownSortValue(first, state.breakdownSort.key)
        - getBreakdownSortValue(second, state.breakdownSort.key);
      return difference ? difference * sortDirection : first.originalIndex - second.originalIndex;
    });
  const rows = sortedEntries.map(({ result, originalIndex }) => `
    <tr tabindex="0" data-scramble-index="${originalIndex}" aria-label="View scramble ${originalIndex + 1}${result.dnf ? ', DNF' : ''}" title="View scramble ${originalIndex + 1}${result.dnf ? ' (DNF)' : ''}">
      <td class="breakdown-results-table__index">${originalIndex + 1}</td>
      <td class="breakdown-results-table__primary"><span class="breakdown-results-table__primary-content"><strong class="metric-value breakdown-results-table__value">${renderBigCubeMetric(result, 'total_algs')}</strong>${result.dnf ? '<span class="dnf-badge">DNF</span>' : ''}</span></td>
      <td class="breakdown-results-table__group-start"><strong class="metric-value breakdown-results-table__value">${renderBigCubeMetric(result, 'corner_algs')}</strong></td>
      <td><strong class="metric-value breakdown-results-table__value">${renderBigCubeMetric(result, 'wing_algs')}</strong></td>
      <td><strong class="metric-value breakdown-results-table__value">${renderBigCubeMetric(result, 'xcenter_algs')}</strong></td>
      <td class="breakdown-results-table__minor">${renderFourByFourOrientation(result)}</td>
      <td class="breakdown-results-table__minor">${result.wings.parity ? (result.wings.parity_finish === 'direct' ? 'direct' : 'via BUr') : '—'}</td>
    </tr>`).join('');

  elements.breakdownResultsTableShell.innerHTML = `
    <table class="breakdown-results-table breakdown-results-table--indexed" aria-label="Per-scramble 4x4 breakdown">
      <thead>
        <tr>
          ${renderBreakdownSortHeader('#', 'index', 'breakdown-results-table__index', 'scramble number')}
          ${renderBreakdownSortHeader('Algs', 'total_algs', 'breakdown-results-table__primary')}
          ${renderBreakdownSortHeader('Corner algs', 'corner_algs', 'breakdown-results-table__group-start')}
          ${renderBreakdownSortHeader('Wing algs', 'wing_algs')}
          ${renderBreakdownSortHeader('Xcenter algs', 'xcenter_algs')}
          <th class="breakdown-results-table__minor" scope="col">Orientation</th>
          <th class="breakdown-results-table__minor" scope="col">Wing parity</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  bindBreakdownSort(scrambleBreakdowns);
}

function renderFourByFourOrientation(result) {
  const selected = result.orientation.corner_sticker_at_UFR;
  const tied = result.optimal_orientation?.tied_optimal_stickers || [];
  if (!result.optimal_orientation) return selected;
  if (tied.includes(selected)) return `${selected} (optimal)`;
  return `${selected} → ${result.optimal_orientation.corner_sticker_at_UFR}`;
}

function renderFiveByFiveBreakdown(scrambleBreakdowns) {
  const sortDirection = state.breakdownSort.direction === 'asc' ? 1 : -1;
  const sortedEntries = scrambleBreakdowns
    .map((result, originalIndex) => ({ result, originalIndex }))
    .sort((first, second) => {
      const difference = getBreakdownSortValue(first, state.breakdownSort.key)
        - getBreakdownSortValue(second, state.breakdownSort.key);
      return difference ? difference * sortDirection : first.originalIndex - second.originalIndex;
    });
  const rows = sortedEntries.map(({ result, originalIndex }) => `
    <tr tabindex="0" data-scramble-index="${originalIndex}" aria-label="View scramble ${originalIndex + 1}${result.dnf ? ', DNF' : ''}" title="View scramble ${originalIndex + 1}${result.dnf ? ' (DNF)' : ''}">
      <td class="breakdown-results-table__index">${originalIndex + 1}</td>
      <td class="breakdown-results-table__primary"><span class="breakdown-results-table__primary-content"><strong class="metric-value breakdown-results-table__value">${renderBigCubeMetric(result, 'total_algs')}</strong>${result.dnf ? '<span class="dnf-badge">DNF</span>' : ''}</span></td>
      <td class="breakdown-results-table__group-start"><strong class="metric-value breakdown-results-table__value">${renderBigCubeMetric(result, 'corner_algs')}</strong></td>
      <td><strong class="metric-value breakdown-results-table__value">${renderBigCubeMetric(result, 'midge_algs')}</strong></td>
      <td><strong class="metric-value breakdown-results-table__value">${renderBigCubeMetric(result, 'wing_algs')}</strong></td>
      <td><strong class="metric-value breakdown-results-table__value">${renderBigCubeMetric(result, 'xcenter_algs')}</strong></td>
      <td><strong class="metric-value breakdown-results-table__value">${renderBigCubeMetric(result, 'pluscenter_algs')}</strong></td>
      <td class="breakdown-results-table__minor">${result.wings.parity ? (result.wings.parity_finish === 'direct' ? 'direct' : 'via BUr') : '—'}</td>
    </tr>`).join('');

  elements.breakdownResultsTableShell.innerHTML = `
    <table class="breakdown-results-table breakdown-results-table--indexed" aria-label="Per-scramble 5x5 breakdown">
      <thead>
        <tr>
          ${renderBreakdownSortHeader('#', 'index', 'breakdown-results-table__index', 'scramble number')}
          ${renderBreakdownSortHeader('Algs', 'total_algs', 'breakdown-results-table__primary')}
          ${renderBreakdownSortHeader('Corner algs', 'corner_algs', 'breakdown-results-table__group-start')}
          ${renderBreakdownSortHeader('Midge algs', 'midge_algs')}
          ${renderBreakdownSortHeader('Wing algs', 'wing_algs')}
          ${renderBreakdownSortHeader('Xcenter algs', 'xcenter_algs')}
          ${renderBreakdownSortHeader('+center algs', 'pluscenter_algs')}
          <th class="breakdown-results-table__minor" scope="col">Wing parity</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  bindBreakdownSort(scrambleBreakdowns);
}

function finishRenderingResult(distribution, scrambleBreakdowns, showComparisons = false) {
  state.breakdownSort = { key: 'index', direction: 'asc' };
  state.scrambleBreakdowns = scrambleBreakdowns;
  state.selectScramblesOnNextClick = true;
  renderBreakdown(scrambleBreakdowns);
  renderAlgGrid(scrambleBreakdowns, showComparisons);
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

function renderBigCubeResult(result) {
  const numberOfSolves = result.number_of_solves;
  const puzzleLabel = result.puzzle === '5x5' ? '5×5' : '4×4';
  elements.resultsSection.classList.remove('is-hidden');
  elements.processedBanner.textContent = `Processed ${numberOfSolves} ${puzzleLabel} scramble${numberOfSolves === 1 ? '' : 's'}.`;
  elements.statSolves.textContent = String(numberOfSolves);
  const comparison = result.comparison || {};
  elements.statTotal.innerHTML = renderMetricSequence([
    comparison.finish_baseline_total_algs,
    result.total_algs,
    comparison.optimal_total_algs,
  ]);
  elements.statAverage.innerHTML = renderMetricSequence([
    comparison.finish_baseline_average_algs,
    result.average_algs,
    comparison.optimal_average_algs,
  ], (value) => Number(value).toFixed(2));
  elements.twoFlipsMetric.classList.add('is-hidden');
  elements.twoTwistsMetric.classList.add('is-hidden');
  elements.floatingSavedMetric.classList.add('is-hidden');
  elements.statFinishSaved.textContent = String(comparison.finish_saved_algs || 0);
  elements.finishSavedLabel.textContent = comparison.finish_capability === 'none'
    ? 'Algsets saved'
    : `${String(comparison.finish_capability).toUpperCase()} saved`;
  elements.finishSavedMetric.classList.toggle(
    'is-hidden',
    !comparison.has_finish_comparison || comparison.finish_saved_algs <= 0,
  );
  elements.statOrientationMissed.textContent = String(comparison.orientation_missed_algs || 0);
  elements.orientationMissedMetric.classList.toggle(
    'is-hidden',
    !comparison.has_orientation_comparison,
  );
  finishRenderingResult(result.distribution, result.breakdowns, Boolean(result.comparison));
}

function renderResult(rawResult) {
  if (!Array.isArray(rawResult) && ['4x4', '5x5'].includes(rawResult?.puzzle)) {
    renderBigCubeResult(rawResult);
    return;
  }
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
  const finishSavedAlgs = comparisonMetadata?.finish_saved_algs
    ?? comparisonMetadata?.ltct_saved_algs
    ?? 0;
  const finishCapability = comparisonMetadata?.finish_capability || 'none';

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
  elements.statFinishSaved.textContent = String(finishSavedAlgs);
  elements.finishSavedLabel.textContent = finishCapability === 'none'
    ? 'Algsets saved'
    : `${finishCapability.toUpperCase()} saved`;
  elements.finishSavedMetric.classList.toggle('is-hidden', finishSavedAlgs <= 0);
  elements.orientationMissedMetric.classList.add('is-hidden');
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
  const puzzle = getPuzzle();
  const bufferMode = getBufferMode();
  const cornerBuffers = selectedCornerBuffers();
  const edgeBuffers = selectedEdgeBuffers();

  if (!cornerBuffers.length) throw new Error('Select at least one corner buffer.');
  if (!cornerBuffers.includes('UFR')) throw new Error('Corner buffer selection must include UFR.');
  if (puzzle !== '4x4') {
    if (!edgeBuffers.length) throw new Error('Select at least one edge buffer.');
    if (!edgeBuffers.includes('UF')) {
      throw new Error(`${puzzle === '5x5' ? 'Midge' : 'Edge'} buffer selection must include UF.`);
    }
  }

  const finishCapability = getFinishCapability();

  const flipWeight = Number(elements.flipWeight.value);
  const twistWeight = Number(elements.twistWeight.value);
  if (puzzle !== '4x4' && (!Number.isFinite(flipWeight) || flipWeight < 1)) {
    throw new Error('2-flip weight must be at least 1.');
  }
  if (!Number.isFinite(twistWeight) || twistWeight < 1) {
    throw new Error('2-twist weight must be at least 1.');
  }
  const terminalWeights = getTerminalWeights();
  for (const [terminalType, weight] of Object.entries(terminalWeights)) {
    if (!Number.isFinite(weight) || weight < 1 || weight > 2) {
      throw new Error(`${terminalType} weight must be from 1 to 2.`);
    }
  }

  const advancedOptions = {
    corner_floating_parity: !elements.cornerFloatingParity.disabled
      && elements.cornerFloatingParity.checked,
    edge_finish_capability: elements.weak2e2eCapabilityOption.classList.contains('is-hidden')
      ? 'none'
      : getWeak2e2eCapability(),
    ltef: !elements.ltef.disabled && elements.ltef.checked,
    terminal_weights: terminalWeights,
  };

  if (puzzle === '4x4') {
    return {
      puzzle,
      scrambles: elements.scrambleInput.value,
      bufferMode,
      dnf: elements.dnf.checked,
      orientedCornerSticker: elements.bigCubeOrientation.value,
      cornerBuffers,
      twistWeight,
      finishCapability,
      wingParityCapability: getWingParityCapability(),
      compareOptimalOrientation: !elements.compareOptimalOrientation.disabled
        && elements.compareOptimalOrientation.checked,
      advancedOptions,
    };
  }

  if (puzzle === '5x5') {
    return {
      puzzle,
      scrambles: elements.scrambleInput.value,
      bufferMode,
      dnf: elements.dnf.checked,
      cornerBuffers,
      midgeBuffers: edgeBuffers,
      flipWeight,
      twistWeight,
      finishCapability,
      wingParityCapability: getWingParityCapability(),
      advancedOptions,
    };
  }

  return {
    puzzle,
    scrambles: elements.scrambleInput.value,
    bufferMode,
    tracingOrientation: elements.tracingOrientation.value.trim(),
    edgeMethod: getEdgeMethod(),
    flipWeight,
    twistWeight,
    finishCapability,
    weak2e2eCapability: elements.weak2e2eCapabilityOption.classList.contains('is-hidden')
      ? 'none'
      : getWeak2e2eCapability(),
    advancedOptions,
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
  const response = await fetch('./examples/testing-10k-scrams.txt?v=dnf-demo-v1');
  if (!response.ok) throw new Error('Could not load bundled example scrambles.');
  const scrambles = (await response.text())
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const randomScrambles = [...scrambles]
    .sort(() => Math.random() - 0.5)
    .slice(0, 100);

  elements.scrambleInput.value = randomScrambles.join('\n');
  elements.dnf.checked = true;
  saveSettings();
  state.selectScramblesOnNextClick = false;
}

function initialize() {
  initializeTheme();
  resetResults();
  elements.bigCubeOrientation.innerHTML = [
    ...BIG_CUBE_ORIENTATION_STICKERS
      .map((sticker) => `<option value="${sticker}">${sticker}</option>`),
    '<option value="optimal">Optimal (check all 24)</option>',
  ].join('');
  restoreSettings();
  syncPills();
  updatePuzzleUI();

  document.querySelectorAll('input[name="puzzle"]').forEach((input) => {
    input.addEventListener('change', updatePuzzleUI);
  });

  document.querySelectorAll('input[name="buffer-mode"]').forEach((input) => {
    input.addEventListener('change', updateBufferModeUI);
  });

  document.querySelectorAll('input[name="edge-method"]').forEach((input) => {
    input.addEventListener('change', updateBufferModeUI);
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

  [
    elements.dnf,
    elements.tracingOrientation,
    elements.compareOptimalOrientation,
    elements.flipWeight,
    elements.twistWeight,
    elements.cornerFloatingParity,
    elements.ltef,
    ...Object.values(elements.terminalWeightInputs),
  ].forEach((input) => {
    input.addEventListener('input', saveSettings);
    input.addEventListener('change', saveSettings);
  });

  elements.bigCubeOrientation.addEventListener('change', () => {
    syncOptimalOrientationComparisonUI();
    saveSettings();
  });

  document.querySelectorAll('input[name="finish-capability"]').forEach((input) => {
    input.addEventListener('change', () => {
      syncTerminalWeightVisibility();
      saveSettings();
    });
  });

  document.querySelectorAll('input[name="weak-2e2e-capability"]').forEach((input) => {
    input.addEventListener('change', () => {
      syncTerminalWeightVisibility();
      saveSettings();
    });
  });

  [elements.cornerFloatingParity, elements.ltef].forEach((input) => {
    input.addEventListener('change', syncTerminalWeightVisibility);
  });

  document.querySelectorAll('input[name="wing-parity-capability"]').forEach((input) => {
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
