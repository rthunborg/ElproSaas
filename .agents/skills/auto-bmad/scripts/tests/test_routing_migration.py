"""Focused deterministic routing/migration tests.

``cli_delegate`` is imported only to exercise its pure ``resolve()`` builder.
No CLI entry point, subprocess, PID probe, or process signal is used here.
"""
from __future__ import annotations

import hashlib
import importlib.util
import re
import tempfile
import tomllib
import unittest
from pathlib import Path
from unittest import mock


SCRIPTS = Path(__file__).resolve().parents[1]
ASSETS = SCRIPTS.parent / "assets"
REPO = SCRIPTS.parents[3]


def load_module(name: str):
    path = SCRIPTS / f"{name}.py"
    spec = importlib.util.spec_from_file_location(f"auto_bmad_test_{name}", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


preflight = load_module("preflight")
cli_delegate = load_module("cli_delegate")
config_plan = load_module("config_plan")
state_update = load_module("state_update")
state_plan = load_module("state_plan")
story_plan = load_module("story_plan")
VALID_GIT_RUN = lambda _argv: (
    0, "e90ec0e000000000000000000000000000000000\n", "")


class RoutingAndMigrationTests(unittest.TestCase):
    def test_cli_resolve_all_configured_phases_tools_and_errors(self):
        source = (ASSETS / "profiles.yaml").read_text(encoding="utf-8")
        source_lines = source.splitlines(keepends=True)
        phase_profiles = config_plan.parse_phase_profiles(
            source_lines, config_plan.find_block(source_lines, "phase_profiles"))
        parsed_profiles = cli_delegate.parse_profiles(source)
        tools = ("codex", "claude", "opencode")
        routes = {phase: tools[index % len(tools)]
                  for index, phase in enumerate(phase_profiles)}
        config = (
            "delegation:\n  cli_phases:\n"
            + "".join(f"    {phase}: {tool}\n" for phase, tool in routes.items())
            + source
        )
        capture_dir = Path(tempfile.gettempdir()) / "auto-bmad-resolve-contract"
        with mock.patch.object(cli_delegate, "_capture_dir", return_value=capture_dir):
            for phase, tool in routes.items():
                with self.subTest(phase=phase, tool=tool):
                    profile = phase_profiles[phase]
                    block = parsed_profiles[profile][tool]
                    model_key, effort_key = {
                        "claude": ("model", "effort"),
                        "codex": ("model", "reasoning_effort"),
                        "opencode": ("model", "variant"),
                    }[tool]
                    model = block.get(model_key) or None
                    effort = block.get(effort_key) or None
                    plan = cli_delegate.resolve(
                        phase, config, "/work/repo",
                        story_key="4-2-routing", label="matrix",
                    )
                    base = f"4-2-routing-{phase}-matrix"
                    capture_log = str(capture_dir / f"{base}.log")
                    exit_file = str(capture_dir / f"{base}.exit")
                    prompt_file = str(capture_dir / f"{base}.prompt")
                    self.assertEqual((phase, tool, profile, model, effort), (
                        plan["phase"], plan["tool"], plan["profile"],
                        plan["model"], plan["effort"]))
                    self.assertEqual((capture_log, exit_file, prompt_file), (
                        plan["capture_log"], plan["exit_file"], plan["prompt_file"]))
                    if tool == "claude":
                        expected_argv = [
                            "claude", "-p", "--model", model, "--effort", effort,
                            "--output-format", "json", "--dangerously-skip-permissions",
                        ]
                        expected_result = (capture_log, "json", "stdin")
                    elif tool == "codex":
                        last_message = str(capture_dir / f"{base}.lastmsg")
                        expected_argv = [
                            "codex", "exec", "-m", model,
                            "-c", f"model_reasoning_effort={effort}",
                            "--dangerously-bypass-approvals-and-sandbox",
                            "-C", "/work/repo", "-o", last_message, "--ephemeral",
                        ]
                        expected_result = (last_message, "text", "stdin")
                    else:
                        expected_argv = ["opencode", "run"]
                        if model:
                            expected_argv += ["-m", model]
                        if effort:
                            expected_argv += ["--variant", effort]
                        expected_argv += ["--format", "json", "--dir", "/work/repo", "--auto"]
                        expected_result = (capture_log, "opencode-json", "arg")
                    self.assertEqual(expected_argv, plan["argv"])
                    self.assertEqual(expected_result, (
                        plan["result_source"], plan["result_format"], plan["prompt_via"]))
                    self.assertEqual([], plan["errors"])

            unrouted = cli_delegate.resolve("not_configured", config, "/work/repo")
            self.assertEqual({"routed": False, "phase": "not_configured"}, unrouted)

            invalid_cases = (
                ("bad-tool", "build", "delegation:\n  cli_phases:\n    build: gpt5\n" + source,
                 "expected 'claude', 'codex' or 'opencode'"),
                ("missing-phase-map", "unknown", "delegation:\n  cli_phases:\n    unknown: codex\n" + source,
                 "no phase_profiles mapping"),
                ("missing-profile", "build",
                 "delegation:\n  cli_phases:\n    build: codex\nprofiles: {}\nphase_profiles:\n  build: absent\n",
                 "not found in profiles block"),
                ("missing-tool-block", "build",
                 "delegation:\n  cli_phases:\n    build: codex\nprofiles:\n  p:\n    claude:\n      model: opus\n      effort: high\nphase_profiles:\n  build: p\n",
                 "no 'codex' block"),
                ("missing-effort", "build",
                 "delegation:\n  cli_phases:\n    build: claude\nprofiles:\n  p:\n    claude:\n      model: opus\nphase_profiles:\n  build: p\n",
                 "claude.effort' missing"),
            )
            for label, phase, bad_config, message in invalid_cases:
                with self.subTest(invalid=label):
                    plan = cli_delegate.resolve(phase, bad_config, "/work/repo")
                    self.assertTrue(plan["routed"])
                    self.assertFalse(plan["ok"])
                    self.assertTrue(any(message in error for error in plan["errors"]), plan)
                    self.assertNotIn("argv", plan)

    def test_state_schema_docs_are_lockstep(self):
        fields, subkeys = state_update._doc_schema_fields()
        self.assertEqual(state_update.SCHEMA_ORDER, tuple(fields))
        self.assertEqual(state_update.BUILD_KEYS, tuple(subkeys["build"]))
        self.assertEqual(state_update.PHASE8_KEYS, tuple(subkeys["phase8_steps"]))
        self.assertEqual(state_update.RETRO_KEYS, tuple(subkeys["retro"]))

    def test_live_story_10_6_resume_contract_before_or_after_adoption(self):
        path = (REPO / "_bmad-output" / "auto-bmad" / "state" /
                "10-6-tax-answer-reconciliation.yaml")
        state = state_update.full_state(state_update.load_state(path))
        self.assertTrue(set(range(7)).issubset(state["completed_phases"]))
        self.assertEqual(6, state["legacy_review_iteration"])
        self.assertEqual(0, state["build"]["review_loop_iteration"])
        found = story_plan.build_find_spec_result(
            str(REPO / "_bmad-output" / "implementation-artifacts"),
            "10-6-tax-answer-reconciliation",
        )[0]
        self.assertTrue(found["found"])
        if found["artifact_format"] == "legacy-story":
            self.assertTrue(state["legacy_review_resume"])
            self.assertIsNone(state["spec_path"])
            self.assertTrue(state["overrides"]["legacy_adoption_pending"])
            self.assertIsNone(found["status"])
            self.assertEqual(0, state["followup_passes"])
        else:
            self.assertEqual("bmad-build-auto", found["artifact_format"])
            self.assertFalse(state["legacy_review_resume"])
            self.assertEqual(str(Path(found["spec_path"]).resolve()),
                             str(Path(state["spec_path"]).resolve()))
            self.assertEqual("done", state["build"]["status"])
            self.assertNotIn("legacy_adoption_pending", state["overrides"])
            self.assertEqual("v0.24-to-v0.31", state["overrides"]["legacy_adoption"])

    def test_shipped_and_live_profiles_and_codex_roles_follow_policy(self):
        source = (ASSETS / "profiles.yaml").read_text(encoding="utf-8")
        live = (REPO / "_bmad-output" / "auto-bmad" / "config.yaml").read_text(encoding="utf-8")
        snapshots = []
        expected_fields = {
            "claude:model", "claude:effort", "codex:model",
            "codex:reasoning_effort", "opencode:model", "opencode:variant",
        }
        for text in (source, live):
            lines = text.splitlines(keepends=True)
            profiles = config_plan.parse_profiles_blocks(
                lines, config_plan.find_block(lines, "profiles"))
            phases = config_plan.parse_phase_profiles(
                lines, config_plan.find_block(lines, "phase_profiles"))
            values = {}
            for name, info in profiles.items():
                values[name] = config_plan._profile_leaf_values(
                    lines, info["start"], info["end"])
                self.assertEqual(expected_fields, set(values[name]), name)
            snapshots.append((values, phases))
            def pair(name):
                return values[name]["codex:model"], values[name]["codex:reasoning_effort"]
            self.assertEqual(("gpt-5.6-terra", "medium"), pair("default"))
            self.assertEqual(("gpt-5.6-luna", "medium"), pair("light"))
            self.assertEqual(("gpt-5.6-terra", "high"), pair("standard"))
            self.assertEqual(("gpt-5.6-sol", "xhigh"), pair("critical"))
            self.assertEqual(("gpt-5.6-luna", "xhigh"), pair("diverse_review"))
            self.assertEqual("standard", phases["followup_review"])
            self.assertEqual("critical", phases["final_convergence"])
        self.assertEqual(snapshots[0], snapshots[1])
        codex = tomllib.loads((REPO / ".codex" / "config.toml").read_text(encoding="utf-8"))
        self.assertEqual({
            "max_threads": 4,
            "max_depth": 1,
            "default_subagent_model": "gpt-5.6-terra",
            "default_subagent_reasoning_effort": "medium",
        }, codex["agents"])
        roles = {
            path.stem: tomllib.loads(path.read_text(encoding="utf-8"))
            for path in (REPO / ".codex" / "agents").glob("*.toml")
        }
        expected = {
            "docs-writer": ("gpt-5.6-terra", "medium", "workspace-write"),
            "legacy-oracle-explorer": ("gpt-5.6-terra", "medium", "read-only"),
            "money-tax-reviewer": ("gpt-5.6-luna", "xhigh", "read-only"),
            "phase-scope-reviewer": ("gpt-5.6-luna", "xhigh", "read-only"),
            "pr-reviewer": ("gpt-5.6-sol", "xhigh", "read-only"),
            "security-rls-reviewer": ("gpt-5.6-sol", "xhigh", "read-only"),
            "test-gap-reviewer": ("gpt-5.6-luna", "xhigh", "read-only"),
        }
        self.assertEqual(set(expected), set(roles))
        for name, (model, effort, sandbox) in expected.items():
            self.assertEqual(name, roles[name]["name"])
            self.assertEqual(model, roles[name]["model"])
            self.assertEqual(effort, roles[name]["model_reasoning_effort"])
            self.assertEqual(sandbox, roles[name]["sandbox_mode"])
        for name in ("money-tax-reviewer", "phase-scope-reviewer", "test-gap-reviewer"):
            self.assertIn("leaf-only", roles[name]["developer_instructions"])
            self.assertIn("Never spawn", roles[name]["developer_instructions"])
        self.assertIn("final-convergence", roles["pr-reviewer"]["developer_instructions"])
        self.assertIn("critical security", roles["security-rls-reviewer"]["developer_instructions"])

    def test_agents_and_claude_auto_bmad_installs_are_exact_mirrors(self):
        def hashes(root):
            result = {}
            for path in root.rglob("*"):
                if (not path.is_file() or "__pycache__" in path.parts
                        or path.suffix == ".pyc"):
                    continue
                rel = path.relative_to(root).as_posix()
                result[rel] = hashlib.sha256(path.read_bytes()).hexdigest()
            return result

        agents = hashes(REPO / ".agents" / "skills" / "auto-bmad")
        claude = hashes(REPO / ".claude" / "skills" / "auto-bmad")
        self.assertEqual(agents, claude)

    def test_codex_nesting_catalog_probe_depth_matrix(self):
        catalog = (
            '{"models":['
            '{"slug":"gpt-5.6-terra","multi_agent_version":"v2"},'
            '{"slug":"gpt-5.6-sol","multi_agent_version":"v2"},'
            '{"slug":"gpt-5.6-luna","multi_agent_version":"v1"},'
            '{"slug":"custom-v1","multi_agent_version":"v1"}]}'
        )
        catalog_runner = lambda argv: (
            (0, catalog, "") if list(argv) == ["codex", "debug", "models"]
            else (127, "", "unexpected"))
        failed_runner = lambda _argv: (127, "", "not available")
        cases = (
            ("terra-v2-absent", catalog_runner, ["gpt-5.6-terra"], None, "ok", "V2"),
            ("sol-v2-depth1", catalog_runner, ["gpt-5.6-sol"], 1, "ok", "V2"),
            ("mixed-v2-depth1", catalog_runner,
             ["gpt-5.6-terra", "gpt-5.6-sol"], 1, "ok", "V2"),
            ("luna-catalog-absent", catalog_runner, ["gpt-5.6-luna"], None,
             "hard_stop", "leaf-only"),
            ("luna-catalog-depth1", catalog_runner, ["gpt-5.6-luna"], 1,
             "hard_stop", "leaf-only"),
            ("luna-catalog-depth2", catalog_runner, ["gpt-5.6-luna"], 2,
             "hard_stop", "leaf-only"),
            ("mixed-with-luna", catalog_runner,
             ["gpt-5.6-terra", "gpt-5.6-luna"], 2, "hard_stop", "leaf-only"),
            ("v1-depth1", catalog_runner, ["custom-v1"], 1, "hard_stop", "V1/legacy"),
            ("v1-depth2", catalog_runner, ["custom-v1"], 2, "ok", "V1 depth fallback"),
            ("probe-fail-terra-absent", failed_runner, ["gpt-5.6-terra"], None,
             "warn", "could not be verified"),
            ("probe-fail-sol-depth1", failed_runner, ["gpt-5.6-sol"], 1,
             "warn", "could not be verified"),
            ("probe-fail-mixed-depth2", failed_runner,
             ["gpt-5.6-terra", "gpt-5.6-sol"], 2, "ok", "probe failed"),
            ("probe-fail-luna-absent", failed_runner, ["gpt-5.6-luna"], None,
             "hard_stop", "leaf-only"),
            ("probe-fail-luna-depth1", failed_runner, ["gpt-5.6-luna"], 1,
             "hard_stop", "leaf-only"),
            ("probe-fail-luna-depth2", failed_runner, ["gpt-5.6-luna"], 2,
             "hard_stop", "leaf-only"),
            ("no-model-absent", failed_runner, [], None,
             "hard_stop", "no Codex nesting model"),
            ("no-model-depth2", failed_runner, [], 2, "ok", "max_depth = 2"),
        )
        with tempfile.TemporaryDirectory() as td:
            root = Path(td) / "repo"
            home = Path(td) / "home"
            (root / ".codex").mkdir(parents=True)
            home.mkdir()
            project_config = root / ".codex" / "config.toml"
            for label, runner, models, depth, status, detail in cases:
                with self.subTest(case=label):
                    if depth is None:
                        project_config.unlink(missing_ok=True)
                    else:
                        project_config.write_text(
                            f"[agents]\nmax_depth = {depth}\n", encoding="utf-8")
                    verdict = preflight.classify_nesting(
                        "codex", "subagents", root, env={}, home=home,
                        codex_models=models, run=runner)
                    self.assertEqual(status, verdict["status"], verdict)
                    self.assertIn(detail, verdict["detail"])

            project_config.write_text(
                "[agents]\nmax_depth = 1\n[features]\nmulti_agent_v2 = true\n",
                encoding="utf-8")
            stale_flag = preflight.classify_nesting(
                "codex", "subagents", root, env={}, home=home,
                codex_models=["custom-v1"], run=catalog_runner)
            self.assertEqual("hard_stop", stale_flag["status"])
            self.assertIn("V1/legacy", stale_flag["detail"])

    def test_route_persistence_stepwise_escalation_and_resume(self):
        with tempfile.TemporaryDirectory() as td:
            state_file = Path(td) / "route.yaml"
            state_update.cmd_init(state_file, {"story_key": "5-2-route"})
            luna = {
                "phase": "narrow_triage", "role": "triage", "profile": "light",
                "model": "gpt-5.6-luna", "effort": "medium", "host": "codex",
                "tier": "subagents", "route": "subagent", "escalation_reason": "",
            }
            state_update.cmd_route_select(state_file, luna)
            with self.assertRaisesRegex(state_update.ContractError, "non-stepwise"):
                state_update.cmd_route_select(state_file, {
                    **luna, "role": "conflict-resolver", "profile": "critical",
                    "model": "gpt-5.6-sol", "effort": "xhigh",
                    "escalation_reason": "triage conflict",
                })
            terra = {
                **luna, "role": "primary-reviewer", "profile": "standard",
                "model": "gpt-5.6-terra", "effort": "high",
                "escalation_reason": "triage remained unresolved",
            }
            sol = {
                **terra, "role": "conflict-resolver", "profile": "critical",
                "model": "gpt-5.6-sol", "effort": "xhigh",
                "escalation_reason": "Terra found a policy conflict",
            }
            state_update.cmd_route_select(state_file, terra)
            state_update.cmd_route_select(state_file, sol)
            replay = state_update.cmd_route_select(state_file, sol)
            state = state_update.full_state(state_update.load_state(state_file))
            self.assertTrue(replay["resumed"])
            self.assertFalse(replay["ledger_appended"])
            self.assertEqual(3, len(state["routing_ledger"]))
            self.assertEqual("gpt-5.6-sol", state["selected_model"])
            self.assertEqual("Terra found a policy conflict", state["escalation_reason"])
            capsule = state_plan.read_state_file(str(state_file))
            self.assertEqual("gpt-5.6-sol", capsule["selected_model"])
            self.assertEqual("xhigh", capsule["selected_effort"])
            self.assertEqual("Terra found a policy conflict", capsule["escalation_reason"])

    def test_final_convergence_is_critical_and_luna_cannot_own_it(self):
        with tempfile.TemporaryDirectory() as td:
            state_file = Path(td) / "final.yaml"
            state_update.cmd_init(state_file, {"story_key": "5-3-final"})
            base = {
                "phase": "final_convergence", "role": "final-convergence",
                "profile": "critical", "model": "gpt-5.6-sol", "effort": "xhigh",
                "host": "codex", "tier": "subagents", "route": "subagent",
                "escalation_reason": "legacy adoption requires final convergence",
            }
            state_update.cmd_route_select(state_file, base)
            with self.assertRaisesRegex(state_update.ContractError, "governed Codex phase"):
                state_update.cmd_route_select(state_file, {
                    **base, "model": "gpt-5.6-luna", "effort": "medium",
                })

    def test_same_phase_critical_downgrade_is_rejected_without_state_change(self):
        with tempfile.TemporaryDirectory() as td:
            state_file = Path(td) / "critical.yaml"
            state_update.cmd_init(state_file, {"story_key": "5-4-critical"})
            critical = {
                "phase": "final_convergence", "role": "final-convergence",
                "profile": "critical", "model": "gpt-5.6-sol", "effort": "xhigh",
                "host": "codex", "tier": "subagents", "route": "subagent",
                "escalation_reason": "conflicting security evidence",
            }
            state_update.cmd_route_select(state_file, critical)
            before_bytes = state_file.read_bytes()
            before = state_update.full_state(state_update.load_state(state_file))
            with self.assertRaisesRegex(state_update.ContractError, "governed Codex phase"):
                state_update.cmd_route_select(state_file, {
                    **critical, "role": "primary-reviewer", "profile": "standard",
                    "model": "gpt-5.6-terra", "effort": "high",
                    "escalation_reason": "attempted downgrade",
                })
            after = state_update.full_state(state_update.load_state(state_file))
            self.assertEqual(before_bytes, state_file.read_bytes())
            self.assertEqual(before["routing_ledger"], after["routing_ledger"])
            self.assertEqual("gpt-5.6-sol", after["selected_model"])
            self.assertEqual("xhigh", after["selected_effort"])

    def test_same_phase_unranked_codex_route_change_is_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            state_file = Path(td) / "unranked.yaml"
            state_update.cmd_init(state_file, {"story_key": "5-5-unranked"})
            initial = {
                "phase": "repository_scan", "role": "explorer", "profile": "default",
                "model": "gpt-5.6-terra", "effort": "medium", "host": "codex",
                "tier": "subagents", "route": "subagent", "escalation_reason": "",
            }
            state_update.cmd_route_select(state_file, initial)
            before = state_file.read_bytes()
            with self.assertRaisesRegex(state_update.ContractError, "noncanonical Codex route change"):
                state_update.cmd_route_select(state_file, {
                    **initial, "model": "project-custom-model", "effort": "high",
                    "escalation_reason": "scan became difficult",
                })
            self.assertEqual(before, state_file.read_bytes())

    def test_governed_codex_routes_require_exact_role_profile_model_and_effort(self):
        for phase, expected in state_update._GOVERNED_CODEX_ROUTES.items():
            role, profile, model, effort = expected
            payload = {
                "phase": phase, "role": role, "profile": profile,
                "model": model, "effort": effort, "host": "codex",
                "tier": "subagents", "route": "subagent",
                "escalation_reason": "",
            }
            with self.subTest(phase=phase, case="accept"):
                self.assertEqual(
                    expected,
                    tuple(state_update._validate_route_selection(payload)[key]
                          for key in ("role", "profile", "model", "effort")),
                )
            bad_values = {
                "role": role + "-wrong",
                "profile": profile + "-wrong",
                "model": model + "-custom",
                "effort": "medium" if effort != "medium" else "high",
            }
            for field, value in bad_values.items():
                with self.subTest(phase=phase, case=field):
                    with self.assertRaisesRegex(
                            state_update.ContractError, "requires exact role/profile/model/effort"):
                        state_update._validate_route_selection({**payload, field: value})

    def test_cross_model_layer_has_static_posix_and_powershell_commands(self):
        args = ("codex", "C:/work/repo", "gpt-5.6-luna", "xhigh", None)
        posix = cli_delegate.build_layer_command(*args, platform="posix")
        windows = cli_delegate.build_layer_command(*args, platform="nt")
        self.assertIn('</dev/null >/dev/null 2>&1 && cat "<DIFF_FILE>.review"', posix)
        self.assertNotIn("; cat", posix)
        self.assertNotIn("cmd.exe", posix)
        self.assertTrue(windows.startswith(
            'cmd.exe /d /s /c --% cd /d "C:/work/repo" && codex exec '))
        self.assertIn(' -o "<DIFF_FILE>.review" ', windows)
        self.assertIn("< NUL > NUL 2>&1 && type \"<DIFF_FILE>.review\"", windows)
        self.assertNotIn("/dev/null", windows)
        self.assertNotIn("; cat", windows)
        self.assertNotIn("timeout", windows)

    def test_legacy_profile_schema_migration_preserves_valid_overrides(self):
        asset = (ASSETS / "profiles.yaml").read_text(encoding="utf-8")
        old = (
            'version: 1\nprofiles_source_version: "0.24.0"\nowner_note: keep\n'
            'delegation:\n  mode: custom-subagents\n  cli_phases:\n    retrospective: codex\n'
            'profiles:\n'
            '  ab-deep:\n    claude:\n      model: opus\n      effort: xhigh\n'
            '    codex:\n      model: gpt-5.5\n      reasoning_effort: xhigh\n'
            '  standard:\n    claude:\n      model: sonnet\n      effort: high\n'
            '    codex:\n      model: gpt-5.6-terra\n      reasoning_effort: high\n'
            '    opencode:\n      model: ""\n      variant: ""\n'
            '  local-map:\n    claude:\n      model: custom-claude\n      effort: max\n'
            '    codex:\n      model: custom-codex\n      reasoning_effort: xhigh\n'
            '    opencode:\n      model: custom/provider\n      variant: thorough\n'
            'phase_profiles:\n  dev_story: ab-deep\n  build: standard\n'
            '  followup_review: local-map\n  project_scan: local-map\n'
        )
        result = config_plan.apply(old, asset, "0.24.0", "0.31.0")
        migrated = result["new_text"]
        self.assertIsNotNone(result["legacy_profile_migration"])
        self.assertIn("owner_note: keep", migrated)
        self.assertIn('profiles_source_version: "0.31.0"', migrated)
        self.assertIn("  mode: custom-subagents", migrated)
        self.assertIn("    retrospective: codex", migrated)
        self.assertNotIn("  ab-deep:", migrated)
        for legacy_name in config_plan.LEGACY_PROFILE_NAMES:
            self.assertNotIn(f"  {legacy_name}:", migrated)
        self.assertNotIn("  dev_story:", migrated)
        self.assertIn("  local-map:", migrated)
        self.assertIn("  project_scan: local-map", migrated)
        self.assertIn("  followup_review: local-map", migrated)
        migrated_lines = migrated.splitlines(keepends=True)
        migrated_profiles = config_plan.parse_profiles_blocks(
            migrated_lines, config_plan.find_block(migrated_lines, "profiles"))
        local = migrated_profiles["local-map"]
        self.assertEqual({
            "claude:model": "custom-claude", "claude:effort": "max",
            "codex:model": "custom-codex", "codex:reasoning_effort": "xhigh",
            "opencode:model": "custom/provider", "opencode:variant": "thorough",
        }, config_plan._profile_leaf_values(
            migrated_lines, local["start"], local["end"]))
        migration = result["legacy_profile_migration"]
        self.assertEqual("v0.24-rendered-agents", migration["from"])
        self.assertEqual(["ab-deep"], migration["removed_profiles"])
        self.assertEqual(["dev_story"], migration["removed_phase_profiles"])
        self.assertEqual(["local-map"], migration["preserved_custom_profiles"])
        self.assertEqual(["followup_review"], migration["preserved_phase_overrides"])
        self.assertEqual(["project_scan"], migration["preserved_custom_phase_profiles"])
        self.assertEqual("sonnet", config_plan._profile_leaf_values(
            migrated.splitlines(keepends=True),
            config_plan.parse_profiles_blocks(
                migrated.splitlines(keepends=True),
                config_plan.find_block(migrated.splitlines(keepends=True), "profiles"),
            )["standard"]["start"],
            config_plan.parse_profiles_blocks(
                migrated.splitlines(keepends=True),
                config_plan.find_block(migrated.splitlines(keepends=True), "profiles"),
            )["standard"]["end"],
        )["claude:model"])
        again = config_plan.apply(migrated, asset, "0.31.0", "0.31.0")
        self.assertIsNone(again["legacy_profile_migration"])
        self.assertEqual(migrated, again["new_text"])

    def test_realistic_legacy_retunes_translate_without_old_defaults(self):
        asset = (ASSETS / "profiles.yaml").read_text(encoding="utf-8")
        old = (
            'version: 1\nprofiles_source_version: "0.24.0"\nprofiles:\n'
            '  ab-deep:\n    claude:\n      model: opus\n      effort: xhigh\n'
            '    codex:\n      model: project-deep\n      reasoning_effort: high\n'
            '    opencode:\n      model: ""\n      variant: ""\n'
            '  ab-standard:\n    claude:\n      model: project-standard\n      effort: xhigh\n'
            '    codex:\n      model: gpt-5.5\n      reasoning_effort: high\n'
            '    opencode:\n      model: standard/provider\n      variant: thorough\n'
            '  ab-security:\n    claude:\n      model: security-claude\n      effort: max\n'
            '    codex:\n      model: gpt-5.5\n      reasoning_effort: xhigh\n'
            '    opencode:\n      model: secure/provider\n      variant: strict\n'
            '  ab-alt-deep:\n    claude:\n      model: alternate-claude\n      effort: max\n'
            '    codex:\n      model: alternate-codex\n      reasoning_effort: high\n'
            '    opencode:\n      model: alternate/provider\n      variant: deep\n'
            '  ab-alt-standard:\n    claude:\n      model: light-claude\n      effort: medium\n'
            '    codex:\n      model: light-codex\n      reasoning_effort: medium\n'
            '    opencode:\n      model: light/provider\n      variant: quick\n'
            'phase_profiles:\n  dev_story: ab-deep\n  code_review_fix: ab-standard\n'
            '  code_review_security: ab-security\n'
        )
        result = config_plan.apply(old, asset, "0.24.0", "0.31.0")
        migrated = result["new_text"]
        lines = migrated.splitlines(keepends=True)
        profiles = config_plan.parse_profiles_blocks(
            lines, config_plan.find_block(lines, "profiles"))
        def values(name):
            info = profiles[name]
            return config_plan._profile_leaf_values(lines, info["start"], info["end"])
        expected = {
            "standard": {
                "claude:model": "project-standard", "claude:effort": "xhigh",
                "codex:model": "project-deep", "codex:reasoning_effort": "high",
                "opencode:model": "standard/provider", "opencode:variant": "thorough",
            },
            "critical": {
                "claude:model": "security-claude", "claude:effort": "max",
                "codex:model": "gpt-5.6-sol", "codex:reasoning_effort": "xhigh",
                "opencode:model": "secure/provider", "opencode:variant": "strict",
            },
            "diverse_review": {
                "claude:model": "alternate-claude", "claude:effort": "max",
                "codex:model": "alternate-codex", "codex:reasoning_effort": "high",
                "opencode:model": "alternate/provider", "opencode:variant": "deep",
            },
            "light": {
                "claude:model": "light-claude", "claude:effort": "medium",
                "codex:model": "light-codex", "codex:reasoning_effort": "medium",
                "opencode:model": "light/provider", "opencode:variant": "quick",
            },
            "default": {
                "claude:model": "light-claude", "claude:effort": "medium",
                "codex:model": "light-codex", "codex:reasoning_effort": "medium",
                "opencode:model": "light/provider", "opencode:variant": "quick",
            },
        }
        for name, fields in expected.items():
            self.assertEqual(fields, values(name), name)
        mapped = result["legacy_profile_migration"]["mapped_legacy_retunes"]
        self.assertEqual({
            ("ab-deep", "standard"), ("ab-standard", "standard"),
            ("ab-security", "critical"), ("ab-alt-deep", "diverse_review"),
            ("ab-alt-standard", "light"), ("ab-alt-standard", "default"),
        }, {(item["source"], item["target"]) for item in mapped})
        self.assertEqual([], result["legacy_profile_migration"]["legacy_retune_conflicts"])
        again = config_plan.apply(migrated, asset, "0.31.0", "0.31.0")
        self.assertEqual(migrated, again["new_text"])

    def test_legacy_state_and_story_adoption_are_idempotent(self):
        with tempfile.TemporaryDirectory() as td:
            impl = Path(td) / "impl"
            impl.mkdir()
            key = "10-6-tax-answer-reconciliation"
            body = "# Story 10.6\r\n\r\nStatus: review\r\n"
            source = impl / f"{key}.md"
            source.write_text(body, encoding="utf-8", newline="")
            state_file = Path(td) / "state.yaml"
            state_file.write_text(
                f"story_key: {key}\nstatus: in-progress\n"
                "completed_phases: [0, 1, 2, 3, 4, 5, 6]\n"
                "code_review_iterations: 6\ncode_review_loop_done: false\n"
                "external_review_iterations: 0\nconvergence_unverified: false\n"
                "overrides:\n  legacy_adoption_pending: true\n  owner_note: keep\n",
                encoding="utf-8",
            )
            migrated_state = state_update.full_state(state_update.load_state(state_file))
            self.assertTrue(migrated_state["legacy_review_resume"])
            self.assertEqual(6, migrated_state["legacy_review_iteration"])
            self.assertEqual(0, migrated_state["followup_passes"])
            dry, code = story_plan.build_legacy_adoption_result(
                str(impl), key, str(state_file), "e90ec0e", "2026-08-31", write=False,
                git_run=VALID_GIT_RUN)
            self.assertEqual(0, code, dry)
            self.assertTrue(source.exists())
            done, code = story_plan.build_legacy_adoption_result(
                str(impl), key, str(state_file), "e90ec0e", "2026-08-31", write=True,
                git_run=VALID_GIT_RUN)
            self.assertEqual(0, code, done)
            self.assertTrue(done["verified"])
            archive = Path(done["archive"])
            target = Path(done["target"])
            with archive.open("r", encoding="utf-8", newline="") as fh:
                self.assertEqual(body, fh.read())
            with target.open("r", encoding="utf-8", newline="") as fh:
                adopted = fh.read()
            self.assertTrue(adopted.endswith(body))
            self.assertIn('baseline_revision: "e90ec0e"', adopted)
            self.assertIn("followup_review_recommended: true", adopted)
            before_rerun = {
                "archive": archive.read_bytes(), "target": target.read_bytes(),
                "state": state_file.read_bytes(),
            }
            rerun, code = story_plan.build_legacy_adoption_result(
                str(impl), key, str(state_file), "e90ec0e", "2026-08-31", write=True,
                git_run=VALID_GIT_RUN)
            self.assertEqual(0, code)
            self.assertTrue(rerun["already_adopted"])
            self.assertEqual(before_rerun["archive"], archive.read_bytes())
            self.assertEqual(before_rerun["target"], target.read_bytes())
            self.assertEqual(before_rerun["state"], state_file.read_bytes())
            state = state_update.full_state(state_update.load_state(state_file))
            self.assertEqual(6, state["code_review_iterations"])
            self.assertEqual(0, state["followup_passes"])
            self.assertEqual(0, state["build"]["review_loop_iteration"])
            self.assertEqual(7, state["overrides"]["start_phase"])
            self.assertNotIn("legacy_adoption_pending", state["overrides"])
            self.assertEqual("keep", state["overrides"]["owner_note"])

    def test_recognized_no_vcs_frontmatter_adoption_is_lossless_and_idempotent(self):
        key = "10-6-tax-answer-reconciliation"
        state_text = (
            f"story_key: {key}\nstatus: in-progress\n"
            "completed_phases: [0, 1, 2, 3, 4, 5, 6]\n"
            "code_review_iterations: 6\n"
            "overrides:\n  legacy_adoption_pending: true\n"
        )
        for eol in ("\n", "\r\n"):
            with self.subTest(eol=repr(eol)), tempfile.TemporaryDirectory() as td:
                impl = Path(td) / "impl"
                impl.mkdir()
                source = impl / f"{key}.md"
                legacy_body = f"# Story 10.6{eol}{eol}Status: review{eol}"
                source_bytes = (
                    f"---{eol}baseline_commit: NO_VCS{eol}---{eol}" + legacy_body
                ).encode("utf-8")
                source.write_bytes(source_bytes)
                state_file = Path(td) / "state.yaml"
                state_file.write_text(state_text, encoding="utf-8")

                done, code = story_plan.build_legacy_adoption_result(
                    str(impl), key, str(state_file), "e90ec0e", "2026-08-31", write=True,
                    git_run=VALID_GIT_RUN)
                self.assertEqual(0, code, done)
                self.assertTrue(done["verified"])
                archive = Path(done["archive"])
                target = Path(done["target"])
                self.assertEqual(source_bytes, archive.read_bytes())
                adopted = target.read_bytes().decode("utf-8")
                self.assertTrue(adopted.endswith(legacy_body))
                self.assertNotIn("baseline_commit: NO_VCS", adopted)
                self.assertEqual(2, len(re.findall(r"(?m)^---\r?$", adopted)))
                self.assertEqual("bmad-build-auto", story_plan.read_spec(str(target))["artifact_format"])

                before_rerun = {
                    "archive": archive.read_bytes(), "target": target.read_bytes(),
                    "state": state_file.read_bytes(),
                }
                rerun, code = story_plan.build_legacy_adoption_result(
                    str(impl), key, str(state_file), "e90ec0e", "2026-08-31", write=True,
                    git_run=VALID_GIT_RUN)
                self.assertEqual(0, code, rerun)
                self.assertTrue(rerun["already_adopted"])
                self.assertEqual(before_rerun["archive"], archive.read_bytes())
                self.assertEqual(before_rerun["target"], target.read_bytes())
                self.assertEqual(before_rerun["state"], state_file.read_bytes())

    def test_legacy_adoption_rejects_malformed_frontmatter_without_writes(self):
        with tempfile.TemporaryDirectory() as td:
            impl = Path(td) / "impl"
            impl.mkdir()
            key = "10-6-tax-answer-reconciliation"
            source = impl / f"{key}.md"
            source.write_bytes(b"---\nbaseline_commit: NO_VCS\n# unclosed legacy header\n")
            state_file = Path(td) / "state.yaml"
            state_file.write_text(
                f"story_key: {key}\nstatus: in-progress\n"
                "completed_phases: [0, 1, 2, 3, 4, 5, 6]\n"
                "code_review_iterations: 6\n",
                encoding="utf-8",
            )
            source_before = source.read_bytes()
            state_before = state_file.read_bytes()

            refused, code = story_plan.build_legacy_adoption_result(
                str(impl), key, str(state_file), "e90ec0e", "2026-08-31", write=True,
                git_run=VALID_GIT_RUN)

            self.assertEqual(1, code)
            self.assertIn("malformed/unclosed frontmatter", refused["error"])
            self.assertEqual(source_before, source.read_bytes())
            self.assertEqual(state_before, state_file.read_bytes())
            self.assertFalse((impl / f"legacy-v024-{key}.md").exists())
            self.assertFalse((impl / f"spec-{key}.md").exists())

    def test_legacy_adoption_is_refusal_and_ambiguity_safe(self):
        with tempfile.TemporaryDirectory() as td:
            impl = Path(td) / "impl"
            impl.mkdir()
            key = "10-6-tax-answer-reconciliation"
            source = impl / f"{key}.md"
            source.write_text("# Legacy body\n", encoding="utf-8")
            target = impl / f"spec-{key}.md"
            target.write_text("---\nstatus: done\n---\n\ndifferent\n", encoding="utf-8")
            state_file = Path(td) / "state.yaml"
            state_file.write_text(
                f"story_key: {key}\nstatus: in-progress\n"
                "completed_phases: [0, 1, 2, 3, 4, 5, 6]\n"
                "code_review_iterations: 6\n",
                encoding="utf-8",
            )
            found, find_code = story_plan.build_find_spec_result(str(impl), key)
            self.assertEqual(1, find_code)
            self.assertTrue(found["ambiguous"])
            self.assertTrue(found["hard_stop"])
            before = {
                "source": source.read_bytes(), "target": target.read_bytes(),
                "state": state_file.read_bytes(),
            }
            failed_git = mock.Mock(return_value=(1, "", "unknown revision"))
            invalid, code = story_plan.build_legacy_adoption_result(
                str(impl), key, str(state_file), "e90ec0e", "2026-08-31", write=True,
                git_run=failed_git)
            self.assertEqual(1, code)
            self.assertIn("does not resolve to a commit", invalid["error"])
            self.assertEqual(before["source"], source.read_bytes())
            self.assertEqual(before["target"], target.read_bytes())
            self.assertEqual(before["state"], state_file.read_bytes())
            probe_argv = failed_git.call_args.args[0]
            self.assertEqual(["git", "-C", str(impl.resolve()), "rev-parse", "--verify",
                              "e90ec0e^{commit}"], probe_argv)
            refused, code = story_plan.build_legacy_adoption_result(
                str(impl), key, str(state_file), "e90ec0e", "2026-08-31", write=True,
                git_run=VALID_GIT_RUN)
            self.assertEqual(1, code)
            self.assertIn("different content", refused["error"])
            self.assertEqual(before["source"], source.read_bytes())
            self.assertEqual(before["target"], target.read_bytes())
            self.assertEqual(before["state"], state_file.read_bytes())
            self.assertFalse((impl / f"legacy-v024-{key}.md").exists())

        with tempfile.TemporaryDirectory() as td:
            impl = Path(td) / "impl"
            impl.mkdir()
            key = "10-6-tax-answer-reconciliation"
            source = impl / f"{key}.md"
            source.write_text("---\nstatus: review\n---\n\nlegacy\n", encoding="utf-8")
            state_file = Path(td) / "state.yaml"
            state_file.write_text(
                f"story_key: {key}\nstatus: in-progress\n"
                "completed_phases: [0, 1, 2, 3, 4, 5, 6]\n"
                "code_review_iterations: 6\n",
                encoding="utf-8",
            )
            source_before = source.read_bytes()
            state_before = state_file.read_bytes()
            refused, code = story_plan.build_legacy_adoption_result(
                str(impl), key, str(state_file), "e90ec0e", "2026-08-31", write=True,
                git_run=VALID_GIT_RUN)
            self.assertEqual(1, code)
            self.assertIn("refusing lossy/double adoption", refused["error"])
            self.assertEqual(source_before, source.read_bytes())
            self.assertEqual(state_before, state_file.read_bytes())
            self.assertFalse((impl / f"spec-{key}.md").exists())


if __name__ == "__main__":
    unittest.main()
