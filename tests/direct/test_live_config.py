"""Offline regression for the pinned test runner's real configuration schema."""
from pathlib import Path

import yaml
from gltest_cli.config.user import (
    transform_raw_to_user_config_with_defaults,
    validate_raw_user_config,
)


def test_live_config_resolves_studionet_without_fallback():
    path = Path(__file__).resolve().parents[2] / "gltest.config.yaml"
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    validate_raw_user_config(raw)
    config = transform_raw_to_user_config_with_defaults(raw)
    assert config.default_network == "localnet"
    network = config.networks["studionet"]
    assert network.url == "https://studio.genlayer.com/api"
    assert network.id == 61999
    assert network.chain_type == "studionet"
    assert network.leader_only is False
    assert network.default_wait_interval == 10000
