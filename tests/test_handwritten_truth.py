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
    actual = ssi_handmade.alg_counter_main(
        text,
        tracing_orientation=params['tracing_orientation'],
        edge_method=params['edge_method'],
        flip_weight=params['flip_weight'],
        twist_weight=params['twist_weight'],
        ltct=params['ltct'],
        dnf=params['dnf'],
    )[6]

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

    print(
        'PASS handwritten oracle matches frozen truth '
        f"({len(actual)} entries, edge_method={params['edge_method']})"
    )


for param_file in PARAM_FILES:
    assert_matches(param_file)
