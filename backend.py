import re

### WIDE MOVE TRANSLATOR

def translate_wide_moves(wide_moves):
    '''Translating last or last 2 moves in standard bld scramble to "outer" notation.'''
    standard_orientation = {
        "White": "U", "Yellow": "D", "Green": "F", "Blue": "B", "Red": "R", "Orange": "L" }
    wide_move_mappings = {
        "Uw":  {"U": "White",  "D": "Yellow", "F": "Red",    "B": "Orange", "R": "Blue",   "L": "Green"},
        "Uw'": {"U": "White",  "D": "Yellow", "F": "Orange", "B": "Red",    "R": "Green",  "L": "Blue"},
        "Uw2": {"U": "White",  "D": "Yellow", "F": "Blue",   "B": "Green",  "R": "Orange", "L": "Red"},
        "Rw":  {"U": "Green",  "D": "Blue",   "F": "Yellow", "B": "White",  "R": "Red",    "L": "Orange"},
        "Rw'": {"U": "Blue",   "D": "Green",  "F": "White",  "B": "Yellow", "R": "Red",    "L": "Orange"},
        "Rw2": {"U": "Yellow", "D": "White",  "F": "Blue",   "B": "Green",  "R": "Red",    "L": "Orange"},
        "Lw":  {"U": "Blue",   "D": "Green",  "F": "White",  "B": "Yellow", "R": "Red",    "L": "Orange"},
        "Lw'": {"U": "Green",  "D": "Blue",   "F": "Yellow", "B": "White",  "R": "Red",    "L": "Orange"},
        "Lw2": {"U": "Yellow", "D": "White",  "F": "Blue",   "B": "Green",  "R": "Red",    "L": "Orange"},
        "Dw":  {"U": "White",  "D": "Yellow", "F": "Orange", "B": "Red",    "R": "Green",  "L": "Blue"},
        "Dw'": {"U": "White",  "D": "Yellow", "F": "Red",    "B": "Orange", "R": "Blue",   "L": "Green"},
        "Dw2": {"U": "White",  "D": "Yellow", "F": "Blue",   "B": "Green",  "R": "Orange", "L": "Red"},
        "Fw":  {"U": "Orange", "D": "Red",    "F": "Green",  "B": "Blue",   "R": "White",  "L": "Yellow"},
        "Fw'": {"U": "Red",    "D": "Orange", "F": "Green",  "B": "Blue",   "R": "Yellow", "L": "White"},
        "Fw2": {"U": "Yellow", "D": "White",  "F": "Green",  "B": "Blue",   "R": "Orange", "L": "Red"},
        "Bw":  {"U": "Red",    "D": "Orange", "F": "Green",  "B": "Blue",   "R": "Yellow", "L": "White"},
        "Bw'": {"U": "Orange", "D": "Red",    "F": "Green",  "B": "Blue",   "R": "White",  "L": "Yellow"},
        "Bw2": {"U": "Yellow", "D": "White",  "F": "Green",  "B": "Blue",   "R": "Orange", "L": "Red"} }
    
    # Translation for the first wide move
    first_move_translation = {
        "Uw": "D", "Uw'": "D'", "Uw2": "D2",
        "Dw": "U", "Dw'": "U'", "Dw2": "U2",
        "Rw": "L", "Rw'": "L'", "Rw2": "L2",
        "Lw": "R", "Lw'": "R'", "Lw2": "R2",
        "Fw": "B", "Fw'": "B'", "Fw2": "B2",
        "Bw": "F", "Bw'": "F'", "Bw2": "F2"
    }

    if len(wide_moves) == 0:
        return []
    
    if len(wide_moves) == 1:
        # Single wide move
        return [first_move_translation[wide_moves[0]]]

    # Handling two wide moves
    if len(wide_moves) == 2:
        first_move = wide_moves[0]
        second_move = wide_moves[1]
        translated_first = first_move_translation[first_move]
        
        orientation_after_first = wide_move_mappings[first_move] # side : color
        translated_second = first_move_translation[second_move] # move in normal notation
        color_turned = orientation_after_first[translated_second[0]]
        second_side = standard_orientation[color_turned]
        if len(second_move) == 2:
            tip = ''
        elif second_move[2] == "'":
            tip = "'"
        elif second_move[2] == "2":
            tip = '2'
        else:
            assert(False)

        return [translated_first, second_side + tip]

