from .wide_move_translator import scramble_transform

SOLVED_STATE_EDG = {
    'UB': 'UB', 'UR': 'UR', 'UF': 'UF', 'UL': 'UL',
    'LU': 'LU', 'LF': 'LF', 'LD': 'LD', 'LB': 'LB',
    'FU': 'FU', 'FR': 'FR', 'FD': 'FD', 'FL': 'FL',
    'RU': 'RU', 'RB': 'RB', 'RD': 'RD', 'RF': 'RF',
    'BU': 'BU', 'BL': 'BL', 'BD': 'BD', 'BR': 'BR',
    'DF': 'DF', 'DR': 'DR', 'DB': 'DB', 'DL': 'DL',
}

SOLVED_STATE_COR = {
    'UBL': 'UBL', 'UBR': 'UBR', 'UFR': 'UFR', 'UFL': 'UFL',
    'LUB': 'LUB', 'LUF': 'LUF', 'LDF': 'LDF', 'LDB': 'LDB',
    'FUL': 'FUL', 'FUR': 'FUR', 'FDR': 'FDR', 'FDL': 'FDL',
    'RUF': 'RUF', 'RUB': 'RUB', 'RDB': 'RDB', 'RDF': 'RDF',
    'BUR': 'BUR', 'BUL': 'BUL', 'BDL': 'BDL', 'BDR': 'BDR',
    'DFL': 'DFL', 'DFR': 'DFR', 'DBR': 'DBR', 'DBL': 'DBL',
}

def apply_move_edg(move, state):
    old_state = state.copy()
    new_state = state.copy()

    if move == 'U':
        new_state['UF'] = old_state['UR']
        new_state['FU'] = old_state['RU']
        new_state['UR'] = old_state['UB']
        new_state['RU'] = old_state['BU']
        new_state['UB'] = old_state['UL']
        new_state['BU'] = old_state['LU']
        new_state['UL'] = old_state['UF']
        new_state['LU'] = old_state['FU']
        return new_state
    elif move == 'D':
        new_state['DF'] = old_state['DL']
        new_state['FD'] = old_state['LD']
        new_state['DR'] = old_state['DF']
        new_state['RD'] = old_state['FD']
        new_state['DB'] = old_state['DR']
        new_state['BD'] = old_state['RD']
        new_state['DL'] = old_state['DB']
        new_state['LD'] = old_state['BD']
        return new_state
    elif move == 'R':
        new_state['UR'] = old_state['FR']
        new_state['RU'] = old_state['RF']
        new_state['BR'] = old_state['UR']
        new_state['RB'] = old_state['RU']
        new_state['DR'] = old_state['BR']
        new_state['RD'] = old_state['RB']
        new_state['FR'] = old_state['DR']
        new_state['RF'] = old_state['RD']
        return new_state
    elif move == 'L':
        new_state['UL'] = old_state['BL']
        new_state['LU'] = old_state['LB']
        new_state['FL'] = old_state['UL']
        new_state['LF'] = old_state['LU']
        new_state['DL'] = old_state['FL']
        new_state['LD'] = old_state['LF']
        new_state['BL'] = old_state['DL']
        new_state['LB'] = old_state['LD']
        return new_state
    elif move == 'F':
        new_state['UF'] = old_state['LF']
        new_state['FU'] = old_state['FL']
        new_state['RF'] = old_state['UF']
        new_state['FR'] = old_state['FU']
        new_state['DF'] = old_state['RF']
        new_state['FD'] = old_state['FR']
        new_state['LF'] = old_state['DF']
        new_state['FL'] = old_state['FD']
        return new_state
    elif move == 'B':
        new_state['UB'] = old_state['RB']
        new_state['BU'] = old_state['BR']
        new_state['LB'] = old_state['UB']
        new_state['BL'] = old_state['BU']
        new_state['DB'] = old_state['LB']
        new_state['BD'] = old_state['BL']
        new_state['RB'] = old_state['DB']
        new_state['BR'] = old_state['BD']
        return new_state
    elif move == 'U2':
        return apply_move_edg('U', apply_move_edg('U', old_state))
    elif move == "U'":
        return apply_move_edg('U', apply_move_edg('U', apply_move_edg('U', old_state)))
    elif move == 'D2':
        return apply_move_edg('D', apply_move_edg('D', old_state))
    elif move == "D'":
        return apply_move_edg('D', apply_move_edg('D', apply_move_edg('D', old_state)))
    elif move == 'R2':
        return apply_move_edg('R', apply_move_edg('R', old_state))
    elif move == "R'":
        return apply_move_edg('R', apply_move_edg('R', apply_move_edg('R', old_state)))
    elif move == 'L2':
        return apply_move_edg('L', apply_move_edg('L', old_state))
    elif move == "L'":
        return apply_move_edg('L', apply_move_edg('L', apply_move_edg('L', old_state)))
    elif move == 'F2':
        return apply_move_edg('F', apply_move_edg('F', old_state))
    elif move == "F'":
        return apply_move_edg('F', apply_move_edg('F', apply_move_edg('F', old_state)))
    elif move == 'B2':
        return apply_move_edg('B', apply_move_edg('B', old_state))
    elif move == "B'":
        return apply_move_edg('B', apply_move_edg('B', apply_move_edg('B', old_state)))

def apply_scramble_edg(scramble, state):
    state = state.copy()
    for move in scramble.split(' '):
        state = apply_move_edg(move, state)
    return state

def scr_to_scrambled_state_edg(scr, tracing_orientation):
    initial_state = SOLVED_STATE_EDG.copy()
    normalized_scramble = scramble_transform(scr, tracing_orientation)
    return apply_scramble_edg(normalized_scramble, initial_state)

