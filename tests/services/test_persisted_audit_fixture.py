"""
Audit Trail Ledger Fixture Verification Test (SIH PS-25022).

Guarantees that the canonical persisted audit ledger (backend/data/audit_trail.jsonl)
shipped in the repository is 100% cryptographically valid, tamper-free,
and linked from GENESIS_ROOT with no broken hash pointers or data alterations.
"""
import pytest
from pathlib import Path
from backend.services.audit import AuditLogger


def test_persisted_audit_fixture_is_valid():
    """Verify that the actual shipped audit trail file passes full SHA-256 chain verification."""
    audit_file = Path(__file__).parent.parent.parent / "backend" / "data" / "audit_trail.jsonl"
    assert audit_file.exists(), f"Canonical audit trail file missing at {audit_file}"

    logger = AuditLogger(persistence_file_path=str(audit_file))
    
    assert len(logger.logs) > 0, "Audit trail should contain historical records"
    
    verification = logger.verify_chain_integrity()
    assert verification["is_tamper_free"] is True, f"Audit ledger failed cryptographic verification: {verification}"
    assert verification["entries_verified"] == len(logger.logs)
    assert "latest_root_hash" in verification
    assert len(verification["latest_root_hash"]) == 64  # Valid SHA-256 hex string