def scramble_transform(scr):
    '''Works with at most two wide moves at the end of the scramble.'''
    scr_list = scr.split(' ')
    normal = [move for move in scr_list if not 'w' in move]
    wide = [move for move in scr_list if 'w' in move]
    wide_translated = translate_wide_moves(wide)
    new_scr_list = normal + wide_translated
    new_scr = ' '.join(new_scr_list)
    return new_scr


### SCRAMBLEING/TRACING ORIENTATION

def orientation_to_orientation_list(orientation):
    '''Receives x y z rotations string and returns list of them.'''
    return [e for e in orientation.strip().split(' ') if e] if orientation else []

def inverse_orientation(orientation):
    '''Receives x y z rotations and inverses them, returns list.'''
    orientation_list = orientation_to_orientation_list(orientation)
    inversed_orientation_list = []
    for e in orientation_list[::-1]:
        if e == 'x':
            inversed_orientation_list.append("x'")
        elif e == "x'":
            inversed_orientation_list.append("x")
        elif e == 'y':
            inversed_orientation_list.append("y'")
        elif e == "y'":
            inversed_orientation_list.append("y")
        elif e == 'z':
            inversed_orientation_list.append("z'")
        elif e == "z'":
            inversed_orientation_list.append("z")
        elif e in "x2 y2 z2":
            inversed_orientation_list.append(e)
        else:
            assert(False)

    return inversed_orientation_list


### EDGES GENERAL

SOLVED_STATE_EDG = {
    'UB': 'UB', 'UR': 'UR', 'UF': 'UF', 'UL': 'UL', 
    'LU': 'LU', 'LF': 'LF', 'LD': 'LD', 'LB': 'LB', 
    'FU': 'FU', 'FR': 'FR', 'FD': 'FD', 'FL': 'FL', 
    'RU': 'RU', 'RB': 'RB', 'RD': 'RD', 'RF': 'RF', 
    'BU': 'BU', 'BL': 'BL', 'BD': 'BD', 'BR': 'BR', 
    'DF': 'DF', 'DR': 'DR', 'DB': 'DB', 'DL': 'DL'
}

def apply_move_edg(move, state):
    '''returns state on which move is applied'''
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
    '''Receives scramble and state, returns state.'''
    state = state.copy()
    scr = scramble.split(' ')
    for move in scr:
        state = apply_move_edg(move, state)
    return state

def remove_from_list_edg(visiting_list, sticker):
    '''Receives sticker and removes both on the piece from list, returns new_list.'''
    new_list = visiting_list.copy() # Pointer safety
    new_list.remove(sticker)
    new_list.remove(sticker[::-1])
    return new_list

def switch_with_buffer_edg(target, state):
    '''Returns new state with target and buffer switched.'''
    new_state = state.copy()
    # Change buffer piece
    new_state['UF'] = state[target]
    new_state['FU'] = state[target[::-1]]
    # Change target piece
    new_state[target] = state['UF']
    new_state[target[::-1]] = state['FU']
    return new_state

