(function (global) {
  const deps = typeof module !== 'undefined' && module.exports
    ? require('./finalizing')
    : global.SsiCoreModules;

  const SsiCore = {
    algCounterMain: deps.algCounterMain,
    analyzeScramble: deps.analyzeScramble,
    buildCornerBreakdown: deps.buildCornerBreakdown,
    buildEdgeBreakdown: deps.buildEdgeBreakdown,
    countScrambleAlgs: deps.countScrambleAlgs,
    debugHumanReviewReport: deps.debugHumanReviewReport,
    extractScrambleList: deps.extractScrambleList,
    scrambleTransform: deps.scrambleTransform || global.SsiCoreModules.scrambleTransform,
  };

  global.SsiCore = SsiCore;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SsiCore;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
