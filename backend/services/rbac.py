"""
Role-Based Access Control (RBAC) Enforcement Service (SIH PS-25022).

Defines the single authoritative backend permission matrix for RAILOPT-X,
synchronized with the frontend permission matrix in src/services/permissions.ts.
Enforces permissions on all privileged API endpoints via X-User-Role header inspection.
"""
from typing import Optional, Dict
from fastapi import Header, HTTPException, status

OPERATOR_ROLES = ("Controller", "Supervisor", "Admin", "Analyst")

ROLE_PERMISSIONS: Dict[str, Dict[str, bool]] = {
    "Controller": {
        "controlSimulation": True,
        "optimize": True,
        "approveDecision": True,
        "injectDisruption": False,
        "whatIf": True,
        "analytics": True,
        "audit": True,
        "safetyConfig": False,
    },
    "Supervisor": {
        "controlSimulation": True,
        "optimize": True,
        "approveDecision": True,
        "injectDisruption": True,
        "whatIf": True,
        "analytics": True,
        "audit": True,
        "safetyConfig": False,
    },
    "Admin": {
        "controlSimulation": True,
        "optimize": True,
        "approveDecision": True,
        "injectDisruption": True,
        "whatIf": True,
        "analytics": True,
        "audit": True,
        "safetyConfig": True,
    },
    "Analyst": {
        "controlSimulation": False,
        "optimize": False,
        "approveDecision": False,
        "injectDisruption": False,
        "whatIf": True,
        "analytics": True,
        "audit": True,
        "safetyConfig": False,
    },
}


def normalize_role(role_header: Optional[str]) -> str:
    """Normalize and validate the incoming operator role string."""
    if not role_header or not role_header.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing required 'X-User-Role' header. Operator role authentication required."
        )
    
    cleaned = role_header.strip().capitalize()
    if cleaned in ROLE_PERMISSIONS:
        return cleaned
    
    # Check case-insensitive match
    for valid_role in ROLE_PERMISSIONS:
        if valid_role.lower() == role_header.strip().lower():
            return valid_role
            
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Unknown operator role '{role_header}'. Valid roles: {list(ROLE_PERMISSIONS.keys())}"
    )


def can_perform(role: str, action: str) -> bool:
    """Check whether a given role is authorized to perform an action."""
    normalized = normalize_role(role)
    return ROLE_PERMISSIONS.get(normalized, {}).get(action, False)


def check_role_permission(user_role: Optional[str], allowed_roles: list[str]) -> str:
    """Validate user_role against an explicit list of allowed roles."""
    role = normalize_role(user_role)
    allowed_capitalized = [r.strip().capitalize() for r in allowed_roles]
    if role not in allowed_capitalized and "Admin" not in role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{role}' is unauthorized. Allowed roles: {allowed_roles}"
        )
    return role


def enforce_permission(action: str, x_user_role: Optional[str] = Header(None)):
    """FastAPI route guard ensuring the calling role has permission for the specified action."""
    role = normalize_role(x_user_role)
    if not can_perform(role, action):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{role}' is not authorized to perform action '{action}'. Permission denied."
        )
    return role

