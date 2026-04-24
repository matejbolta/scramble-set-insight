const worker = new Worker('./worker.js');
let requestId = 0;
let lastSummary = '';

const elements = {
  scrambleInput: document.getElementById('scramble-input'),
  tracingOrientation: document.getElementById('tracing-orientation'),
  edgeMethod: document.getElementById('edge-method'),
  flipWeight: document.getElementById('flip-weight'),
  twistWeight: document.getElementById('twist-weight'),
  ltct: document.getElementById('ltct'),
  dnf: document.getElementById('dnf'),
  cornerBuffers: document.getElementById('corner-buffers'),
  edgeBuffers: document.getElementById('edge-buffers'),
  analyzeButton: document.getElementById('analyze-button'),
  loadExampleButton: document.getElementById('load-example-button'),
  clearButton: document.getElementById('clear-button'),
  copySummaryButton: document.getElementById('copy-summary-button'),
  runStatus: document.getElementById('run-status'),
  parsedCount: document.getElementById('parsed-count'),
  parseHint: document.getElementById('parse-hint'),
  statSolves: document.getElementById('stat-solves'),
  statAverage: document.getElementById('stat-average'),
  statTotal: document.getElementById('stat-total'),
  statTwoFlips: document.getElementById('stat-two-flips'),
  statTwoTwists: document.getElementById('stat-two-twists'),
  statRange: document.getElementById('stat-range'),
  distributionChart: document.getElementById('distribution-chart'),
  distributionTable: document.getElementById('distribution-table'),
  algList: document.getElementById('alg-list'),
  tableRowTemplate: document.getElementById('table-row-template'),
};

function setStatus(label, mode) {
  elements.runStatus.textContent = label;
  elements.runStatus.className = `status-chip status-chip--${mode}`;
}

function getSelectedValues(select) {
  return Array.from(select.selectedOptions).map((option) => option.value);
}

function updateParsedCount() {
  const count = window.SsiCore.extractScrambleList(elements.scrambleInput.value, elements.dnf.checked).length;
  elements.parsedCount.textContent = `${count} scramble${count === 1 ? '' : 's'} parsed`;
  elements.parseHint.textContent = count
    ? `Parser found ${count} valid scramble${count === 1 ? '' : 's'}.`
    : 'Paste csTimer ScrambleGenerator output or Session Statistics here.';
}

function resetResults() {
  elements.statSolves.textContent = '0';
  elements.statAverage.textContent = '0';
  elements.statTotal.textContent = '0';
  elements.statTwoFlips.textContent = '0';
  elements.statTwoTwists.textContent = '0';
  elements.statRange.textContent = '0-0';
  elements.distributionChart.className = 'distribution-chart empty-state';
  elements.distributionChart.textContent = 'Run an analysis to see the distribution.';
  elements.distributionTable.innerHTML = '<div class="empty-state">No breakdown yet.</div>';
  elements.algList.textContent = '[]';
  elements.copySummaryButton.disabled = true;
  lastSummary = '';
}

function buildSummary(result, settings) {
  return [
    'Scramble Set Insight',
    `Edge method: ${settings.edgeMethod}`,
    `Tracing orientation: ${settings.tracingOrientation || '(identity)'}`,
    `Corner buffers: ${settings.cornerBuffers.join(', ')}`,
    `Edge buffers: ${settings.edgeBuffers.join(', ')}`,
    '',
    `Scrambles: ${result.numberOfSolves}`,
    `Average algs: ${result.average}`,
    `Total algs: ${result.total}`,
    `Floating 2-flips: ${result.totalTwoFlips}`,
    `Floating 2-twists: ${result.totalTwoTwists}`,
  ].join('\n');
}

function renderDistributionChart(distribution) {
  const entries = Object.entries(distribution).map(([key, value]) => ({ key, value }));
  if (!entries.length) {
    elements.distributionChart.className = 'distribution-chart empty-state';
    elements.distributionChart.textContent = 'No distribution data.';
    return;
  }

  const width = 780;
  const height = 280;
  const paddingLeft = 44;
  const paddingBottom = 36;
  const paddingTop = 18;
  const gap = 8;
  const plotWidth = width - paddingLeft - 14;
  const plotHeight = height - paddingTop - paddingBottom;
  const maxValue = Math.max(...entries.map((entry) => entry.value));
  const barWidth = Math.max(18, (plotWidth - gap * (entries.length - 1)) / entries.length);

  const bars = entries.map((entry, index) => {
    const barHeight = maxValue === 0 ? 0 : (entry.value / maxValue) * plotHeight;
    const x = paddingLeft + index * (barWidth + gap);
    const y = paddingTop + plotHeight - barHeight;
    return `
      <g>
        <rect class="chart-bar" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="8"></rect>
        <text class="chart-axis-label" x="${x + barWidth / 2}" y="${height - 10}" text-anchor="middle">${entry.key}</text>
        <text class="chart-value-label" x="${x + barWidth / 2}" y="${Math.max(y - 6, 12)}" text-anchor="middle">${entry.value}</text>
      </g>`;
  }).join('');

  elements.distributionChart.className = 'distribution-chart';
  elements.distributionChart.innerHTML = `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Distribution chart">
      <defs>
        <linearGradient id="barGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#0f5bd8"></stop>
          <stop offset="100%" stop-color="#c45416"></stop>
        </linearGradient>
      </defs>
      <line x1="${paddingLeft}" y1="${paddingTop + plotHeight}" x2="${width - 8}" y2="${paddingTop + plotHeight}" stroke="rgba(29,36,48,0.18)"></line>
      ${bars}
    </svg>`;
}

