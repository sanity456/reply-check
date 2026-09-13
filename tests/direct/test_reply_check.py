"""Complete local contract suite. Model output is mocked; no live-network claims."""
import copy
import json
import sys
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[2]
DOCS = [{"id": "faq", "title": "Public FAQ", "body": "Refund requests must be submitted within 7 days of purchase.", "url": ""}]
QUESTION = "How long do I have to request a refund?"
DRAFT = "You can request a refund within 7 days of purchase."
T0 = "2026-09-10T10:00:00+00:00"

def addr(value):
    return "0x" + bytes(value.as_bytes if hasattr(value, "as_bytes") else value).hex()

@pytest.fixture
def contract(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    direct_vm.warp(T0)
    direct_vm.value = 0
    return direct_deploy(str(ROOT / "contracts/reply_check.py"), sdk_version="v0.2.16")

@pytest.fixture
def workspace(contract):
    contract.create_workspace("northstar", "Northstar", True)
    contract.publish_references("northstar", 0, json.dumps(DOCS), True)
    return contract

def response(verdict="SUPPORTED", **overrides):
    value = {"question_status": "ANSWERED", "summary": "The refund window matches the reference.",
             "findings": [{"segment_id": 1, "verdict": verdict, "reason": "The reference states seven days.",
                           "citations": [{"reference_id": "faq", "quote": DOCS[0]["body"]}] if verdict in ("SUPPORTED", "CONTRADICTED") else [],
                           "suggestion": ""}]}
    value.update(overrides)
    return value

def mock(direct_vm, value=None):
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r"(?s).*REPLYCHECK_ASSESS_V1.*", json.dumps(response() if value is None else value))
    direct_vm.mock_llm(r"(?s).*REPLYCHECK_AUDIT_V1.*", '{"faithful":true}')

def review(workspace, direct_vm, **overrides):
    mock(direct_vm, overrides.pop("model", None))
    args = dict(workspace_id="northstar", version=1, question=QUESTION, draft=DRAFT, request_id="request-1", public_consent=True)
    args.update(overrides)
    return workspace.submit_review(**args)

def test_protocol(contract):
    assert contract.get_protocol()["funds_accepted"] is False
    assert contract.get_protocol()["reference_mode"] == "owner_attested_public_text"