def apply_rotation_edg(state, rotation):
    '''Receives state and applies single rotation.'''
    old_state = state.copy()
    new_state = state.copy()
    if rotation == 'x':
        new_state['UF'] = old_state['FD']
        new_state['FU'] = old_state['DF']
        new_state['UR'] = old_state['FR']
        new_state['RU'] = old_state['RF']
        new_state['UB'] = old_state['FU']
        new_state['BU'] = old_state['UF']
        new_state['UL'] = old_state['FL']
        new_state['LU'] = old_state['LF']
        new_state['DF'] = old_state['BD']
        new_state['FD'] = old_state['DB']
        new_state['DR'] = old_state['BR']
        new_state['RD'] = old_state['RB']
        new_state['DB'] = old_state['BU']
        new_state['BD'] = old_state['UB']
        new_state['DL'] = old_state['BL']
        new_state['LD'] = old_state['LB']
        new_state['FR'] = old_state['DR']
        new_state['RF'] = old_state['RD']
        new_state['FL'] = old_state['DL']
        new_state['LF'] = old_state['LD']
        new_state['BR'] = old_state['UR']
        new_state['RB'] = old_state['RU']
        new_state['BL'] = old_state['UL']
        new_state['LB'] = old_state['LU']
    elif rotation == 'y':
        new_state['UF'] = old_state['UR']
        new_state['FU'] = old_state['RU']
        new_state['UR'] = old_state['UB']
        new_state['RU'] = old_state['BU']
        new_state['UB'] = old_state['UL']
        new_state['BU'] = old_state['LU']
        new_state['UL'] = old_state['UF']
        new_state['LU'] = old_state['FU']
        new_state['DF'] = old_state['DR']
        new_state['FD'] = old_state['RD']
        new_state['DR'] = old_state['DB']
        new_state['RD'] = old_state['BD']
        new_state['DB'] = old_state['DL']
        new_state['BD'] = old_state['LD']
        new_state['DL'] = old_state['DF']
        new_state['LD'] = old_state['FD']
        new_state['FR'] = old_state['RB']
        new_state['RF'] = old_state['BR']
        new_state['FL'] = old_state['RF']
        new_state['LF'] = old_state['FR']
        new_state['BR'] = old_state['LB']
        new_state['RB'] = old_state['BL']
        new_state['BL'] = old_state['LF']
        new_state['LB'] = old_state['FL']
    elif rotation == "x2":
        return apply_rotation_edg(apply_rotation_edg(old_state, 'x'), 'x')
    elif rotation == "x'":
        return apply_rotation_edg(apply_rotation_edg(apply_rotation_edg(old_state, 'x'), 'x'), 'x')
    elif rotation == "y2":
        return apply_rotation_edg(apply_rotation_edg(old_state, 'y'), 'y')
    elif rotation == "y'":
        return apply_rotation_edg(apply_rotation_edg(apply_rotation_edg(old_state, 'y'), 'y'), 'y')
    elif rotation == 'z':
        return apply_rotation_edg(apply_rotation_edg(apply_rotation_edg(old_state, 'y'), "x'"), "y'")
    elif rotation == 'z2':
        return apply_rotation_edg(apply_rotation_edg(old_state, 'z'), 'z')
    elif rotation == "z'":
        return apply_rotation_edg(apply_rotation_edg(apply_rotation_edg(old_state, 'z'), 'z'), 'z')
    else:
        assert(False)

    return new_state

def rotate_edg(state, orientation_list):
    '''Receives state and orientation list, returns rotated state.'''
    state = state.copy()
    for rotation in orientation_list:
        state = apply_rotation_edg(state, rotation)
    return state

def scr_to_scrambled_state_edg(scr, tracing_orientation):
    '''Receives scramble and tracing orientation and returns scrambled state of edges.'''
    initial_state = SOLVED_STATE_EDG.copy()
    inversed_rotated_state = rotate_edg(initial_state, inverse_orientation(tracing_orientation))

    rotated_scrambled_state = apply_scramble_edg(scramble_transform(scr), inversed_rotated_state)

    # We need to rotate the state back to the initial orientation
    rotated_back_state = rotate_edg(rotated_scrambled_state, orientation_to_orientation_list(tracing_orientation))

    return rotated_back_state


### EDGES WEAKSWAP

def solved_edg_weakswap(state):
    '''Checks for solved edges. Weakswap version. Returns the list of them.'''
    solved_list = []
    for e in ['UB', 'UR', 'UL', 'FL', 'FR', 'BL', 'BR', 'DF', 'DR', 'DB', 'DL']:
        if state[e] == e:
            solved_list.append(e)
    if state['UR'] == 'UF': # Weakswap purposes
        solved_list.append('UR')
    return solved_list

def flipped_edg_weakswap(state):
    '''Checks for flipped edges. Weakswap version. Returns list of them.'''
    flipped_list = []
    for e in ['UB', 'UL', 'FL', 'FR', 'BL', 'BR', 'DF', 'DR', 'DB', 'DL']: # Don't check UR because of Weakswap
        if state[e] == e[::-1]:
            flipped_list.append(e)
    return flipped_list

