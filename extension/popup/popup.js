(function () {
  'use strict';

  const STORAGE_KEY = 'ssiCsTimerConfig';
  const CORNER_BUFFERS = ['UFR', 'UFL', 'UBR', 'UBL', 'RDF', 'FDL'];
  const EDGE_BUFFERS = ['UF', 'UR', 'UB', 'UL', 'FR', 'FL', 'DF', 'DB', 'DR', 'DL'];
  const REQUIRED_CORNER_BUFFERS = ['UFR'];
  const REQUIRED_EDGE_BUFFERS = ['UF'];
  const commentFormatApi = window.SsiCommentFormat;
  const DEFAULT_SETTINGS = {
    bufferMode: 'standard',
    cornerBuffers: ['UFR'],
    edgeBuffers: ['UF'],
    edgeMethod: 'pseudoswap',
    tracingOrientation: '',
    finishCapability: 'none',
    flipWeight: 1,
    twistWeight: 1,
    commentTemplate: 'baseline_algs',
    commentFinish: false,
    commentArrow: 'ascii',
    writeComment: false,
  };

  const elements = {
    extensionEnabled: document.getElementById('extension-enabled'),
    extensionEnabledText: document.getElementById('extension-enabled-text'),
    form: document.getElementById('settings-form'),
    fieldset: document.getElementById('settings-fieldset'),
    outputsFieldset: document.getElementById('outputs-fieldset'),
    sessionState: document.getElementById('session-state'),
    sessionStateText: document.getElementById('session-state-text'),
    sessionName: document.getElementById('session-name'),
    sessionGuidance: document.getElementById('session-guidance'),
    version: document.getElementById('extension-version'),
    bufferMode: document.getElementById('buffer-mode'),
    edgeMethod: document.getElementById('edge-method'),
    partialBuffers: document.getElementById('partial-buffers'),
    cornerBuffers: document.getElementById('corner-buffers'),
    edgeBuffers: document.getElementById('edge-buffers'),
    orientation: document.getElementById('orientation'),
    finishCapability: document.getElementById('finish-capability'),
    commentFinish: document.getElementById('comment-finish'),
    flipWeight: document.getElementById('flip-weight'),
    twistWeight: document.getElementById('twist-weight'),
    commentFormat: document.getElementById('comment-format'),
    commentFormatHint: document.getElementById('comment-format-hint'),
    commentArrow: document.getElementById('comment-arrow'),
    writeComment: document.getElementById('write-comment'),
    status: document.getElementById('status'),
  };

  let currentContext = null;
  let configStore = { version: 3, enabled: true, sessions: {} };
  let autosaveTimer = null;
  let saveQueue = Promise.resolve();

  function showVersion(version) {
    if (!version) return;
    elements.version.textContent = `v${version}`;
    elements.version.setAttribute('aria-label', `Version ${version}`);
    elements.version.hidden = false;
  }

  async function renderVersion() {
    const runtimeVersion = globalThis.chrome && chrome.runtime && chrome.runtime.getManifest
      ? chrome.runtime.getManifest().version
      : '';
    if (runtimeVersion) {
      showVersion(runtimeVersion);
      return;
    }

    try {
      const response = await fetch('../manifest.json');
      const manifest = await response.json();
      showVersion(manifest.version);
    } catch {
      // Leave the optional badge hidden outside a valid extension/local preview.
    }
  }

  function setStatus(message, kind) {
    elements.status.textContent = message;
    elements.status.className = `status${kind ? ` is-${kind}` : ''}`;
  }

  function setSessionState(state) {
    const labels = { active: 'Connected', disabled: 'Disabled', unavailable: 'Unavailable' };
    elements.sessionState.dataset.state = state;
    elements.sessionStateText.textContent = labels[state] || 'Connecting';
  }

  function setSessionGuidance(message) {
    elements.sessionGuidance.textContent = message || '';
    elements.sessionGuidance.hidden = !message;
  }

  function isExtensionEnabled() {
    return configStore.enabled !== false;
  }

  function renderExtensionState(enabled) {
    elements.extensionEnabled.checked = enabled;
    elements.extensionEnabledText.textContent = enabled ? 'Enabled' : 'Disabled';
    if (enabled) return;
    currentContext = null;
    elements.fieldset.disabled = true;
    elements.outputsFieldset.disabled = true;
    elements.sessionName.textContent = 'Extension disabled';
    setSessionState('disabled');
    setSessionGuidance('');
    setStatus('', '');
  }

  function decodeHtml(value) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = String(value);
    return textarea.value;
  }

  function normalizeBufferSelection(selected, allowed, required) {
    const selectedSet = new Set(Array.isArray(selected) ? selected : required);
    return allowed.filter((buffer) => selectedSet.has(buffer));
  }

  function createBufferOptions(container, options, selected, required) {
    const normalizedSelection = normalizeBufferSelection(selected, options, required);
    container.replaceChildren();
    for (const option of options) {
      const label = document.createElement('label');
      label.className = 'buffer-pill';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = option;
      input.checked = normalizedSelection.includes(option);
      input.disabled = required.includes(option);
      if (input.disabled) label.title = 'Primary buffer (always included)';
      label.append(input, document.createTextNode(option));
      container.appendChild(label);
    }
  }

  function selectedBuffers(container) {
    return [...container.querySelectorAll('input:checked')].map((input) => input.value);
  }

  function normalizeFinishCapability(value) {
    if (value === true) return 'ltct';
    return ['none', 'ltct', 't2c'].includes(value) ? value : 'none';
  }

  function updateModeAvailability() {
    const bufferMode = elements.bufferMode.value;
    elements.partialBuffers.hidden = bufferMode !== 'partial';
    const t2cOption = elements.finishCapability.querySelector('option[value="t2c"]');
    t2cOption.disabled = bufferMode !== 'full';
    if (bufferMode !== 'full' && elements.finishCapability.value === 't2c') {
      elements.finishCapability.value = 'ltct';
    }
  }

  function updateCommentFinishAvailability() {
    const finishEnabled = elements.finishCapability.value !== 'none';
    elements.commentFinish.disabled = !finishEnabled;
    if (!finishEnabled) elements.commentFinish.checked = false;
  }

  function updateCommentFormatOptions(preferredTemplate) {
    const allowComparisons = commentFormatApi.comparisonsAvailable(
      elements.bufferMode.value,
      elements.finishCapability.value,
    );
    elements.commentArrow.disabled = !allowComparisons;
    const normalizedTemplate = commentFormatApi.normalizeTemplate(preferredTemplate, allowComparisons);
    elements.commentFormat.replaceChildren(...commentFormatApi.availableTemplateOptions(allowComparisons)
      .map((option) => {
        const element = document.createElement('option');
        element.value = option.value;
        element.textContent = commentFormatApi.formatTemplateLabel(option, elements.commentArrow.value);
        return element;
      }));
    elements.commentFormat.value = normalizedTemplate;

    const hint = commentFormatApi.comparisonHint(
      elements.bufferMode.value,
      elements.finishCapability.value,
    );
    elements.commentFormatHint.textContent = hint;
    elements.commentFormatHint.hidden = !hint;
    if (hint) {
      elements.commentFormat.setAttribute('aria-describedby', 'comment-format-hint');
    } else {
      elements.commentFormat.removeAttribute('aria-describedby');
    }
  }

  function setForm(settings) {
    const source = settings || {};
    const migratedFinishCapability = source.finishCapability === undefined
      ? (source.ltct ? 'ltct' : 'none')
      : source.finishCapability;
    const migratedCommentFinish = source.commentFinish === undefined
      ? source.commentLtct
      : source.commentFinish;
    const value = {
      ...DEFAULT_SETTINGS,
      ...source,
      finishCapability: normalizeFinishCapability(migratedFinishCapability),
      commentFinish: Boolean(migratedCommentFinish),
    };
    const preferredTemplate = source.commentTemplate === undefined
      ? source.commentFormat
      : source.commentTemplate;
    elements.bufferMode.value = value.bufferMode;
    elements.edgeMethod.value = value.edgeMethod;
    elements.orientation.value = value.tracingOrientation || '';
    elements.finishCapability.value = value.finishCapability;
    elements.commentFinish.checked = value.commentFinish;
    elements.commentArrow.value = commentFormatApi.normalizeArrow(value.commentArrow);
    elements.writeComment.checked = Boolean(value.writeComment);
    elements.flipWeight.value = String(value.flipWeight ?? 1);
    elements.twistWeight.value = String(value.twistWeight ?? 1);
    createBufferOptions(
      elements.cornerBuffers,
      CORNER_BUFFERS,
      value.cornerBuffers,
      REQUIRED_CORNER_BUFFERS,
    );
    createBufferOptions(
      elements.edgeBuffers,
      EDGE_BUFFERS,
      value.edgeBuffers,
      REQUIRED_EDGE_BUFFERS,
    );
    updateModeAvailability();
    updateCommentFinishAvailability();
    updateCommentFormatOptions(preferredTemplate ?? DEFAULT_SETTINGS.commentTemplate);
  }

  function collectSettings() {
    const bufferMode = elements.bufferMode.value;
    let cornerBuffers = ['UFR'];
    let edgeBuffers = ['UF'];
    if (bufferMode === 'full') {
      cornerBuffers = [...CORNER_BUFFERS];
      edgeBuffers = [...EDGE_BUFFERS];
    } else if (bufferMode === 'partial') {
      cornerBuffers = normalizeBufferSelection(
        selectedBuffers(elements.cornerBuffers),
        CORNER_BUFFERS,
        REQUIRED_CORNER_BUFFERS,
      );
      edgeBuffers = normalizeBufferSelection(
        selectedBuffers(elements.edgeBuffers),
        EDGE_BUFFERS,
        REQUIRED_EDGE_BUFFERS,
      );
      if (!cornerBuffers.includes('UFR') || !edgeBuffers.includes('UF')) {
        throw new Error('Partial floating must include UFR and UF.');
      }
    }

    const flipWeight = Number(elements.flipWeight.value);
    const twistWeight = Number(elements.twistWeight.value);
    if (!Number.isFinite(flipWeight) || flipWeight < 1 || !Number.isFinite(twistWeight) || twistWeight < 1) {
      throw new Error('Weights must be at least 1.');
    }
    const finishCapability = normalizeFinishCapability(elements.finishCapability.value);
    if (finishCapability === 't2c' && bufferMode !== 'full') {
      throw new Error('T2C requires full floating.');
    }

    return {
      bufferMode,
      cornerBuffers,
      edgeBuffers,
      edgeMethod: elements.edgeMethod.value,
      tracingOrientation: elements.orientation.value.trim(),
      finishCapability,
      flipWeight,
      twistWeight,
      commentTemplate: elements.commentFormat.value,
      commentFinish: elements.commentFinish.checked,
      commentArrow: elements.commentArrow.value,
      writeComment: elements.writeComment.checked,
    };
  }

  async function getActiveTabContext() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.id == null) throw new Error('Open csTimer in the active tab first.');

    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CONTEXT' });
      if (!response || !response.ok) throw new Error(response && response.error ? response.error : 'No response from csTimer.');
      if (!response.ready) throw new Error(response.error || 'csTimer is still loading.');
      return response.context;
    } catch (error) {
      throw new Error('Open or reload a csTimer tab, then reopen this popup.');
    }
  }

  async function initialize() {
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEY);
      configStore = stored[STORAGE_KEY] || { version: 3, enabled: true, sessions: {} };
      const enabled = isExtensionEnabled();
      renderExtensionState(enabled);
      if (!enabled) return;
      elements.fieldset.disabled = true;
      elements.outputsFieldset.disabled = true;
      elements.sessionName.textContent = 'Connecting…';
      setSessionState('connecting');
      currentContext = await getActiveTabContext();
      const saved = configStore.sessions && configStore.sessions[currentContext.id];
      const isSameSession = saved && String(saved.sessionName) === currentContext.nameRaw;

      elements.sessionName.textContent = decodeHtml(currentContext.nameRaw);
      setSessionGuidance('');
      const settings = isSameSession ? saved.settings : DEFAULT_SETTINGS;
      setForm(settings);
      elements.fieldset.disabled = false;
      elements.outputsFieldset.disabled = false;

      if (saved && !isSameSession) {
        setSessionState('active');
        setStatus('Using default settings for this session.', '');
      } else {
        setSessionState('active');
        setStatus('', '');
      }
    } catch (error) {
      elements.sessionName.textContent = 'csTimer not connected';
      setSessionState('unavailable');
      setSessionGuidance('Open or reload a csTimer tab, then reopen this popup.');
      setStatus('', '');
    }
  }

  elements.bufferMode.addEventListener('change', function () {
    updateModeAvailability();
    updateCommentFinishAvailability();
    updateCommentFormatOptions(elements.commentFormat.value);
  });

  elements.finishCapability.addEventListener('change', function () {
    updateCommentFinishAvailability();
    updateCommentFormatOptions(elements.commentFormat.value);
  });

  elements.commentArrow.addEventListener('change', function () {
    updateCommentFormatOptions(elements.commentFormat.value);
  });

  async function saveCurrentSettings() {
    if (!currentContext) return;

    try {
      const settings = collectSettings();
      configStore = {
        version: 3,
        enabled: isExtensionEnabled(),
        sessions: {
          ...(configStore.sessions || {}),
          [currentContext.id]: {
            sessionName: currentContext.nameRaw,
            settings,
          },
        },
      };
      await chrome.storage.local.set({ [STORAGE_KEY]: configStore });
      setSessionState('active');
      setStatus('Saved.', 'success');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  elements.extensionEnabled.addEventListener('change', async function () {
    const enabled = elements.extensionEnabled.checked;
    elements.extensionEnabled.disabled = true;
    try {
      configStore = {
        version: 3,
        enabled,
        sessions: configStore.sessions || {},
      };
      await chrome.storage.local.set({ [STORAGE_KEY]: configStore });
      renderExtensionState(enabled);
      if (enabled) await initialize();
    } catch (error) {
      configStore.enabled = !enabled;
      renderExtensionState(!enabled);
      setStatus(error.message, 'error');
    } finally {
      elements.extensionEnabled.disabled = false;
    }
  });

  function scheduleAutosave(delay) {
    if (!currentContext) return;
    if (autosaveTimer != null) clearTimeout(autosaveTimer);
    autosaveTimer = null;
    setStatus('Saving…', '');
    if (delay <= 0) {
      saveQueue = saveQueue.then(saveCurrentSettings, saveCurrentSettings);
      return;
    }
    autosaveTimer = setTimeout(function () {
      autosaveTimer = null;
      saveQueue = saveQueue.then(saveCurrentSettings, saveCurrentSettings);
    }, delay);
  }

  elements.form.addEventListener('input', function (event) {
    if (!event.target.matches('input[type="text"], input[type="number"]')) return;
    scheduleAutosave(300);
  });

  elements.form.addEventListener('change', function (event) {
    if (!event.target.matches('input, select')) return;
    scheduleAutosave(0);
  });

  elements.form.addEventListener('submit', function (event) {
    event.preventDefault();
  });

  renderVersion();
  initialize();
})();
