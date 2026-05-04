import streamlit as st

from python.ssi_core import alg_counter_main, extract_scramble_list

CORNER_BUFFER_OPTIONS = ['UFR', 'UFL', 'UBR', 'UBL', 'RDF', 'FDL']
EDGE_BUFFER_OPTIONS = ['UF', 'UR', 'UB', 'UL', 'FR', 'FL', 'DF', 'DB', 'DR', 'DL']
EDGE_METHOD_OPTIONS = {'Weak Swap': 'weakswap', 'Pseudo Swap': 'pseudoswap'}
LEGACY_CORNER_BUFFERS = ['UFR']
LEGACY_EDGE_BUFFERS = ['UF']
BUFFER_MODES = ['UF/UFR', 'Full floating', 'Partial floating']
STREAMLIT_PRIMARY = '#FF4B4B'
COMPLEMENT_COLOR = '#59C0C0'
COMPLEMENT_COLOR_STRONG = '#6BC7C7'
COMPLEMENT_SOFT = 'rgba(89, 192, 192, 0.18)'
COMPLEMENT_BORDER = 'rgba(89, 192, 192, 0.45)'

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


param_col_1, param_col_2, param_col_3 = st.columns(3)

with param_col_1:
    edge_method_label = st.radio(
        'Edge tracing',
        options=list(EDGE_METHOD_OPTIONS.keys()),
        index=0,
    )
    edge_method = EDGE_METHOD_OPTIONS[edge_method_label]

    tracing_orientation = st.text_input(
        'Tracing orientation',
        value='',
        placeholder='e.g. x2',
        help='Tracing orientation is ___ away from scrambling orientation.',
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
    'Scrambles',
    height=280,
    placeholder="Paste from csTimer's ScrambleGenerator or Session Statistics",
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

            st.markdown(
                (
                    f"<div style='background: {COMPLEMENT_SOFT}; border: 1px solid {COMPLEMENT_BORDER}; "
                    f"color: {COMPLEMENT_COLOR_STRONG}; padding: 0.9rem 1rem; border-radius: 0.6rem; "
                    "font-weight: 600; margin-bottom: 0.5rem;'>"
                    f"Processed {number_of_solves} scramble{'s' if number_of_solves != 1 else ''}."
                    "</div>"
                ),
                unsafe_allow_html=True,
            )

            rounded_average_algs = f'{average_algs_per:.2f}'

            metric_col_1, metric_col_2, metric_col_3, metric_col_4, metric_col_5 = st.columns(5)
            metric_col_1.metric('Scrambles', number_of_solves)
            metric_col_2.metric('Total algs', total_algs)
            metric_col_3.metric('Average algs', rounded_average_algs)
            metric_col_4.metric('2-flips', total_two_flips)
            metric_col_5.metric('2-twists', total_two_twists)

            st.divider()
            st.subheader('Distribution')
            distribution_data = [
                {'Algs': algs, 'Algs label': f'{algs} algs', 'Scrambles': count}
                for algs, count in sorted(number_of_cases_with_n_algs_dict.items())
            ]
            distribution_chart_spec = {
                'layer': [
                    {
                        'mark': {
                            'type': 'bar',
                            'color': COMPLEMENT_COLOR,
                            'cornerRadiusTopLeft': 2,
                            'cornerRadiusTopRight': 2,
                        },
                        'encoding': {
                            'x': {
                                'field': 'Algs label',
                                'type': 'ordinal',
                                'sort': {'field': 'Algs', 'op': 'min', 'order': 'ascending'},
                                'axis': {'labelAngle': 0, 'title': None},
                            },
                            'y': {
                                'field': 'Scrambles',
                                'type': 'quantitative',
                                'title': None,
                                'axis': {'labels': False, 'ticks': False, 'domain': False, 'grid': True},
                            },
                        },
                    },
                    {
                        'mark': {'type': 'text', 'dy': -10, 'color': '#e6edf3', 'fontSize': 14, 'fontWeight': 600},
                        'encoding': {
                            'x': {
                                'field': 'Algs label',
                                'type': 'ordinal',
                                'sort': {'field': 'Algs', 'op': 'min', 'order': 'ascending'},
                            },
                            'y': {'field': 'Scrambles', 'type': 'quantitative'},
                            'text': {'field': 'Scrambles', 'type': 'quantitative'},
                        },
                    },
                ],
                'data': {'values': distribution_data},
                'height': 260,
                'width': 'container',
                'config': {
                    'background': 'transparent',
                    'view': {'stroke': None},
                    'axis': {
                        'labelColor': '#e6edf3',
                        'tickColor': '#3d444d',
                        'domainColor': '#3d444d',
                        'gridColor': '#30363d',
                    },
                },
            }
            _, chart_col, _ = st.columns([1, 2, 1])
            with chart_col:
                st.vega_lite_chart(distribution_data, distribution_chart_spec, use_container_width=True)

            st.subheader('Algs per scramble')
            cells_html = []
            for index, algs in enumerate(alg_count_list, start=1):
                cells_html.append(
                    (
                        "<div style=\""
                        "border: 1px solid #3d444d; border-radius: 8px; padding: 0.45rem 0.2rem; "
                        "text-align: center; background: #161b22; min-height: 58px; "
                        "display: flex; flex-direction: column; justify-content: center; gap: 0.15rem;\">"
                        f"<div style=\"font-size: 0.72rem; color: #8b949e;\">{index}</div>"
                        f"<div style=\"font-size: 1rem; font-weight: 700; color: #e6edf3;\">{algs}</div>"
                        "</div>"
                    )
                )
            st.markdown(
                (
                    "<div style=\"display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); "
                    "gap: 0.45rem;\">"
                    + "".join(cells_html)
                    + "</div>"
                ),
                unsafe_allow_html=True,
            )

        except Exception:
            st.error('Could not parse the input. Paste text from csTimer ScrambleGenerator or Session Statistics.')
