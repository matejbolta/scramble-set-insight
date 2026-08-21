'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const extensionRoot = path.resolve(__dirname, '..');
const ssiRoot = process.env.SSI_REPO_ROOT
  ? path.resolve(process.env.SSI_REPO_ROOT)
  : path.resolve(extensionRoot, '..');
const engineFiles = [
  'buffer-selection.js',
  'wide-move-translator.js',
  'scrambling.js',
  'corner-tracing.js',
  'edge-common.js',
  'cycle-model.js',
  'cycle-residue.js',
  'cycle-residue-planner.js',
  'dlin-planner.js',
  'weakswap-tracing.js',
  'pseudoswap-tracing.js',
  'finalizing.js',
  'ssi-core.js',
];

for (const file of engineFiles) {
  const source = path.join(ssiRoot, 'web', file);
  const vendor = path.join(extensionRoot, 'vendor', 'ssi-core', file);
  assert.equal(fs.lstatSync(vendor).isFile(), true, `${file} should be a generated regular file`);
  assert.equal(fs.lstatSync(vendor).isSymbolicLink(), false, `${file} should not be a symlink`);
  assert.deepEqual(fs.readFileSync(vendor), fs.readFileSync(source), `${file} should match web/`);
}

const engine = require(path.join(extensionRoot, 'vendor/ssi-core/ssi-core.js'));
const commentFormatApi = require(path.join(extensionRoot, 'src/comment-format.js'));
const adapterApi = require(path.join(extensionRoot, 'src/page-adapter.js'));

const SAMPLE_SCRAMBLE = "R' F R2 D F2 U' F2 U L2 U' R2 D2 U' B F U F2 R2 F L U' Rw'";
const FLOATING_SCRAMBLE = "D2 R2 U L2 R2 D' B2 L2 D' F2 D2 B2 L' B U' B L2 D2 B Rw2 Uw'";
const LTCT_SCRAMBLE = "B2 L D R B2 R F2 R' U2 L2 U2 R2 F2 D B' L R' F' U L' Uw";
const COMBINED_SCRAMBLE = LTCT_SCRAMBLE;
const T2C_SCRAMBLE = "D2 B U2 R' D F' D' B2 U' L2 D2 F2 R2 F L2 F2 R2 U2 F D2 Rw' Uw2";

