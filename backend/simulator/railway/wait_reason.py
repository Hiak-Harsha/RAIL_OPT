"""
WaitReason — Authoritative machine-readable reason for a waiting/held train.

Instead of a plain string status, each waiting train carries a structured
WaitReason with entity reference, remaining time, and severity — so the
frontend can render accurate "Why is this train waiting?" explanations.
"""
from __future__ import annotations
from enum import Enum
from typing import Optional
from pydantic import BaseModel


class WaitReasonType(str, Enum):
    """The specific cause of a train's WAITING_FOR_* state."""
    ROUTE_NOT_RESERVED = "ROUTE_NOT_RESERVED"          # Block not yet cleared/reserved
    HEADWAY_INSUFFICIENT = "HEADWAY_INSUFFICIENT"      # 180s headway deficit remaining
    PLATFORM_UNAVAILABLE = "PLATFORM_UNAVAILABLE"      # Destination platform occupied/reserved
    CONFLICT_HOLD = "CONFLICT_HOLD"                    # Controller HOLD order active
    DISRUPTION = "DISRUPTION"                          # Active disruption on this train
    SIGNAL_RED = "SIGNAL_RED"                          # Standing at RED signal


class WaitReason(BaseModel):
    """
    Machine-readable wait reason attached to a held/waiting train.

    Fields:
        type: Why the train is waiting (enum above)
        entity_id: Which block/signal/platform/train is causing the hold
        remaining_sec: Estimated time until wait condition clears (0 = unknown)
        severity: CRITICAL / HIGH / MEDIUM / LOW
        message: Human-readable summary for UI display
    """
    type: WaitReasonType
    entity_id: Optional[str] = None
    remaining_sec: float = 0.0
    severity: str = "MEDIUM"
    message: str = ""

    @classmethod
    def headway(cls, remaining_sec: float, blocking_train_id: Optional[str] = None) -> "WaitReason":
        return cls(
            type=WaitReasonType.HEADWAY_INSUFFICIENT,
            entity_id=blocking_train_id,
            remaining_sec=remaining_sec,
            severity="HIGH" if remaining_sec > 120 else "MEDIUM",
            message=f"WAITING FOR HEADWAY — {int(remaining_sec)}s remaining"
            + (f" (behind {blocking_train_id})" if blocking_train_id else "")
        )

    @classmethod
    def route(cls, blocking_block_id: Optional[str] = None, blocking_train_id: Optional[str] = None) -> "WaitReason":
        return cls(
            type=WaitReasonType.ROUTE_NOT_RESERVED,
            entity_id=blocking_block_id,
            remaining_sec=0.0,
            severity="HIGH",
            message=f"WAITING FOR ROUTE"
            + (f" — {blocking_block_id} reserved by {blocking_train_id}" if blocking_block_id else "")
        )

    @classmethod
    def platform(cls, platform_id: Optional[str] = None, station_code: Optional[str] = None) -> "WaitReason":
        return cls(
            type=WaitReasonType.PLATFORM_UNAVAILABLE,
            entity_id=platform_id,
            remaining_sec=0.0,
            severity="MEDIUM",
            message=f"WAITING FOR PLATFORM"
            + (f" — {station_code} {platform_id} unavailable" if platform_id else "")
        )

    @classmethod
    def conflict_hold(cls, hold_remaining_sec: float, hold_block_id: Optional[str] = None) -> "WaitReason":
        return cls(
            type=WaitReasonType.CONFLICT_HOLD,
            entity_id=hold_block_id,
            remaining_sec=hold_remaining_sec,
            severity="CRITICAL",
            message=f"CONFLICT HOLD ACTIVE — {int(hold_remaining_sec)}s remaining"
            + (f" at {hold_block_id}" if hold_block_id else "")
        )

    @classmethod
    def signal_red(cls, signal_id: Optional[str] = None, block_id: Optional[str] = None) -> "WaitReason":
        return cls(
            type=WaitReasonType.SIGNAL_RED,
            entity_id=signal_id or block_id,
            remaining_sec=0.0,
            severity="HIGH",
            message=f"AT RED SIGNAL — awaiting aspect change"
            + (f" ({signal_id})" if signal_id else "")
        )
