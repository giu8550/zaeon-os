"""ProfileRepository — carrega perfil + plano do usuário pro agente.

O perfil vive no app Zaeon (Next.js + Mongo). O agent-gateway é Python → lê via API
interna. Interface + impl HTTP + fake em memória (pros testes / dev sem o app).
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from app.agent.persona import UserProfile
from app.engines import plans


class ProfileRepository(ABC):
    @abstractmethod
    async def get(self, owner_id: int) -> Optional[UserProfile]: ...

    @abstractmethod
    async def get_by_instance(self, instance_id: str) -> Optional[UserProfile]: ...


class HttpProfileRepository(ProfileRepository):
    """Lê o perfil via API interna do Zaeon. PONTO DE PAUSA: URL + token de serviço."""

    def __init__(self, base_url: str, token: Optional[str] = None) -> None:
        self._base = base_url.rstrip("/")
        self._token = token

    async def _fetch(self, path: str) -> Optional[dict]:
        import httpx  # import tardio
        headers = {"Authorization": f"Bearer {self._token}"} if self._token else {}
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(f"{self._base}{path}", headers=headers)
            return r.json() if r.is_success else None

    def _to_profile(self, d: dict) -> UserProfile:
        plan = plans.Plan(d.get("plan", "free"))
        return UserProfile(
            user_id=int(d["user_id"]),
            full_name=d.get("full_name", ""),
            email=d.get("email", ""),
            address_override=d.get("pronoun_override"),
            institution=d.get("institution"),
            plan_state=plans.PlanState(plan=plan),
        )

    async def get(self, owner_id: int) -> Optional[UserProfile]:
        d = await self._fetch(f"/api/internal/profile/{owner_id}")
        return self._to_profile(d) if d else None

    async def get_by_instance(self, instance_id: str) -> Optional[UserProfile]:
        d = await self._fetch(f"/api/internal/profile/by-instance/{instance_id}")
        return self._to_profile(d) if d else None


class InMemoryProfileRepository(ProfileRepository):
    """Fake pros testes / dev local."""

    def __init__(self, by_owner: Optional[dict[int, UserProfile]] = None,
                 by_instance: Optional[dict[str, UserProfile]] = None) -> None:
        self._owner = by_owner or {}
        self._inst = by_instance or {}

    async def get(self, owner_id: int) -> Optional[UserProfile]:
        return self._owner.get(owner_id)

    async def get_by_instance(self, instance_id: str) -> Optional[UserProfile]:
        return self._inst.get(instance_id)