function renderDistributionTable(distribution) {
  const entries = Object.entries(distribution);
  if (!entries.length) {
    elements.distributionTable.innerHTML = '<div class="empty-state">No breakdown yet.</div>';
    return;
  }
  elements.distributionTable.innerHTML = '';
  for (const [key, value] of entries) {
    const row = elements.tableRowTemplate.content.firstElementChild.cloneNode(true);
    row.querySelector('.distribution-row__key').textContent = key;
    row.querySelector('.distribution-row__value').textContent = value;
    elements.distributionTable.appendChild(row);
  }
}

function renderResult(rawResult, settings) {
  const [numberOfSolves, distribution, average, total, totalTwoFlips, totalTwoTwists, algCountList] = rawResult;
  const keys = Object.keys(distribution).map(Number);
  const range = keys.length ? `${Math.min(...keys)}-${Math.max(...keys)}` : '0-0';

  elements.statSolves.textContent = String(numberOfSolves);
  elements.statAverage.textContent = String(average);
  elements.statTotal.textContent = String(total);
  elements.statTwoFlips.textContent = String(totalTwoFlips);
  elements.statTwoTwists.textContent = String(totalTwoTwists);
  elements.statRange.textContent = range;
  renderDistributionChart(distribution);
  renderDistributionTable(distribution);
  elements.algList.textContent = JSON.stringify(algCountList);

  lastSummary = buildSummary({ numberOfSolves, average, total, totalTwoFlips, totalTwoTwists }, settings);
  elements.copySummaryButton.disabled = false;
}

function collectSettings() {
  const cornerBuffers = getSelectedValues(elements.cornerBuffers);
  const edgeBuffers = getSelectedValues(elements.edgeBuffers);
  if (!cornerBuffers.length) throw new Error('Select at least one corner buffer.');
  if (!edgeBuffers.length) throw new Error('Select at least one edge buffer.');
  return {
    scrambles: elements.scrambleInput.value,
    tracingOrientation: elements.tracingOrientation.value.trim(),
    edgeMethod: elements.edgeMethod.value,
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
  updateParsedCount();
  setStatus('Analyzing', 'running');
  elements.analyzeButton.disabled = true;
  const id = ++requestId;

  return new Promise((resolve, reject) => {
    const handleMessage = (event) => {
      if (event.data.id !== id) return;
      worker.removeEventListener('message', handleMessage);
      elements.analyzeButton.disabled = false;
      if (event.data.ok) {
        renderResult(event.data.result, settings);
        setStatus('Analysis complete', 'success');
        resolve();
      } else {
        setStatus('Input error', 'error');
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
  elements.scrambleInput.value = await response.text();
  updateParsedCount();
}

window.SsiCore = window.SsiCore || {};

backendReady();

function backendReady() {
  resetResults();
  updateParsedCount();

  elements.scrambleInput.addEventListener('input', updateParsedCount);
  elements.dnf.addEventListener('change', updateParsedCount);
  elements.clearButton.addEventListener('click', () => {
    elements.scrambleInput.value = '';
    updateParsedCount();
    resetResults();
    setStatus('Idle', 'idle');
  });

  elements.loadExampleButton.addEventListener('click', async () => {
    try {
      setStatus('Loading example', 'running');
      await loadExample();
      setStatus('Example loaded', 'success');
    } catch (error) {
      setStatus('Example failed', 'error');
      elements.parseHint.textContent = error.message;
    }
  });

  elements.analyzeButton.addEventListener('click', async () => {
    try {
      await analyze();
    } catch (error) {
      elements.parseHint.textContent = error.message;
    }
  });

  elements.copySummaryButton.addEventListener('click', async () => {
    if (!lastSummary) return;
    await navigator.clipboard.writeText(lastSummary);
    setStatus('Summary copied', 'success');
  });
}
