import time
import requests
from typing import Optional, Dict, Any
from .logging import setup_logging

logger = setup_logging()


class APIClient:
    def __init__(self, base_url: str, headers: Optional[Dict[str, str]] = None, rate_limit: int = 200):
        self.base_url = base_url.rstrip('/')
        self.headers = headers or {}
        self.rate_limit = rate_limit
        self.last_request_time = 0
        self.min_request_delay = 60 / rate_limit

    def _wait_for_rate_limit(self):
        elapsed = time.time() - self.last_request_time
        if elapsed < self.min_request_delay:
            time.sleep(self.min_request_delay - elapsed)
        self.last_request_time = time.time()

    def get(self, endpoint: str, params: Optional[Dict[str, Any]] = None, max_retries: int = 3) -> Optional[Dict[str, Any]]:
        self._wait_for_rate_limit()

        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        retries = 0

        while retries < max_retries:
            try:
                response = requests.get(url, params=params, headers=self.headers)
                return response.json()
            except requests.exceptions.RequestException as e:
                retries += 1
                wait_time = 2 ** retries
                logger.warning(
                    "Request failed",
                    url=url,
                    attempt=retries,
                    max_retries=max_retries,
                    error=str(e)
                )
                if retries < max_retries:
                    time.sleep(wait_time)
                else:
                    logger.error("Max retries reached", url=url, error=str(e))
                    return None

        return None
