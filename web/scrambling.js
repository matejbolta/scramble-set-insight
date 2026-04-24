(function (global) {
  const deps = typeof module !== 'undefined' && module.exports
    ? require('./wide-move-translator')
    : global.SsiCoreModules;

  const { scrambleTransform } = deps;

  function cloneState(state) {
    return { ...state };
  }

  const SOLVED_STATE_EDG = {
    UB: 'UB', UR: 'UR', UF: 'UF', UL: 'UL',
    LU: 'LU', LF: 'LF', LD: 'LD', LB: 'LB',
    FU: 'FU', FR: 'FR', FD: 'FD', FL: 'FL',
    RU: 'RU', RB: 'RB', RD: 'RD', RF: 'RF',
    BU: 'BU', BL: 'BL', BD: 'BD', BR: 'BR',
    DF: 'DF', DR: 'DR', DB: 'DB', DL: 'DL',
  };

  const SOLVED_STATE_COR = {
    UBL: 'UBL', UBR: 'UBR', UFR: 'UFR', UFL: 'UFL',
    LUB: 'LUB', LUF: 'LUF', LDF: 'LDF', LDB: 'LDB',
    FUL: 'FUL', FUR: 'FUR', FDR: 'FDR', FDL: 'FDL',
    RUF: 'RUF', RUB: 'RUB', RDB: 'RDB', RDF: 'RDF',
    BUR: 'BUR', BUL: 'BUL', BDL: 'BDL', BDR: 'BDR',
    DFL: 'DFL', DFR: 'DFR', DBR: 'DBR', DBL: 'DBL',
  };

  function applyMoveEdg(move, state) {
    const oldState = cloneState(state);
    const newState = cloneState(state);
    if (move === 'U') {
      newState.UF = oldState.UR; newState.FU = oldState.RU; newState.UR = oldState.UB; newState.RU = oldState.BU;
      newState.UB = oldState.UL; newState.BU = oldState.LU; newState.UL = oldState.UF; newState.LU = oldState.FU;
      return newState;
    } else if (move === 'D') {
      newState.DF = oldState.DL; newState.FD = oldState.LD; newState.DR = oldState.DF; newState.RD = oldState.FD;
      newState.DB = oldState.DR; newState.BD = oldState.RD; newState.DL = oldState.DB; newState.LD = oldState.BD;
      return newState;
    } else if (move === 'R') {
      newState.UR = oldState.FR; newState.RU = oldState.RF; newState.BR = oldState.UR; newState.RB = oldState.RU;
      newState.DR = oldState.BR; newState.RD = oldState.RB; newState.FR = oldState.DR; newState.RF = oldState.RD;
      return newState;
    } else if (move === 'L') {
      newState.UL = oldState.BL; newState.LU = oldState.LB; newState.FL = oldState.UL; newState.LF = oldState.LU;
      newState.DL = oldState.FL; newState.LD = oldState.LF; newState.BL = oldState.DL; newState.LB = oldState.LD;
      return newState;
    } else if (move === 'F') {
      newState.UF = oldState.LF; newState.FU = oldState.FL; newState.RF = oldState.UF; newState.FR = oldState.FU;
      newState.DF = oldState.RF; newState.FD = oldState.FR; newState.LF = oldState.DF; newState.FL = oldState.FD;
      return newState;
    } else if (move === 'B') {
      newState.UB = oldState.RB; newState.BU = oldState.BR; newState.LB = oldState.UB; newState.BL = oldState.BU;
      newState.DB = oldState.LB; newState.BD = oldState.BL; newState.RB = oldState.DB; newState.BR = oldState.BD;
      return newState;
    } else if (move === 'U2') return applyMoveEdg('U', applyMoveEdg('U', oldState));
    else if (move === "U'") return applyMoveEdg('U', applyMoveEdg('U', applyMoveEdg('U', oldState)));
    else if (move === 'D2') return applyMoveEdg('D', applyMoveEdg('D', oldState));
    else if (move === "D'") return applyMoveEdg('D', applyMoveEdg('D', applyMoveEdg('D', oldState)));
    else if (move === 'R2') return applyMoveEdg('R', applyMoveEdg('R', oldState));
    else if (move === "R'") return applyMoveEdg('R', applyMoveEdg('R', applyMoveEdg('R', oldState)));
    else if (move === 'L2') return applyMoveEdg('L', applyMoveEdg('L', oldState));
    else if (move === "L'") return applyMoveEdg('L', applyMoveEdg('L', applyMoveEdg('L', oldState)));
    else if (move === 'F2') return applyMoveEdg('F', applyMoveEdg('F', oldState));
    else if (move === "F'") return applyMoveEdg('F', applyMoveEdg('F', applyMoveEdg('F', oldState)));
    else if (move === 'B2') return applyMoveEdg('B', applyMoveEdg('B', oldState));
    else if (move === "B'") return applyMoveEdg('B', applyMoveEdg('B', applyMoveEdg('B', oldState)));
    return newState;
  }

  function applyScrambleEdg(scramble, state) {
    let nextState = cloneState(state);
    for (const move of scramble.split(' ')) {
      nextState = applyMoveEdg(move, nextState);
    }
    return nextState;
  }

  function scrToScrambledStateEdg(scr, tracingOrientation) {
    const normalizedScramble = scrambleTransform(scr, tracingOrientation);
    return applyScrambleEdg(normalizedScramble, SOLVED_STATE_EDG);
  }

  function applyMoveCor(move, state) {
    const oldState = cloneState(state);
    const newState = cloneState(state);
    if (move === 'U') {
      newState.UFR = oldState.UBR; newState.UBR = oldState.UBL; newState.UBL = oldState.UFL; newState.UFL = oldState.UFR;
      newState.FUL = oldState.RUF; newState.RUF = oldState.BUR; newState.BUR = oldState.LUB; newState.LUB = oldState.FUL;
      newState.FUR = oldState.RUB; newState.RUB = oldState.BUL; newState.BUL = oldState.LUF; newState.LUF = oldState.FUR;
      return newState;
    } else if (move === 'D') {
      newState.DFR = oldState.DFL; newState.DFL = oldState.DBL; newState.DBL = oldState.DBR; newState.DBR = oldState.DFR;
      newState.FDL = oldState.LDB; newState.LDB = oldState.BDR; newState.BDR = oldState.RDF; newState.RDF = oldState.FDL;
      newState.FDR = oldState.LDF; newState.LDF = oldState.BDL; newState.BDL = oldState.RDB; newState.RDB = oldState.FDR;
      return newState;
    } else if (move === 'R') {
      newState.UFR = oldState.FDR; newState.FDR = oldState.DBR; newState.DBR = oldState.BUR; newState.BUR = oldState.UFR;
      newState.FUR = oldState.DFR; newState.DFR = oldState.BDR; newState.BDR = oldState.UBR; newState.UBR = oldState.FUR;
      newState.RUF = oldState.RDF; newState.RDF = oldState.RDB; newState.RDB = oldState.RUB; newState.RUB = oldState.RUF;
      return newState;
    } else if (move === 'L') {
      newState.FUL = oldState.UBL; newState.UBL = oldState.BDL; newState.BDL = oldState.DFL; newState.DFL = oldState.FUL;
      newState.UFL = oldState.BUL; newState.BUL = oldState.DBL; newState.DBL = oldState.FDL; newState.FDL = oldState.UFL;
      newState.LUF = oldState.LUB; newState.LUB = oldState.LDB; newState.LDB = oldState.LDF; newState.LDF = oldState.LUF;
      return newState;
    } else if (move === 'F') {
      newState.FUL = oldState.FDL; newState.FDL = oldState.FDR; newState.FDR = oldState.FUR; newState.FUR = oldState.FUL;
      newState.UFR = oldState.LUF; newState.LUF = oldState.DFL; newState.DFL = oldState.RDF; newState.RDF = oldState.UFR;
      newState.RUF = oldState.UFL; newState.UFL = oldState.LDF; newState.LDF = oldState.DFR; newState.DFR = oldState.RUF;
      return newState;
    } else if (move === 'B') {
      newState.UBR = oldState.RDB; newState.RDB = oldState.DBL; newState.DBL = oldState.LUB; newState.LUB = oldState.UBR;
      newState.BUR = oldState.BDR; newState.BDR = oldState.BDL; newState.BDL = oldState.BUL; newState.BUL = oldState.BUR;
      newState.RUB = oldState.DBR; newState.DBR = oldState.LDB; newState.LDB = oldState.UBL; newState.UBL = oldState.RUB;
      return newState;
    } else if (move === 'U2') return applyMoveCor('U', applyMoveCor('U', oldState));
    else if (move === "U'") return applyMoveCor('U', applyMoveCor('U', applyMoveCor('U', oldState)));
    else if (move === 'D2') return applyMoveCor('D', applyMoveCor('D', oldState));
    else if (move === "D'") return applyMoveCor('D', applyMoveCor('D', applyMoveCor('D', oldState)));
    else if (move === 'R2') return applyMoveCor('R', applyMoveCor('R', oldState));
    else if (move === "R'") return applyMoveCor('R', applyMoveCor('R', applyMoveCor('R', oldState)));
    else if (move === 'L2') return applyMoveCor('L', applyMoveCor('L', oldState));
    else if (move === "L'") return applyMoveCor('L', applyMoveCor('L', applyMoveCor('L', oldState)));
    else if (move === 'F2') return applyMoveCor('F', applyMoveCor('F', oldState));
    else if (move === "F'") return applyMoveCor('F', applyMoveCor('F', applyMoveCor('F', oldState)));
    else if (move === 'B2') return applyMoveCor('B', applyMoveCor('B', oldState));
    else if (move === "B'") return applyMoveCor('B', applyMoveCor('B', applyMoveCor('B', oldState)));
    return newState;
  }

  function applyScrambleCor(scramble, state) {
    let nextState = cloneState(state);
    for (const move of scramble.split(' ')) {
      nextState = applyMoveCor(move, nextState);
    }
    return nextState;
  }

  function scrToScrambledStateCor(scr, tracingOrientation) {
    const normalizedScramble = scrambleTransform(scr, tracingOrientation);
    return applyScrambleCor(normalizedScramble, SOLVED_STATE_COR);
  }

  const api = {
    SOLVED_STATE_COR,
    SOLVED_STATE_EDG,
    applyMoveCor,
    applyMoveEdg,
    applyScrambleCor,
    applyScrambleEdg,
    scrToScrambledStateCor,
    scrToScrambledStateEdg,
  };

  global.SsiCoreModules = global.SsiCoreModules || {};
  Object.assign(global.SsiCoreModules, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
