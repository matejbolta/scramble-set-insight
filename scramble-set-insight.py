import json

import streamlit as st

from python.ssi_core import alg_counter_main, extract_scramble_list

CORNER_BUFFER_OPTIONS = ['UFR', 'UFL', 'UBR', 'UBL', 'RDF', 'FDL']
EDGE_BUFFER_OPTIONS = ['UF', 'UR', 'UB', 'UL', 'FR', 'FL', 'DF', 'DB', 'DR', 'DL']
EDGE_METHOD_OPTIONS = {'Weak Swap': 'weakswap', 'Pseudo Swap': 'pseudoswap'}
LEGACY_CORNER_BUFFERS = ['UFR']
LEGACY_EDGE_BUFFERS = ['UF']
BUFFER_MODES = ['Standard', 'Custom']

st.set_page_config(page_title='Scramble Set Insight', layout='wide')

st.title('Scramble Set Insight')
st.caption('Analyze a scramble set, compare edge methods, and estimate total tracing load.')

with st.sidebar:
    st.header('Settings')

    edge_method_label = st.radio(
        'Edge method',
        options=list(EDGE_METHOD_OPTIONS.keys()),
        index=0,
    )
    edge_method = EDGE_METHOD_OPTIONS[edge_method_label]

    tracing_orientation = st.text_input(
        'Tracing orientation',
        value='',
        placeholder="Leave empty for normal home practice. Example: x2",
        help='Use this when the scramble was applied from a different cube orientation than the one you trace from.',
    )

    dnf = st.checkbox('Include DNFs', value=False)

    st.subheader('Buffers')
    buffer_mode = st.radio(
        'Tracing setup',
        options=BUFFER_MODES,
        index=0,
        help='Standard uses the classic UFR / UF setup. Custom lets you choose floating buffers.',
    )

    if buffer_mode == 'Standard':
        corner_buffers = LEGACY_CORNER_BUFFERS.copy()
        edge_buffers = LEGACY_EDGE_BUFFERS.copy()
        st.caption('Standard setup: corners UFR, edges UF.')
    else:
        corner_buffers = st.multiselect(
            'Corner buffers you know',
            options=CORNER_BUFFER_OPTIONS,
            default=LEGACY_CORNER_BUFFERS,
        )
        edge_buffers = st.multiselect(
            'Edge buffers you know',
            options=EDGE_BUFFER_OPTIONS,
            default=LEGACY_EDGE_BUFFERS,
        )

    with st.expander('Advanced options'):
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
        ltct = st.checkbox('I use LTCT', value=False)

st.subheader('Scrambles')
scrambles = st.text_area(
    'Paste scrambles here',
    height=240,
    placeholder='Paste from csTimer ScrambleGenerator or Session Statistics.',
    label_visibility='collapsed',
)

parsed_scrambles = extract_scramble_list(scrambles, dnf=dnf) if scrambles.strip() else []
custom_mode = buffer_mode == 'Custom'

status_col_1, status_col_2, status_col_3 = st.columns(3)
status_col_1.metric('Parsed scrambles', len(parsed_scrambles))
status_col_2.metric('Edge method', edge_method_label)
status_col_3.metric('Buffer mode', 'Custom' if custom_mode else 'Standard')

with st.expander('Input tips'):
    st.write('- Paste directly from csTimer ScrambleGenerator or Session Statistics.')
    st.write('- Leave tracing orientation empty for normal home practice.')
    st.write('- Use Custom buffers only if you want floating-aware counting.')

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
                st.write(f'**Method:** {edge_method_label}')
                st.write(f'**Tracing orientation:** {tracing_orientation or "None"}')
                st.write(f'**Corner buffers:** {", ".join(corner_buffers)}')
                st.write(f'**Edge buffers:** {", ".join(edge_buffers)}')
                if ltct:
                    st.write('**LTCT:** On')
                if dnf:
                    st.write('**DNFs:** Included')
                if custom_mode:
                    st.write('**Floating:** Enabled')

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
