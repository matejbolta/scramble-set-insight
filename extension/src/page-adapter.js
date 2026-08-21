(function (global) {
  'use strict';

  const CONTENT_SOURCE = 'ssi-cstimer-extension';
  const PAGE_SOURCE = 'ssi-cstimer-page';
  const MODULE_ID = 'ssiAlgComment';
  const TOOL_ID = 'ssialgcount';
  const UNSUPPORTED_SCRAMBLE_MESSAGE = 'Switch to 3\u00d73\nscramble type';
  const SUPPORTED_3X3_SCRAMBLE_TYPES = new Set([
    // WCA: 3x3x3, 3x3 bld, 3x3 fm, and 3x3 oh.
    '333', '333ni', '333fm', '333oh',
    // 3x3x3.
    '333o', '333noob', 'edges', 'corners', 'nocache_333bldspec',
    'nocache_333patspec', '333ft', '333custom',
    // 3x3x3 CFOP.
    'pll', 'oll', 'lsll2', 'll', 'zbll', 'coll', 'cll', 'ell', '2gll',
    'zzll', 'zbls', 'eols', 'wvls', 'vls', 'f2l', 'eoline', 'eocross',
    'easyc', 'easyxc',
    // 3x3x3 Roux.
    'sbrx', 'cmll', 'lse', 'lsemu',
    // 3x3x3 Mehta.
    'mt3qb', 'mteole', 'mttdr', 'mt6cp', 'mtcdrll', 'mtl5ep', 'ttll',
    // 3x3x3 subsets.
    '2gen', '2genl', 'roux', '3gen_F', '3gen_L', 'RrU', '333drud',
    'half', 'lsll',
  ]);
  const SUPPORTED_MOVE_RE = /^[UDRLFB](?:w)?(?:2|')?$/;
  const CORNER_BUFFERS = ['UFR', 'UFL', 'UBR', 'UBL', 'RDF', 'FDL'];
  const EDGE_BUFFERS = ['UF', 'UR', 'UB', 'UL', 'FR', 'FL', 'DF', 'DB', 'DR', 'DL'];
  const commentFormatApi = typeof module !== 'undefined' && module.exports
    ? require('./comment-format')
    : global.SsiCommentFormat;

  function finiteAtLeastOne(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
  }

  function normalizeFinishCapability(value) {
    if (value === true) return 'ltct';
    return ['none', 'ltct', 't2c'].includes(value) ? value : 'none';
  }

  function normalizeSelectedBuffers(value, allowed, required) {
    if (!Array.isArray(value)) return [...required];
    return allowed.filter((buffer) => value.includes(buffer));
  }

  function normalizeSettings(value) {
    const raw = value && typeof value === 'object' ? value : {};
    const bufferMode = ['standard', 'full', 'partial'].includes(raw.bufferMode)
      ? raw.bufferMode
      : 'standard';
    let cornerBuffers = ['UFR'];
    let edgeBuffers = ['UF'];

    if (bufferMode === 'full') {
      cornerBuffers = [...CORNER_BUFFERS];
      edgeBuffers = [...EDGE_BUFFERS];
    } else if (bufferMode === 'partial') {
      cornerBuffers = normalizeSelectedBuffers(raw.cornerBuffers, CORNER_BUFFERS, ['UFR']);
      edgeBuffers = normalizeSelectedBuffers(raw.edgeBuffers, EDGE_BUFFERS, ['UF']);
      if (!cornerBuffers.includes('UFR') || !edgeBuffers.includes('UF')) {
        throw new Error('Partial floating must include UFR and UF.');
      }
    }

    const finishCapability = normalizeFinishCapability(
      raw.finishCapability === undefined ? raw.ltct : raw.finishCapability,
    );
    if (finishCapability === 't2c' && bufferMode !== 'full') {
      throw new Error('T2C requires full floating.');
    }
    const writeComment = Boolean(raw.writeComment);
    const allowComparisons = commentFormatApi.comparisonsAvailable(bufferMode, finishCapability);
    return {
      bufferMode,
      cornerBuffers,
      edgeBuffers,
      edgeMethod: raw.edgeMethod === 'weakswap' ? 'weakswap' : 'pseudoswap',
      tracingOrientation: typeof raw.tracingOrientation === 'string'
        ? raw.tracingOrientation.trim().slice(0, 8)
        : '',
      finishCapability,
      flipWeight: finiteAtLeastOne(raw.flipWeight, 1),
      twistWeight: finiteAtLeastOne(raw.twistWeight, 1),
      commentTemplate: commentFormatApi.normalizeTemplate(
        raw.commentTemplate === undefined ? raw.commentFormat : raw.commentTemplate,
        allowComparisons,
      ),
      commentFinish: finishCapability !== 'none' && Boolean(
        raw.commentFinish === undefined ? raw.commentLtct : raw.commentFinish,
      ),
      commentArrow: commentFormatApi.normalizeArrow(raw.commentArrow),
      writeComment,
    };
  }

  function normalizeConfigStore(value) {
    if (!value || typeof value !== 'object') {
      return { version: 3, enabled: true, sessions: {} };
    }
    const sessions = value.sessions && typeof value.sessions === 'object' ? value.sessions : {};
    return { version: 3, enabled: value.enabled !== false, sessions };
  }

  function parseSessionData(kernel) {
    try {
      const parsed = JSON.parse(kernel.getProp('sessionData') || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function getCurrentSessionContext(kernel) {
    const id = String(kernel.getProp('session'));
    const sessionData = parseSessionData(kernel);
    const record = sessionData[id] && typeof sessionData[id] === 'object' ? sessionData[id] : {};
    const nameRaw = record.name == null ? id : String(record.name);
    const scrambleType = record.opt && typeof record.opt.scrType === 'string'
      ? record.opt.scrType
      : String(kernel.getProp('scrType') || '');
    return { id, nameRaw, scrambleType };
  }

  function getMatchingSessionConfig(configStore, context) {
    const stored = normalizeConfigStore(configStore).sessions[context.id];
    if (!stored) return null;
    if (String(stored.sessionName) !== context.nameRaw) return null;
    return normalizeSettings(stored.settings);
  }

  function rounded(value) {
    return Number(Number(value).toFixed(5));
  }

  function normalizeScrambleText(scramble) {
    return String(scramble || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .trim();
  }

  function isSupported3x3ScrambleType(scrambleType) {
    return SUPPORTED_3X3_SCRAMBLE_TYPES.has(String(scrambleType || ''));
  }

  function isSupportedScrambleNotation(scramble) {
    const normalized = normalizeScrambleText(scramble);
    if (!normalized) return false;
    return normalized.split(/\s+/).every((move) => SUPPORTED_MOVE_RE.test(move));
  }

  function calculateComment(engine, scramble, settings) {
    const normalized = normalizeSettings(settings);
    const normalizedScramble = normalizeScrambleText(scramble);
    if (!isSupportedScrambleNotation(normalizedScramble)) {
      throw new Error(UNSUPPORTED_SCRAMBLE_MESSAGE);
    }
    const runAnalysis = function (cornerBuffers, edgeBuffers, finishCapability) {
      return engine.algCounterMain(
        normalizedScramble,
        normalized.tracingOrientation,
        normalized.edgeMethod,
        normalized.flipWeight,
        normalized.twistWeight,
        finishCapability,
        true,
        cornerBuffers,
        edgeBuffers,
      );
    };
    const result = runAnalysis(
      normalized.cornerBuffers,
      normalized.edgeBuffers,
      normalized.finishCapability,
    );

    if (!result || result[0] < 1 || !result[9] || !result[9][0]) {
      throw new Error('No supported 3x3 scramble was found.');
    }

    const breakdown = result[9][0];
    const hasFloatingComparison = normalized.bufferMode !== 'standard';
    const hasFinishComparison = normalized.finishCapability !== 'none';
    let comparison = null;

    if (hasFloatingComparison || hasFinishComparison) {
      const baselineResult = runAnalysis(['UFR'], ['UF'], 'none');
      const baselineBreakdown = baselineResult && baselineResult[9] && baselineResult[9][0];
      if (!baselineBreakdown) throw new Error('Comparison metadata is unavailable.');

      comparison = {
        total_algs: rounded(baselineBreakdown.total_algs),
        corner_algs: rounded(baselineBreakdown.corner_algs),
        edge_algs: baselineBreakdown.edge_algs,
      };
    }

    return commentFormatApi.formatCommentBreakdown(
      breakdown,
      comparison,
      normalized.commentTemplate,
      normalized.commentFinish,
      normalized.commentArrow,
    );
  }

  function findSolveIndex(stats, solve) {
    const length = Number(stats.getTimesStatsTable().timesLen) || 0;
    for (let index = length - 1; index >= Math.max(0, length - 5); index -= 1) {
      const candidate = stats.timesAt(index);
      if (candidate === solve) return index;
      if (candidate && solve && candidate[1] === solve[1] && candidate[3] === solve[3]) return index;
    }
    return -1;
  }

  function markRenderedSolveAsCommented(documentRef, solveIndex) {
    if (!documentRef || typeof documentRef.querySelectorAll !== 'function') return;
    const expected = String(solveIndex + 1);
    const cells = documentRef.querySelectorAll('#stats table.table td.times:first-child');
    for (const cell of cells) {
      if (cell.textContent.replace('*', '').trim() !== expected) continue;
      cell.textContent = `*${expected}`;
      return;
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderAlgcountTool(toolHost, state) {
    if (!toolHost) return 0;
    const algCount = state && state.algCount;
    let content;
    if (algCount) {
      content = [
        '<div style="line-height:1.2;font-variant-numeric:tabular-nums;overflow-wrap:anywhere;">',
        escapeHtml(algCount),
        '</div>',
      ].join('');
    } else if (state && state.unsupported) {
      content = [
        '<div style="max-width:17em;font-size:.82em;font-weight:600;line-height:1.4;opacity:.74;">',
        escapeHtml(UNSUPPORTED_SCRAMBLE_MESSAGE).replace(/\n/g, '<br>'),
        '</div>',
      ].join('');
    } else {
      content = '<div style="max-width:16em;font-size:.82em;line-height:1.4;opacity:.68;">No solves in this session yet.</div>';
    }
    const html = [
      '<div class="ssi-cstimer-algcount-tool" ',
      'style="display:flex;align-items:center;justify-content:center;flex-direction:column;',
      'padding:.45em .25em;text-align:center;color:inherit;">',
      content,
      '</div>',
    ].join('');
    if (typeof toolHost.empty === 'function' && typeof toolHost.append === 'function') {
      toolHost.empty().append(html);
      return 1;
    }
    if ('innerHTML' in toolHost) {
      toolHost.innerHTML = html;
      return 1;
    }
    return 0;
  }

  function findSelectedAlgcountToolHost(documentRef) {
    if (!documentRef || typeof documentRef.querySelector !== 'function') return undefined;
    const toolsRoot = documentRef.querySelector('#toolsDiv');
    if (!toolsRoot || typeof toolsRoot.querySelectorAll !== 'function') return undefined;
    for (const slot of toolsRoot.querySelectorAll(':scope > div')) {
      const primarySelect = slot.querySelector('select');
      if (!primarySelect || primarySelect.value !== TOOL_ID) continue;
      return slot.firstElementChild || null;
    }
    return null;
  }

  function createAdapter(options) {
    const { kernel, stats, engine } = options;
    const toolsApi = options.tools || null;
    const documentRef = options.documentRef || null;
    const notify = typeof options.notify === 'function' ? options.notify : function () {};
    let configStore = normalizeConfigStore(options.configStore);
    let latestDisplay = null;
    let toolHost = null;

    function clearTool() {
      latestDisplay = null;
      if (!toolHost) return 0;
      if (typeof toolHost.empty === 'function') {
        toolHost.empty();
        return 1;
      }
      if ('innerHTML' in toolHost) {
        toolHost.innerHTML = '';
        return 1;
      }
      return 0;
    }

    function syncToolHostFromSelection() {
      const selectedHost = findSelectedAlgcountToolHost(documentRef);
      if (selectedHost !== undefined) toolHost = selectedHost;
      return toolHost;
    }

    function refreshTool() {
      return renderAlgcountTool(toolHost, {
        algCount: latestDisplay && latestDisplay.algCount,
        unsupported: Boolean(latestDisplay && latestDisplay.unsupported),
      });
    }

    function showUnsupportedScramble(context) {
      latestDisplay = { unsupported: true };
      const rendered = refreshTool();
      notify({
        type: 'UNSUPPORTED_SCRAMBLE',
        message: UNSUPPORTED_SCRAMBLE_MESSAGE,
        rendered,
        session: context,
      });
      return rendered;
    }

    function currentSettings() {
      return getMatchingSessionConfig(configStore, getCurrentSessionContext(kernel))
        || normalizeSettings({});
    }

    function analyzeLatestForTool(useNativeCallbackHost = false) {
      if (!configStore.enabled) return clearTool();
      if (!useNativeCallbackHost && !syncToolHostFromSelection()) return 0;
      if (!toolHost) return 0;
      const length = Number(stats.getTimesStatsTable().timesLen) || 0;
      const solve = length > 0 ? stats.timesAt(length - 1) : null;
      if (!solve) {
        latestDisplay = null;
        return refreshTool();
      }
      const context = getCurrentSessionContext(kernel);
      if (!isSupported3x3ScrambleType(context.scrambleType)) {
        return showUnsupportedScramble(context);
      }
      try {
        latestDisplay = {
          algCount: calculateComment(engine, solve[1], currentSettings()),
        };
      } catch {
        return showUnsupportedScramble(context);
      }
      return refreshTool();
    }

    function setConfigStore(value) {
      configStore = normalizeConfigStore(value);
      if (!configStore.enabled) return clearTool();
      analyzeLatestForTool();
      return 1;
    }

    if (toolsApi && typeof toolsApi.regTool === 'function') {
      toolsApi.regTool(TOOL_ID, 'BLD Algcount', function (host) {
        toolHost = host || null;
        if (toolHost && configStore.enabled) analyzeLatestForTool(true);
        else clearTool();
      });
      setTimeout(analyzeLatestForTool, 0);
      setTimeout(analyzeLatestForTool, 50);
    }

    async function handleSolve(_signal, solve) {
      if (!configStore.enabled) {
        return { status: 'ignored', reason: 'extension-disabled' };
      }
      const context = getCurrentSessionContext(kernel);
      const settings = currentSettings();
      const showInTool = Boolean(toolHost);
      if (!settings.writeComment && !showInTool) {
        return { status: 'ignored', reason: 'idle' };
      }

      const solveIndex = findSolveIndex(stats, solve);
      if (solveIndex < 0) {
        notify({ type: 'ERROR', message: 'Could not locate the new solve in csTimer.' });
        return { status: 'error', reason: 'solve-not-found' };
      }

      const storedSolve = stats.timesAt(solveIndex);
      if (!isSupported3x3ScrambleType(context.scrambleType)) {
        showUnsupportedScramble(context);
        return { status: 'ignored', reason: 'unsupported-scramble' };
      }
      let algCount;
      try {
        algCount = calculateComment(engine, storedSolve[1], settings);
      } catch {
        showUnsupportedScramble(context);
        return { status: 'ignored', reason: 'unsupported-scramble' };
      }

      if (showInTool) {
        latestDisplay = { algCount };
        const rendered = refreshTool();
        notify({ type: 'DISPLAY_UPDATED', algCount, rendered, session: context });
      }

      if (!settings.writeComment) {
        return { status: 'display-ready', algCount, solveIndex };
      }

      const originalComment = String(storedSolve[2] || '');
      if (originalComment.trim()) {
        notify({ type: 'COMMENT_SKIPPED', reason: 'comment-not-empty', session: context });
        return showInTool
          ? { status: 'display-ready', algCount, solveIndex, reason: 'comment-not-empty' }
          : { status: 'ignored', reason: 'comment-not-empty' };
      }

      storedSolve[2] = algCount;
      try {
        await Promise.resolve(stats.getSessionManager().save(solveIndex));
        markRenderedSolveAsCommented(documentRef, solveIndex);
        notify({ type: 'COMMENT_WRITTEN', comment: algCount, solveIndex, session: context });
        return { status: 'written', comment: algCount, algCount, solveIndex };
      } catch (error) {
        storedSolve[2] = originalComment;
        notify({
          type: 'ERROR',
          message: `Could not save the alg count: ${error instanceof Error ? error.message : String(error)}`,
          session: context,
        });
        return { status: 'error', reason: 'save-failed' };
      }
    }

    kernel.regListener(MODULE_ID, 'timestd', handleSolve);
    kernel.regListener(MODULE_ID, 'session', function () {
      if (!configStore.enabled) {
        clearTool();
        return;
      }
      latestDisplay = null;
      syncToolHostFromSelection();
      refreshTool();
      setTimeout(analyzeLatestForTool, 0);
      setTimeout(analyzeLatestForTool, 50);
      notify({ type: 'SESSION_CHANGED', session: getCurrentSessionContext(kernel) });
    });

    return {
      getContext: function () {
        return getCurrentSessionContext(kernel);
      },
      handleSolve,
      setConfigStore,
    };
  }

  function postToExtension(type, payload) {
    global.postMessage({ source: PAGE_SOURCE, type, payload }, '*');
  }

  function installPageBridge() {
    if (!global || typeof global.addEventListener !== 'function') return;
    let configStore = normalizeConfigStore();
    let adapter = null;
    let attempts = 0;
    let configReceived = false;
    let installTimer = null;

    function publishContext(requestId) {
      if (!adapter) {
        postToExtension('CONTEXT_RESPONSE', {
          requestId,
          ready: false,
          disabled: configReceived && !configStore.enabled,
          error: configReceived && !configStore.enabled
            ? 'Extension disabled.'
            : 'Waiting for csTimer to finish loading.',
        });
        return;
      }
      postToExtension('CONTEXT_RESPONSE', {
        requestId,
        ready: true,
        context: adapter.getContext(),
      });
    }

    global.addEventListener('message', function (event) {
      if (event.source !== global) return;
      const message = event.data;
      if (!message || message.source !== CONTENT_SOURCE) return;

      if (message.type === 'CONFIG_SYNC') {
        configStore = normalizeConfigStore(message.payload);
        configReceived = true;
        if (adapter) {
          adapter.setConfigStore(configStore);
        } else if (configStore.enabled) {
          tryInstall();
        }
      } else if (message.type === 'CONTEXT_REQUEST') {
        publishContext(message.requestId);
      }
    });

    function tryInstall() {
      if (adapter || installTimer != null || !configReceived || !configStore.enabled) return;
      if (global.kernel && global.stats && global.tools
          && typeof global.tools.regTool === 'function' && global.SsiCore) {
        adapter = createAdapter({
          kernel: global.kernel,
          stats: global.stats,
          tools: global.tools,
          engine: global.SsiCore,
          documentRef: global.document,
          configStore,
          notify: function (message) {
            postToExtension(message.type, message);
          },
        });
        postToExtension('BRIDGE_READY', { context: adapter.getContext() });
        return;
      }

      attempts += 1;
      if (attempts < 120) {
        installTimer = global.setTimeout(function () {
          installTimer = null;
          tryInstall();
        }, 250);
      } else {
        postToExtension('ERROR', { message: 'csTimer did not expose its statistics interface.' });
      }
    }

    postToExtension('BRIDGE_LOADING', {});
  }

  const api = {
    calculateComment,
    createAdapter,
    formatAlgCount: commentFormatApi.formatAlgCount,
    formatCommentBreakdown: commentFormatApi.formatCommentBreakdown,
    findSelectedAlgcountToolHost,
    getCurrentSessionContext,
    getMatchingSessionConfig,
    isSupported3x3ScrambleType,
    isSupportedScrambleNotation,
    normalizeConfigStore,
    normalizeSettings,
    renderAlgcountTool,
    UNSUPPORTED_SCRAMBLE_MESSAGE,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.SsiCsTimerAdapter = api;
    installPageBridge();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
