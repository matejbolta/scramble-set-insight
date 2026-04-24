from .scrambling import scr_to_scrambled_state_edg

EDGE_FLOAT_BUFFER_ORDER_PSEUDOSWAP = ('UF', 'UB', 'UR', 'UL', 'FR', 'FL', 'DF', 'DB', 'DR', 'DL')
EDGE_FLOAT_BUFFER_ORDER_WEAKSWAP = ('UF', 'UR', 'UB', 'UL', 'FR', 'FL', 'DF', 'DB', 'DR', 'DL')
STICKER_LETTER_MAP = {
    'UBL': 'C', 'UB': 'C',
    'UBR': 'B', 'UR': 'B',
    'UFR': 'Q', 'UF': 'Q',
    'UFL': 'D', 'UL': 'D',
    'LUB': 'E', 'LU': 'E',
    'LUF': 'F', 'LF': 'F',
    'LDF': 'G', 'LD': 'G',
    'LDB': 'H', 'LB': 'H',
    'FUL': 'I', 'RU': 'I',
    'FUR': 'Y', 'FU': 'Y',
    'FDR': 'M', 'FD': 'M',
    'FDL': 'L', 'FL': 'L',
    'FR': 'J',
    'RUF': 'W',
    'RUB': 'N', 'RB': 'N',
    'RDB': 'O', 'RD': 'O',
    'RDF': 'A', 'RF': 'A',
    'BUR': 'P', 'BU': 'P',
    'BUL': 'R', 'BL': 'R',
    'BDL': 'S', 'BD': 'S',
    'BDR': 'T', 'BR': 'T',
    'DFL': 'K', 'DF': 'K',
    'DFR': 'U', 'DR': 'U',
    'DBR': 'V', 'DB': 'V',
    'DBL': 'Z', 'DL': 'Z',
}

def remove_from_list_edg(visiting_list, sticker):
    new_list = visiting_list.copy()
    new_list.remove(sticker)
    new_list.remove(sticker[::-1])
    return new_list

def get_piece_group_edg(sticker):
    return [sticker, sticker[::-1]]

def normalize_edge_buffers(edge_buffers, edge_method):
    buffer_order = EDGE_FLOAT_BUFFER_ORDER_WEAKSWAP if edge_method == 'weakswap' else EDGE_FLOAT_BUFFER_ORDER_PSEUDOSWAP
    if edge_buffers == 'all':
        return list(buffer_order)
    if edge_buffers is None:
        return ['UF']
    allowed_buffers = set(edge_buffers)
    normalized_buffers = [buffer for buffer in buffer_order if buffer in allowed_buffers]
    if not normalized_buffers:
        assert False
    return normalized_buffers

def switch_with_buffer_edg(buffer, target, state):
    new_state = state.copy()
    buffer_group = get_piece_group_edg(buffer)
    target_group = get_piece_group_edg(target)
    new_state[buffer_group[0]] = state[target_group[0]]
    new_state[buffer_group[1]] = state[target_group[1]]
    new_state[target_group[0]] = state[buffer_group[0]]
    new_state[target_group[1]] = state[buffer_group[1]]
    return new_state

def apply_trace_log_edg(state, trace_log):
    virtual_state = state.copy()
    for buffer, target in trace_log:
        virtual_state = switch_with_buffer_edg(buffer, target, virtual_state)
    return virtual_state

def piece_in_its_place_edg(state, sticker):
    return state[sticker] in get_piece_group_edg(sticker)

def piece_solved_edg(state, sticker):
    return state[sticker] == sticker

def edge_buffer_solved_for_float(state, buffer, edge_method, parity=False):
    if edge_method == 'weakswap':
        if buffer == 'UF':
            return state['UF'] in ('UF', 'UR')
        if buffer == 'UR':
            return state['UR'] in ('UR', 'UF')
        return piece_solved_edg(state, buffer)
    if buffer == 'UF':
        return state['UF'] == ('UR' if parity else 'UF')
    if buffer == 'UR':
        return state['UR'] == ('UF' if parity else 'UR')
    return piece_solved_edg(state, buffer)

def flatten_edge_trace_segments(segments):
    return [target for segment in segments for target in segment['targets']]

def sticker_to_letter(sticker):
    return STICKER_LETTER_MAP[sticker]

def stickers_to_letters(stickers):
    return [sticker_to_letter(sticker) for sticker in stickers]

def segments_to_letter_view(segments):
    return [{'buffer': sticker_to_letter(segment['buffer']), 'targets': stickers_to_letters(segment['targets'])} for segment in segments]

def pair_letters(letters):
    return [''.join(letters[i:i + 2]) for i in range(0, len(letters), 2)]

