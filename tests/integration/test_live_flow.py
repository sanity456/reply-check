"""Opt-in Studionet test using the same pinned SDK as the application.

genlayer-py 0.2.16 dispatches several Studio operations by localnet's numeric
chain ID. Do not spoof that ID or silently fall back to a different network.
The subprocess uses genlayer-js 1.1.8's explicit Studionet transport instead.
"""
import os
from pathlib import Path
import subprocess

import pytest


def test_live_reference_review_and_approval_flow():
    if os.environ.get("REPLYCHECK_RUN_LIVE") != "1":
        pytest.fail("Live writes disabled: require explicit REPLYCHECK_RUN_LIVE=1 approval.")

    from gltest_cli.config.general import get_general_config

    config = get_general_config()
    assert config.get_network_name() == "studionet", "This harness targets only Studionet"
    assert config.get_rpc_url() == "https://studio.genlayer.com/api"
    assert config.get_leader_only() is False
    root = Path(__file__).resolve().parents[2]
    completed = subprocess.run(
        ["node", "scripts/live-studionet.mjs"], cwd=root, check=False,
    )
    assert completed.returncode == 0, "Live flow incomplete; inspect its saved public evidence"
