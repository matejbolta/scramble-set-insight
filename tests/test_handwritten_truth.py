import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from python import ssi_handmade

PARAM_FILES = [
    ROOT / 'baseline' / 'truth-weakswap-params.json',
    ROOT / 'baseline' / 'truth-pseudoswap-params.json',
]


def assert_matches(params_path):
    params = json.loads(params_path.read_text())
    text = (ROOT / params['input_file']).read_text()
    expected = json.loads((ROOT / params['output_file']).read_text())
    result = ssi_handmade.alg_counter_main(
        text,
        tracing_orientation=params['tracing_orientation'],
        edge_method=params['edge_method'],
        flip_weight=params['flip_weight'],
        twist_weight=params['twist_weight'],
        ltct=params['ltct'],
        dnf=params['dnf'],
    )
    actual = result[6]

    if actual != expected:
        for index, (actual_value, expected_value) in enumerate(zip(actual, expected)):
            if actual_value != expected_value:
                raise AssertionError(
                    f"{params['edge_method']} mismatch at index {index}: "
                    f"expected {expected_value}, got {actual_value}"
                )
        raise AssertionError(f"{params['edge_method']} truth lists differ in length")

    if len(actual) != params['alg_count_list_length']:
        raise AssertionError(
            f"{params['edge_method']} length: "
            f"expected {params['alg_count_list_length']}, got {len(actual)}"
        )
    if result[4] != params['total_two_flips']:
        raise AssertionError(
            f"{params['edge_method']} 2-flip aggregate: "
            f"expected {params['total_two_flips']}, got {result[4]}"
        )
    if result[5] != params['total_two_twists']:
        raise AssertionError(
            f"{params['edge_method']} 2-twist aggregate: "
            f"expected {params['total_two_twists']}, got {result[5]}"
        )

    print(
        'PASS handwritten oracle matches stored truth '
        f"({len(actual)} entries, edge_method={params['edge_method']})"
    )


for param_file in PARAM_FILES:
    assert_matches(param_file)


THREE_EQUAL_TWISTS = (
    "F2 D L2 U2 L2 B2 L2 D R2 D2 R2 F2 L' B' D2 U' "
    "F U' L U' B2 Fw' Uw'"
)
for edge_method in ('weakswap', 'pseudoswap'):
    for weight, expected in (
        (1, (10, 0, 2)),
        (1.25, (10.5, 0, 2)),
        (1.5, (11, 0, 0)),
    ):
        actual = ssi_handmade.count_scramble_algs(
            THREE_EQUAL_TWISTS,
            tracing_orientation='',
            edge_method=edge_method,
            flip_weight=weight,
            twist_weight=weight,
            ltct=False,
        )
        assert actual == expected, (edge_method, weight, actual)
print('PASS handwritten weighted t+t+t regression')