def test_constructor_refuses_value(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    direct_vm.value = 1
    with pytest.raises(Exception, match="FUNDS_NOT_ACCEPTED"):
        direct_deploy(str(ROOT / "contracts/reply_check.py"), sdk_version="v0.2.16")

def test_citations_are_stored_as_exact_normalized_passages(workspace, direct_vm):
    model = response()
    model["findings"][0]["citations"][0]["quote"] = "  " + DOCS[0]["body"] + "  "
    result = review(workspace, direct_vm, model=model)
    quote = result["assessment"]["findings"][0]["citations"][0]["quote"]
    assert quote == DOCS[0]["body"]
    assert quote in workspace.get_references("northstar", 1)["documents"][0]["body"]

def test_single_answer_card_matches_list_and_preserves_retirement(workspace, direct_vm):
    result = review(workspace, direct_vm)
    workspace.publish_answer_card("northstar", "refund", result["id"], "Refund timing")
    assert workspace.get_answer_card("northstar", "refund") == workspace.list_answer_cards("northstar", 0, 1)[0]
    workspace.retire_answer_card("northstar", "refund")
    assert workspace.get_answer_card("northstar", "refund")["status"] == "RETIRED"
    with pytest.raises(Exception, match="CARD_NOT_FOUND"):
        workspace.get_answer_card("northstar", "missing")

def test_created_time_is_message_time(contract, direct_vm):
    created = contract.create_workspace("x", "Example", True)
    assert created["created_at"] == T0
    direct_vm.warp("2027-01-02T03:04:05+00:00")
    bundle = contract.publish_references("x", 0, json.dumps(DOCS), True)
    assert bundle["published_at"] == "2027-01-02T03:04:05+00:00"

@pytest.mark.parametrize("identifier", ["", "../x", "x:y", "a" * 65, "space here"])
def test_invalid_workspace_id(contract, identifier):
    with pytest.raises(Exception, match="INVALID_ID"):
        contract.create_workspace(identifier, "Name", True)

@pytest.mark.parametrize("consent", [False, None, 1, "true"])
def test_public_consent_strict(contract, consent):
    with pytest.raises(Exception):
        contract.create_workspace("x", "Name", consent)
    assert contract.list_workspaces(0, 50) == []

def test_duplicate_workspace(contract):
    contract.create_workspace("x", "Name", True)
    with pytest.raises(Exception, match="WORKSPACE_EXISTS"):
        contract.create_workspace("x", "Other", True)

def test_refunds_not_supported(contract, direct_vm):
    direct_vm.value = 1
    with pytest.raises(Exception):
        contract.create_workspace("x", "Name", True)
    direct_vm.value = 0

def test_reference_immutability_and_optimistic_lock(workspace):
    old = workspace.get_references("northstar", 1)
    updated = copy.deepcopy(DOCS)
    updated[0]["body"] = "Refund requests must be submitted within 14 days of purchase."
    new = workspace.publish_references("northstar", 1, json.dumps(updated), True)
    assert new["version"] == 2 and new["digest"] != old["digest"]
    assert workspace.get_references("northstar", 1) == old
    with pytest.raises(Exception, match="REFERENCE_VERSION_CHANGED"):
        workspace.publish_references("northstar", 1, json.dumps(DOCS), True)

@pytest.mark.parametrize("docs", [
    [], [DOCS[0]] * 7, [DOCS[0], DOCS[0]], [{"id": "x"}],
    [{**DOCS[0], "url": "javascript:alert(1)"}],
    [{**DOCS[0], "url": "https://user:password@example.org"}],
    [{**DOCS[0], "body": ""}], [{**DOCS[0], "body": "x" * 6001}],
])
def test_bad_references_rejected(workspace, docs):
    with pytest.raises(Exception):
        workspace.publish_references("northstar", 1, json.dumps(docs), True)
    assert workspace.get_workspace("northstar")["version"] == 1

def test_reference_json_failure(workspace):
    with pytest.raises(Exception, match="INVALID_REFERENCE_JSON"):
        workspace.publish_references("northstar", 1, "{broken", True)

def test_invitation_requires_wallet_acceptance(workspace, direct_vm, direct_bob):
    account = addr(direct_bob)
    workspace.invite_member("northstar", account, "editor")
    assert workspace.get_role("northstar", account) == "visitor"
    assert workspace.get_invitation("northstar", account) == "editor"
    direct_vm.sender = direct_bob
    with pytest.raises(Exception, match="ROLE_REQUIRED"):
        workspace.publish_references("northstar", 1, json.dumps(DOCS), True)
    workspace.accept_invitation("northstar")
    assert workspace.get_role("northstar", account) == "editor"
    workspace.publish_references("northstar", 1, json.dumps(DOCS), True)

def test_role_change_requires_new_acceptance(workspace, direct_vm, direct_alice, direct_bob):
    account = addr(direct_bob)
    workspace.invite_member("northstar", account, "member")
    direct_vm.sender = direct_bob
    workspace.accept_invitation("northstar")
    direct_vm.sender = direct_alice
    workspace.invite_member("northstar", account, "reviewer")
    assert workspace.get_role("northstar", account) == "member"
    direct_vm.sender = direct_bob
    workspace.accept_invitation("northstar")
    assert workspace.get_role("northstar", account) == "reviewer"

def test_removal_clears_invitation_and_access(workspace, direct_vm, direct_alice, direct_bob):
    account = addr(direct_bob)
    workspace.invite_member("northstar", account, "member")
    direct_vm.sender = direct_bob
    workspace.accept_invitation("northstar")
    direct_vm.sender = direct_alice
    workspace.invite_member("northstar", account, "reviewer")
    workspace.remove_member("northstar", account)
    assert workspace.get_role("northstar", account) == "visitor"
    assert workspace.get_invitation("northstar", account) == ""

def test_visitor_cannot_review(workspace, direct_vm, direct_bob):
    direct_vm.sender = direct_bob
    with pytest.raises(Exception, match="ROLE_REQUIRED"):
        review(workspace, direct_vm)

def test_successfully_bound_assessment(workspace, direct_vm, direct_alice):
    record = review(workspace, direct_vm)
    assert record["assessment"]["verdict"] == "MATCHES_REFERENCES"
    assert record["author"] == addr(direct_alice)
    assert record["draft"] == DRAFT and record["question"] == QUESTION
    assert record["reference_digest"] == workspace.get_references("northstar", 1)["digest"]
    assert record["recorded_at"] == T0
    assert workspace.get_review("northstar", record["id"]) == record
    assert len(workspace.list_reviews("northstar", 0, 50)) == 1

@pytest.mark.parametrize("verdict,expected", [("CONTRADICTED", "NEEDS_CHANGES"), ("UNSUPPORTED", "NEEDS_CHANGES"), ("NEUTRAL", "NOT_ENOUGH_INFORMATION")])
def test_non_pass_verdicts(workspace, direct_vm, verdict, expected):
    assert review(workspace, direct_vm, model=response(verdict))["assessment"]["verdict"] == expected

@pytest.mark.parametrize("question_status", ["UNANSWERED", "NOT_IN_REFERENCES"])
def test_missing_information_never_passes(workspace, direct_vm, question_status):
    result = review(workspace, direct_vm, model=response(question_status=question_status))
    assert result["assessment"]["verdict"] == "NOT_ENOUGH_INFORMATION"

def test_same_request_is_idempotent_across_reference_changes(workspace, direct_vm):
    first = review(workspace, direct_vm)
    workspace.publish_references("northstar", 1, json.dumps(DOCS), True)
    assert review(workspace, direct_vm) == first
    assert workspace.get_workspace("northstar")["review_count"] == 1

def test_nonce_cannot_change_input(workspace, direct_vm):
    review(workspace, direct_vm)
    with pytest.raises(Exception, match="IDEMPOTENCY_CONFLICT"):
        review(workspace, direct_vm, draft="Different draft.")
    assert workspace.get_workspace("northstar")["review_count"] == 1

def test_stale_reference_cannot_start_new_review(workspace, direct_vm):
    workspace.publish_references("northstar", 1, json.dumps(DOCS), True)
    with pytest.raises(Exception, match="REFERENCE_VERSION_CHANGED"):
        review(workspace, direct_vm)

@pytest.mark.parametrize("draft", ["", "x" * 3001, "hello\x00world", "private_key: abc", "Please contact customer@example.org", "A. " * 13])
def test_invalid_or_sensitive_draft(workspace, direct_vm, draft):
    with pytest.raises(Exception):
        review(workspace, direct_vm, draft=draft)
    assert workspace.get_workspace("northstar")["review_count"] == 0

@pytest.mark.parametrize("mutation", ["empty", "extra", "missing", "wrong-id", "bool-id", "bad-verdict", "fake-quote", "fake-ref", "no-citation", "duplicate", "wrong-status"])
def test_malformed_model_never_writes(workspace, direct_vm, mutation):
    raw = response()
    if mutation == "empty": raw = {}
    elif mutation == "extra": raw["verdict"] = "MATCHES_REFERENCES"
    elif mutation == "missing": raw["findings"] = []
    elif mutation == "wrong-id": raw["findings"][0]["segment_id"] = 2
    elif mutation == "bool-id": raw["findings"][0]["segment_id"] = True
    elif mutation == "bad-verdict": raw["findings"][0]["verdict"] = "PASS"
    elif mutation == "fake-quote": raw["findings"][0]["citations"][0]["quote"] = "Refunds forever."
    elif mutation == "fake-ref": raw["findings"][0]["citations"][0]["reference_id"] = "invented"
    elif mutation == "no-citation": raw["findings"][0]["citations"] = []
    elif mutation == "duplicate": raw["findings"][0]["citations"] *= 2
    elif mutation == "wrong-status": raw["question_status"] = "PROBABLY"
    with pytest.raises(Exception):
        review(workspace, direct_vm, model=raw)
    assert workspace.get_workspace("northstar")["review_count"] == 0

def test_all_segments_must_be_reviewed(workspace, direct_vm):
    with pytest.raises(Exception, match="INCOMPLETE_COVERAGE"):
        review(workspace, direct_vm, draft=DRAFT + " We guarantee instant processing.")

def test_answer_card_requires_current_matching_review(workspace, direct_vm):
    record = review(workspace, direct_vm)
    card = workspace.publish_answer_card("northstar", "refunds", record["id"], "Refund window")
    assert card["draft"] == record["draft"]
    assert workspace.list_answer_cards("northstar", 0, 50)[0]["status"] == "APPROVED"
    workspace.publish_references("northstar", 1, json.dumps(DOCS), True)
    assert workspace.list_answer_cards("northstar", 0, 50)[0]["status"] == "NEEDS_RECHECK"
    assert workspace.get_review("northstar", record["id"]) == record
    with pytest.raises(Exception, match="RECHECK_REQUIRED"):
        workspace.publish_answer_card("northstar", "refunds-v2", record["id"], "Refund window")

def test_answer_card_rejects_nonmatching_review(workspace, direct_vm):
    record = review(workspace, direct_vm, model=response("CONTRADICTED"))
    with pytest.raises(Exception, match="MATCHING_ASSESSMENT_REQUIRED"):
        workspace.publish_answer_card("northstar", "bad", record["id"], "Bad")

def test_card_retirement_keeps_evidence(workspace, direct_vm):
    record = review(workspace, direct_vm)
    workspace.publish_answer_card("northstar", "refunds", record["id"], "Refunds")
    workspace.retire_answer_card("northstar", "refunds")
    assert workspace.list_answer_cards("northstar", 0, 50)[0]["status"] == "RETIRED"
    assert workspace.get_review("northstar", record["id"]) == record

def test_member_cannot_approve(workspace, direct_vm, direct_bob):
    record = review(workspace, direct_vm)
    workspace.invite_member("northstar", addr(direct_bob), "member")
    direct_vm.sender = direct_bob
    workspace.accept_invitation("northstar")
    with pytest.raises(Exception, match="ROLE_REQUIRED"):
        workspace.publish_answer_card("northstar", "refunds", record["id"], "Refunds")

def test_ownership_transfer_is_two_step(workspace, direct_vm, direct_alice, direct_bob):
    workspace.propose_owner("northstar", addr(direct_bob))
    assert workspace.get_workspace("northstar")["owner"] == addr(direct_alice)
    with pytest.raises(Exception, match="NOT_PROPOSED_OWNER"):
        workspace.accept_ownership("northstar")
    direct_vm.sender = direct_bob
    workspace.accept_ownership("northstar")
    assert workspace.get_workspace("northstar")["owner"] == addr(direct_bob)
    assert workspace.get_role("northstar", addr(direct_alice)) == "visitor"

def test_archive_preserves_reads_and_owner_can_restore(workspace, direct_vm):
    record = review(workspace, direct_vm)
    workspace.set_archived("northstar", True)
    assert workspace.get_review("northstar", record["id"]) == record
    with pytest.raises(Exception, match="WORKSPACE_ARCHIVED"):
        review(workspace, direct_vm, request_id="blocked")
    workspace.set_archived("northstar", False)
    assert not workspace.get_workspace("northstar")["archived"]

@pytest.mark.parametrize("offset,limit", [(-1, 10), (0, 0), (0, 51), (True, 1), (0, True)])
def test_pagination_bounds(workspace, offset, limit):
    for method, args in ((workspace.list_workspaces, (offset,limit)), (workspace.list_reviews, ("northstar",offset,limit)), (workspace.list_answer_cards, ("northstar",offset,limit))):
        with pytest.raises(Exception, match="INVALID_PAGE"):
            method(*args)

def test_cross_workspace_isolation(workspace, direct_vm, direct_bob):
    record = review(workspace, direct_vm)
    direct_vm.sender = direct_bob
    workspace.create_workspace("other", "Other", True)
    with pytest.raises(Exception, match="REVIEW_NOT_FOUND"):
        workspace.get_review("other", record["id"])
