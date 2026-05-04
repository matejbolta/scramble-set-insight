import json

import streamlit as st

from python.ssi_core import alg_counter_main, extract_scramble_list

CORNER_BUFFER_OPTIONS = ['UFR', 'UFL', 'UBR', 'UBL', 'RDF', 'FDL']
EDGE_BUFFER_OPTIONS = ['UF', 'UR', 'UB', 'UL', 'FR', 'FL', 'DF', 'DB', 'DR', 'DL']
EDGE_METHOD_OPTIONS = {'Weak Swap': 'weakswap', 'Pseudo Swap': 'pseudoswap'}
LEGACY_CORNER_BUFFERS = ['UFR']
LEGACY_EDGE_BUFFERS = ['UF']
BUFFER_MODES = ['UF/UFR', 'Full floating', 'Partial floating']

st.set_page_config(page_title='Scramble Set Insight', layout='wide')


def compact_buffer_picker(label, options, default_selected, key_prefix, columns_count):
    pills = getattr(st, 'pills', None)
    st.markdown(
        f"<div style='margin: -0.35rem 0 0.15rem 0; font-size: 0.9rem; font-weight: 600;'>{label}</div>",
        unsafe_allow_html=True,
    )
    if callable(pills):
        selected = pills(
            label,
            options=options,
            default=default_selected,
            selection_mode='multi',
            key=f'{key_prefix}_pills',
            label_visibility='collapsed',
        )
        return selected or []

    selected = []
    columns = st.columns(columns_count)
    default_selected_set = set(default_selected)
    for index, option in enumerate(options):
        with columns[index % columns_count]:
            checked = st.checkbox(option, value=option in default_selected_set, key=f'{key_prefix}_{option}')
            if checked:
                selected.append(option)
    return selected


st.write('Parameters')

param_col_1, param_col_2, param_col_3 = st.columns(3)

with param_col_1:
    edge_method_label = st.radio(
        'Edge tracing',
        options=list(EDGE_METHOD_OPTIONS.keys()),
        index=0,
    )
    edge_method = EDGE_METHOD_OPTIONS[edge_method_label]

    tracing_orientation = st.text_input(
        'Tracing orientation is ___ away from scrambling orientation',
        value='',
        placeholder='e.g. x2',
    )

with param_col_2:
    dnf = st.checkbox('Include DNFs', value=False)
    ltct = st.checkbox('I use LTCT', value=False)

    weight_col_1, weight_col_2 = st.columns(2)
    with weight_col_1:
        flip_weight = st.number_input(
            '2-flip weight',
            min_value=0.0,
            step=0.5,
            value=1.0,
            help='Algs per floating 2-flip',
        )
    with weight_col_2:
        twist_weight = st.number_input(
            '2-twist weight',
            min_value=0.0,
            step=0.5,
            value=1.0,
            help='Algs per floating 2-twist',
        )

with param_col_3:
    buffer_mode = st.radio(
        'Buffers',
        options=BUFFER_MODES,
        index=0,
    )

    if buffer_mode == 'UF/UFR':
        corner_buffers = LEGACY_CORNER_BUFFERS.copy()
        edge_buffers = LEGACY_EDGE_BUFFERS.copy()
    elif buffer_mode == 'Full floating':
        corner_buffers = CORNER_BUFFER_OPTIONS.copy()
        edge_buffers = EDGE_BUFFER_OPTIONS.copy()
    else:
        corner_buffers = compact_buffer_picker(
            'Corner buffers',
            CORNER_BUFFER_OPTIONS,
            LEGACY_CORNER_BUFFERS,
            'corner_buffer',
            columns_count=3,
        )
        edge_buffers = compact_buffer_picker(
            'Edge buffers',
            EDGE_BUFFER_OPTIONS,
            LEGACY_EDGE_BUFFERS,
            'edge_buffer',
            columns_count=3,
        )

scrambles = st.text_area(
    'Scrambles: paste from csTimer ScrambleGenerator or Session Statistics',
    height=280,
)

run_analysis = st.button('Analyze Set', type='primary', use_container_width=True)

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
            metric_col_4.metric('2-flips', total_two_flips)
            metric_col_5.metric('2-twists', total_two_twists)

            st.divider()
            results_col_1, results_col_2 = st.columns([1.35, 1])

            with results_col_1:
                st.subheader('Distribution')
                st.bar_chart(number_of_cases_with_n_algs_dict)

            with results_col_2:
                st.subheader('Run summary')
                st.write(f'**Edge tracing:** {edge_method_label}')
                st.write(f'**Tracing orientation:** {tracing_orientation or "None"}')
                st.write(f'**Corner buffers:** {", ".join(corner_buffers)}')
                st.write(f'**Edge buffers:** {", ".join(edge_buffers)}')
                if ltct:
                    st.write('**LTCT:** On')
                if dnf:
                    st.write('**DNFs:** Included')

            st.subheader('Counts by alg total')
            count_table = [
                {'Algs': algs, 'Scrambles': count}
                for algs, count in number_of_cases_with_n_algs_dict.items()
            ]
            st.dataframe(count_table, use_container_width=True, hide_index=True)

            with st.expander('Raw alg_count_list'):
                st.code(json.dumps(alg_count_list), language='json')

        except Exception:
            st.error('Could not parse the input. Paste text from csTimer ScrambleGenerator or Session Statistics.')
