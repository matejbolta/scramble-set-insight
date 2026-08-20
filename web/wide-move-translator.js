(function (global) {
  const FACE_ORDER = ['U', 'D', 'F', 'B', 'R', 'L'];
  const OPPOSITE_FACE = { U: 'D', D: 'U', F: 'B', B: 'F', R: 'L', L: 'R' };
  const WIDE_MOVE_ROTATION = { U: 'y', D: "y'", R: 'x', L: "x'", F: 'z', B: "z'" };
  const SPECIAL_MOVE_EXPANSIONS = Object.freeze({
    S: Object.freeze(['Fw', "F'"]),
    "S'": Object.freeze(["Fw'", 'F']),
    S2: Object.freeze(['Fw2', 'F2']),
    M: Object.freeze(["Rw'", 'R']),
    "M'": Object.freeze(['Rw', "R'"]),
    M2: Object.freeze(['Rw2', 'R2']),
    E: Object.freeze(["Uw'", 'U']),
    "E'": Object.freeze(['Uw', "U'"]),
    E2: Object.freeze(['Uw2', 'U2']),
  });
  const ROTATION_MOVE_BASES = Object.freeze({
    x: Object.freeze(['Rw', 'L']),
    y: Object.freeze(['Uw', 'D']),
    z: Object.freeze(['Fw', 'B']),
  });
  const ROTATION_TRANSFORMS = {
    x: { U: 'F', F: 'D', D: 'B', B: 'U', L: 'L', R: 'R' },
    "x'": { U: 'B', B: 'D', D: 'F', F: 'U', L: 'L', R: 'R' },
    y: { U: 'U', D: 'D', F: 'R', R: 'B', B: 'L', L: 'F' },
    "y'": { U: 'U', D: 'D', F: 'L', L: 'B', B: 'R', R: 'F' },
    z: { U: 'L', R: 'U', D: 'R', L: 'D', F: 'F', B: 'B' },
    "z'": { U: 'R', R: 'D', D: 'L', L: 'U', F: 'F', B: 'B' },
  };

  function normalizeHalfTurnPrime(move) {
    return move.endsWith("2'") ? move.slice(0, -1) : move;
  }

  function rotationMoveExpansion(move) {
    const normalizedMove = normalizeHalfTurnPrime(move);
    const rotation = normalizedMove[0]?.toLowerCase();
    const base = ROTATION_MOVE_BASES[rotation];
    if (!base) return null;
    const suffix = normalizedMove.slice(1);
    if (!['', "'", '2'].includes(suffix)) return null;
    const [wide, opposite] = base;
    if (suffix === '2') return [`${wide}2`, `${opposite}2`];
    if (suffix === "'") return [`${wide}'`, opposite];
    return [wide, `${opposite}'`];
  }

  function splitMove(move) {
    if (!move) throw new Error('Assertion failed');
    const normalizedMove = normalizeHalfTurnPrime(move);
    const face = normalizedMove[0];
    const rest = normalizedMove.slice(1);
    const isWide = rest.startsWith('w');
    const suffix = isWide ? rest.slice(1) : rest;
    if (!['', "'", '2'].includes(suffix)) throw new Error('Assertion failed');
    return [face, isWide, suffix];
  }

  function orientationToOrientationList(orientation) {
    return orientation ? orientation.trim().split(' ').filter(Boolean) : [];
  }

  function inverseOrientation(orientation) {
    const orientationList = orientationToOrientationList(orientation);
    const inversed = [];
    for (const e of [...orientationList].reverse()) {
      if (e === 'x') inversed.push("x'");
      else if (e === "x'") inversed.push('x');
      else if (e === 'y') inversed.push("y'");
      else if (e === "y'") inversed.push('y');
      else if (e === 'z') inversed.push("z'");
      else if (e === "z'") inversed.push('z');
      else if (['x2', 'y2', 'z2'].includes(e)) inversed.push(e);
      else throw new Error('Assertion failed');
    }
    return inversed;
  }

  function applyRotationToOrientation(orientation, rotation) {
    if (rotation.endsWith('2')) {
      const baseRotation = rotation[0];
      return applyRotationToOrientation(applyRotationToOrientation(orientation, baseRotation), baseRotation);
    }
    const transform = ROTATION_TRANSFORMS[rotation];
    return Object.fromEntries(FACE_ORDER.map((face) => [face, orientation[transform[face]]]));
  }

  function orientationToMoveMapping(orientation) {
    let moveMapping = Object.fromEntries(FACE_ORDER.map((face) => [face, face]));
    for (const rotation of inverseOrientation(orientation)) {
      moveMapping = applyRotationToOrientation(moveMapping, rotation);
    }
    return moveMapping;
  }

  function suffixToRotation(rotation, suffix) {
    if (suffix === '') return rotation;
    if (suffix === '2') return rotation[0] + '2';
    if (rotation.endsWith("'")) return rotation[0];
    return rotation + "'";
  }

  function translateAtomicMove(move, orientation) {
    const [face, isWide, suffix] = splitMove(move);
    if (!FACE_ORDER.includes(face)) throw new Error(`Unsupported move: ${move}`);
    if (!isWide) return [orientation[face] + suffix, orientation];
    const translatedFace = orientation[OPPOSITE_FACE[face]];
    const translatedMove = translatedFace + suffix;
    const rotation = suffixToRotation(WIDE_MOVE_ROTATION[face], suffix);
    const updatedOrientation = applyRotationToOrientation(orientation, rotation);
    return [translatedMove, updatedOrientation];
  }

  function expandSpecialMove(move) {
    const normalizedMove = normalizeHalfTurnPrime(move);
    return SPECIAL_MOVE_EXPANSIONS[normalizedMove]
      || rotationMoveExpansion(normalizedMove)
      || [normalizedMove];
  }

  function translateMove(move, orientation) {
    const translatedMoves = [];
    let updatedOrientation = orientation;
    for (const atomicMove of expandSpecialMove(move)) {
      const [translatedMove, updated] = translateAtomicMove(
        atomicMove,
        updatedOrientation,
      );
      translatedMoves.push(translatedMove);
      updatedOrientation = updated;
    }
    return [translatedMoves.join(' '), updatedOrientation];
  }

  function scrambleTransform(scr, tracingOrientation = '') {
    const scrList = scr.trim().split(/\s+/).filter(Boolean);
    let orientation = orientationToMoveMapping(tracingOrientation);
    const translatedMoves = [];
    for (const move of scrList) {
      const [translatedMove, updated] = translateMove(move, orientation);
      translatedMoves.push(translatedMove);
      orientation = updated;
    }
    return translatedMoves.join(' ');
  }

  const api = {
    applyRotationToOrientation,
    expandSpecialMove,
    inverseOrientation,
    normalizeHalfTurnPrime,
    orientationToMoveMapping,
    orientationToOrientationList,
    ROTATION_MOVE_BASES,
    rotationMoveExpansion,
    scrambleTransform,
    splitMove,
    suffixToRotation,
    SPECIAL_MOVE_EXPANSIONS,
    translateMove,
  };

  global.SsiCoreModules = global.SsiCoreModules || {};
  Object.assign(global.SsiCoreModules, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