def trace_state_edg_weakswap(state):
    '''Receives scrambled state. Weakswap version. Returns list of traced edge targets.'''
    # We ignore all solved (non-buffer) and flipped (non-buffer, non-UR) pieces.
    # That means we exclude them from need_visiting sticker/piece list.
    need_visiting = [
        'UR', 'RU', 'UB', 'BU', 'UL', 'LU', 'FL', 'LF', 'FR', 'RF', 'BL',
        'LB', 'BR', 'RB', 'DF', 'FD', 'DR', 'RD', 'DB', 'BD', 'DL', 'LD' ]
    solved_list = solved_edg_weakswap(state)
    flipped_list = flipped_edg_weakswap(state)
    for sticker in solved_list:
        need_visiting = remove_from_list_edg(need_visiting, sticker)
    for sticker in flipped_list:
        need_visiting = remove_from_list_edg(need_visiting, sticker)
    
    traced_letters = []
    weakswap = 1 if state['UR'] in 'UF UR' else 0

    while need_visiting:

        if need_visiting == ['UR', 'RU'] and not (len(traced_letters) % 2):
            # Even letters and UR is flipped (as the last unvisited edge)
            flipped_list.append('UR')
            break

        elif state['UF'] in 'UF FU UR RU' and not weakswap: # UF/UR piece is in buffer position, UR position is free
            # Identify target (because weakswap)
            if state['UF'] in 'UR RU':
                target = state['UF']
            elif state['UF'] == 'UF':
                target = 'UR'
            else:
                target = 'RU'
            # Add target to traced_letters
            traced_letters.append(target)
            # We consider UR piece to be solved either way (with UF or UR)
            need_visiting = remove_from_list_edg(need_visiting, 'UR')
            # We "set" this piece as buffer and solve it in UR/RU
            state = switch_with_buffer_edg(target, state)
            weakswap = 1
        
        elif state['UF'] in 'UF FU UR RU' and weakswap: # UF/UR piece is in buffer position, UR position is filled
            # We cycle break elsewhere than UR
            state = switch_with_buffer_edg(need_visiting[0], state)
            # We don't remove target piece from need_visiting, as it's not solved yet
            # Add target to traced_letters
            traced_letters.append(need_visiting[0])
            
        else: # Non-UF/UR piece in buffer position
            # We remove target piece from need_visiting
            need_visiting = remove_from_list_edg(need_visiting, state['UF'])
            # Add target to traced_letters
            traced_letters.append(state['UF'])
            # We shoot to our target
            state = switch_with_buffer_edg(state['UF'], state)
    
    # Weakswap may add last target
    if len(traced_letters) % 2 and not len(flipped_list) % 2: # Odd letters, even fipped edges
        traced_letters.append('UR')
    elif len(traced_letters) % 2 and len(flipped_list) % 2: # Odd letters, odd flipped edges
        traced_letters.append('RU')
    else: # Even letters
        pass

    return traced_letters, flipped_list

def trace_scr_edg_weakswap(scr, tracing_orientation):
    '''Receives scramble and returns list with traced targets.'''
    traced_list, flipped_list = trace_state_edg_weakswap(scr_to_scrambled_state_edg(scr, tracing_orientation))
    return traced_list, flipped_list


### EDGES PSEUDOSWAP

def solved_edg_pseudoswap(state, parity):
    '''Checks for solved edges. Pseudoswap version. Returns list of them.'''
    solved_list = []
    for e in ['UB', 'UL', 'FL', 'FR', 'BL', 'BR', 'DF', 'DR', 'DB', 'DL']:
        if state[e] == e:
            solved_list.append(e)
    if not parity and state['UR'] == 'UR': # Pseudoswap purposes
        solved_list.append('UR')
    elif parity and state['UR'] == 'UF': # Pseudoswap purposes
        solved_list.append('UR')
    return solved_list

def flipped_edg_pseudoswap(state, parity):
    '''Checks for flipped edges. Pseudoswap version. Returns list of them.'''
    flipped_list = []
    for e in ['UB', 'UL', 'FL', 'FR', 'BL', 'BR', 'DF', 'DR', 'DB', 'DL']: # Don't check UR yet because of Pseudoswap
        if state[e] == e[::-1]:
            flipped_list.append(e)
    if not parity and state['UR'] == 'RU': # Pseudoswap purposes
        flipped_list.append('UR')
    elif parity and state['UR'] == 'FU': # Pseudoswap purposes
        flipped_list.append('UR')
    return flipped_list

