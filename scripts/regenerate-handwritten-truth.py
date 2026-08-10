#!/usr/bin/env python3
"""Deliberately regenerate the stored 10k handwritten-oracle truth fixtures."""

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from python import ssi_handmade


PARAM_FILES = (
    ROOT / 'baseline' / 'truth-weakswap-params.json',
    ROOT / 'baseline' / 'truth-pseudoswap-params.json',
)


def regenerate(params_path):
    params = json.loads(params_path.read_text())
    text = (ROOT / params['input_file']).read_text()
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
    expected_length = params['alg_count_list_length']
    if len(actual) != expected_length:
        raise ValueError(
            f"{params['edge_method']} produced {len(actual)} entries; "
            f"expected {expected_length}"
        )
    output_path = ROOT / params['output_file']
    output_path.write_text(json.dumps(actual, separators=(',', ':')) + '\n')
    params['total_two_flips'] = result[4]
    params['total_two_twists'] = result[5]
    params_path.write_text(json.dumps(params, indent=2) + '\n')
    print(f"WROTE {output_path.relative_to(ROOT)} ({len(actual)} entries)")


for param_file in PARAM_FILES:
    regenerate(param_file)
