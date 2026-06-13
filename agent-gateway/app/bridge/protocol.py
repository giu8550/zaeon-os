"""Contrato do barramento Redis com o whatsmeow adapter (zenith-wa-bridge).

Porta enxuta de `app/bridge/{shard,producer}.py` do zenith-warmer. Define:
- `shard_of(instance_id, n)`  → shard = instance_id % n (label string).
- `build_command(...)`        → (stream, fields) p/ XADD em wa:cmd:{shard}.

O adapter Go lê SÓ o campo `v` (JSON do Command) — a fidelidade do `v` é o contrato.
Os campos indexados são paridade pra inspeção via redis-cli.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Optional


def shard_of(instance_id: int, n: int) -> str:
    if n <= 1:
        return "0"
    return str(instance_id % n)


def build_command(
    operation: str,
    instance_id: int,
    payload: dict[str, Any],
    *,
    n_shards: int,
    idempotency_key: Optional[str] = None,
) -> tuple[str, dict[str, str]]:
    """Monta (nome_do_stream, fields) para publicar um comando no adapter."""
    command_id = str(uuid.uuid4())
    requested_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    v = {
        "command_id": command_id,
        "instance_id": instance_id,
        "operation": operation,
        "payload": payload,
        "requested_at": requested_at,
        "idempotency_key": idempotency_key or command_id,
    }
    stream = f"wa:cmd:{shard_of(instance_id, n_shards)}"
    fields = {
        "command_id": command_id,
        "instance_id": str(instance_id),
        "operation": operation,
        # JSON compacto, UTF-8 cru (paridade byte-a-byte com json.Marshal do Go)
        "v": json.dumps(v, separators=(",", ":"), ensure_ascii=False),
    }
    return stream, fields
