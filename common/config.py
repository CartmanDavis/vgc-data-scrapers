import os
import json
from pathlib import Path
from typing import Optional, Any


class Config:
    def __init__(self, config_path: Optional[str] = None):
        if config_path is None:
            config_path = 'config.json'
        self.config_path = config_path
        self._config = {}
        self._load_config()

    def _load_config(self):
        if self.config_path and Path(self.config_path).exists():
            with open(self.config_path, 'r') as f:
                self._config = json.load(f)

    def get(self, key: str, default: Any = None, env_var: Optional[str] = None) -> Any:
        if env_var:
            value = os.getenv(env_var)
            if value:
                return value

        keys = key.split('.')
        value = self._config
        for k in keys:
            value = value.get(k) if isinstance(value, dict) else None
            if value is None:
                return default
        return value or default

    @property
    def limitless_api_key(self) -> Optional[str]:
        return self.get('limitless.apiKey', env_var='LIMITLESS_API_KEY')

    @property
    def limitless_base_url(self) -> str:
        return self.get('limitless.baseUrl', 'https://play.limitlesstcg.com/api') or 'https://play.limitlesstcg.com/api'

    @property
    def limitless_rate_limit(self) -> int:
        return int(self.get('limitless.rateLimit', '200') or '200')

    @property
    def rk9_base_url(self) -> str:
        return self.get('rk9.baseUrl', 'https://rk9.gg') or 'https://rk9.gg'

    @property
    def rk9_request_delay(self) -> float:
        return float(self.get('rk9.requestDelay', '1.0') or '1.0')

    @property
    def db_path(self) -> str:
        return self.get('database.path', './db/vgc.db') or './db/vgc.db'

    @property
    def log_dir(self) -> str:
        return self.get('log.dir', './logs') or './logs'
