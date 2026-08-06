import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from legacy import ssi_core

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


def assert_pseudoswap_floating_closure_regressions():
    primary_closure = ssi_core.analyze_scramble(
        'U',
        '',
        'pseudoswap',
        1,
        1,
        False,
        ['UFR'],
        ['UF'],
    )
    assert primary_closure['corner']['analysis']['parity'] is True
    assert primary_closure['edges']['targets'] == ['UR', 'UB', 'UL', 'UR']
    assert primary_closure['edges']['analysis']['parity'] is False
    assert primary_closure['edges']['analysis']['algs'] == 2
    assert primary_closure['total_algs'] == 4

    flipped_primary_closure = ssi_core.analyze_scramble(
        "R F' U L' Uw'",
        '',
        'pseudoswap',
        1,
        1,
        False,
        ['UFR'],
        ['UF'],
    )
    assert flipped_primary_closure['corner']['analysis']['parity'] is True
    assert flipped_primary_closure['edges']['targets'] == [
        'FR', 'FD', 'RB', 'UR', 'UB', 'UL', 'RU',
        'FL', 'DL', 'LF', 'DR', 'DB', 'BL', 'RD',
    ]
    assert flipped_primary_closure['edges']['analysis']['parity'] is False
    assert flipped_primary_closure['edges']['analysis']['algs'] == 7

    floating_closure = ssi_core.analyze_scramble(
        'U Rw2',
        '',
        'pseudoswap',
        1,
        1,
        False,
        ['UFR', 'UFL', 'UBR', 'UBL', 'RDF', 'FDL'],
        ['UF', 'UR', 'UB', 'UL', 'FR', 'FL', 'DF', 'DB', 'DR', 'DL'],
    )
    assert floating_closure['edges']['segments'] == [
        {'buffer': 'UF', 'targets': ['UR', 'UB', 'UL', 'DL', 'UR']},
        {'buffer': 'FL', 'targets': ['BL']},
    ]
    assert floating_closure['edges']['analysis']['parity'] is False
    assert floating_closure['edges']['analysis']['saved_by_pairing'] == 1
    assert floating_closure['edges']['analysis']['algs'] == 3
    assert floating_closure['total_algs'] == 6

    print('PASS: ssi_core pseudoswap floating closure regressions')


def assert_primary_floating_buffer_validation():
    invalid_cases = [
        (['UFL'], ['UF'], 'Corner buffer selection must include UFR.'),
        (['UFR'], ['UR'], 'Edge buffer selection must include UF.'),
    ]
    for corner_buffers, edge_buffers, expected_message in invalid_cases:
        try:
            ssi_core.analyze_scramble(
                'U',
                '',
                'pseudoswap',
                1,
                1,
                False,
                corner_buffers,
                edge_buffers,
            )
        except ValueError as error:
            assert str(error) == expected_message
        else:
            raise AssertionError(f'Expected ValueError: {expected_message}')

    print('PASS: ssi_core primary floating buffer validation')


def main():
    for params_path in PARAM_FILES:
        assert_matches(params_path)
    assert_pseudoswap_floating_closure_regressions()
    assert_primary_floating_buffer_validation()


if __name__ == '__main__':
    main()
