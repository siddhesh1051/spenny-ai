"""Supabase DB helpers using httpx directly — avoids SSL issues with supabase-py on macOS."""

import httpx
from .config import get_settings

_settings = get_settings()


def _rest(path: str) -> str:
    return f"/rest/v1/{path}"


class _Table:
    """Minimal async PostgREST client wrapper."""

    def __init__(self, table: str, base_url: str, anon_key: str, auth_token: str, ssl_verify: bool):
        self._table = table
        self._base_url = base_url
        self._anon_key = anon_key
        self._auth_token = auth_token
        self._ssl_verify = ssl_verify
        self._filters: list[tuple[str, str]] = []
        self._select_cols = "*"
        self._limit_val: int | None = None
        self._order_col: str | None = None
        self._order_desc: bool = False
        self._single = False

    def _headers(self, extra: dict | None = None) -> dict:
        h = {
            "apikey": self._anon_key,
            "Authorization": f"Bearer {self._auth_token}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        if extra:
            h.update(extra)
        return h

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(base_url=self._base_url, verify=self._ssl_verify, timeout=30)

    def select(self, cols: str = "*"):
        self._select_cols = cols
        return self

    def eq(self, col: str, val):
        self._filters.append((col, f"eq.{val}"))
        return self

    def gte(self, col: str, val):
        self._filters.append((col, f"gte.{val}"))
        return self

    def lte(self, col: str, val):
        self._filters.append((col, f"lte.{val}"))
        return self

    def ilike(self, col: str, pattern: str):
        self._filters.append((col, f"ilike.{pattern}"))
        return self

    def order(self, col: str, desc: bool = False):
        self._order_col = col
        self._order_desc = desc
        return self

    def limit(self, n: int):
        self._limit_val = n
        return self

    def single(self):
        self._single = True
        return self

    def _params(self) -> dict:
        params: dict = {"select": self._select_cols}
        for col, filter_val in self._filters:
            params[col] = filter_val
        if self._order_col:
            direction = "desc" if self._order_desc else "asc"
            params["order"] = f"{self._order_col}.{direction}"
        if self._limit_val is not None:
            params["limit"] = str(self._limit_val)
        return params

    async def execute(self) -> "_Result":
        extra_headers = {}
        if self._single:
            extra_headers["Accept"] = "application/vnd.pgrst.object+json"
        async with self._client() as client:
            resp = await client.get(
                _rest(self._table),
                params=self._params(),
                headers=self._headers(extra_headers),
            )
        if resp.status_code in (200, 201, 206):
            return _Result(resp.json())
        if resp.status_code == 406 and self._single:
            return _Result(None)
        resp.raise_for_status()
        return _Result(None)

    async def insert(self, data: dict | list) -> "_Result":
        async with self._client() as client:
            resp = await client.post(
                _rest(self._table),
                json=data,
                headers=self._headers(),
            )
        if resp.status_code in (200, 201):
            rows = resp.json()
            if isinstance(data, list):
                return _Result(rows)
            return _Result(rows[0] if rows else data)
        resp.raise_for_status()
        return _Result(None)

    async def upsert(self, data: dict, on_conflict: str = "") -> "_Result":
        headers = self._headers({
            "Prefer": "resolution=merge-duplicates,return=representation",
        })
        params = {}
        if on_conflict:
            params["on_conflict"] = on_conflict
        async with self._client() as client:
            resp = await client.post(
                _rest(self._table),
                json=data,
                headers=headers,
                params=params,
            )
        if resp.status_code in (200, 201):
            rows = resp.json()
            return _Result(rows[0] if rows else data)
        resp.raise_for_status()
        return _Result(None)

    async def update(self, data: dict) -> "_Result":
        params = {col: val for col, val in self._filters}
        async with self._client() as client:
            resp = await client.patch(
                _rest(self._table),
                json=data,
                params=params,
                headers=self._headers(),
            )
        if resp.status_code in (200, 201, 204):
            body = resp.json() if resp.content else []
            return _Result(body)
        resp.raise_for_status()
        return _Result(None)

    async def delete(self) -> "_Result":
        params = {col: val for col, val in self._filters}
        async with self._client() as client:
            resp = await client.delete(
                _rest(self._table),
                params=params,
                headers=self._headers(),
            )
        if resp.status_code in (200, 204):
            return _Result(resp.json() if resp.content else [])
        resp.raise_for_status()
        return _Result(None)


class _Result:
    def __init__(self, data):
        self.data = data


class _DB:
    def __init__(self, base_url: str, anon_key: str, auth_token: str, ssl_verify: bool):
        self._base_url = base_url
        self._anon_key = anon_key
        self._auth_token = auth_token
        self._ssl_verify = ssl_verify

    def table(self, name: str) -> _Table:
        return _Table(name, self._base_url, self._anon_key, self._auth_token, self._ssl_verify)

    async def rpc(self, fn: str, params: dict) -> "_Result":
        headers = {
            "apikey": self._anon_key,
            "Authorization": f"Bearer {self._auth_token}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(base_url=self._base_url, verify=self._ssl_verify, timeout=30) as client:
            resp = await client.post(f"/rest/v1/rpc/{fn}", json=params, headers=headers)
        if resp.status_code in (200, 201):
            return _Result(resp.json())
        resp.raise_for_status()
        return _Result(None)


def get_service_client(user_token: str | None = None) -> _DB:
    """
    Returns an async DB client.
    - Pass user_token (the request JWT) to query as that user (RLS applies, user sees own data).
    - Without user_token, falls back to anon key (RLS blocks most reads).
    """
    token = user_token or _settings.supabase_anon_key
    return _DB(
        base_url=_settings.supabase_url,
        anon_key=_settings.supabase_anon_key,
        auth_token=token,
        ssl_verify=_settings.ssl_verify,
    )
