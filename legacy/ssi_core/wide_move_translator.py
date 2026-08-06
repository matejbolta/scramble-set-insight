### WIDE MOVE TRANSLATOR

FACE_ORDER = ('U', 'D', 'F', 'B', 'R', 'L')
OPPOSITE_FACE = {
    'U': 'D',
    'D': 'U',
    'F': 'B',
    'B': 'F',
    'R': 'L',
    'L': 'R',
}
WIDE_MOVE_ROTATION = {
    'U': 'y',
    'D': "y'",
    'R': 'x',
    'L': "x'",
    'F': 'z',
    'B': "z'",
}
ROTATION_TRANSFORMS = {
    'x': {
        'U': 'F', 'F': 'D', 'D': 'B', 'B': 'U', 'L': 'L', 'R': 'R',
    },
    "x'": {
        'U': 'B', 'B': 'D', 'D': 'F', 'F': 'U', 'L': 'L', 'R': 'R',
    },
    'y': {
        'U': 'U', 'D': 'D', 'F': 'R', 'R': 'B', 'B': 'L', 'L': 'F',
    },
    "y'": {
        'U': 'U', 'D': 'D', 'F': 'L', 'L': 'B', 'B': 'R', 'R': 'F',
    },
    'z': {
        'U': 'L', 'R': 'U', 'D': 'R', 'L': 'D', 'F': 'F', 'B': 'B',
    },
    "z'": {
        'U': 'R', 'R': 'D', 'D': 'L', 'L': 'U', 'F': 'F', 'B': 'B',
    },
}

def split_move(move):
    '''Splits move into face, wide flag, and suffix.'''
    if not move:
        assert(False)

    face = move[0]
    rest = move[1:]
    is_wide = rest.startswith('w')
    suffix = rest[1:] if is_wide else rest
    if suffix not in ('', "'", '2'):
        assert(False)
    return face, is_wide, suffix

def apply_rotation_to_orientation(orientation, rotation):
    '''Updates visible-face -> standard-face mapping after a cube rotation.'''
    if rotation.endswith('2'):
        base_rotation = rotation[0]
        updated_orientation = apply_rotation_to_orientation(orientation, base_rotation)
        return apply_rotation_to_orientation(updated_orientation, base_rotation)

    transform = ROTATION_TRANSFORMS[rotation]
    return {face: orientation[transform[face]] for face in FACE_ORDER}

def orientation_to_move_mapping(orientation):
    '''Converts orientation string into visible-face -> tracing-face mapping.'''
    move_mapping = {face: face for face in FACE_ORDER}
    for rotation in inverse_orientation(orientation):
        move_mapping = apply_rotation_to_orientation(move_mapping, rotation)
    return move_mapping

def suffix_to_rotation(rotation, suffix):
    '''Applies move suffix semantics to a base rotation.'''
    if suffix == '':
        return rotation
    if suffix == '2':
        return rotation[0] + '2'
    if rotation.endswith("'"):
        return rotation[0]
    return rotation + "'"

def translate_move(move, orientation):
    '''Translates a single move into standard-orientation normal moves.'''
    face, is_wide, suffix = split_move(move)
    if not is_wide:
        return orientation[face] + suffix, orientation

    translated_face = orientation[OPPOSITE_FACE[face]]
    translated_move = translated_face + suffix
    rotation = suffix_to_rotation(WIDE_MOVE_ROTATION[face], suffix)
    updated_orientation = apply_rotation_to_orientation(orientation, rotation)
    return translated_move, updated_orientation

def scramble_transform(scr, tracing_orientation=''):
    '''Translates arbitrary wide moves and frame differences into normal moves.'''
    scr_list = [move for move in scr.split(' ') if move]
    orientation = orientation_to_move_mapping(tracing_orientation)
    translated_moves = []

    for move in scr_list:
        translated_move, orientation = translate_move(move, orientation)
        translated_moves.append(translated_move)

    return ' '.join(translated_moves)


### SCRAMBLING/TRACING ORIENTATION

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
            inversed_orientation_list.append('x')
        elif e == 'y':
            inversed_orientation_list.append("y'")
        elif e == "y'":
            inversed_orientation_list.append('y')
        elif e == 'z':
            inversed_orientation_list.append("z'")
        elif e == "z'":
            inversed_orientation_list.append('z')
        elif e in ('x2', 'y2', 'z2'):
            inversed_orientation_list.append(e)
        else:
            assert(False)

    return inversed_orientation_list
