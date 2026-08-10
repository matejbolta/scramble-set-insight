from .edge_common import (
    remove_from_list_edg,
    scr_to_scrambled_state_edg,
    switch_with_buffer_edg,
    trace_state_edg_floating,
)

def solved_edg_weakswap(state):
    solved_list = []
    for e in ['UB', 'UR', 'UL', 'FL', 'FR', 'BL', 'BR', 'DF', 'DR', 'DB', 'DL']:
        if state[e] == e:
            solved_list.append(e)
    if state['UR'] == 'UF':
        solved_list.append('UR')
    return solved_list

def flipped_edg_weakswap(state):
    flipped_list = []
    for e in ['UB', 'UL', 'FL', 'FR', 'BL', 'BR', 'DF', 'DR', 'DB', 'DL']:
        if state[e] == e[::-1]:
            flipped_list.append(e)
    return flipped_list

def trace_state_edg_weakswap(state):
    need_visiting = [
        'UR', 'RU', 'UB', 'BU', 'UL', 'LU', 'FL', 'LF', 'FR', 'RF', 'BL',
        'LB', 'BR', 'RB', 'DF', 'FD', 'DR', 'RD', 'DB', 'BD', 'DL', 'LD']
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
            flipped_list.append('UR')
            break
        elif state['UF'] in 'UF FU UR RU' and not weakswap:
            if state['UF'] in 'UR RU':
                target = state['UF']
            elif state['UF'] == 'UF':
                target = 'UR'
            else:
                target = 'RU'
            traced_letters.append(target)
            need_visiting = remove_from_list_edg(need_visiting, 'UR')
            state = switch_with_buffer_edg('UF', target, state)
            weakswap = 1
        elif state['UF'] in 'UF FU UR RU' and weakswap:
            state = switch_with_buffer_edg('UF', need_visiting[0], state)
            traced_letters.append(need_visiting[0])
        else:
            need_visiting = remove_from_list_edg(need_visiting, state['UF'])
            traced_letters.append(state['UF'])
            state = switch_with_buffer_edg('UF', state['UF'], state)

    if len(traced_letters) % 2 and not len(flipped_list) % 2:
        traced_letters.append('UR')
    elif len(traced_letters) % 2 and len(flipped_list) % 2:
        traced_letters.append('RU')

    return traced_letters, flipped_list

def trace_scr_edg_weakswap(scr, tracing_orientation):
    traced_list, flipped_list = trace_state_edg_weakswap(scr_to_scrambled_state_edg(scr, tracing_orientation))
    return traced_list, flipped_list

def trace_state_edg_weakswap_segments(state, edge_buffers=('UF',)):
    solved_list = solved_edg_weakswap(state)
    flipped_list = flipped_edg_weakswap(state)
    segments = trace_state_edg_floating(state, solved_list, flipped_list, edge_buffers=edge_buffers, edge_method='weakswap')
    return segments, flipped_list

def trace_scr_edg_weakswap_segments(scr, tracing_orientation, edge_buffers=('UF',)):
    return trace_state_edg_weakswap_segments(scr_to_scrambled_state_edg(scr, tracing_orientation), edge_buffers=edge_buffers)
