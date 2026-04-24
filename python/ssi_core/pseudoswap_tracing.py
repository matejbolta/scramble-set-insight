from .edge_common import (
    remove_from_list_edg,
    scr_to_scrambled_state_edg,
    switch_with_buffer_edg,
    trace_state_edg_floating,
)

def solved_edg_pseudoswap(state, parity):
    solved_list = []
    for e in ['UB', 'UL', 'FL', 'FR', 'BL', 'BR', 'DF', 'DR', 'DB', 'DL']:
        if state[e] == e:
            solved_list.append(e)
    if not parity and state['UR'] == 'UR':
        solved_list.append('UR')
    elif parity and state['UR'] == 'UF':
        solved_list.append('UR')
    return solved_list

def flipped_edg_pseudoswap(state, parity):
    flipped_list = []
    for e in ['UB', 'UL', 'FL', 'FR', 'BL', 'BR', 'DF', 'DR', 'DB', 'DL']:
        if state[e] == e[::-1]:
            flipped_list.append(e)
    if not parity and state['UR'] == 'RU':
        flipped_list.append('UR')
    elif parity and state['UR'] == 'FU':
        flipped_list.append('UR')
    return flipped_list

def trace_state_edg_pseudoswap(state, parity):
    need_visiting = [
        'UR', 'RU', 'UB', 'BU', 'UL', 'LU', 'FL', 'LF', 'FR', 'RF', 'BL',
        'LB', 'BR', 'RB', 'DF', 'FD', 'DR', 'RD', 'DB', 'BD', 'DL', 'LD']
    solved_list = solved_edg_pseudoswap(state, parity=parity)
    flipped_list = flipped_edg_pseudoswap(state, parity=parity)
    for sticker in solved_list:
        need_visiting = remove_from_list_edg(need_visiting, sticker)
    for sticker in flipped_list:
        need_visiting = remove_from_list_edg(need_visiting, sticker)

    traced_letters = []

    while need_visiting:
        if (not parity and state['UF'] in 'UF FU') or (parity and state['UF'] in 'UR RU'):
            state = switch_with_buffer_edg('UF', need_visiting[0], state)
            traced_letters.append(need_visiting[0])
        else:
            traced_letters.append(state['UF'].replace('F', 'R'))
            need_visiting = remove_from_list_edg(need_visiting, state['UF'].replace('F', 'R'))
            state = switch_with_buffer_edg('UF', state['UF'].replace('F', 'R'), state)

    return traced_letters, flipped_list

def trace_scr_edg_pseudoswap(scr, parity, tracing_orientation):
    traced_list, flipped_list = trace_state_edg_pseudoswap(scr_to_scrambled_state_edg(scr, tracing_orientation), parity)
    return traced_list, flipped_list

def trace_state_edg_pseudoswap_segments(state, parity, edge_buffers=('UF',)):
    solved_list = solved_edg_pseudoswap(state, parity=parity)
    flipped_list = flipped_edg_pseudoswap(state, parity=parity)
    segments = trace_state_edg_floating(state, solved_list, flipped_list, edge_buffers=edge_buffers, edge_method='pseudoswap', parity=parity)
    return segments, flipped_list

def trace_scr_edg_pseudoswap_segments(scr, parity, tracing_orientation, edge_buffers=('UF',)):
    return trace_state_edg_pseudoswap_segments(scr_to_scrambled_state_edg(scr, tracing_orientation), parity, edge_buffers=edge_buffers)