def trace_state_edg_pseudoswap(state, parity):
    '''Receives scrambled state. Pseudoswap version. Returns list of traced edge targets.'''
    # We ignore all solved (non-buffer) and flipped (non-buffer) pieces.
    # That means we exclude them from need_visiting sticker/piece list.
    need_visiting = [
        'UR', 'RU', 'UB', 'BU', 'UL', 'LU', 'FL', 'LF', 'FR', 'RF', 'BL',
        'LB', 'BR', 'RB', 'DF', 'FD', 'DR', 'RD', 'DB', 'BD', 'DL', 'LD' ]
    solved_list = solved_edg_pseudoswap(state, parity=parity)
    flipped_list = flipped_edg_pseudoswap(state, parity=parity)
    for sticker in solved_list:
        need_visiting = remove_from_list_edg(need_visiting, sticker)
    for sticker in flipped_list:
        need_visiting = remove_from_list_edg(need_visiting, sticker)
    
    traced_letters = []

    while need_visiting:

        if (not parity and state['UF'] in 'UF FU') or (parity and state['UF'] in 'UR RU'): # Buffer solved/flipped in place
            # We cycle break
            state = switch_with_buffer_edg(need_visiting[0], state)
            # We don't remove target piece from need_visiting, as it's not solved yet
            # Add target to traced_letters
            traced_letters.append(need_visiting[0])

        elif state['UF'] in 'UF FU UR RU': # Non-buffer UF/UR piece in buffer position
            # Remove UR/RU from need_visiting
            need_visiting = remove_from_list_edg(need_visiting, 'UR')
            # Add UR/RU to traced_letters
            traced_letters.append(state['UF'].replace('F', 'R'))
            # We shoot to our target, which is UR/RU
            state = switch_with_buffer_edg(state['UF'].replace('F', 'R'), state)

        else: # Non-buffer, non-UF/UR piece in buffer position
            # We remove target piece from need_visiting.
            need_visiting = remove_from_list_edg(need_visiting, state['UF'])
            # Add target to traced_letters
            traced_letters.append(state['UF'])
            # We shoot to our target
            state = switch_with_buffer_edg(state['UF'], state)
    
    return traced_letters

def trace_scr_edg_pseudoswap(scr, parity, tracing_orientation):
    '''Receives scramble and returns list with traced targets.'''
    traced_list = trace_state_edg_pseudoswap(scr_to_scrambled_state_edg(scr, tracing_orientation), parity)
    return traced_list


### CORNERS

SOLVED_STATE_COR = {
    'UBL': 'UBL', 'UBR': 'UBR', 'UFR': 'UFR', 'UFL': 'UFL', 
    'LUB': 'LUB', 'LUF': 'LUF', 'LDF': 'LDF', 'LDB': 'LDB', 
    'FUL': 'FUL', 'FUR': 'FUR', 'FDR': 'FDR', 'FDL': 'FDL', 
    'RUF': 'RUF', 'RUB': 'RUB', 'RDB': 'RDB', 'RDF': 'RDF', 
    'BUR': 'BUR', 'BUL': 'BUL', 'BDL': 'BDL', 'BDR': 'BDR', 
    'DFL': 'DFL', 'DFR': 'DFR', 'DBR': 'DBR', 'DBL': 'DBL'
}

def apply_move_cor(move, state):
    '''Receives cube state, performs 1 move and returns new state.'''
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
    '''Returns cube state, on which the given scramble is performed.'''
    state = state.copy()
    scr = scramble.split(' ')
    for move in scr:
        state = apply_move_cor(move, state)
    return state

def get_piece_group_cor(sticker):
    '''Returns other two stickers on given corner piece.'''
    piece_groups = [ # Organised in cw order (significant for piece swaps).
        ['UFR', 'RUF', 'FUR'],
        ['UBR', 'BUR', 'RUB'],
        ['UBL', 'LUB', 'BUL'],
        ['UFL', 'FUL', 'LUF'],
        ['DFR', 'FDR', 'RDF'],
        ['DFL', 'LDF', 'FDL'],
        ['DBR', 'RDB', 'BDR'],
        ['DBL', 'BDL', 'LDB']]
    for group in piece_groups:
        if sticker in group:
            return group.copy()

def solved_cor(state):
    '''Checks for solved corners. Returns list of their W/Y stickers.'''
    solved_list = []
    for e in ['UBL', 'UBR', 'UFL', 'DFL', 'DFR', 'DBR', 'DBL']:
        if state[e] == e:
            solved_list.append(e)
    return solved_list

