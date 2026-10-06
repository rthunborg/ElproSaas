#!/usr/bin/env python3
"""Resolve the owner-authorized Codex effort from a task's assessed risk domains.

Pure selection, no launch, inference or state writes. The caller assesses the
actual task/diff (not generic project boilerplate) and persists the returned
route with state_update.py before dispatch. Unknown domains fail closed.
"""
from __future__ import annotations

import argparse
import json

from state_update import _GOVERNED_CODEX_ROUTES

SENSITIVE_DOMAINS = frozenset({
    "tenant-isolation", "tenancy", "provisioning", "rbac", "permissions",
    "authentication", "authorization", "security", "rls", "secrets",
    "public-tokens", "money-tax", "transactional-integrity", "critical-conflict",
})
EFFORT_RANK = {"low": 0, "medium": 1, "high": 2}


def select_effort(phase: str, risk_domains=(), *, current_effort=None,
                  retry=False, host="codex", tier="subagents", route="subagent") -> dict:
    if phase not in _GOVERNED_CODEX_ROUTES:
        raise ValueError(f"unknown phase: {phase}")
    domains = sorted(set(risk_domains))
    unknown = set(domains) - SENSITIVE_DOMAINS
    if unknown:
        raise ValueError("unknown risk domains: " + ", ".join(sorted(unknown)))
    if current_effort is not None and current_effort not in EFFORT_RANK:
        raise ValueError(f"unsupported current effort: {current_effort}")
    if host != "codex" and route != "cli:codex":
        raise ValueError("this effort policy only selects Codex routes")
    role, profile, model, default = _GOVERNED_CODEX_ROUTES[phase]
    fixed_high = phase == "security_layer"
    effort = "high" if domains or fixed_high else "medium" if retry else default
    if current_effort and EFFORT_RANK[current_effort] > EFFORT_RANK[effort]:
        effort = current_effort
    reason = (
        "Automatic sensitive-task escalation: " + ", ".join(domains) if domains else
        "Critical security/convergence phase" if fixed_high else
        "Low attempt needs more reasoning" if retry else
        "Ordinary task uses Low effort"
    )
    if current_effort and effort == current_effort and not domains and not fixed_high:
        reason = f"Retain persisted {current_effort} effort for the in-flight task"
    return {
        "phase": phase, "role": role, "profile": profile, "model": model,
        "effort": effort, "host": host, "tier": tier, "route": route,
        "escalation_reason": reason,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--phase", required=True)
    parser.add_argument("--risk-domain", action="append", default=[])
    parser.add_argument("--current-effort", choices=tuple(EFFORT_RANK))
    parser.add_argument("--retry", action="store_true")
    parser.add_argument("--host", default="codex")
    parser.add_argument("--tier", default="subagents")
    parser.add_argument("--route", default="subagent")
    args = parser.parse_args()
    try:
        selected = select_effort(
            args.phase, args.risk_domain, current_effort=args.current_effort,
            retry=args.retry, host=args.host, tier=args.tier, route=args.route,
        )
    except ValueError as exc:
        print(json.dumps({"ok": False, "error": str(exc)}))
        return 2
    print(json.dumps(selected))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
