from sqlalchemy.orm import Session
from ..models_audit import AuditLog
from typing import Optional, Dict, Any

def log_change(
    db: Session,
    *,
    actor: Optional[str] = "system",
    action: str,
    entity_type: str,
    entity_id: int,
    field: str,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    meta: Optional[Dict[str, Any]] = None
):
    """Log a change to the audit log."""
    log_entry = AuditLog(
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        field=field,
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(new_value) if new_value is not None else None,
        meta=meta
    )
    db.add(log_entry)
    # Note: caller should commit

