(function (global) {
  const deps = typeof module !== 'undefined' && module.exports
    ? { ...require('./big-cube-model'), ...require('./cycle-model') }
    : global.SsiCoreModules;

  const {
    PLUSCENTER_LOCATIONS,
    stateRelativeToGoal,
    WING_LOCATIONS,
    XCENTER_LOCATIONS,
  } = deps;

  const WING_BUFFER = 'UFr';
  const WING_PARITY_TARGET = 'BUr';
  const XCENTER_BUFFER = 'Ubl';
  const XCENTER_HELPER = 'Ubr';
  const PLUSCENTER_BUFFER = 'Ub';
  const PLUSCENTER_HELPER = 'Ur';

  function normalizeWingParityCapability(value) {
    if (value == null || value === '' || value === false) return 'basic';
    if (value === true) return 'full';
    const normalized = String(value).toLowerCase();
    if (['basic', 'full'].includes(normalized)) return normalized;
    throw new Error(`Unknown wing parity capability: ${value}`);
  }

  function solvedWingState() {
    return Object.fromEntries(WING_LOCATIONS.map((location) => [location, location]));
  }

  function wingGoalState(cornerParity = false) {
    const goal = solvedWingState();
    if (cornerParity) {
      [goal.UFr, goal.URb] = [goal.URb, goal.UFr];
      [goal.FUl, goal.RUf] = [goal.RUf, goal.FUl];
    }
    return goal;
  }

  function firstUnsolvedUniqueLocation(state, order, except = null) {
    return order.find((location) => (
      location !== except && state[location] !== location
    )) || null;
  }

  function traceWingState(state, cornerParity = false) {
    let virtual = stateRelativeToGoal(state, wingGoalState(cornerParity));
    const targets = [];
    const maximumTargets = WING_LOCATIONS.length * 2;

    while (true) {
      const unsolved = firstUnsolvedUniqueLocation(
        virtual,
        WING_LOCATIONS,
        WING_BUFFER,
      );
      if (virtual[WING_BUFFER] === WING_BUFFER && !unsolved) break;

      const target = virtual[WING_BUFFER] === WING_BUFFER
        ? unsolved
        : virtual[WING_BUFFER];
      if (!target || target === WING_BUFFER || !WING_LOCATIONS.includes(target)) {
        throw new Error(`Invalid wing trace target: ${target}`);
      }
      [virtual[WING_BUFFER], virtual[target]] = [
        virtual[target],
        virtual[WING_BUFFER],
      ];
      targets.push(target);
      if (targets.length > maximumTargets) {
        throw new Error('Wing trace exceeded its deterministic safety bound.');
      }
    }

    return {
      corner_parity: Boolean(cornerParity),
      goal: wingGoalState(cornerParity),
      targets,
      target_count: targets.length,
      last_target: targets.at(-1) || null,
    };
  }

  function countWingTrace(trace, parityCapability = 'basic') {
    const capability = normalizeWingParityCapability(parityCapability);
    const targetCount = trace.target_count;
    if (!(targetCount % 2)) {
      return {
        capability,
        algs: targetCount / 2,
        parity: false,
        parity_finish: null,
        execution_targets: [...trace.targets],
      };
    }

    const directParity = capability === 'full'
      || trace.last_target === WING_PARITY_TARGET;
    return {
      capability,
      algs: directParity
        ? (targetCount - 1) / 2 + 1
        : (targetCount + 1) / 2 + 1,
      parity: true,
      parity_finish: directParity ? 'direct' : 'buffered-through-BUr',
      execution_targets: directParity
        ? [...trace.targets]
        : [...trace.targets, WING_PARITY_TARGET],
    };
  }

  function centerSolved(state, location) {
    return state[location] === location[0];
  }

  function firstUnsolvedCenter(state, locations) {
    return locations.find((location) => !centerSolved(state, location)) || null;
  }

  function chooseInterchangeableCenterTarget(state, locations, buffer) {
    const carriedColor = state[buffer];
    if (!/^[UDRLFB]$/.test(carriedColor)) {
      throw new Error(`Invalid center color in ${buffer}: ${carriedColor}`);
    }

    if (carriedColor === 'U') {
      const openUSlot = locations.find((location) => (
        location !== buffer && location[0] === 'U' && !centerSolved(state, location)
      ));
      if (openUSlot) return { target: openUSlot, reason: 'open-U-slot' };
      return {
        target: firstUnsolvedCenter(state, locations),
        reason: 'cycle-break',
      };
    }

    const matchingSlots = locations.filter((location) => (
      location[0] === carriedColor && !centerSolved(state, location)
    ));
    const nonUTarget = matchingSlots.find((location) => state[location] !== 'U');
    return {
      target: nonUTarget || matchingSlots[0] || null,
      reason: nonUTarget ? 'matching-non-U' : 'matching-U',
    };
  }

  function traceInterchangeableCenterState(
    state,
    locations,
    buffer,
    helper,
    kind,
  ) {
    let virtual = { ...state };
    const targets = [];
    const decisions = [];
    const maximumTargets = locations.length * 2;

    while (firstUnsolvedCenter(virtual, locations)) {
      const { target, reason } = chooseInterchangeableCenterTarget(
        virtual,
        locations,
        buffer,
      );
      if (!target || target === buffer) {
        throw new Error(`Invalid ${kind} trace target: ${target}`);
      }
      const carried_color = virtual[buffer];
      const target_color = virtual[target];
      [virtual[buffer], virtual[target]] = [virtual[target], virtual[buffer]];
      targets.push(target);
      decisions.push({ target, reason, carried_color, target_color });
      if (targets.length > maximumTargets) {
        throw new Error(`${kind} trace exceeded its deterministic safety bound.`);
      }
    }

    return {
      buffer,
      helper,
      targets,
      target_count: targets.length,
      execution_targets: targets.length % 2
        ? [...targets, helper]
        : [...targets],
      algs: Math.ceil(targets.length / 2),
      decisions,
    };
  }

  function chooseXcenterTarget(state) {
    return chooseInterchangeableCenterTarget(
      state,
      XCENTER_LOCATIONS,
      XCENTER_BUFFER,
    );
  }

  function traceXcenterState(state) {
    return traceInterchangeableCenterState(
      state,
      XCENTER_LOCATIONS,
      XCENTER_BUFFER,
      XCENTER_HELPER,
      'Xcenter',
    );
  }

  function choosePluscenterTarget(state) {
    return chooseInterchangeableCenterTarget(
      state,
      PLUSCENTER_LOCATIONS,
      PLUSCENTER_BUFFER,
    );
  }

  function tracePluscenterState(state) {
    return traceInterchangeableCenterState(
      state,
      PLUSCENTER_LOCATIONS,
      PLUSCENTER_BUFFER,
      PLUSCENTER_HELPER,
      '+center',
    );
  }

  const api = {
    centerSolved,
    chooseInterchangeableCenterTarget,
    choosePluscenterTarget,
    chooseXcenterTarget,
    countWingTrace,
    normalizeWingParityCapability,
    PLUSCENTER_BUFFER,
    PLUSCENTER_HELPER,
    solvedWingState,
    traceInterchangeableCenterState,
    tracePluscenterState,
    traceWingState,
    traceXcenterState,
    wingGoalState,
    WING_BUFFER,
    WING_PARITY_TARGET,
    XCENTER_BUFFER,
    XCENTER_HELPER,
  };

  global.SsiCoreModules = global.SsiCoreModules || {};
  Object.assign(global.SsiCoreModules, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