def apply_move_cor(move, state):
    old_state = state.copy()
    new_state = state.copy()
    if move == 'U':
        new_state['UFR'] = old_state['UBR']
        new_state['UBR'] = old_state['UBL']
        new_state['UBL'] = old_state['UFL']
        new_state['UFL'] = old_state['UFR']
        new_state['FUL'] = old_state['RUF']
        new_state['RUF'] = old_state['BUR']
        new_state['BUR'] = old_state['LUB']
        new_state['LUB'] = old_state['FUL']
        new_state['FUR'] = old_state['RUB']
        new_state['RUB'] = old_state['BUL']
        new_state['BUL'] = old_state['LUF']
        new_state['LUF'] = old_state['FUR']
        return new_state
    elif move == 'D':
        new_state['DFR'] = old_state['DFL']
        new_state['DFL'] = old_state['DBL']
        new_state['DBL'] = old_state['DBR']
        new_state['DBR'] = old_state['DFR']
        new_state['FDL'] = old_state['LDB']
        new_state['LDB'] = old_state['BDR']
        new_state['BDR'] = old_state['RDF']
        new_state['RDF'] = old_state['FDL']
        new_state['FDR'] = old_state['LDF']
        new_state['LDF'] = old_state['BDL']
        new_state['BDL'] = old_state['RDB']
        new_state['RDB'] = old_state['FDR']
        return new_state
    elif move == 'R':
        new_state['UFR'] = old_state['FDR']
        new_state['FDR'] = old_state['DBR']
        new_state['DBR'] = old_state['BUR']
        new_state['BUR'] = old_state['UFR']
        new_state['FUR'] = old_state['DFR']
        new_state['DFR'] = old_state['BDR']
        new_state['BDR'] = old_state['UBR']
        new_state['UBR'] = old_state['FUR']
        new_state['RUF'] = old_state['RDF']
        new_state['RDF'] = old_state['RDB']
        new_state['RDB'] = old_state['RUB']
        new_state['RUB'] = old_state['RUF']
        return new_state
    elif move == 'L':
        new_state['FUL'] = old_state['UBL']
        new_state['UBL'] = old_state['BDL']
        new_state['BDL'] = old_state['DFL']
        new_state['DFL'] = old_state['FUL']
        new_state['UFL'] = old_state['BUL']
        new_state['BUL'] = old_state['DBL']
        new_state['DBL'] = old_state['FDL']
        new_state['FDL'] = old_state['UFL']
        new_state['LUF'] = old_state['LUB']
        new_state['LUB'] = old_state['LDB']
        new_state['LDB'] = old_state['LDF']
        new_state['LDF'] = old_state['LUF']
        return new_state
    elif move == 'F':
        new_state['FUL'] = old_state['FDL']
        new_state['FDL'] = old_state['FDR']
        new_state['FDR'] = old_state['FUR']
        new_state['FUR'] = old_state['FUL']
        new_state['UFR'] = old_state['LUF']
        new_state['LUF'] = old_state['DFL']
        new_state['DFL'] = old_state['RDF']
        new_state['RDF'] = old_state['UFR']
        new_state['RUF'] = old_state['UFL']
        new_state['UFL'] = old_state['LDF']
        new_state['LDF'] = old_state['DFR']
        new_state['DFR'] = old_state['RUF']
        return new_state
    elif move == 'B':
        new_state['UBR'] = old_state['RDB']
        new_state['RDB'] = old_state['DBL']
        new_state['DBL'] = old_state['LUB']
        new_state['LUB'] = old_state['UBR']
        new_state['BUR'] = old_state['BDR']
        new_state['BDR'] = old_state['BDL']
        new_state['BDL'] = old_state['BUL']
        new_state['BUL'] = old_state['BUR']
        new_state['RUB'] = old_state['DBR']
        new_state['DBR'] = old_state['LDB']
        new_state['LDB'] = old_state['UBL']
        new_state['UBL'] = old_state['RUB']
        return new_state
    elif move == 'U2':
        return apply_move_cor('U', apply_move_cor('U', old_state))
    elif move == "U'":
        return apply_move_cor('U', apply_move_cor('U', apply_move_cor('U', old_state)))
    elif move == 'D2':
        return apply_move_cor('D', apply_move_cor('D', old_state))
    elif move == "D'":
        return apply_move_cor('D', apply_move_cor('D', apply_move_cor('D', old_state)))
    elif move == 'R2':
        return apply_move_cor('R', apply_move_cor('R', old_state))
    elif move == "R'":
        return apply_move_cor('R', apply_move_cor('R', apply_move_cor('R', old_state)))
    elif move == 'L2':
        return apply_move_cor('L', apply_move_cor('L', old_state))
    elif move == "L'":
        return apply_move_cor('L', apply_move_cor('L', apply_move_cor('L', old_state)))
    elif move == 'F2':
        return apply_move_cor('F', apply_move_cor('F', old_state))
    elif move == "F'":
        return apply_move_cor('F', apply_move_cor('F', apply_move_cor('F', old_state)))
    elif move == 'B2':
        return apply_move_cor('B', apply_move_cor('B', old_state))
    elif move == "B'":
        return apply_move_cor('B', apply_move_cor('B', apply_move_cor('B', old_state)))

def apply_scramble_cor(scramble, state):
    state = state.copy()
    for move in scramble.split(' '):
        state = apply_move_cor(move, state)
    return state

def scr_to_scrambled_state_cor(scr, tracing_orientation):
    initial_state = SOLVED_STATE_COR.copy()
    normalized_scramble = scramble_transform(scr, tracing_orientation)
    return apply_scramble_cor(normalized_scramble, initial_state)
