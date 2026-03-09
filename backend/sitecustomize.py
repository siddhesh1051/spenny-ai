"""Auto-loaded by Python on startup — disables SSL verification when SSL_VERIFY=false."""
import os
if os.environ.get("SSL_VERIFY", "true").lower() == "false":
    import httpx
    _orig_async = httpx.AsyncClient.__init__
    def _p_async(self, *a, **kw):
        kw.setdefault("verify", False)
        _orig_async(self, *a, **kw)
    httpx.AsyncClient.__init__ = _p_async
    _orig_sync = httpx.Client.__init__
    def _p_sync(self, *a, **kw):
        kw.setdefault("verify", False)
        _orig_sync(self, *a, **kw)
    httpx.Client.__init__ = _p_sync
