from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone
from typing import Any


def _to_str(v: Any) -> str:
    try:
        if v is None:
            return ""
        return str(v)
    except Exception:
        return ""

# Cache the column set (SQLite schema doesn't change at runtime)
_audit_cols_cache = None

def _audit_cols(db):
    global _audit_cols_cache
    if _audit_cols_cache is None:
        # Detect actual columns present in audit_logs
        rows = db.execute(text("PRAGMA table_info('audit_logs')")).fetchall()
        _audit_cols_cache = {r[1] for r in rows}  # second field is name
    return _audit_cols_cache

def log_change(db, *, actor: str, entity_type: str, entity_id: int, field: str, old_value, new_value):
    """Schema-aware insert into audit_logs. Always set ts. Add timestamp if present."""
    cols = _audit_cols(db)
    print("AUDIT_COLS", cols)  # doit contenir {'ts', 'timestamp', ...}
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    payload = {
        "actor": actor or "system",
        "action": "update",
        "entity_type": entity_type,
        "entity_id": entity_id,
        "field": field,
        "old_value": _to_str(old_value),
        "new_value": _to_str(new_value),
        "ts": now_str,
        "timestamp": now_str,
    }
    # Build column list dynamically
    base_cols = ["actor","action","entity_type","entity_id","field","old_value","new_value"]
    insert_cols = base_cols[:]
    if "ts" in cols:
        insert_cols.append("ts")
    if "timestamp" in cols:
        insert_cols.append("timestamp")
    placeholders = ",".join(f":{c}" for c in insert_cols)
    columns_sql = ",".join(insert_cols)
    sql = text(f"INSERT INTO audit_logs ({columns_sql}) VALUES ({placeholders})")
    print("AUDIT_INSERT", columns_sql, {k: payload[k] for k in insert_cols})
    try:
        db.execute(sql, {k: payload[k] for k in insert_cols})
    except IntegrityError:
        # Fallback: force ts in case of mismatch
        if "ts" not in insert_cols and "ts" in cols:
            insert_cols.append("ts")
            placeholders = ",".join(f":{c}" for c in insert_cols)
            columns_sql = ",".join(insert_cols)
            sql = text(f"INSERT INTO audit_logs ({columns_sql}) VALUES ({placeholders})")
            db.execute(sql, {k: payload[k] for k in insert_cols})
    # Do not commit here; outer transaction controls commit.
