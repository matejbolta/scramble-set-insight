const worker = new Worker('./worker.js');
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
  loadExampleButton: document.getElementById('load-example-button'),
  clearButton: document.getElementById('clear-button'),
  processedBanner: document.getElementById('processed-banner'),
  resultsSection: document.getElementById('results-section'),
  statSolves: document.getElementById('stat-solves'),
  statAverage: document.getElementById('stat-average'),
  statTotalLabel: document.getElementById('stat-total-label'),
  statTotal: document.getElementById('stat-total'),
  statCorners: document.getElementById('stat-corners'),
  statEdges: document.getElementById('stat-edges'),
  statTwoFlips: document.getElementById('stat-two-flips'),
  statTwoTwists: document.getElementById('stat-two-twists'),
  setOnlyMetrics: document.querySelectorAll('.metric-card--set-only'),
  singleOnlyMetrics: document.querySelectorAll('.metric-card--single-only'),
  overviewCard: document.getElementById('overview-card'),
  breakdownCard: document.getElementById('breakdown-card'),
  distributionCard: document.getElementById('distribution-card'),
  distributionChart: document.getElementById('distribution-chart'),
  algGrid: document.getElementById('alg-grid'),
  partialBuffers: document.getElementById('partial-buffers'),
  cornerPills: document.getElementById('corner-pills'),
  edgePills: document.getElementById('edge-pills'),
  themeToggle: document.getElementById('theme-toggle'),
};

const state = {
  cornerBuffers: [...LEGACY_CORNER_BUFFERS],
  edgeBuffers: [...LEGACY_EDGE_BUFFERS],
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
  elements.resultsSection.classList.add('is-hidden');
  elements.processedBanner.textContent = '';
  elements.statSolves.textContent = '0';
  elements.statAverage.textContent = '0.00';
  elements.statTotalLabel.textContent = 'Total algs';
  elements.statTotal.textContent = '0';
  elements.statCorners.textContent = '0';
  elements.statEdges.textContent = '0';
  elements.statTwoFlips.textContent = '0';
  elements.statTwoTwists.textContent = '0';
  elements.distributionChart.className = 'distribution-chart empty-state';
  elements.distributionChart.textContent = 'Run an analysis to see the distribution.';
  elements.algGrid.className = 'alg-grid empty-state';
  elements.algGrid.textContent = 'Run an analysis to see per-scramble alg counts.';
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

function renderAlgGrid(scrambleBreakdowns) {
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
        <div class="alg-cell${showIndexes ? '' : ' alg-cell--unindexed'}">
          ${showIndexes ? `<div class="alg-cell__index">${index + 1}</div>` : ''}
          <div class="alg-cell__value">${result.total_algs}</div>
          <div class="alg-cell__split" aria-label="${result.corner_algs} corner algs plus ${result.edge_algs} edge algs">
            <span>${result.corner_algs}</span>
            <span class="alg-cell__plus">+</span>
            <span>${result.edge_algs}</span>
          </div>
        </div>`
    )
    .join('');
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
  const totalCornerAlgs = rawResult[7];
  const totalEdgeAlgs = rawResult[8];
  const scrambleBreakdowns = rawResult[9];
  const isSingleScramble = numberOfSolves === 1;

  elements.resultsSection.classList.remove('is-hidden');
  elements.processedBanner.textContent = `Processed ${numberOfSolves} scramble${numberOfSolves === 1 ? '' : 's'}.`;
  elements.statSolves.textContent = String(numberOfSolves);
  elements.statTotalLabel.textContent = isSingleScramble ? 'Algs' : 'Total algs';
  elements.statTotal.textContent = String(total);
  elements.statCorners.textContent = String(totalCornerAlgs);
  elements.statEdges.textContent = String(totalEdgeAlgs);
  elements.statAverage.textContent = Number(average).toFixed(2);
  elements.statTwoFlips.textContent = String(totalTwoFlips);
  elements.statTwoTwists.textContent = String(totalTwoTwists);
  elements.setOnlyMetrics.forEach((metric) => metric.classList.toggle('is-hidden', isSingleScramble));
  elements.singleOnlyMetrics.forEach((metric) => metric.classList.toggle('is-hidden', !isSingleScramble));
  elements.breakdownCard.classList.toggle('is-hidden', isSingleScramble);
  elements.distributionCard.classList.toggle('is-hidden', isSingleScramble);

  if (!isSingleScramble) renderAlgGrid(scrambleBreakdowns);
  if (!isSingleScramble) renderDistributionChart(distribution);

  requestAnimationFrame(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const preferredScrollTop = window.scrollY + elements.actionRow.getBoundingClientRect().top - 20;
    const lastVisibleResult = isSingleScramble ? elements.overviewCard : elements.distributionCard;
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
  const id = ++requestId;

  return new Promise((resolve, reject) => {
    const handleMessage = (event) => {
      if (event.data.id !== id) return;
      worker.removeEventListener('message', handleMessage);
      elements.analyzeButton.disabled = false;
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

  [elements.dnf, elements.ltct, elements.tracingOrientation, elements.flipWeight, elements.twistWeight].forEach((input) => {
    input.addEventListener('input', saveSettings);
    input.addEventListener('change', saveSettings);
  });

  elements.clearButton.addEventListener('click', () => {
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
