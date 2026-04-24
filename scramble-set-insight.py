import json

import streamlit as st

from python.ssi_core import alg_counter_main, extract_scramble_list

CORNER_BUFFER_OPTIONS = ['UFR', 'UFL', 'UBR', 'UBL', 'RDF', 'FDL']
EDGE_BUFFER_OPTIONS = ['UF', 'UR', 'UB', 'UL', 'FR', 'FL', 'DF', 'DB', 'DR', 'DL']
EDGE_METHOD_OPTIONS = {'Weak Swap': 'weakswap', 'Pseudo Swap': 'pseudoswap'}
LEGACY_CORNER_BUFFERS = ['UFR']
LEGACY_EDGE_BUFFERS = ['UF']

st.set_page_config(page_title='Scramble Set Insight', layout='wide')

st.title('Scramble Set Insight')
st.caption('Legacy Streamlit edition powered by the current `ssi_core` backend.')

st.info(
    'Legacy mode is `UFR` for corners and `UF` for edges. '
    'Add more buffers if you want floating-aware counting.'
)

st.subheader('Scrambles')
scrambles = st.text_area(
    'Input scrambles',
    height=180,
    help="Paste from csTimer ScrambleGenerator or Session Statistics.",
)

left_col, right_col = st.columns(2)

with left_col:
    st.subheader('Method')
    tracing_orientation = st.text_input(
        'Tracing orientation is ___ away from scrambling orientation',
        value='',
        placeholder="e.g. x2 or z x y'",
    )
    edge_method_label = st.radio(
        'Edge tracing',
        options=list(EDGE_METHOD_OPTIONS.keys()),
        index=0,
    )
    edge_method = EDGE_METHOD_OPTIONS[edge_method_label]

    weight_col_1, weight_col_2 = st.columns(2)
    with weight_col_1:
        flip_weight = st.number_input('Algs per Floating 2-Flip', min_value=0.0, step=0.5, value=1.0)
    with weight_col_2:
        twist_weight = st.number_input('Algs per Floating 2-Twist', min_value=0.0, step=0.5, value=1.0)

with right_col:
    st.subheader('Advanced')
    toggle_col_1, toggle_col_2 = st.columns(2)
    with toggle_col_1:
        ltct = st.checkbox('I use LTCT', value=False)
    with toggle_col_2:
        dnf = st.checkbox('Include DNFs', value=False)

    corner_buffers = st.multiselect(
        'Corner buffers',
        options=CORNER_BUFFER_OPTIONS,
        default=LEGACY_CORNER_BUFFERS,
        help='Leave only UFR selected for legacy corner tracing.',
    )
    edge_buffers = st.multiselect(
        'Edge buffers',
        options=EDGE_BUFFER_OPTIONS,
        default=LEGACY_EDGE_BUFFERS,
        help='Leave only UF selected for legacy edge tracing.',
    )

parsed_scrambles = extract_scramble_list(scrambles, dnf=dnf) if scrambles.strip() else []
legacy_mode = corner_buffers == LEGACY_CORNER_BUFFERS and edge_buffers == LEGACY_EDGE_BUFFERS
st.caption(
    f'Parsed scrambles preview count: {len(parsed_scrambles)} '
    f'({"DNFs included" if dnf else "DNFs excluded"})'
)
st.caption(f'Mode: {"Legacy-compatible" if legacy_mode else "Floating-enabled"}')

run_analysis = st.button('Insight', type='primary', use_container_width=True)

if run_analysis:
    if not scrambles.strip():
        st.warning('Paste some scrambles first.')
    elif not corner_buffers or not edge_buffers:
        st.warning('Select at least one corner buffer and one edge buffer.')
    else:
        try:
            (
                number_of_solves,
                number_of_cases_with_n_algs_dict,
                average_algs_per,
                total_algs,
                total_two_flips,
                total_two_twists,
                alg_count_list,
            ) = alg_counter_main(
                scrambles,
                tracing_orientation,
                edge_method,
                flip_weight,
                twist_weight,
                ltct,
                dnf,
                corner_buffers,
                edge_buffers,
            )

            st.success(f'Processed {number_of_solves} scramble{"s" if number_of_solves != 1 else ""}.')

            metric_col_1, metric_col_2, metric_col_3, metric_col_4, metric_col_5 = st.columns(5)
            metric_col_1.metric('Scrambles', number_of_solves)
            metric_col_2.metric('Average algs', average_algs_per)
            metric_col_3.metric('Total algs', total_algs)
            metric_col_4.metric('Floating 2-flips', total_two_flips)
            metric_col_5.metric('Floating 2-twists', total_two_twists)

            st.divider()
            results_col_1, results_col_2 = st.columns([1.2, 1])

            with results_col_1:
                st.subheader('Distribution')
                st.bar_chart(number_of_cases_with_n_algs_dict)

            with results_col_2:
                st.subheader('Settings used')
                st.write(f'Edge method: **{edge_method}**')
                st.write(f'Tracing orientation: **{tracing_orientation or "(identity)"}**')
                st.write(f'Corner buffers: **{", ".join(corner_buffers)}**')
                st.write(f'Edge buffers: **{", ".join(edge_buffers)}**')
                st.write(f'LTCT: **{ltct}**')
                st.write(f'Include DNFs: **{dnf}**')

            st.subheader('Count table')
            for algs, count in number_of_cases_with_n_algs_dict.items():
                st.write(f'{algs}: **{count}**')

            with st.expander('Raw alg_count_list'):
                st.code(json.dumps(alg_count_list), language='json')

        except Exception:
            st.error('Paste text from csTimer Session Statistics or from csTimer ScrambleGenerator.')
