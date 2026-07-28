import re

from .corner_tracing import (
    analyze_corner_trace_segments,
    flatten_corner_trace_segments,
    normalize_corner_buffers,
    scr_to_scrambled_state_cor,
    trace_state_cor_segments,
    twist_direction_indentifier,
    twisted_cor,
)
from .edge_common import (
    analyze_edge_trace_segments,
    flatten_edge_trace_segments,
    normalize_edge_buffers,
    pair_letters,
    segments_to_letter_view,
    stickers_to_letters,
)
from .pseudoswap_tracing import trace_scr_edg_pseudoswap_segments
from .weakswap_tracing import trace_scr_edg_weakswap_segments

def build_corner_breakdown(scr, tracing_orientation, corner_buffers, twist_weight, ltct):
    normalized_corner_buffers = normalize_corner_buffers(corner_buffers)
    corner_state = scr_to_scrambled_state_cor(scr, tracing_orientation)
    corner_segments = trace_state_cor_segments(corner_state, corner_buffers=normalized_corner_buffers)
    corner_targets = flatten_corner_trace_segments(corner_segments)
    corner_analysis = analyze_corner_trace_segments(corner_segments)
    corner_standalone_algs = sum((len(segment['targets']) + 1) // 2 for segment in corner_segments)

    twist_list = twisted_cor(corner_state)
    twist_number = len(twist_list)
    cw, ccw = twist_direction_indentifier(scr, tracing_orientation) if twist_number else (0, 0)
    two_twists = min(cw, ccw)
    single_twists = abs(cw - ccw)
    twist_algs = two_twists * twist_weight + single_twists
    ltct_adjustment = -1 if corner_analysis['corner_parity'] and ltct and single_twists > 0 else 0

    return {
        'buffers': normalized_corner_buffers,
        'segments': corner_segments,
        'targets': corner_targets,
        'analysis': {
            'odd_segment_count': len(corner_analysis['odd_segments']),
            'even_segment_count': len(corner_analysis['even_segments']),
            'parity': corner_analysis['corner_parity'],
            'algs': corner_analysis['algs'],
            'standalone_algs': corner_standalone_algs,
            'saved_by_pairing': corner_standalone_algs - corner_analysis['algs'],
        },
        'twists': {
            'list': twist_list,
            'count': twist_number,
            'cw': cw,
            'ccw': ccw,
            'two_twists': two_twists,
            'single_twists': single_twists,
            'algs': twist_algs,
        },
        'ltct_adjustment': ltct_adjustment,
    }

def build_edge_breakdown(scr, tracing_orientation, edge_method, edge_buffers, flip_weight, corner_parity):
    normalized_edge_buffers = normalize_edge_buffers(edge_buffers, edge_method)

    if edge_method == 'weakswap':
        edge_segments, flipped_list = trace_scr_edg_weakswap_segments(
            scr,
            tracing_orientation,
            edge_buffers=normalized_edge_buffers,
        )
    else:
        edge_segments, flipped_list = trace_scr_edg_pseudoswap_segments(
            scr,
            corner_parity,
            tracing_orientation,
            edge_buffers=normalized_edge_buffers,
        )
    edge_targets = flatten_edge_trace_segments(edge_segments)

    edge_analysis = analyze_edge_trace_segments(edge_segments)
    edge_standalone_algs = sum((len(segment['targets']) + 1) // 2 for segment in edge_segments)
    flip_number = len(flipped_list)
    two_flips = flip_number // 2
    flip_algs = two_flips * flip_weight + (flip_number % 2)

    return {
        'method': edge_method,
        'buffers': normalized_edge_buffers,
        'segments': edge_segments,
        'targets': edge_targets,
        'analysis': {
            'odd_segment_count': len(edge_analysis['odd_segments']),
            'even_segment_count': len(edge_analysis['even_segments']),
            'parity': edge_analysis['edge_parity'],
            'algs': edge_analysis['algs'],
            'standalone_algs': edge_standalone_algs,
            'saved_by_pairing': edge_standalone_algs - edge_analysis['algs'],
        },
        'flips': {
            'list': flipped_list,
            'count': flip_number,
            'two_flips': two_flips,
            'algs': flip_algs,
        },
    }

def count_scramble_algs(scr, tracing_orientation, edge_method, flip_weight, twist_weight, ltct, corner_buffers=('UFR',), edge_buffers=('UF',)):
    corner = build_corner_breakdown(scr, tracing_orientation, corner_buffers, twist_weight, ltct)
    edges = build_edge_breakdown(scr, tracing_orientation, edge_method, edge_buffers, flip_weight, corner['analysis']['parity'])
    algs = (
        corner['analysis']['algs']
        + edges['analysis']['algs']
        + edges['flips']['algs']
        + corner['twists']['algs']
        + corner['ltct_adjustment']
    )
    return algs, edges['flips']['two_flips'], corner['twists']['two_twists']

def analyze_scramble(scr, tracing_orientation='', edge_method='weakswap', flip_weight=1, twist_weight=1, ltct=False, corner_buffers=('UFR',), edge_buffers=('UF',)):
    corner = build_corner_breakdown(scr, tracing_orientation, corner_buffers, twist_weight, ltct)
    edges = build_edge_breakdown(scr, tracing_orientation, edge_method, edge_buffers, flip_weight, corner['analysis']['parity'])
    total_algs = (
        edges['analysis']['algs']
        + edges['flips']['algs']
        + corner['analysis']['algs']
        + corner['twists']['algs']
        + corner['ltct_adjustment']
    )
    return {
        'scramble': scr,
        'tracing_orientation': tracing_orientation,
        'edge_method': edge_method,
        'corner_buffers': corner['buffers'],
        'edge_buffers': edges['buffers'],
        'corner': {
            'segments': corner['segments'],
            'targets': corner['targets'],
            'analysis': corner['analysis'],
        },
        'edges': edges,
        'twists': corner['twists'],
        'ltct_adjustment': corner['ltct_adjustment'],
        'total_algs': total_algs,
    }

def debug_human_review_report(scr, tracing_orientation='', flip_weight=1, twist_weight=1, ltct=False, corner_buffers=('UFR',), edge_buffers_weakswap='all', edge_buffers_pseudoswap='all'):
    weak = analyze_scramble(
        scr,
        tracing_orientation=tracing_orientation,
        edge_method='weakswap',
        flip_weight=flip_weight,
        twist_weight=twist_weight,
        ltct=ltct,
        corner_buffers=corner_buffers,
        edge_buffers=edge_buffers_weakswap,
    )
    pseudo = analyze_scramble(
        scr,
        tracing_orientation=tracing_orientation,
        edge_method='pseudoswap',
        flip_weight=flip_weight,
        twist_weight=twist_weight,
        ltct=ltct,
        corner_buffers=corner_buffers,
        edge_buffers=edge_buffers_pseudoswap,
    )

    corner_letter_segments = segments_to_letter_view(weak['corner']['segments'])
    weak_edge_segments = segments_to_letter_view(weak['edges']['segments'])
    pseudo_edge_segments = segments_to_letter_view(pseudo['edges']['segments'])

    lines = [f'Scramble: {scr}', '', 'Corners:']
    for segment in corner_letter_segments:
        lines.append(f"  buffer {segment['buffer']}: {pair_letters(segment['targets'])}")
    if weak['twists']['count'] > 0:
        twist_parts = [f"twists: {stickers_to_letters(weak['twists']['list'])}"]
        if weak['twists']['two_twists'] > 0:
            twist_parts.append(f"two twists: {weak['twists']['two_twists']}")
        twist_parts.append(f"single twists: {weak['twists']['single_twists']}")
        twist_parts.append(f"twist algs: {weak['twists']['algs']}")
        lines.append(f"  {', '.join(twist_parts)}")
    lines.extend([
        f"  ltct adjustment: {weak['ltct_adjustment']}",
        f"  algs: {weak['corner']['analysis']['algs']} (standalone {weak['corner']['analysis']['standalone_algs']}, saved {weak['corner']['analysis']['saved_by_pairing']})",
        '',
        'Edges weakswap:',
    ])
    for segment in weak_edge_segments:
        lines.append(f"  buffer {segment['buffer']}: {pair_letters(segment['targets'])}")
    lines.extend([
        f"  flips: {stickers_to_letters(weak['edges']['flips']['list'])} (count {weak['edges']['flips']['count']}, algs {weak['edges']['flips']['algs']})",
        f"  algs: {weak['edges']['analysis']['algs']} (standalone {weak['edges']['analysis']['standalone_algs']}, saved {weak['edges']['analysis']['saved_by_pairing']})",
        '',
        'Edges pseudoswap:',
    ])
    for segment in pseudo_edge_segments:
        lines.append(f"  buffer {segment['buffer']}: {pair_letters(segment['targets'])}")
    lines.extend([
        f"  flips: {stickers_to_letters(pseudo['edges']['flips']['list'])} (count {pseudo['edges']['flips']['count']}, algs {pseudo['edges']['flips']['algs']})",
        f"  algs: {pseudo['edges']['analysis']['algs']} (standalone {pseudo['edges']['analysis']['standalone_algs']}, saved {pseudo['edges']['analysis']['saved_by_pairing']})",
    ])
    return '\n'.join(lines)

def extract_scramble_list(text, dnf):
    lines = text.strip().splitlines()
    scrambles = []
    for line in lines:
        line = line.strip()
        line = re.sub(r'\[.*\]', '', line)
        if any(phrase in line.lower() for phrase in [
            'generated by cstimer', 'solves/total', 'single', 'best', 'worst', 'avg of', 'current', 'average', 'mean', 'time list'
        ]):
            continue
        match_dnf = re.search(r'DNF', line)
        if not dnf and match_dnf:
            continue
        line = re.sub(r'DNF', '', line)
        match_move = re.search(r'[UDRLFB]', line)
        if match_move:
            line = line[match_move.start():]
        else:
            continue
        match_timestamp = re.search(r'@', line)
        if match_timestamp:
            line = line[:match_timestamp.start()]
        line = line.strip()
        if line:
            scrambles.append(line)
    return scrambles

def alg_counter_main(text, tracing_orientation='', edge_method='weakswap', flip_weight=1, twist_weight=1, ltct=False, dnf=False, corner_buffers=('UFR',), edge_buffers=('UF',)):
    scr_list = extract_scramble_list(text, dnf)
    alg_count_list = [
        count_scramble_algs(
            scr,
            tracing_orientation,
            edge_method,
            flip_weight,
            twist_weight,
            ltct,
            corner_buffers=corner_buffers,
            edge_buffers=edge_buffers,
        )
        for scr in scr_list
    ]

    final_count = {}
    total_two_flips, total_two_twists = 0, 0
    for algs_per_scr in alg_count_list:
        final_count[algs_per_scr[0]] = final_count.get(algs_per_scr[0], 0) + 1
        total_two_flips += algs_per_scr[1]
        total_two_twists += algs_per_scr[2]
    alg_count_list = [int(e[0]) if e[0].is_integer() else e[0] for e in alg_count_list]

    final_count = {int(k) if k.is_integer() else k: v for k, v in final_count.items()}
    number_of_cases_with_n_algs_dict = dict(sorted(final_count.items()))
    total_algs = sum([k * v for k, v in final_count.items()])
    total_algs = int(total_algs) if total_algs.is_integer() else total_algs
    average_algs_per = round(total_algs / len(scr_list), 5)

    return (
        len(alg_count_list),
        number_of_cases_with_n_algs_dict,
        average_algs_per,
        round(total_algs, 5),
        total_two_flips,
        total_two_twists,
        alg_count_list,
    )
