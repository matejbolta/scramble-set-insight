(function (global) {
  'use strict';

  const TEMPLATE_OPTIONS = Object.freeze([
    { value: 'baseline_total', label: 'N', group: 'baseline', kind: 'total' },
    { value: 'baseline_algs', label: 'N algs', group: 'baseline', kind: 'algs' },
    { value: 'baseline_compact', label: 'N=C+E', group: 'baseline', kind: 'compact' },
    { value: 'baseline_outer_spaces', label: 'N = C+E', group: 'baseline', kind: 'outer_spaces' },
    { value: 'baseline_all_spaces', label: 'N = C + E', group: 'baseline', kind: 'all_spaces' },
    { value: 'final_total', label: 'M', group: 'final', kind: 'total' },
    { value: 'final_algs', label: 'M algs', group: 'final', kind: 'algs' },
    { value: 'final_compact', label: 'M=C+E', group: 'final', kind: 'compact' },
    { value: 'final_outer_spaces', label: 'M = C+E', group: 'final', kind: 'outer_spaces' },
    { value: 'final_all_spaces', label: 'M = C + E', group: 'final', kind: 'all_spaces' },
    { value: 'comparison_total', label: 'N->M', group: 'comparison', kind: 'total' },
    { value: 'comparison_compact', label: 'N->M=C+E', group: 'comparison', kind: 'compact' },
    { value: 'comparison_outer_spaces', label: 'N->M = C+E', group: 'comparison', kind: 'outer_spaces' },
    { value: 'comparison_all_spaces', label: 'N->M = C + E', group: 'comparison', kind: 'all_spaces' },
  ]);

  const ARROW_OPTIONS = Object.freeze([
    { value: 'ascii', label: '->', symbol: '->' },
    { value: 'u2192', label: '→', symbol: '→' },
    { value: 'u279c', label: '➜', symbol: '➜' },
    { value: 'u279d', label: '➝', symbol: '➝' },
    { value: 'u25b8', label: '▸', symbol: '▸' },
    { value: 'u2794', label: '➔', symbol: '➔' },
  ]);

  const OPTION_BY_VALUE = new Map(TEMPLATE_OPTIONS.map((option) => [option.value, option]));
  const ARROW_BY_VALUE = new Map(ARROW_OPTIONS.map((option) => [option.value, option]));
  const BASELINE_FALLBACKS = {
    comparison_total: 'baseline_total',
    comparison_compact: 'baseline_compact',
    comparison_outer_spaces: 'baseline_outer_spaces',
    comparison_all_spaces: 'baseline_all_spaces',
    final_total: 'baseline_total',
    final_algs: 'baseline_algs',
    final_compact: 'baseline_compact',
    final_outer_spaces: 'baseline_outer_spaces',
    final_all_spaces: 'baseline_all_spaces',
  };
  const FINAL_FALLBACKS = {
    baseline_total: 'final_total',
    baseline_algs: 'final_algs',
    baseline_compact: 'final_compact',
    baseline_outer_spaces: 'final_outer_spaces',
    baseline_all_spaces: 'final_all_spaces',
  };

  function normalizeFinishCapability(value) {
    if (value === true) return 'ltct';
    return ['none', 'ltct', 't2c'].includes(value) ? value : 'none';
  }

  function comparisonsAvailable(bufferMode, finishCapability) {
    return bufferMode !== 'standard' || normalizeFinishCapability(finishCapability) !== 'none';
  }

  function comparisonHint(bufferMode, finishCapability) {
    const floating = bufferMode !== 'standard';
    const capability = normalizeFinishCapability(finishCapability);
    const advanced = capability === 'none' ? '' : capability.toUpperCase();
    if (floating && advanced) return `N = before floating/${advanced} · M = final`;
    if (floating) return 'N = before floating · M = final';
    if (advanced) return `N = before ${advanced} · M = final`;
    return '';
  }

  function normalizeTemplate(value, allowComparisons) {
    let normalized = value;
    if (value === 'total') {
      normalized = allowComparisons ? 'comparison_total' : 'baseline_algs';
    } else if (value === 'detailed') {
      normalized = allowComparisons ? 'comparison_compact' : 'baseline_compact';
    }

    if (!OPTION_BY_VALUE.has(normalized)) normalized = 'baseline_algs';
    if (allowComparisons && OPTION_BY_VALUE.get(normalized).group === 'baseline') {
      normalized = FINAL_FALLBACKS[normalized] || 'final_algs';
    } else if (!allowComparisons && OPTION_BY_VALUE.get(normalized).group !== 'baseline') {
      normalized = BASELINE_FALLBACKS[normalized] || 'baseline_algs';
    }
    return normalized;
  }

  function availableTemplateOptions(allowComparisons) {
    return TEMPLATE_OPTIONS.filter((option) => allowComparisons
      ? option.group !== 'baseline'
      : option.group === 'baseline');
  }

  function normalizeArrow(value) {
    return ARROW_BY_VALUE.has(value) ? value : 'ascii';
  }

  function formatTemplateLabel(option, arrowValue) {
    if (!option || option.group !== 'comparison') return option ? option.label : '';
    const arrow = ARROW_BY_VALUE.get(normalizeArrow(arrowValue)).symbol;
    return option.label.replace('->', arrow);
  }

  function rounded(value) {
    return Number(Number(value).toFixed(5));
  }

  function formatAlgCount(value) {
    return String(rounded(value));
  }

  function formatComparedAlgCount(actual, baseline, arrowValue) {
    const formattedActual = formatAlgCount(actual);
    if (!Number.isFinite(baseline) || baseline <= actual) return formattedActual;
    const arrow = ARROW_BY_VALUE.get(normalizeArrow(arrowValue)).symbol;
    return `${formatAlgCount(baseline)}${arrow}${formattedActual}`;
  }

  function metricSource(breakdown, comparison, group) {
    if (group !== 'baseline' || !comparison) return breakdown;
    return {
      total_algs: comparison.total_algs,
      corner_algs: comparison.corner_algs,
      edge_algs: comparison.edge_algs,
    };
  }

  function renderDetailed(kind, total, corners, edges) {
    if (kind === 'outer_spaces') return `${total} = ${corners}+${edges}`;
    if (kind === 'all_spaces') return `${total} = ${corners} + ${edges}`;
    return `${total}=${corners}+${edges}`;
  }

  function formatCommentBreakdown(breakdown, comparison, templateValue, commentFinish, arrowValue) {
    const normalizedTemplate = OPTION_BY_VALUE.has(templateValue) ? templateValue : 'baseline_algs';
    const template = OPTION_BY_VALUE.get(normalizedTemplate);
    const source = metricSource(breakdown, comparison, template.group);
    const total = template.group === 'comparison'
      ? formatComparedAlgCount(breakdown.total_algs, comparison && comparison.total_algs, arrowValue)
      : formatAlgCount(source.total_algs);
    const finishType = breakdown.finish_type || (breakdown.ltct_used ? 'ltct' : null);
    const finishAnnotation = commentFinish && finishType ? ` ${finishType.toUpperCase()}` : '';

    if (template.kind === 'total') return `${total}${finishAnnotation}`;
    if (template.kind === 'algs') return `${total} algs${finishAnnotation}`;

    const corners = formatAlgCount(source.corner_algs);
    const edges = formatAlgCount(source.edge_algs);
    return `${renderDetailed(template.kind, total, corners, edges)}${finishAnnotation}`;
  }

  const api = {
    ARROW_OPTIONS,
    TEMPLATE_OPTIONS,
    availableTemplateOptions,
    comparisonHint,
    comparisonsAvailable,
    formatAlgCount,
    formatCommentBreakdown,
    formatTemplateLabel,
    normalizeArrow,
    normalizeTemplate,
  };

  global.SsiCommentFormat = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
