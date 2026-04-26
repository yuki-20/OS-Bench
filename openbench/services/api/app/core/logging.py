from __future__ import annotations

import sys
from loguru import logger as _logger


def configure_logging() -> None:
    _logger.remove()
    _logger.add(
        sys.stdout,
        level="INFO",
        format="<level>{level:<8}</level> <cyan>{name}:{function}:{line}</cyan> | {message}",
        colorize=True,
    )


logger = _logger
