#!/usr/bin/env python3
"""Materialize a validated Storage backup into the isolated file backend without DB writes."""

import hashlib
import json
import os
import re
import sys
from pathlib import Path

VERSION_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
BUCKET_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


def fail(message: str) -> None:
    raise ValueError(message)


def safe_bucket(value: object) -> str:
    if not isinstance(value, str) or not BUCKET_RE.fullmatch(value):
        fail("Storage restore plan has an invalid bucket")
    return value


# The pinned recovery Compose runtime fixes both Storage tenant location segments to
# `stub`; these are backend routing segments, never an application tenant UUID.
RECOVERY_RUNTIME_TENANT = "stub"
RECOVERY_RUNTIME_GLOBAL_BUCKET = "stub"


def recovery_runtime_prefix() -> tuple[str, str]:
    return (safe_bucket(RECOVERY_RUNTIME_TENANT), safe_bucket(RECOVERY_RUNTIME_GLOBAL_BUCKET))


def safe_path(value: object) -> list[str]:
    if not isinstance(value, str) or not value:
        fail("Storage restore plan has an invalid object path")
    segments = value.split("/")
    if any(not segment or segment in (".", "..") or "\\" in segment or "\x00" in segment for segment in segments):
        fail("Storage restore plan has an invalid object path")
    return segments


def contained(root: Path, *segments: str) -> Path:
    candidate = (root.joinpath(*segments)).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        fail("Storage restore path escapes its allowed root")
    return candidate


def bytes_value(value: object) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        fail("Storage restore plan has an invalid byte count")
    return value


def metadata_string(value: object, field: str) -> str:
    if not isinstance(value, str) or not value or "\x00" in value:
        fail(f"Storage restore plan has invalid {field} metadata")
    return value


def load_json(path: Path, message: str) -> object:
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, json.JSONDecodeError):
        fail(message)


def manifest_objects(workspace: Path) -> dict[tuple[str, str], int]:
    manifest = load_json(contained(workspace, "storage", "manifest.json"), "Storage restore manifest is missing or invalid")
    if not isinstance(manifest, dict) or not isinstance(manifest.get("exported_at"), str) or not isinstance(manifest.get("objects"), list):
        fail("Storage restore manifest is missing or invalid")
    objects: dict[tuple[str, str], int] = {}
    for entry in manifest["objects"]:
        if not isinstance(entry, dict):
            fail("Storage restore manifest is missing or invalid")
        bucket = safe_bucket(entry.get("bucket"))
        path = "/".join(safe_path(entry.get("path")))
        key = (bucket, path)
        if key in objects:
            fail("Storage restore manifest has duplicate objects")
        objects[key] = bytes_value(entry.get("bytes"))
    return objects


def plan_objects(plan_path: Path, manifest: dict[tuple[str, str], int]) -> list[dict[str, object]]:
    plan = load_json(plan_path, "Storage restore plan is missing or invalid")
    if not isinstance(plan, dict) or not isinstance(plan.get("objects"), list):
        fail("Storage restore plan is missing or invalid")
    planned: list[dict[str, object]] = []
    seen: set[tuple[str, str]] = set()
    for entry in plan["objects"]:
        if not isinstance(entry, dict):
            fail("Storage restore plan is missing or invalid")
        bucket = safe_bucket(entry.get("bucket"))
        path = "/".join(safe_path(entry.get("path")))
        key = (bucket, path)
        if key in seen or key not in manifest or bytes_value(entry.get("bytes")) != manifest[key]:
            fail("Storage restore plan does not exactly match the backup manifest")
        seen.add(key)
        version = entry.get("version")
        if not isinstance(version, str) or not VERSION_RE.fullmatch(version):
            fail("Storage restore plan has an invalid object version")
        planned.append({
            "bucket": bucket,
            "path": path,
            "segments": safe_path(path),
            "bytes": manifest[key],
            "version": version,
            "content_type": metadata_string(entry.get("content_type"), "content type"),
            "cache_control": metadata_string(entry.get("cache_control"), "cache control"),
        })
    if len(seen) != len(manifest):
        fail("Storage restore plan does not exactly match the backup manifest")
    return planned


def copy_exclusive(source: Path, target: Path, expected_bytes: int) -> tuple[int, str]:
    target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    digest = hashlib.sha256()
    copied = 0
    try:
        output_fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        fail("Storage backend target already contains a restore object")
    try:
        with source.open("rb") as incoming, os.fdopen(output_fd, "wb") as outgoing:
            while True:
                chunk = incoming.read(1024 * 1024)
                if not chunk:
                    break
                copied += len(chunk)
                digest.update(chunk)
                outgoing.write(chunk)
            outgoing.flush()
            os.fsync(outgoing.fileno())
    except Exception:
        try:
            target.unlink()
        except OSError:
            pass
        raise
    if copied != expected_bytes:
        try:
            target.unlink()
        except OSError:
            pass
        fail("Storage backup object is missing or has an unexpected byte count")
    return copied, digest.hexdigest()


def restore(workspace: Path, plan_path: Path, backend_root: Path) -> dict[str, int]:
    workspace = workspace.resolve()
    backend_root = backend_root.resolve()
    manifest = manifest_objects(workspace)
    planned = plan_objects(plan_path, manifest)
    runtime_tenant, runtime_global_bucket = recovery_runtime_prefix()
    restored_bytes = 0
    for entry in planned:
        source = contained(workspace, "storage", entry["bucket"], *entry["segments"])
        if not source.is_file() or source.is_symlink():
            fail("Storage backup object is missing or invalid")
        target = contained(backend_root, runtime_tenant, runtime_global_bucket, entry["bucket"], *entry["segments"][:-1], f"{entry['segments'][-1]}-$v-{entry['version']}")
        copied, _checksum = copy_exclusive(source, target, entry["bytes"])
        try:
            os.setxattr(target, "user.supabase.content-type", entry["content_type"].encode("utf-8"))
            os.setxattr(target, "user.supabase.cache-control", entry["cache_control"].encode("utf-8"))
        except OSError:
            try:
                target.unlink()
            except OSError:
                pass
            fail("Storage backend metadata write failed")
        restored_bytes += copied
    return {"objects": len(planned), "bytes": restored_bytes}


def main() -> None:
    if len(sys.argv) != 4:
        raise ValueError("Usage: restore-storage-file-backend.py <backup-workspace> <restore-plan.json> <storage-backend-root>")
    result = restore(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]))
    print(json.dumps(result, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)