def twisted_cor(state):
    '''Checks for twisted corners. Returns list of their W/Y stickers.'''
    twisted_list = []
    u_d_stickers = ['UBL', 'UBR', 'UFL', 'DFL', 'DFR', 'DBR', 'DBL']
    for e in u_d_stickers:
        brothers = get_piece_group_cor(e)
        brothers.remove(e) # Not looking for solved, only twisted
        if state[e] in brothers: # e is twisted in place
            for brother in brothers: # identify which twist it is and save it
                if state[brother] in u_d_stickers:
                    twisted_list.append(brother)
    return twisted_list

def remove_from_list_cor(visiting_list, sticker):
    '''Receives sticker and removes all 3 on the piece from list, returns new_list.'''
    new_list = visiting_list.copy() # Pointer safety
    all_brothers = get_piece_group_cor(sticker)
    for b in all_brothers:
        new_list.remove(b)
    return new_list

def switch_with_buffer_cor(target, state):
    '''Returns new state with target and buffer switched.'''
    new_state = state.copy()
    all_brothers = get_piece_group_cor(target)
    target_i = all_brothers.index(target)
    # Change buffer piece
    new_state['UFR'] = state[target]
    new_state['RUF'] = state[all_brothers[(target_i + 1) % 3]]
    new_state['FUR'] = state[all_brothers[(target_i + 2) % 3]]
    # Change target piece
    new_state[target] = state['UFR']
    new_state[all_brothers[(target_i + 1) % 3]] = state['RUF']
    new_state[all_brothers[(target_i + 2) % 3]] = state['FUR']
    return new_state

def trace_state_cor(state):
    '''Receives scrambled state. Returns list of traced corner targets.'''
    # We ignore all solved and twisted (non-buffer) pieces, as these are handled above already.
    # That means we exclude them from need_visiting sticker/piece list.
    need_visiting = [
        'UBL', 'LUB', 'BUL', 'UBR', 'RUB', 'BUR', 'UFL', 'FUL', 'LUF',
        'DFR', 'FDR', 'RDF', 'DFL', 'FDL', 'LDF', 'DBL', 'BDL', 'LDB', 'DBR', 'BDR', 'RDB' ]
    solved_list = solved_cor(state)
    twisted_list = twisted_cor(state)
    for sticker in solved_list:
        need_visiting = remove_from_list_cor(need_visiting, sticker)
    for sticker in twisted_list:
        need_visiting = remove_from_list_cor(need_visiting, sticker)
    
    traced_letters = []

    while need_visiting:

        if state['UFR'] in get_piece_group_cor('UFR'): # Buffer piece is in buffer position
            # We have to cycle break
            state = switch_with_buffer_cor(need_visiting[0], state)
            # We don't remove target piece from need_visiting, as it's not solved yet
            # Add target to traced_letters
            traced_letters.append(need_visiting[0])
        
        else: # Non-buffer piece in buffer position
            # We remove target piece from need_visiting
            need_visiting = remove_from_list_cor(need_visiting, state['UFR'])
            # Add target to traced_letters
            traced_letters.append(state['UFR'])
            # We shoot to our target
            state = switch_with_buffer_cor(state['UFR'], state)

    return traced_letters

def trace_scr_cor(scr, tracing_orientation):
    '''Receives scramble and returns list with traced targets.'''
    traced_list = trace_state_cor(scr_to_scrambled_state_cor(scramble_transform(scr), tracing_orientation))
    return traced_list

def twist_direction_indentifier(scr, tracing_orientation):
    '''Receives scramble, returns the number of CW and CCW twists.'''
    cw_stickers = ['LUF', 'BUL', 'RUB', 'RDF', 'FDL', 'LDB', 'BDR']
    # ccw_stickers = ['FUL', 'LUB', 'BUR', 'FDR', 'LDF', 'BDL', 'RDB']
    cw, ccw = 0, 0
    state = scr_to_scrambled_state_cor(scramble_transform(scr), tracing_orientation)
    twist_list = twisted_cor(state)
    for twist in twist_list:
        if twist in cw_stickers:
            cw += 1
        else: # twist in ccw_stickers
            ccw += 1
    return cw, ccw

