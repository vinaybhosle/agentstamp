"""AgentStamp API client for trust verification and reputation scoring."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import requests


DEFAULT_BASE_URL = "https://agentstamp.org/api/v1"
DEFAULT_TIMEOUT = 10


class AgentStampError(Exception):
    """Raised when an AgentStamp API call fails."""

    def __init__(self, message: str, status_code: Optional[int] = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class AgentStampClient:
    """Client for the AgentStamp trust intelligence API.

    Usage::

        from agentstamp import AgentStampClient

        client = AgentStampClient()
        result = client.trust_check("0x1234...")
        print(result["trusted"], result["score"])
    """

    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        timeout: int = DEFAULT_TIMEOUT,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._session = requests.Session()
        self._session.headers.update({"Accept": "application/json"})

    # ── Trust ────────────────────────────────────────────────

    def trust_check(self, wallet_address: str) -> Dict[str, Any]:
        """Single-call trust verdict for a wallet address.

        Returns a dict with ``trusted`` (bool), ``score`` (int 0-100),
        ``tier``, ``label``, and optional ``agent`` / ``stamp`` details.
        """
        return self._get(f"/trust/check/{wallet_address}")

    # ── Stamps ───────────────────────────────────────────────

    def verify_stamp(self, stamp_id: str) -> Dict[str, Any]:
        """Verify an identity certificate by stamp ID."""
        return self._get(f"/stamp/verify/{stamp_id}")

    def stamp_stats(self) -> Dict[str, Any]:
        """Get stamp issuance statistics."""
        return self._get("/stamp/stats")

    # ── Registry ─────────────────────────────────────────────

    def search_agents(
        self,
        query: Optional[str] = None,
        category: Optional[str] = None,
        limit: int = 10,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """Search the agent directory."""
        params: Dict[str, Any] = {"limit": limit, "offset": offset}
        if query:
            params["q"] = query
        if category:
            params["category"] = category
        return self._get("/registry/search", params=params)

    def get_agent(self, agent_id: str) -> Dict[str, Any]:
        """Get an agent's full profile."""
        return self._get(f"/registry/agent/{agent_id}")

    def get_reputation(self, agent_id: str) -> Dict[str, Any]:
        """Get an agent's reputation score (0-100) with full breakdown."""
        return self._get(f"/registry/agent/{agent_id}/reputation")

    def leaderboard(self) -> Dict[str, Any]:
        """Get the agent leaderboard."""
        return self._get("/registry/leaderboard")

    def browse_agents(
        self,
        category: Optional[str] = None,
        limit: int = 10,
    ) -> Dict[str, Any]:
        """Browse registered agents."""
        params: Dict[str, Any] = {"limit": limit}
        if category:
            params["category"] = category
        return self._get("/registry/browse", params=params)

    # ── Wishing Well ─────────────────────────────────────────

    def browse_wishes(
        self,
        category: Optional[str] = None,
        limit: int = 10,
    ) -> Dict[str, Any]:
        """Browse wishes in the wishing well."""
        params: Dict[str, Any] = {"limit": limit}
        if category:
            params["category"] = category
        return self._get("/well/wishes", params=params)

    def trending_wishes(self) -> Dict[str, Any]:
        """Get trending wish categories."""
        return self._get("/well/trending")

    # ── Passport ─────────────────────────────────────────────

    def get_passport(self, wallet_address: str) -> Dict[str, Any]:
        """Get a signed cross-protocol agent passport."""
        return self._get(f"/passport/{wallet_address}")

    def get_a2a_card(self, wallet_address: str) -> Dict[str, Any]:
        """Get an A2A agent card (Google A2A protocol compatible)."""
        return self._get(f"/passport/{wallet_address}/a2a")

    # ── Internals ────────────────────────────────────────────

    def _get(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        try:
            resp = self._session.get(url, params=params, timeout=self.timeout)
        except requests.RequestException as exc:
            raise AgentStampError(f"Request failed: {exc}") from exc

        if resp.status_code >= 400:
            raise AgentStampError(
                f"API error {resp.status_code}: {resp.text[:200]}",
                status_code=resp.status_code,
            )
        return resp.json()


# ── Convenience functions ────────────────────────────────────

_default_client: Optional[AgentStampClient] = None


def _get_client() -> AgentStampClient:
    global _default_client
    if _default_client is None:
        _default_client = AgentStampClient()
    return _default_client


def verify(stamp_id: str) -> Dict[str, Any]:
    """Verify an AgentStamp certificate. Shorthand for ``AgentStampClient().verify_stamp(...)``."""
    return _get_client().verify_stamp(stamp_id)


def trust_check(wallet_address: str) -> Dict[str, Any]:
    """Single-call trust verdict. Shorthand for ``AgentStampClient().trust_check(...)``."""
    return _get_client().trust_check(wallet_address)


def get_reputation(agent_id: str) -> Dict[str, Any]:
    """Get agent reputation. Shorthand for ``AgentStampClient().get_reputation(...)``."""
    return _get_client().get_reputation(agent_id)