function makeHarness(options = {}) {
  const listeners = {};
  const sessionId = options.sessionId || '3';
  const sessionName = options.sessionName || '3BLD';
  const scrambleType = options.scrambleType || '333ni';
  const solve = [[0, 42000], options.scramble || SAMPLE_SCRAMBLE, options.comment || '', 1234567890];
  const saves = [];
  const notices = [];
  const registeredTools = {};
  const kernel = {
    getProp(key) {
      if (key === 'session') return Number(sessionId);
      if (key === 'sessionData') return JSON.stringify({
        [sessionId]: { name: sessionName, opt: { scrType: scrambleType } },
      });
      if (key === 'scrType') return scrambleType;
      return undefined;
    },
    regListener(_module, signal, callback) {
      listeners[signal] = callback;
    },
  };
  const stats = {
    timesAt(index) {
      return index === 0 ? solve : undefined;
    },
    getTimesStatsTable() {
      return { timesLen: options.timesLen === undefined ? 1 : options.timesLen };
    },
    getSessionManager() {
      return {
        save(index) {
          saves.push(index);
          return Promise.resolve();
        },
      };
    },
  };
  const tools = {
    regTool(name, label, exec) {
      registeredTools[name] = { label, exec };
    },
  };
  const sessionConfig = {
    sessionName: options.configSessionName || sessionName,
    settings: {
      bufferMode: 'standard',
      edgeMethod: 'pseudoswap',
      tracingOrientation: '',
      finishCapability: 'none',
      flipWeight: 1,
      twistWeight: 1,
      commentTemplate: 'baseline_algs',
      commentFinish: false,
      commentArrow: 'ascii',
      writeComment: true,
      ...(options.settings || {}),
    },
  };
  const configStore = {
    version: 3,
    enabled: options.enabled !== false,
    sessions: options.configured === false ? {} : { [sessionId]: sessionConfig },
  };
  const adapter = adapterApi.createAdapter({
    kernel,
    stats,
    tools,
    engine,
    configStore,
    documentRef: options.documentRef,
    notify(message) {
      notices.push(message);
    },
  });
  return { adapter, listeners, notices, registeredTools, saves, solve };
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'manifest.json'), 'utf8'));
  assert.equal(manifest.version, '1.8.3');
  assert.equal(manifest.description, 'Shows or saves algcount after each new csTimer solve.');
  assert.equal(manifest.background, undefined);
  const contentSource = fs.readFileSync(path.join(extensionRoot, 'src', 'content.js'), 'utf8');
  assert.doesNotMatch(contentSource, /SET_BADGE_STATE|setBadgeState|badgeState/);
  assert.match(contentSource, /const shouldReload = extensionEnabled === true && !nextEnabled/);
  assert.match(contentSource, /if \(shouldReload\) window\.location\.reload\(\)/);
  const popupHtml = fs.readFileSync(path.join(extensionRoot, 'popup', 'popup.html'), 'utf8');
  const popupCss = fs.readFileSync(path.join(extensionRoot, 'popup', 'popup.css'), 'utf8');
  assert.match(
    popupCss,
    /:root \{[\s\S]*?width: 390px;[\s\S]*?min-width: 390px;[\s\S]*?max-width: 390px;/,
    'the root document must constrain Chromium popup width',
  );
  assert.match(
    popupCss,
    /scrollbar-width: none;[\s\S]*?:root::\-webkit-scrollbar \{[\s\S]*?display: none;/,
    'the popup must not reserve a visible scrollbar gutter',
  );
  assert.match(popupHtml, /<p class="lede">Shows or saves algcount after each solve\.<\/p>/);
  assert.match(popupHtml, /<img class="brand-mark" src="\.\.\/icons\/icon\.svg" alt="" width="46" height="46" \/>/);
  assert.doesNotMatch(popupHtml, /SCRAMBLE SET INSIGHT/);
  assert.doesNotMatch(popupHtml, /<strong>algcount<\/strong>/);
  assert.match(popupHtml, /<span class="version-badge" id="extension-version" hidden><\/span>/);
  assert.match(
    popupHtml,
    /<label class="master-toggle" for="extension-enabled">[\s\S]*?<input id="extension-enabled" type="checkbox" role="switch" checked \/>/,
  );
  assert.match(
    popupHtml,
    /<option value="baseline_total">N<\/option>\s*<option value="baseline_algs" selected>N algs<\/option>/,
  );
  assert.match(popupHtml, /<label for="finish-capability">Advanced<\/label>/);
  assert.match(popupHtml, /<option value="none" selected>None<\/option>/);
  assert.match(popupHtml, /<option value="t2c" disabled>T2C<\/option>/);
  assert.match(popupHtml, /<input id="comment-finish" type="checkbox" disabled \/>/);
  assert.match(popupHtml, /Adds “LTCT” or “T2C” when an Advanced algset saves algs\./);
  assert.match(popupHtml, /id="flip-weight" type="number" min="1" step="0\.01"/);
  assert.match(popupHtml, /id="twist-weight" type="number" min="1" step="0\.01"/);
  assert.doesNotMatch(popupHtml, /id="show-after-solve"/);
  assert.match(popupHtml, /<input id="write-comment" type="checkbox" \/>/);
  assert.match(popupHtml, /<span class="session-state" id="session-state" data-state="connecting">/);
  assert.match(popupHtml, /<small class="session-guidance" id="session-guidance" hidden><\/small>/);
  assert.match(
    popupHtml,
    /<fieldset class="session-output-card" id="outputs-fieldset" disabled>[\s\S]*?<legend>Current session<\/legend>[\s\S]*?<strong class="session-name" id="session-name">[\s\S]*?<div class="output-grid">/,
  );
  assert.doesNotMatch(popupHtml, /<section class="session-card"/);
  assert.match(popupHtml, /<strong>Save algcount to comment<\/strong>/);
  assert.doesNotMatch(popupHtml, /Empty comments only/);
  assert.doesNotMatch(popupHtml, /Show in BLD Algcount tool|Select it under Tools/);
  assert.match(popupHtml, /<label for="comment-format">Algcount format<\/label>/);
  assert.match(popupHtml, /<small class="format-hint" id="comment-format-hint" hidden><\/small>/);
  assert.match(popupHtml, /<select id="comment-arrow" disabled>/);
  assert.match(popupHtml, /<option value="ascii" selected>-&gt;<\/option>/);
  assert.match(popupHtml, /<p class="privacy-note">Everything runs locally\.<\/p>/);
  assert.doesNotMatch(popupHtml, /id="save-button"/);
  assert.doesNotMatch(popupHtml, /Existing non-empty comments/);
  for (const size of [16, 32, 48, 128]) {
    const iconPath = path.join(extensionRoot, manifest.icons[String(size)]);
    const icon = fs.readFileSync(iconPath);
    assert.equal(icon.toString('ascii', 1, 4), 'PNG', `${size}px icon should be a PNG`);
    assert.equal(icon.readUInt32BE(16), size, `${size}px icon width`);
    assert.equal(icon.readUInt32BE(20), size, `${size}px icon height`);
    assert.equal(manifest.action.default_icon[String(size)], manifest.icons[String(size)]);
  }

  assert.deepEqual(adapterApi.normalizeConfigStore(), {
    version: 3,
    enabled: true,
    sessions: {},
  });
  assert.deepEqual(adapterApi.normalizeConfigStore({ enabled: false }), {
    version: 3,
    enabled: false,
    sessions: {},
  });

  assert.deepEqual(adapterApi.normalizeSettings({}), {
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
  });
  assert.throws(
    () => adapterApi.normalizeSettings({
      bufferMode: 'partial',
      cornerBuffers: ['UFL'],
      edgeBuffers: ['UF'],
    }),
    /must include UFR and UF/,
    'partial floating must reject a missing primary UFR buffer',
  );
  assert.throws(
    () => adapterApi.normalizeSettings({
      bufferMode: 'partial',
      cornerBuffers: ['UFR'],
      edgeBuffers: ['UR'],
    }),
    /must include UFR and UF/,
    'partial floating must reject a missing primary UF buffer',
  );
  assert.throws(
    () => adapterApi.normalizeSettings({ bufferMode: 'standard', finishCapability: 't2c' }),
    /T2C requires full floating/,
  );
  assert.equal(adapterApi.normalizeSettings({ flipWeight: 0, twistWeight: 0.5 }).flipWeight, 1);
  assert.equal(adapterApi.normalizeSettings({ flipWeight: 0, twistWeight: 0.5 }).twistWeight, 1);

  const supported3x3Types = [
    '333', '333ni', '333fm', '333oh',
    '333o', '333noob', 'edges', 'corners', 'nocache_333bldspec',
    'nocache_333patspec', '333ft', '333custom',
    'pll', 'oll', 'lsll2', 'll', 'zbll', 'coll', 'cll', 'ell', '2gll',
    'zzll', 'zbls', 'eols', 'wvls', 'vls', 'f2l', 'eoline', 'eocross',
    'easyc', 'easyxc',
    'sbrx', 'cmll', 'lse', 'lsemu',
    'mt3qb', 'mteole', 'mttdr', 'mt6cp', 'mtcdrll', 'mtl5ep', 'ttll',
    '2gen', '2genl', 'roux', '3gen_F', '3gen_L', 'RrU', '333drud',
    'half', 'lsll',
  ];
  for (const scrambleType of supported3x3Types) {
    assert.equal(adapterApi.isSupported3x3ScrambleType(scrambleType), true, scrambleType);
  }
  for (const scrambleType of ['222so', '444wca', 'mgmp', 'pyrso', 'r3ni', 'input', '']) {
    assert.equal(adapterApi.isSupported3x3ScrambleType(scrambleType), false, scrambleType);
  }
  assert.equal(adapterApi.isSupportedScrambleNotation("R U2 F' Rw Uw2"), true);
  assert.equal(adapterApi.isSupportedScrambleNotation('R U M U\''), false);
  assert.equal(adapterApi.isSupportedScrambleNotation('R U r U\''), false);
  assert.equal(adapterApi.isSupportedScrambleNotation('R U / U\''), false);
  assert.equal(adapterApi.UNSUPPORTED_SCRAMBLE_MESSAGE, 'Switch to 3\u00d73\nscramble type');
  assert.throws(
    () => adapterApi.calculateComment(engine, 'R U M U\'', {}),
    new RegExp(adapterApi.UNSUPPORTED_SCRAMBLE_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  );

  const popupSource = fs.readFileSync(path.join(extensionRoot, 'popup', 'popup.js'), 'utf8');
  const adapterSource = fs.readFileSync(path.join(extensionRoot, 'src', 'page-adapter.js'), 'utf8');
  assert.match(popupSource, /scheduleAutosave\(300\)/);
  assert.match(popupSource, /scheduleAutosave\(0\)/);
  assert.match(popupSource, /enabled: true/);
  assert.match(popupSource, /elements\.extensionEnabled\.addEventListener\('change'/);
  assert.match(popupSource, /setStatus\('Saved\.', 'success'\)/);
  assert.doesNotMatch(popupSource, /Saved automatically\./);
  assert.match(
    popupSource,
    /setSessionGuidance\('Open or reload a csTimer tab, then reopen this popup\.'\)/,
  );
  assert.doesNotMatch(popupSource, /saveButton/);
  assert.match(adapterSource, /toolsApi\.regTool\(TOOL_ID, 'BLD Algcount'/);
  assert.match(adapterSource, /!configReceived \|\| !configStore\.enabled/);
  assert.doesNotMatch(adapterSource, /renderAlgCountInConfirmTime|value !== 'cfm'/);
  assert.doesNotMatch(
    adapterSource,
    /insertBefore\(algcountOption|placeAlgcountToolOption|toolMenuObserver/,
    'native csTimer tool options must not be reordered independently of its private data array',
  );
  assert.match(
    adapterSource,
    /findSelectedAlgcountToolHost[\s\S]*?setTimeout\(analyzeLatestForTool, 50\)/,
    'a restored native selection must reconnect and analyze without a manual tool switch',
  );
  assert.match(
    adapterSource,
    /if \(toolHost && configStore\.enabled\) analyzeLatestForTool\(true\)/,
    'an enabled native tool callback must trust the host even before the menu DOM settles',
  );
  assert.match(
    popupSource,
    /input\.disabled = required\.includes\(option\)/,
    'partial floating must pin primary buffer checkboxes in the popup',
  );

  assert.deepEqual(
    commentFormatApi.availableTemplateOptions(false).map(({ label }) => label),
    ['N', 'N algs', 'N=C+E', 'N = C+E', 'N = C + E'],
  );
  assert.equal(commentFormatApi.comparisonHint('standard', false), '');
  assert.equal(commentFormatApi.comparisonHint('standard', true), 'N = before LTCT · M = final');
  assert.equal(commentFormatApi.comparisonHint('full', false), 'N = before floating · M = final');
  assert.equal(commentFormatApi.comparisonHint('partial', true), 'N = before floating/LTCT · M = final');
  assert.equal(commentFormatApi.comparisonHint('full', 't2c'), 'N = before floating/T2C · M = final');
  assert.deepEqual(
    commentFormatApi.availableTemplateOptions(true).map(({ label }) => label),
    [
      'M',
      'M algs',
      'M=C+E',
      'M = C+E',
      'M = C + E',
      'N->M',
      'N->M=C+E',
      'N->M = C+E',
      'N->M = C + E',
    ],
  );
  assert.deepEqual(
    commentFormatApi.availableTemplateOptions(true)
      .map((option) => commentFormatApi.formatTemplateLabel(option, 'u279c')),
    [
      'M',
      'M algs',
      'M=C+E',
      'M = C+E',
      'M = C + E',
      'N➜M',
      'N➜M=C+E',
      'N➜M = C+E',
      'N➜M = C + E',
    ],
  );
  assert.equal(
    commentFormatApi.normalizeTemplate('comparison_all_spaces', false),
    'baseline_all_spaces',
  );
  assert.equal(
    commentFormatApi.normalizeTemplate('baseline_all_spaces', true),
    'final_all_spaces',
  );
  assert.equal(
    adapterApi.normalizeSettings({ bufferMode: 'full', commentFormat: 'total' }).commentTemplate,
    'comparison_total',
  );
  assert.equal(
    adapterApi.normalizeSettings({ bufferMode: 'standard', commentFormat: 'detailed' }).commentTemplate,
    'baseline_compact',
  );
  assert.equal(adapterApi.normalizeSettings({ ltct: false, commentLtct: true }).commentFinish, false);
  assert.equal(adapterApi.normalizeSettings({ ltct: true, commentLtct: true }).finishCapability, 'ltct');
  assert.equal(adapterApi.normalizeSettings({ ltct: true, commentLtct: true }).commentFinish, true);
  assert.equal(adapterApi.normalizeSettings({ commentArrow: 'u279d' }).commentArrow, 'u279d');
  assert.equal(adapterApi.normalizeSettings({ commentArrow: 'not-an-arrow' }).commentArrow, 'ascii');

  const detailed = adapterApi.calculateComment(engine, SAMPLE_SCRAMBLE, {
    bufferMode: 'standard',
    edgeMethod: 'pseudoswap',
    commentTemplate: 'baseline_compact',
  });
  assert.match(detailed, /^\d+(?:\.\d+)?=\d+(?:\.\d+)?\+\d+(?:\.\d+)?$/);

  const expected = adapterApi.calculateComment(engine, SAMPLE_SCRAMBLE, {
    bufferMode: 'standard',
    edgeMethod: 'pseudoswap',
  });
  assert.match(expected, /^\d+(?:\.\d+)? algs$/);
  assert.equal(expected, `${detailed.split('=')[0]} algs`);

  const floatingTemplates = {
    comparison_total: '11->10',
    comparison_compact: '11->10=4+6',
    comparison_outer_spaces: '11->10 = 4+6',
    comparison_all_spaces: '11->10 = 4 + 6',
    final_total: '10',
    final_algs: '10 algs',
    final_compact: '10=4+6',
    final_outer_spaces: '10 = 4+6',
    final_all_spaces: '10 = 4 + 6',
  };
  for (const [commentTemplate, expectedComment] of Object.entries(floatingTemplates)) {
    assert.equal(adapterApi.calculateComment(engine, FLOATING_SCRAMBLE, {
      bufferMode: 'full',
      edgeMethod: 'pseudoswap',
      commentTemplate,
    }), expectedComment, commentTemplate);
  }

  const arrowOutputs = {
    ascii: '11->10',
    u2192: '11→10',
    u279c: '11➜10',
    u279d: '11➝10',
    u25b8: '11▸10',
    u2794: '11➔10',
  };
  for (const [commentArrow, expectedComment] of Object.entries(arrowOutputs)) {
    assert.equal(adapterApi.calculateComment(engine, FLOATING_SCRAMBLE, {
      bufferMode: 'full',
      edgeMethod: 'pseudoswap',
      commentTemplate: 'comparison_total',
      commentArrow,
    }), expectedComment, commentArrow);
  }

  assert.equal(adapterApi.calculateComment(engine, LTCT_SCRAMBLE, {
    bufferMode: 'standard',
    edgeMethod: 'pseudoswap',
    ltct: true,
    commentTemplate: 'comparison_total',
  }), '11->10');
  assert.equal(adapterApi.calculateComment(engine, LTCT_SCRAMBLE, {
    bufferMode: 'standard',
    edgeMethod: 'pseudoswap',
    ltct: true,
    commentLtct: true,
    commentTemplate: 'comparison_compact',
  }), '11->10=4+6 LTCT');

  assert.equal(adapterApi.calculateComment(engine, COMBINED_SCRAMBLE, {
    bufferMode: 'full',
    edgeMethod: 'pseudoswap',
    ltct: true,
    commentLtct: true,
    commentTemplate: 'comparison_total',
  }), '11->9 LTCT');
  assert.equal(adapterApi.calculateComment(engine, COMBINED_SCRAMBLE, {
    bufferMode: 'full',
    edgeMethod: 'pseudoswap',
    ltct: true,
    commentLtct: true,
    commentTemplate: 'comparison_compact',
  }), '11->9=3+6 LTCT');

  assert.equal(adapterApi.calculateComment(engine, T2C_SCRAMBLE, {
    bufferMode: 'full',
    edgeMethod: 'pseudoswap',
    finishCapability: 't2c',
    commentFinish: true,
    commentTemplate: 'comparison_compact',
  }), '9->7=3+4 T2C');

  const normal = makeHarness();
  await normal.listeners.timestd('timestd', normal.solve);
  assert.equal(normal.solve[2], expected);
  assert.deepEqual(normal.saves, [0]);
  assert.equal(normal.notices.at(-1).type, 'COMMENT_WRITTEN');

  const detailedFormatted = makeHarness({
    settings: { bufferMode: 'standard', edgeMethod: 'pseudoswap', commentTemplate: 'baseline_compact' },
  });
  await detailedFormatted.listeners.timestd('timestd', detailedFormatted.solve);
  assert.equal(detailedFormatted.solve[2], detailed);
  assert.deepEqual(detailedFormatted.saves, [0]);

  const compared = makeHarness({
    scramble: COMBINED_SCRAMBLE,
    settings: {
      bufferMode: 'full',
      edgeMethod: 'pseudoswap',
      finishCapability: 'ltct',
      commentFinish: true,
      commentTemplate: 'comparison_compact',
    },
  });
  await compared.listeners.timestd('timestd', compared.solve);
  assert.equal(compared.solve[2], '11->9=3+6 LTCT');
  assert.deepEqual(compared.saves, [0]);

  const unconfigured = makeHarness({ configured: false });
  await unconfigured.listeners.timestd('timestd', unconfigured.solve);
  assert.equal(unconfigured.solve[2], '');
  assert.deepEqual(unconfigured.saves, []);

  const noOutputs = makeHarness({ settings: { writeComment: false } });
  const noOutputsResult = await noOutputs.listeners.timestd('timestd', noOutputs.solve);
  assert.equal(noOutputsResult.reason, 'idle');
  assert.equal(noOutputs.solve[2], '');
  assert.deepEqual(noOutputs.saves, []);

  const disabled = makeHarness({ enabled: false });
  const disabledToolHost = { innerHTML: 'stale result' };
  disabled.registeredTools.ssialgcount.exec(disabledToolHost);
  assert.equal(disabledToolHost.innerHTML, '');
  const disabledResult = await disabled.listeners.timestd('timestd', disabled.solve);
  assert.equal(disabledResult.reason, 'extension-disabled');
  assert.equal(disabled.solve[2], '');
  assert.deepEqual(disabled.saves, []);

  const mismatched = makeHarness({ configSessionName: 'A different session' });
  await mismatched.listeners.timestd('timestd', mismatched.solve);
  assert.equal(mismatched.solve[2], '');
  assert.deepEqual(mismatched.saves, []);

  const existing = makeHarness({ comment: 'memo mistake' });
  await existing.listeners.timestd('timestd', existing.solve);
  assert.equal(existing.solve[2], 'memo mistake');
  assert.deepEqual(existing.saves, []);
  assert.equal(existing.notices.at(-1).type, 'COMMENT_SKIPPED');

  const existingWithDisplay = makeHarness({
    comment: 'memo mistake',
    settings: {
      bufferMode: 'standard',
      edgeMethod: 'pseudoswap',
      writeComment: true,
    },
  });
  const existingToolHost = { innerHTML: '' };
  existingWithDisplay.registeredTools.ssialgcount.exec(existingToolHost);
  const existingWithDisplayResult = await existingWithDisplay.listeners.timestd(
    'timestd',
    existingWithDisplay.solve,
  );
  assert.equal(existingWithDisplayResult.status, 'display-ready');
  assert.equal(existingWithDisplay.solve[2], 'memo mistake');
  assert.deepEqual(existingWithDisplay.saves, []);
  assert.deepEqual(
    existingWithDisplay.notices.map((notice) => notice.type),
    ['DISPLAY_UPDATED', 'COMMENT_SKIPPED'],
  );

  const displayOnly = makeHarness({
    settings: {
      bufferMode: 'standard',
      edgeMethod: 'pseudoswap',
      writeComment: false,
      commentTemplate: 'baseline_compact',
    },
  });
  assert.equal(displayOnly.registeredTools.ssialgcount.label, 'BLD Algcount');
  const toolHost = { innerHTML: '' };
  displayOnly.registeredTools.ssialgcount.exec(toolHost);
  assert.equal(toolHost.innerHTML.includes(`>${detailed}<`), true);
  const displayOnlyResult = await displayOnly.listeners.timestd('timestd', displayOnly.solve);
  assert.equal(displayOnlyResult.status, 'display-ready');
  assert.equal(displayOnly.solve[2], '');
  assert.deepEqual(displayOnly.saves, []);
  assert.equal(displayOnly.notices.at(-1).type, 'DISPLAY_UPDATED');
  assert.equal(toolHost.innerHTML.includes(`>${detailed}<`), true);
  assert.doesNotMatch(toolHost.innerHTML, /Latest solve/);
  assert.doesNotMatch(toolHost.innerHTML, /font-size:2em|font-family:system-ui/);
  assert.doesNotMatch(toolHost.innerHTML, /min-height/);

  const emptySession = makeHarness({ settings: { writeComment: false }, timesLen: 0 });
  const emptyToolHost = { innerHTML: '' };
  emptySession.registeredTools.ssialgcount.exec(emptyToolHost);
  assert.match(emptyToolHost.innerHTML, /No solves in this session yet\./);

  const non3x3 = makeHarness({
    scrambleType: '222so',
    scramble: "R U2 F' R2 U' F",
  });
  const non3x3ToolHost = { innerHTML: '' };
  non3x3.registeredTools.ssialgcount.exec(non3x3ToolHost);
  assert.match(non3x3ToolHost.innerHTML, /Switch to 3\u00d73<br>scramble type/);
  const non3x3Result = await non3x3.listeners.timestd('timestd', non3x3.solve);
  assert.equal(non3x3Result.reason, 'unsupported-scramble');
  assert.equal(non3x3.solve[2], '');
  assert.deepEqual(non3x3.saves, []);

  const unsupportedNotation = makeHarness({ scramble: "R U M U'" });
  const unsupportedNotationToolHost = { innerHTML: '' };
  unsupportedNotation.registeredTools.ssialgcount.exec(unsupportedNotationToolHost);
  assert.match(unsupportedNotationToolHost.innerHTML, /Switch to 3\u00d73<br>scramble type/);
  const unsupportedNotationResult = await unsupportedNotation.listeners.timestd(
    'timestd',
    unsupportedNotation.solve,
  );
  assert.equal(unsupportedNotationResult.reason, 'unsupported-scramble');
  assert.equal(unsupportedNotation.solve[2], '');
  assert.deepEqual(unsupportedNotation.saves, []);

  const bothOutputs = makeHarness({
    settings: {
      bufferMode: 'standard',
      edgeMethod: 'pseudoswap',
      writeComment: true,
    },
  });
  const bothToolHost = { innerHTML: '' };
  bothOutputs.registeredTools.ssialgcount.exec(bothToolHost);
  await bothOutputs.listeners.timestd('timestd', bothOutputs.solve);
  assert.equal(bothOutputs.solve[2], expected);
  assert.deepEqual(bothOutputs.saves, [0]);
  assert.deepEqual(
    bothOutputs.notices.map((notice) => notice.type),
    ['DISPLAY_UPDATED', 'COMMENT_WRITTEN'],
  );

  const floating = makeHarness({
    settings: { bufferMode: 'full', edgeMethod: 'weakswap', finishCapability: 'ltct' },
  });
  await floating.listeners.timestd('timestd', floating.solve);
  assert.equal(floating.solve[2], adapterApi.calculateComment(engine, SAMPLE_SCRAMBLE, {
    bufferMode: 'full',
    edgeMethod: 'weakswap',
    finishCapability: 'ltct',
  }));

  console.log(`PASS extension writes ${expected} and respects session/comment safeguards`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
