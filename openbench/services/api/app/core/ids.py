from __future__ import annotations

import secrets
import string

ALPHABET = string.ascii_lowercase + string.digits


def short_id(prefix: str = "", length: int = 14) -> str:
    body = "".join(secrets.choice(ALPHABET) for _ in range(length))
    return f"{prefix}_{body}" if prefix else body


def doc_id() -> str:
    return short_id("doc")


def proto_id() -> str:
    return short_id("pro")


def version_id() -> str:
    return short_id("pv")


def step_id() -> str:
    return short_id("stp")


def run_id() -> str:
    return short_id("run")


def event_id() -> str:
    return short_id("evt")


def att_id() -> str:
    return short_id("att")


def org_id() -> str:
    return short_id("org")


def user_id() -> str:
    return short_id("usr")


def membership_id() -> str:
    return short_id("mem")


def deviation_id() -> str:
    return short_id("dev")


def timer_id() -> str:
    return short_id("tmr")


def report_id() -> str:
    return short_id("rep")


def chunk_id() -> str:
    return short_id("ch")


def assessment_id() -> str:
    return short_id("pa")


def step_state_id() -> str:
    return short_id("ss")


def hazard_id() -> str:
    return short_id("hz")


def audit_id() -> str:
    return short_id("aud")
