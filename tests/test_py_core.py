import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from python import ssi_core

PARAM_FILES = [
    ROOT / 'baseline' / 'truth-weakswap-params.json',
    ROOT / 'baseline' / 'truth-pseudoswap-params.json',
]


def assert_matches(params_path):
    params = json.loads(params_path.read_text())
    input_path = Path(params['input_file'])
    output_path = Path(params['output_file'])

    text = input_path.read_text()
    expected_alg_count_list = json.loads(output_path.read_text())

    result = ssi_core.alg_counter_main(
        text,
        params['tracing_orientation'],
        params['edge_method'],
        params['flip_weight'],
        params['twist_weight'],
        params['ltct'],
        params['dnf'],
        ['UFR'],
        ['UF'],
    )
    actual_alg_count_list = result[6]

    expected_length = params['alg_count_list_length']
    actual_length = len(actual_alg_count_list)

    if actual_length != expected_length:
        raise AssertionError(
            f"alg_count_list length mismatch for {params['edge_method']}: expected {expected_length}, got {actual_length}"
        )

    if actual_alg_count_list != expected_alg_count_list:
        for index, (actual, expected) in enumerate(zip(actual_alg_count_list, expected_alg_count_list)):
            if actual != expected:
                raise AssertionError(
                    f"alg_count_list mismatch for {params['edge_method']} at index {index}: expected {expected}, got {actual}"
                )
        if len(actual_alg_count_list) != len(expected_alg_count_list):
            raise AssertionError(
                f"alg_count_list mismatch for {params['edge_method']}: lists differ in length after zip comparison"
            )
        raise AssertionError(f"alg_count_list mismatch for {params['edge_method']}")

    print(
        'PASS: ssi_core matches baseline '
        f"({actual_length} entries, edge_method={params['edge_method']})"
    )


def main():
    for params_path in PARAM_FILES:
        assert_matches(params_path)


if __name__ == '__main__':
    main()