def apply_rotation_cor(state, rotation):
    '''Receives state and applies single rotation.'''
    old_state = state.copy()
    new_state = state.copy()
    if rotation == 'x':
        new_state['UFR'] = old_state['FDR']
        new_state['UBR'] = old_state['FUR']
        new_state['UBL'] = old_state['FUL']
        new_state['UFL'] = old_state['FDL']
        new_state['FUL'] = old_state['DFL']
        new_state['FUR'] = old_state['DFR']
        new_state['RUF'] = old_state['RDF']
        new_state['RUB'] = old_state['RUF']
        new_state['BUR'] = old_state['UFR']
        new_state['BUL'] = old_state['UFL']
        new_state['LUB'] = old_state['LUF']
        new_state['LUF'] = old_state['LDF']
        new_state['FDL'] = old_state['DBL']
        new_state['FDR'] = old_state['DBR']
        new_state['RDF'] = old_state['RDB']
        new_state['RDB'] = old_state['RUB']
        new_state['BDR'] = old_state['UBR']
        new_state['BDL'] = old_state['UBL']
        new_state['LDB'] = old_state['LUB']
        new_state['LDF'] = old_state['LDB']
        new_state['DFL'] = old_state['BDL']
        new_state['DFR'] = old_state['BDR']
        new_state['DBR'] = old_state['BUR']
        new_state['DBL'] = old_state['BUL']
    elif rotation == 'y':
        new_state['UFR'] = old_state['UBR']
        new_state['UBR'] = old_state['UBL']
        new_state['UBL'] = old_state['UFL']
        new_state['UFL'] = old_state['UFR']
        new_state['FUL'] = old_state['RUF']
        new_state['FUR'] = old_state['RUB']
        new_state['RUF'] = old_state['BUR']
        new_state['RUB'] = old_state['BUL']
        new_state['BUR'] = old_state['LUB']
        new_state['BUL'] = old_state['LUF']
        new_state['LUB'] = old_state['FUL']
        new_state['LUF'] = old_state['FUR']
        new_state['FDL'] = old_state['RDF']
        new_state['FDR'] = old_state['RDB']
        new_state['RDF'] = old_state['BDR']
        new_state['RDB'] = old_state['BDL']
        new_state['BDR'] = old_state['LDB']
        new_state['BDL'] = old_state['LDF']
        new_state['LDB'] = old_state['FDL']
        new_state['LDF'] = old_state['FDR']
        new_state['DFL'] = old_state['DFR']
        new_state['DFR'] = old_state['DBR']
        new_state['DBR'] = old_state['DBL']
        new_state['DBL'] = old_state['DFL']
    elif rotation == "x2":
        return apply_rotation_cor(apply_rotation_cor(old_state, 'x'), 'x')
    elif rotation == "x'":
        return apply_rotation_cor(apply_rotation_cor(apply_rotation_cor(old_state, 'x'), 'x'), 'x')
    elif rotation == "y2":
        return apply_rotation_cor(apply_rotation_cor(old_state, 'y'), 'y')
    elif rotation == "y'":
        return apply_rotation_cor(apply_rotation_cor(apply_rotation_cor(old_state, 'y'), 'y'), 'y')
    elif rotation == 'z':
        return apply_rotation_cor(apply_rotation_cor(apply_rotation_cor(old_state, 'y'), "x'"), "y'")
    elif rotation == 'z2':
        return apply_rotation_cor(apply_rotation_cor(old_state, 'z'), 'z')
    elif rotation == "z'":
        return apply_rotation_cor(apply_rotation_cor(apply_rotation_cor(old_state, 'z'), 'z'), 'z')
    else:
        assert(False)

    return new_state

def rotate_cor(state, orientation_list):
    '''Receives state and orientation list, returns rotated state.'''
    state = state.copy()
    for rotation in orientation_list:
        state = apply_rotation_cor(state, rotation)
    return state

def scr_to_scrambled_state_cor(scr, tracing_orientation):
    '''Receives scramble and tracing orientation and returns scrambled state of corners.'''
    initial_state = SOLVED_STATE_COR.copy()
    inversed_rotated_state = rotate_cor(initial_state, inverse_orientation(tracing_orientation))

    rotated_scrambled_state = apply_scramble_cor(scramble_transform(scr), inversed_rotated_state)

    # We need to rotate the state back to the initial orientation
    rotated_back_state = rotate_cor(rotated_scrambled_state, orientation_to_orientation_list(tracing_orientation))

    return rotated_back_state


### FINISHING UP

