"""Focused mock-only tests for Windows PID liveness in cli_delegate.py."""

import importlib.util
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock


_SCRIPT = Path(__file__).resolve().parents[1] / "cli_delegate.py"
_SPEC = importlib.util.spec_from_file_location("cli_delegate_windows_pid_under_test", _SCRIPT)
assert _SPEC is not None and _SPEC.loader is not None
cli_delegate = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(cli_delegate)


class WindowsPidAliveTests(unittest.TestCase):
    def _kernel32(self, *, handle, exit_code=None, exit_query_succeeds=True, wait_state=None):
        def set_exit_code(_process_handle, out_code):
            if exit_query_succeeds:
                out_code._obj.value = exit_code
                return 1
            return 0

        return SimpleNamespace(
            OpenProcess=mock.Mock(return_value=handle),
            GetExitCodeProcess=mock.Mock(side_effect=set_exit_code),
            WaitForSingleObject=mock.Mock(return_value=wait_state),
            CloseHandle=mock.Mock(return_value=1),
        )

    def test_running_process_is_alive_and_handle_is_closed(self):
        kernel32 = self._kernel32(
            handle=101, exit_code=cli_delegate._STILL_ACTIVE, wait_state=cli_delegate._WAIT_TIMEOUT
        )

        self.assertTrue(cli_delegate._windows_pid_alive(4242, _kernel32=kernel32, _get_last_error=mock.Mock()))
        kernel32.OpenProcess.assert_called_once_with(
            cli_delegate._PROCESS_QUERY_LIMITED_INFORMATION | cli_delegate._SYNCHRONIZE, False, 4242
        )
        kernel32.GetExitCodeProcess.assert_called_once()
        kernel32.WaitForSingleObject.assert_called_once_with(101, 0)
        kernel32.CloseHandle.assert_called_once_with(101)

    def test_exited_process_is_not_alive_and_handle_is_closed(self):
        kernel32 = self._kernel32(handle=102, exit_code=7)

        self.assertFalse(cli_delegate._windows_pid_alive(4242, _kernel32=kernel32, _get_last_error=mock.Mock()))
        kernel32.WaitForSingleObject.assert_not_called()
        kernel32.CloseHandle.assert_called_once_with(102)

    def test_exit_code_259_is_exited_when_the_waitable_handle_is_signalled(self):
        kernel32 = self._kernel32(
            handle=103, exit_code=cli_delegate._STILL_ACTIVE, wait_state=cli_delegate._WAIT_OBJECT_0
        )

        self.assertFalse(cli_delegate._windows_pid_alive(4242, _kernel32=kernel32, _get_last_error=mock.Mock()))
        kernel32.WaitForSingleObject.assert_called_once_with(103, 0)
        kernel32.CloseHandle.assert_called_once_with(103)

    def test_exit_code_query_failure_uses_wait_state_and_closes_handle(self):
        kernel32 = self._kernel32(
            handle=104, exit_query_succeeds=False, wait_state=cli_delegate._WAIT_OBJECT_0
        )

        self.assertFalse(cli_delegate._windows_pid_alive(4242, _kernel32=kernel32, _get_last_error=mock.Mock()))
        kernel32.WaitForSingleObject.assert_called_once_with(104, 0)
        kernel32.CloseHandle.assert_called_once_with(104)

    def test_wait_query_failure_is_conservatively_alive_and_closes_handle(self):
        kernel32 = self._kernel32(
            handle=105, exit_code=cli_delegate._STILL_ACTIVE, wait_state=0xFFFFFFFF
        )

        self.assertTrue(cli_delegate._windows_pid_alive(4242, _kernel32=kernel32, _get_last_error=mock.Mock()))
        kernel32.CloseHandle.assert_called_once_with(105)

    def test_nonexistent_process_is_not_alive_without_querying_or_closing(self):
        kernel32 = self._kernel32(handle=0)

        self.assertFalse(
            cli_delegate._windows_pid_alive(
                4242, _kernel32=kernel32, _get_last_error=mock.Mock(return_value=87)
            )
        )
        kernel32.GetExitCodeProcess.assert_not_called()
        kernel32.WaitForSingleObject.assert_not_called()
        kernel32.CloseHandle.assert_not_called()

    def test_access_denied_process_is_treated_as_alive_without_querying_or_closing(self):
        kernel32 = self._kernel32(handle=0)

        self.assertTrue(
            cli_delegate._windows_pid_alive(
                4242,
                _kernel32=kernel32,
                _get_last_error=mock.Mock(return_value=cli_delegate._ERROR_ACCESS_DENIED),
            )
        )
        kernel32.GetExitCodeProcess.assert_not_called()
        kernel32.WaitForSingleObject.assert_not_called()
        kernel32.CloseHandle.assert_not_called()

    def test_invalid_pid_skips_all_windows_apis(self):
        kernel32 = self._kernel32(handle=106)

        self.assertFalse(cli_delegate._windows_pid_alive(0, _kernel32=kernel32, _get_last_error=mock.Mock()))
        kernel32.OpenProcess.assert_not_called()
        kernel32.GetExitCodeProcess.assert_not_called()
        kernel32.WaitForSingleObject.assert_not_called()
        kernel32.CloseHandle.assert_not_called()

    def test_windows_dispatch_never_uses_posix_signal_zero(self):
        with (
            mock.patch.object(cli_delegate.os, "name", "nt"),
            mock.patch.object(cli_delegate, "_windows_pid_alive", return_value=True) as windows_probe,
            mock.patch.object(cli_delegate.os, "kill") as posix_probe,
        ):
            self.assertTrue(cli_delegate._pid_alive(4242))

        windows_probe.assert_called_once_with(4242)
        posix_probe.assert_not_called()

    def test_posix_signal_zero_outcomes_are_unchanged(self):
        with mock.patch.object(cli_delegate.os, "name", "posix"):
            with mock.patch.object(cli_delegate.os, "kill") as probe:
                self.assertTrue(cli_delegate._pid_alive(4242))
                probe.assert_called_once_with(4242, 0)
            with mock.patch.object(cli_delegate.os, "kill", side_effect=ProcessLookupError):
                self.assertFalse(cli_delegate._pid_alive(4242))
            with mock.patch.object(cli_delegate.os, "kill", side_effect=PermissionError):
                self.assertTrue(cli_delegate._pid_alive(4242))
            with mock.patch.object(cli_delegate.os, "kill", side_effect=OSError):
                self.assertFalse(cli_delegate._pid_alive(4242))


if __name__ == "__main__":
    unittest.main()
