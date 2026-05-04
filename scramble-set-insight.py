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


def checkbox_grid(label, options, default_selected, key_prefix, columns_count=3):
    st.write(label)
    selected = []
    columns = st.columns(columns_count)
    selected_set = set(default_selected)
    for index, option in enumerate(options):
        with columns[index % columns_count]:
            checked = st.checkbox(option, value=option in selected_set, key=f'{key_prefix}_{option}')
            if checked:
                selected.append(option)
    return selected


with st.sidebar:
    st.header('Parameters')

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

    dnf = st.checkbox('Include DNFs', value=False)
    ltct = st.checkbox('I use LTCT', value=False)
    flip_weight = st.number_input(
        'Algs per floating 2-flip',
        min_value=0.0,
        step=0.5,
        value=1.0,
    )
    twist_weight = st.number_input(
        'Algs per floating 2-twist',
        min_value=0.0,
        step=0.5,
        value=1.0,
    )

    st.subheader('Buffers')
    buffer_mode = st.radio(
        'Select setup',
        options=BUFFER_MODES,
        index=0,
        label_visibility='collapsed',
    )

    if buffer_mode == 'UF/UFR':
        corner_buffers = LEGACY_CORNER_BUFFERS.copy()
        edge_buffers = LEGACY_EDGE_BUFFERS.copy()
    elif buffer_mode == 'Full floating':
        corner_buffers = CORNER_BUFFER_OPTIONS.copy()
        edge_buffers = EDGE_BUFFER_OPTIONS.copy()
    else:
        st.caption('Choose the buffers you want to use.')
        corner_buffers = checkbox_grid(
            'Corner buffers',
            CORNER_BUFFER_OPTIONS,
            LEGACY_CORNER_BUFFERS,
            'corner_buffer',
            columns_count=2,
        )
        edge_buffers = checkbox_grid(
            'Edge buffers',
            EDGE_BUFFER_OPTIONS,
            LEGACY_EDGE_BUFFERS,
            'edge_buffer',
            columns_count=2,
        )

scrambles = st.text_area(
    'Scrambles: paste from csTimer ScrambleGenerator or Session Statistics',
    height=280,
)

parsed_scrambles = extract_scramble_list(scrambles, dnf=dnf) if scrambles.strip() else []

status_col_1, status_col_2, status_col_3 = st.columns(3)
status_col_1.metric('Parsed scrambles', len(parsed_scrambles))
status_col_2.metric('Edge tracing', edge_method_label)
status_col_3.metric('Buffers', 'Partial' if buffer_mode == 'Partial floating' else buffer_mode)

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