def count_scramble_algs(scr, tracing_orientation, edge_method, flip_weight, twist_weight, ltct):
    algs = 0
    corner_list = trace_scr_cor(scr, tracing_orientation) # Odd or Even length
    twist_number = len(twisted_cor(scr_to_scrambled_state_cor(scramble_transform(scr), tracing_orientation)))

    parity = bool(len(corner_list) % 2)

    if edge_method == 'weakswap':
        edge_list, flipped_list = trace_scr_edg_weakswap(scr, tracing_orientation)
        flip_number = len(flipped_list)
    else: # edge_method == 'pseudoswap':
        edge_list = trace_scr_edg_pseudoswap(scr, parity, tracing_orientation)
        flip_number = len(flipped_edg_pseudoswap(scr_to_scrambled_state_edg(scr, tracing_orientation), parity))

    # Counting edge algs
    algs += len(edge_list) // 2

    # Counting edge flips (two_flips separately, and possibly one flip)
    two_flips = flip_number // 2
    algs += two_flips * flip_weight
    algs += flip_number % 2 # Remaining single flip

    # Counting corner algs
    algs += (len(corner_list) + 1) // 2
    
    # Counting twist algs
    two_twists = 0
    if twist_number:
        cw, ccw = twist_direction_indentifier(scr, tracing_orientation)
        floating_two_twists = min(cw, ccw)
        remaining_single_twists = abs(cw - ccw)
        two_twists += floating_two_twists
        algs += two_twists * twist_weight
        algs += remaining_single_twists

        # If we have parity, know LTCT and have a remaining_single_twist, we deduce alg count by 1
        if len(corner_list) % 2 and ltct and remaining_single_twists > 0:
            algs -= 1

    return algs, two_flips, two_twists

def extract_scramble_list(text, dnf):
    '''Receives scrambles from ScrambleGenerator or Session Statistics from csTimer. Returns scramble list.'''
    # Normalize whitespace
    lines = text.strip().splitlines()
    
    scrambles = []
    
    for line in lines:
        line = line.strip()

        # Remove comments inside [] -> from first [ to last ] -> including [ ] brackets
        line = re.sub(r'\[.*\]', '', line)
        
        # Skip headers, statistics, and session summary lines
        if any(phrase in line.lower() for phrase in [
            "generated by cstimer", "solves/total", "single", "best", "worst", "avg of", "current", "average", "mean", "time list"
        ]):
            continue
        
        # Skip DNFed scrambles if dnf is False
        match_dnf = re.search(r'DNF', line)
        if not dnf and match_dnf: 
            continue
        # Remove all 'DNF' substrings (we want to remove all non-scramble letters)
        line = re.sub(r'DNF', '', line)
        
        # Find where scramble starts (first letter)
        match_move = re.search(r'[UDRLFB]', line)
        if match_move:
            line = line[match_move.start():]  # Remove everything before the first letter
        else:
            continue  # No scramble letters found
        
        match_timestamp = re.search(r'@', line)
        if match_timestamp:
            line = line[:match_timestamp.start()]  # Keep everything before @
        
        # Final cleanup
        line = line.strip()
        if line: # Remove empty lines
            scrambles.append(line)
    
    return scrambles

def alg_counter_main(text, tracing_orientation='', edge_method='weakswap', flip_weight=1, twist_weight=1, ltct=False, dnf=False):
    '''Receives scramble list and returns aggregated alg counts.'''
    scr_list = extract_scramble_list(text, dnf)
    alg_count_list = [count_scramble_algs(scr, tracing_orientation, edge_method, flip_weight, twist_weight, ltct) for scr in scr_list]

    final_count = {}
    total_two_flips, total_two_twists = 0, 0
    
    for algs_per_scr in alg_count_list:
        final_count[algs_per_scr[0]] = final_count.get(algs_per_scr[0], 0) + 1
        total_two_flips += algs_per_scr[1]
        total_two_twists += algs_per_scr[2]
    alg_count_list = [int(e[0]) if e[0].is_integer() else e[0] for e in alg_count_list]

    final_count = {int(k) if k.is_integer() else k: v for k, v in final_count.items()}
    number_of_cases_with_n_algs_dict = dict(sorted(final_count.items())) # Sort the final dict

    total_algs = sum([k * v for k, v in final_count.items()])
    total_algs = int(total_algs) if total_algs.is_integer() else total_algs
    average_algs_per = round(total_algs / len(scr_list), 5)

    return(
        len(alg_count_list), # number of solves
        number_of_cases_with_n_algs_dict,
        average_algs_per,
        round(total_algs, 5),
        total_two_flips,
        total_two_twists,
        alg_count_list
    )
