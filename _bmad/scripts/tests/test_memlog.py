#!/usr/bin/env python3
"""Focused concurrency contracts for the shared memlog writer."""

from __future__ import annotations

import importlib.util
import subprocess
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "memlog.py"
SPEC = importlib.util.spec_from_file_location("bmad_memlog", SCRIPT)
if SPEC is None or SPEC.loader is None:  # pragma: no cover - import machinery failure
    raise RuntimeError(f"could not load {SCRIPT}")
MEMLOG_MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MEMLOG_MODULE)


def run_memlog(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        capture_output=True,
        text=True,
        timeout=20,
        check=False,
    )


class MemlogConcurrencyTests(unittest.TestCase):
    def test_parallel_append_and_set_transactions_preserve_every_update(self) -> None:
        with tempfile.TemporaryDirectory() as raw_workspace:
            workspace = Path(raw_workspace)
            initialized = run_memlog(
                "init", "--workspace", str(workspace), "--field", "topic=parallel"
            )
            self.assertEqual(initialized.returncode, 0, initialized.stderr)

            operations: list[tuple[str, ...]] = []
            for index in range(30):
                operations.append(
                    (
                        "append",
                        "--workspace",
                        str(workspace),
                        "--type",
                        "event",
                        "--text",
                        f"parallel-entry-{index:02d}",
                    )
                )
            for index in range(10):
                operations.append(
                    (
                        "set",
                        "--workspace",
                        str(workspace),
                        "--key",
                        f"parallel_field_{index:02d}",
                        "--value",
                        f"value-{index:02d}",
                    )
                )

            with ThreadPoolExecutor(max_workers=20) as pool:
                results = list(pool.map(lambda args: run_memlog(*args), operations))

            failures = [
                f"stdout={result.stdout!r} stderr={result.stderr!r}"
                for result in results
                if result.returncode != 0
            ]
            self.assertEqual(failures, [])

            path = workspace / ".memlog.md"
            meta, body = MEMLOG_MODULE.split(path.read_text(encoding="utf-8"))
            self.assertEqual(MEMLOG_MODULE.entry_count(body), 30)
            for index in range(30):
                self.assertEqual(body.count(f"parallel-entry-{index:02d}"), 1)
            for index in range(10):
                self.assertEqual(meta[f"parallel_field_{index:02d}"], f"value-{index:02d}")
            self.assertEqual(list(workspace.glob(".*.tmp")), [])

    def test_parallel_init_has_one_winner_and_never_corrupts_the_file(self) -> None:
        with tempfile.TemporaryDirectory() as raw_workspace:
            workspace = Path(raw_workspace)

            def initialize(index: int) -> subprocess.CompletedProcess[str]:
                return run_memlog(
                    "init",
                    "--workspace",
                    str(workspace),
                    "--field",
                    f"topic=initializer-{index:02d}",
                )

            with ThreadPoolExecutor(max_workers=8) as pool:
                results = list(pool.map(initialize, range(8)))

            self.assertEqual(sum(result.returncode == 0 for result in results), 1)
            self.assertTrue(all(result.returncode in (0, 2) for result in results))
            meta, body = MEMLOG_MODULE.split(
                (workspace / ".memlog.md").read_text(encoding="utf-8")
            )
            self.assertRegex(meta["topic"], r"^initializer-\d{2}$")
            self.assertEqual(body, "")
            self.assertEqual(list(workspace.glob(".*.tmp")), [])


if __name__ == "__main__":
    unittest.main()
