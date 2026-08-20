(function (global) {
  const deps = typeof module !== 'undefined' && module.exports
    ? {
        ...require('./corner-tracing'),
        ...require('./wide-move-translator'),
      }
    : global.SsiCoreModules;

  const {
    applyRotationToOrientation,
    CORNER_PIECE_GROUPS,
    orientationToMoveMapping,
  } = deps;

  const FACE_VECTORS = Object.freeze({
    U: Object.freeze([0, 1, 0]),
    D: Object.freeze([0, -1, 0]),
    F: Object.freeze([0, 0, 1]),
    B: Object.freeze([0, 0, -1]),
    R: Object.freeze([1, 0, 0]),
    L: Object.freeze([-1, 0, 0]),
  });
  const FACE_AXES = Object.freeze({
    R: Object.freeze({ axis: 0, sign: 1 }),
    L: Object.freeze({ axis: 0, sign: -1 }),
    U: Object.freeze({ axis: 1, sign: 1 }),
    D: Object.freeze({ axis: 1, sign: -1 }),
    F: Object.freeze({ axis: 2, sign: 1 }),
    B: Object.freeze({ axis: 2, sign: -1 }),
  });

  // One canonical sticker orbit: the companion sticker notation of each
  // physical wing deliberately never appears in state or memo output.
  const WING_LOCATIONS = Object.freeze([
    'UFr', 'URb', 'UBl', 'ULf',
    'LUb', 'LFu', 'LDf', 'LBd',
    'FUl', 'FRu', 'FDr', 'FLd',
    'RUf', 'RBu', 'RDb', 'RFd',
    'BUr', 'BLu', 'BDl', 'BRd',
    'DFl', 'DRf', 'DBr', 'DLb',
  ]);
  const XCENTER_LOCATIONS = Object.freeze([
    'Ubl', 'Ubr', 'Ufr', 'Ufl',
    'Lub', 'Luf', 'Ldf', 'Ldb',
    'Ful', 'Fur', 'Fdr', 'Fdl',
    'Ruf', 'Rub', 'Rdb', 'Rdf',
    'Bur', 'Bul', 'Bdl', 'Bdr',
    'Dfl', 'Dfr', 'Dbr', 'Dbl',
  ]);
  const PLUSCENTER_LOCATIONS = Object.freeze([
    'Ub', 'Ur', 'Uf', 'Ul',
    'Lu', 'Lf', 'Ld', 'Lb',
    'Fu', 'Fr', 'Fd', 'Fl',
    'Ru', 'Rb', 'Rd', 'Rf',
    'Bu', 'Bl', 'Bd', 'Br',
    'Df', 'Dr', 'Db', 'Dl',
  ]);
  const CORNER_STICKERS = Object.freeze(CORNER_PIECE_GROUPS.flat());

  function addScaled(target, vector, scale) {
    for (let axis = 0; axis < 3; axis += 1) target[axis] += vector[axis] * scale;
  }

  function geometryForLabel(kind, label, size) {
    const maximum = size - 1;
    const inner = maximum - 2;
    const position = [0, 0, 0];
    const face = label[0].toUpperCase();
    const normal = [...FACE_VECTORS[face]];

    if (kind === 'corner') {
      for (const direction of label) {
        addScaled(position, FACE_VECTORS[direction], maximum);
      }
    } else if (kind === 'wing') {
      addScaled(position, FACE_VECTORS[label[0]], maximum);
      addScaled(position, FACE_VECTORS[label[1]], maximum);
      addScaled(position, FACE_VECTORS[label[2].toUpperCase()], inner);
    } else if (kind === 'xcenter') {
      addScaled(position, FACE_VECTORS[face], maximum);
      addScaled(position, FACE_VECTORS[label[1].toUpperCase()], inner);
      addScaled(position, FACE_VECTORS[label[2].toUpperCase()], inner);
    } else if (kind === 'pluscenter') {
      addScaled(position, FACE_VECTORS[face], maximum);
      addScaled(position, FACE_VECTORS[label[1].toUpperCase()], inner);
    } else {
      throw new Error(`Unknown big-cube piece kind: ${kind}`);
    }
    return { position, normal };
  }

  function vectorKey(vector) {
    return vector.join(',');
  }

  function geometryKey(position, normal) {
    return `${vectorKey(position)}|${vectorKey(normal)}`;
  }

  function rotateVectorOnce(vector, axis, direction) {
    const [x, y, z] = vector;
    if (axis === 0) return direction > 0 ? [x, -z, y] : [x, z, -y];
    if (axis === 1) return direction > 0 ? [z, y, -x] : [-z, y, x];
    return direction > 0 ? [-y, x, z] : [y, -x, z];
  }

  function rotateVector(vector, axis, quarterTurns) {
    let rotated = [...vector];
    const direction = quarterTurns < 0 ? -1 : 1;
    for (let step = 0; step < Math.abs(quarterTurns); step += 1) {
      rotated = rotateVectorOnce(rotated, axis, direction);
    }
    return rotated;
  }

  function createGeometry(kind, labels, size) {
    const records = labels.map((label) => ({
      home: label,
      ...geometryForLabel(kind, label, size),
    }));
    const locationByGeometry = new Map(records.map((record) => [
      geometryKey(record.position, record.normal),
      record.home,
    ]));
    if (locationByGeometry.size !== labels.length) {
      throw new Error(`Duplicate ${kind} geometry for ${size}x${size}.`);
    }
    return { records, locationByGeometry };
  }

  function cloneRecords(records) {
    return records.map((record) => ({
      home: record.home,
      position: [...record.position],
      normal: [...record.normal],
    }));
  }

  const geometryCache = new Map();
  function geometryForSize(size) {
    if (![4, 5].includes(size)) throw new Error('Big-cube size must be 4 or 5.');
    if (!geometryCache.has(size)) {
      geometryCache.set(size, {
        corner: createGeometry('corner', CORNER_STICKERS, size),
        wing: createGeometry('wing', WING_LOCATIONS, size),
        xcenter: createGeometry('xcenter', XCENTER_LOCATIONS, size),
        ...(size === 5
          ? { pluscenter: createGeometry('pluscenter', PLUSCENTER_LOCATIONS, size) }
          : {}),
      });
    }
    return geometryCache.get(size);
  }

  function splitBigMove(move, size) {
    const normalized = move.endsWith("2'") ? move.slice(0, -1) : move;
    const match = normalized.match(/^(3)?([UDRLFB]w|[UDRLFB]|[xyzXYZ]|[MESmes]|[udlrfb])(2|')?$/);
    if (!match) throw new Error(`Unsupported ${size}x${size} move: ${move}`);
    const [, width, rawBase, suffix = ''] = match;
    if (width && (size !== 5 || !rawBase.endsWith('w'))) {
      throw new Error(`${move} is only supported as a 5x5 triple-wide move.`);
    }
    if (/[mes]/.test(rawBase) && size !== 5) {
      throw new Error(`${rawBase} is only supported on 5x5.`);
    }
    return {
      base: /^[XYZ]$/.test(rawBase) ? rawBase.toLowerCase() : rawBase,
      suffix,
      triple: Boolean(width),
    };
  }

  function invertToken(token) {
    const normalized = token.endsWith("2'") ? token.slice(0, -1) : token;
    if (normalized.endsWith('2')) return normalized;
    return normalized.endsWith("'") ? normalized.slice(0, -1) : `${normalized}'`;
  }

  function applySequenceSuffix(sequence, suffix) {
    if (!suffix) return [...sequence];
    if (suffix === "'") return [...sequence].reverse().map(invertToken);
    return [...sequence, ...sequence];
  }

  function compositeExpansion(base, triple, size) {
    if (triple) {
      return {
        Rw: ['x', 'Lw'],
        Lw: ["x'", 'Rw'],
        Uw: ['y', 'Dw'],
        Dw: ["y'", 'Uw'],
        Fw: ['z', 'Bw'],
        Bw: ["z'", 'Fw'],
      }[base];
    }
    if (/^[udlrfb]$/.test(base)) {
      const face = base.toUpperCase();
      return [`${face}w`, `${face}'`];
    }
    const slices = {
      M: ["x'", 'R', "L'"],
      E: ["y'", 'U', "D'"],
      S: ['z', "F'", 'B'],
    };
    if (slices[base]) return slices[base];
    if (size === 5) {
      return {
        m: ["x'", 'Rw', "Lw'"],
        e: ["y'", 'Uw', "Dw'"],
        s: ['z', "Fw'", 'Bw'],
      }[base] || null;
    }
    return null;
  }

  function expandBigMove(move, size) {
    const parsed = splitBigMove(move, size);
    const expansion = compositeExpansion(parsed.base, parsed.triple, size);
    if (expansion) return applySequenceSuffix(expansion, parsed.suffix);
    if (parsed.triple) throw new Error(`Unsupported triple-wide move: ${move}`);
    return [`${parsed.base}${parsed.suffix}`];
  }

  function normalizeBigCubeMoves(scramble, size) {
    if (typeof scramble !== 'string') throw new Error('Scramble must be text.');
    return scramble.trim().split(/\s+/).filter(Boolean).flatMap((move) => (
      expandBigMove(move, size)
    ));
  }

  function turnSpec(move, size) {
    const parsed = splitBigMove(move, size);
    if (parsed.triple || compositeExpansion(parsed.base, false, size)) {
      throw new Error(`Move must be expanded before execution: ${move}`);
    }
    if (/^[xyz]$/.test(parsed.base)) {
      return { rotation: `${parsed.base}${parsed.suffix}` };
    }
    const face = parsed.base[0];
    const isWide = parsed.base.endsWith('w');
    const { axis, sign } = FACE_AXES[face];
    const maximum = size - 1;
    const layers = [sign * maximum];
    if (isWide) layers.push(sign * (maximum - 2));
    const multiplier = parsed.suffix === "'" ? -1 : parsed.suffix === '2' ? 2 : 1;
    return {
      axis,
      layers: new Set(layers),
      quarterTurns: -sign * multiplier,
    };
  }

  function applyTurnToRecords(records, spec) {
    for (const record of records) {
      if (!spec.layers.has(record.position[spec.axis])) continue;
      record.position = rotateVector(record.position, spec.axis, spec.quarterTurns);
      record.normal = rotateVector(record.normal, spec.axis, spec.quarterTurns);
    }
  }

  function rotationAxisAndTurns(rotation) {
    const base = rotation[0].toLowerCase();
    const suffix = rotation.slice(1);
    const axis = { x: 0, y: 1, z: 2 }[base];
    const multiplier = suffix === "'" ? -1 : suffix === '2' ? 2 : 1;
    return { axis, quarterTurns: -multiplier };
  }

  function buildCornerOrientationChoices() {
    const geometry = geometryForSize(4).corner;
    const locationFor = (label, sequence) => {
      const source = geometry.records.find((record) => record.home === label);
      let position = [...source.position];
      let normal = [...source.normal];
      for (const rotation of sequence) {
        const spec = rotationAxisAndTurns(rotation);
        position = rotateVector(position, spec.axis, spec.quarterTurns);
        normal = rotateVector(normal, spec.axis, spec.quarterTurns);
      }
      return geometry.locationByGeometry.get(geometryKey(position, normal));
    };
    const queue = [[]];
    const seen = new Set();
    const choices = new Map();
    while (queue.length) {
      const sequence = queue.shift();
      const key = CORNER_STICKERS.map((label) => locationFor(label, sequence)).join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      for (const sticker of CORNER_STICKERS) {
        if (locationFor(sticker, sequence) === 'UFR' && !choices.has(sticker)) {
          choices.set(sticker, [...sequence]);
        }
      }
      for (const rotation of ['x', 'y', 'z']) queue.push([...sequence, rotation]);
    }
    if (seen.size !== 24 || choices.size !== 24) {
      throw new Error('Failed to enumerate the 24 cube orientations.');
    }
    return choices;
  }

  const ORIENTATION_BY_CORNER_STICKER = buildCornerOrientationChoices();

  function orientationForCornerSticker(sticker) {
    const sequence = ORIENTATION_BY_CORNER_STICKER.get(sticker);
    if (!sequence) throw new Error(`Unknown oriented corner sticker: ${sticker}`);
    return [...sequence];
  }

  function projectState(records, geometry, valueForHome = (home) => home) {
    const state = {};
    for (const record of records) {
      const location = geometry.locationByGeometry.get(
        geometryKey(record.position, record.normal),
      );
      if (!location) {
        throw new Error(`Tracked ${record.home} sticker escaped its canonical orbit.`);
      }
      if (state[location] !== undefined) {
        throw new Error(`Two tracked stickers occupy ${location}.`);
      }
      state[location] = valueForHome(record.home);
    }
    return state;
  }

  function buildBigCubeState(
    scramble,
    size = 4,
    orientedCornerSticker = 'UFR',
  ) {
    const geometry = geometryForSize(size);
    const active = Object.fromEntries(Object.entries(geometry).map(([kind, entry]) => [
      kind,
      cloneRecords(entry.records),
    ]));
    let orientation = orientationToMoveMapping(
      orientationForCornerSticker(orientedCornerSticker).join(' '),
    );
    const normalizedMoves = normalizeBigCubeMoves(scramble, size);
    const executedMoves = [];
    for (const move of normalizedMoves) {
      const spec = turnSpec(move, size);
      if (spec.rotation) {
        orientation = applyRotationToOrientation(orientation, spec.rotation);
        continue;
      }
      const face = move[0];
      const suffix = move.endsWith("'") ? "'" : move.endsWith('2') ? '2' : '';
      const isWide = move.includes('w');
      const translated = `${orientation[face]}${isWide ? 'w' : ''}${suffix}`;
      const translatedSpec = turnSpec(translated, size);
      for (const records of Object.values(active)) {
        applyTurnToRecords(records, translatedSpec);
      }
      executedMoves.push(translated);
    }

    return {
      size,
      oriented_corner_sticker: orientedCornerSticker,
      tracing_orientation: orientationForCornerSticker(orientedCornerSticker).join(' '),
      normalized_moves: normalizedMoves,
      executed_moves: executedMoves,
      corners: projectState(active.corner, geometry.corner),
      wings: projectState(active.wing, geometry.wing),
      xcenters: projectState(active.xcenter, geometry.xcenter, (home) => home[0]),
      ...(size === 5
        ? {
            pluscenters: projectState(
              active.pluscenter,
              geometry.pluscenter,
              (home) => home[0],
            ),
          }
        : {}),
    };
  }

  const api = {
    buildBigCubeState,
    CORNER_STICKERS,
    expandBigMove,
    normalizeBigCubeMoves,
    orientationForCornerSticker,
    PLUSCENTER_LOCATIONS,
    splitBigMove,
    WING_LOCATIONS,
    XCENTER_LOCATIONS,
  };

  global.SsiCoreModules = global.SsiCoreModules || {};
  Object.assign(global.SsiCoreModules, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