def analyze_edge_trace_segments(segments):
    odd_segments = [segment for segment in segments if len(segment['targets']) % 2]
    even_segments = [segment for segment in segments if not len(segment['targets']) % 2]
    standalone_algs = sum((len(segment['targets']) + 1) // 2 for segment in segments)
    floating_algs = standalone_algs - (len(odd_segments) // 2)
    return {
        'odd_segments': odd_segments,
        'even_segments': even_segments,
        'edge_parity': bool(len(odd_segments) % 2),
        'algs': floating_algs,
    }

def trace_state_edg_floating(state, solved_list, flipped_list, edge_buffers, edge_method, parity=False):
    active_buffers = normalize_edge_buffers(edge_buffers, edge_method)
    current_buffer_i = 0
    current_buffer = active_buffers[current_buffer_i]
    all_edge_stickers = [
        'UF', 'FU', 'UR', 'RU', 'UB', 'BU', 'UL', 'LU', 'FR', 'RF', 'FL', 'LF',
        'DF', 'FD', 'DR', 'RD', 'DB', 'BD', 'BR', 'RB', 'BL', 'LB', 'DL', 'LD',
    ]
    need_visiting = [sticker for sticker in all_edge_stickers if sticker not in get_piece_group_edg(current_buffer)]
    for sticker in solved_list:
        need_visiting = remove_from_list_edg(need_visiting, sticker)
    for sticker in flipped_list:
        need_visiting = remove_from_list_edg(need_visiting, sticker)

    trace_log = []
    segments = []

    def ensure_current_segment():
        if not segments or segments[-1]['buffer'] != current_buffer:
            segments.append({'buffer': current_buffer, 'targets': []})

    def remove_if_needed(stickers):
        for sticker in stickers:
            if sticker in need_visiting:
                need_visiting.remove(sticker)

    while need_visiting:
        virtual_state = apply_trace_log_edg(state, trace_log)

        if (
            edge_method == 'weakswap'
            and current_buffer == 'UF'
            and set(need_visiting) == {'UR', 'RU'}
            and not (len(trace_log) % 2)
        ):
            flipped_list.append('UR')
            break

        if (
            edge_method == 'weakswap'
            and current_buffer == 'UF'
            and ('UR' in need_visiting or 'RU' in need_visiting)
            and virtual_state['UF'] in ('UF', 'FU', 'UR', 'RU')
        ):
            if virtual_state['UF'] in ('UR', 'RU'):
                target = virtual_state['UF']
            elif virtual_state['UF'] == 'UF':
                target = 'UR'
            else:
                target = 'RU'
            need_visiting = remove_from_list_edg(need_visiting, 'UR')
            ensure_current_segment()
            segments[-1]['targets'].append(target)
            trace_log.append((current_buffer, target))
            continue

        if (
            edge_method == 'pseudoswap'
            and current_buffer == 'UF'
            and ('UR' in need_visiting or 'RU' in need_visiting)
            and (
                (not parity and virtual_state['UF'] in ('UR', 'RU'))
                or (parity and virtual_state['UF'] in ('UF', 'FU'))
            )
        ):
            target = virtual_state['UF'].replace('F', 'R')
            need_visiting = remove_from_list_edg(need_visiting, 'UR')
            ensure_current_segment()
            segments[-1]['targets'].append(target)
            trace_log.append((current_buffer, target))
            continue

        solved_for_float = edge_buffer_solved_for_float(virtual_state, current_buffer, edge_method, parity=parity)
        if (
            edge_method == 'pseudoswap'
            and current_buffer == 'UF'
            and ('UR' in need_visiting or 'RU' in need_visiting)
        ):
            solved_for_float = False

        cycle_break_only = piece_in_its_place_edg(virtual_state, current_buffer) and not solved_for_float
        target = None
        if not (solved_for_float or cycle_break_only):
            candidate_target = virtual_state[current_buffer]
            if candidate_target not in need_visiting:
                cycle_break_only = True
            else:
                target = candidate_target
                need_visiting = remove_from_list_edg(need_visiting, target)

        if solved_for_float:
            floated = False
            for next_buffer_i in range(current_buffer_i + 1, len(active_buffers)):
                next_buffer = active_buffers[next_buffer_i]
                if edge_buffer_solved_for_float(virtual_state, next_buffer, edge_method, parity=parity):
                    continue
                current_buffer_i = next_buffer_i
                current_buffer = next_buffer
                remove_if_needed(get_piece_group_edg(current_buffer))
                floated = True
                break

            if floated:
                continue

            target = need_visiting[0]
        elif cycle_break_only:
            target = need_visiting[0]

        ensure_current_segment()
        segments[-1]['targets'].append(target)
        trace_log.append((current_buffer, target))

    return segments

__all__ = [
    'analyze_edge_trace_segments',
    'apply_trace_log_edg',
    'edge_buffer_solved_for_float',
    'flatten_edge_trace_segments',
    'get_piece_group_edg',
    'normalize_edge_buffers',
    'pair_letters',
    'piece_in_its_place_edg',
    'piece_solved_edg',
    'remove_from_list_edg',
    'scr_to_scrambled_state_edg',
    'segments_to_letter_view',
    'sticker_to_letter',
    'stickers_to_letters',
    'switch_with_buffer_edg',
    'trace_state_edg_floating',
]
