from .scrambling import scr_to_scrambled_state_cor

CORNER_PIECE_GROUPS = (
    ('UFR', 'RUF', 'FUR'),
    ('UBR', 'BUR', 'RUB'),
    ('UBL', 'LUB', 'BUL'),
    ('UFL', 'FUL', 'LUF'),
    ('DFR', 'FDR', 'RDF'),
    ('DFL', 'LDF', 'FDL'),
    ('DBR', 'RDB', 'BDR'),
    ('DBL', 'BDL', 'LDB'),
)
CORNER_FLOAT_BUFFER_ORDER = ('UFR', 'UFL', 'UBR', 'UBL', 'RDF', 'FDL')

def get_piece_group_cor(sticker):
    for group in CORNER_PIECE_GROUPS:
        if sticker in group:
            return list(group)

def normalize_corner_buffers(corner_buffers):
    if corner_buffers == 'all':
        return list(CORNER_FLOAT_BUFFER_ORDER)
    if corner_buffers is None:
        return ['UFR']
    allowed_buffers = set(corner_buffers)
    normalized_buffers = [buffer for buffer in CORNER_FLOAT_BUFFER_ORDER if buffer in allowed_buffers]
    if not normalized_buffers:
        assert False
    return normalized_buffers

def solved_cor(state):
    solved_list = []
    for e in ['UBL', 'UBR', 'UFL', 'DFL', 'DFR', 'DBR', 'DBL']:
        if state[e] == e:
            solved_list.append(e)
    return solved_list

def twisted_cor(state):
    twisted_list = []
    u_d_stickers = ['UBL', 'UBR', 'UFL', 'DFL', 'DFR', 'DBR', 'DBL']
    for e in u_d_stickers:
        brothers = get_piece_group_cor(e)
        brothers.remove(e)
        if state[e] in brothers:
            for brother in brothers:
                if state[brother] in u_d_stickers:
                    twisted_list.append(brother)
    return twisted_list

def remove_from_list_cor(visiting_list, sticker):
    new_list = visiting_list.copy()
    all_brothers = get_piece_group_cor(sticker)
    for b in all_brothers:
        new_list.remove(b)
    return new_list

def switch_with_buffer_cor(buffer, target, state):
    new_state = state.copy()
    buffer_group = get_piece_group_cor(buffer)
    target_group = get_piece_group_cor(target)
    buffer_i = buffer_group.index(buffer)
    target_i = target_group.index(target)
    for offset in range(3):
        new_state[buffer_group[(buffer_i + offset) % 3]] = state[target_group[(target_i + offset) % 3]]
        new_state[target_group[(target_i + offset) % 3]] = state[buffer_group[(buffer_i + offset) % 3]]
    return new_state

def apply_trace_log_cor(state, trace_log):
    virtual_state = state.copy()
    for buffer, target in trace_log:
        virtual_state = switch_with_buffer_cor(buffer, target, virtual_state)
    return virtual_state

def piece_solved_in_virtual_state_cor(state, sticker):
    return state[sticker] == sticker

def piece_in_its_place_cor(state, sticker):
    return state[sticker] in get_piece_group_cor(sticker)

def trace_state_cor_segments(state, corner_buffers=('UFR',)):
    active_buffers = normalize_corner_buffers(corner_buffers)
    current_buffer_i = 0
    current_buffer = active_buffers[current_buffer_i]
    need_visiting = [sticker for group in CORNER_PIECE_GROUPS for sticker in group if sticker not in get_piece_group_cor(current_buffer)]
    solved_list = solved_cor(state)
    twisted_list = twisted_cor(state)
    for sticker in solved_list:
        need_visiting = remove_from_list_cor(need_visiting, sticker)
    for sticker in twisted_list:
        need_visiting = remove_from_list_cor(need_visiting, sticker)

    trace_log = []
    segments = []

    def ensure_current_segment():
        if not segments or segments[-1]['buffer'] != current_buffer:
            segments.append({'buffer': current_buffer, 'targets': []})

    while need_visiting:
        virtual_state = apply_trace_log_cor(state, trace_log)

        if piece_solved_in_virtual_state_cor(virtual_state, current_buffer):
            floated = False
            for next_buffer_i in range(current_buffer_i + 1, len(active_buffers)):
                next_buffer = active_buffers[next_buffer_i]
                if piece_solved_in_virtual_state_cor(virtual_state, next_buffer):
                    continue
                current_buffer_i = next_buffer_i
                current_buffer = next_buffer
                for sticker in get_piece_group_cor(current_buffer):
                    if sticker in need_visiting:
                        need_visiting.remove(sticker)
                floated = True
                break
            if floated:
                continue

        if piece_in_its_place_cor(virtual_state, current_buffer):
            target = need_visiting[0]
        else:
            need_visiting = remove_from_list_cor(need_visiting, virtual_state[current_buffer])
            target = virtual_state[current_buffer]

        ensure_current_segment()
        segments[-1]['targets'].append(target)
        trace_log.append((current_buffer, target))

    return segments

def flatten_corner_trace_segments(segments):
    return [target for segment in segments for target in segment['targets']]

def analyze_corner_trace_segments(segments):
    odd_segments = [segment for segment in segments if len(segment['targets']) % 2]
    even_segments = [segment for segment in segments if not len(segment['targets']) % 2]
    standalone_algs = sum((len(segment['targets']) + 1) // 2 for segment in segments)
    floating_algs = standalone_algs - (len(odd_segments) // 2)
    return {
        'odd_segments': odd_segments,
        'even_segments': even_segments,
        'corner_parity': bool(len(odd_segments) % 2),
        'algs': floating_algs,
    }

def trace_state_cor(state, corner_buffers=('UFR',)):
    return flatten_corner_trace_segments(trace_state_cor_segments(state, corner_buffers=corner_buffers))

def trace_scr_cor(scr, tracing_orientation, corner_buffers=('UFR',)):
    return trace_state_cor(scr_to_scrambled_state_cor(scr, tracing_orientation), corner_buffers=corner_buffers)

def trace_scr_cor_segments(scr, tracing_orientation, corner_buffers=('UFR',)):
    return trace_state_cor_segments(scr_to_scrambled_state_cor(scr, tracing_orientation), corner_buffers=corner_buffers)

def twist_direction_indentifier(scr, tracing_orientation):
    cw_stickers = ['LUF', 'BUL', 'RUB', 'RDF', 'FDL', 'LDB', 'BDR']
    cw, ccw = 0, 0
    state = scr_to_scrambled_state_cor(scr, tracing_orientation)
    twist_list = twisted_cor(state)
    for twist in twist_list:
        if twist in cw_stickers:
            cw += 1
        else:
            ccw += 1
    return cw, ccw
