#!/usr/bin/env python3
"""
Shared Database Manager
=======================

Bootstraps an automated database path selection workflow for a multi-user LAN deployment.

Features:
1. Smart startup scan (path.ini > config.json > LAN discovery > folder picker).
2. Auto-networking for admins via `net share`.
3. Client discovery via subnet scanning/host hints.
4. UNC path enforcement so every node points to the same central storage.
5. Pure standard-library implementation so it can be bundled with PyInstaller.
"""

from __future__ import annotations

import json
import os
import pathlib
import socket
import subprocess
import sys
import time
import threading
from typing import Dict, Iterable, Optional, Tuple

try:  # GUI helpers are optional
  import tkinter as tk
  from tkinter import filedialog, messagebox, simpledialog
except Exception:  # pragma: no cover - fallback for minimal systems
  tk = None  # type: ignore
  filedialog = None  # type: ignore
  messagebox = None  # type: ignore
  simpledialog = None  # type: ignore
import getpass

try:
  from zeroconf import ServiceBrowser, Zeroconf
except Exception:  # pragma: no cover - zeroconf optional
  Zeroconf = None  # type: ignore
  ServiceBrowser = None  # type: ignore


def get_app_root() -> pathlib.Path:
  if getattr(sys, "frozen", False):
    return pathlib.Path(sys.executable).resolve().parent
  return pathlib.Path(__file__).resolve().parent


APP_ROOT = get_app_root()
CONFIG_FILE = APP_ROOT / "config.json"
PATH_POINTER = APP_ROOT / "path.ini"
DEFAULT_SHARE_NAME = "SharedDatabase"
DEFAULT_FOLDER_PROMPT = "Data Storage"
SCAN_TIMEOUT = 3.5
SUPERADMIN_EMAIL = os.environ.get("SUPERADMIN_EMAIL", "Surendra@kumbhatco.in")
SUPERADMIN_PASSWORD = os.environ.get("SUPERADMIN_PASSWORD", "99665588@Rm1")
DB_FILENAME = os.environ.get("FREIGHT_DB_FILENAME", "freight-data.sqlite")


def log(message: str) -> None:
  timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
  print(f"{timestamp} | {message}")


def load_json(path: pathlib.Path) -> Dict[str, str]:
  if not path.exists():
    return {}
  try:
    return json.loads(path.read_text(encoding="utf-8"))
  except Exception as exc:  # pragma: no cover - corrupted config
    log(f"Warning: failed to parse {path.name}: {exc}")
    return {}


def save_json(path: pathlib.Path, data: Dict[str, str]) -> None:
  path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def ensure_pointer_file(unc_path: str) -> None:
  PATH_POINTER.write_text(unc_path, encoding="utf-8")
  log(f"Wrote pointer file -> {unc_path}")


class ConfigStore:
  def __init__(self) -> None:
    self.path = CONFIG_FILE
    self.data: Dict[str, str] = load_json(self.path)

  def save(self) -> None:
    save_json(self.path, self.data)
    log("Configuration saved.")

  @property
  def storage_path(self) -> Optional[str]:
    return self.data.get("storage_path")

  @storage_path.setter
  def storage_path(self, value: str) -> None:
    self.data["storage_path"] = value
    self.save()

  @property
  def database_file(self) -> Optional[str]:
    return self.data.get("database_file")

  @database_file.setter
  def database_file(self, value: str) -> None:
    self.data["database_file"] = value
    self.save()

  @property
  def host_hint(self) -> Optional[str]:
    return self.data.get("host_hint")

  @host_hint.setter
  def host_hint(self, value: str) -> None:
    self.data["host_hint"] = value
    self.save()

  @property
  def host_ip(self) -> Optional[str]:
    return self.data.get("host_ip")

  @host_ip.setter
  def host_ip(self, value: str) -> None:
    self.data["host_ip"] = value
    self.save()

  @property
  def share_name(self) -> str:
    return self.data.get("share_name", DEFAULT_SHARE_NAME)

  @share_name.setter
  def share_name(self, value: str) -> None:
    self.data["share_name"] = value
    self.save()

  @property
  def is_admin(self) -> bool:
    return bool(self.data.get("is_admin", False))

  @is_admin.setter
  def is_admin(self, value: bool) -> None:
    self.data["is_admin"] = bool(value)
    self.save()

  @property
  def path_locked(self) -> bool:
    return bool(self.data.get("path_locked", False))

  @path_locked.setter
  def path_locked(self, value: bool) -> None:
    self.data["path_locked"] = bool(value)
    self.save()


class FolderPicker:
  def __init__(self) -> None:
    self._root = None
    if tk is not None:
      self._root = tk.Tk()
      self._root.withdraw()
  @property
  def root(self):
    return self._root

  def choose_folder(self) -> Optional[pathlib.Path]:
    if filedialog is None:
      log("Tkinter not available. Falling back to CLI input.")
      path = input(f"Enter full path for {DEFAULT_FOLDER_PROMPT}: ").strip()
      return pathlib.Path(path) if path else None

    selected = filedialog.askdirectory(
      title=f"Select {DEFAULT_FOLDER_PROMPT} folder"
    )
    if not selected:
      return None
    return pathlib.Path(selected)

  def confirm_admin(self) -> bool:
    prompt = "Are you the Admin configuring the master shared folder?"
    if messagebox is not None:
      result = messagebox.askyesno("Admin Setup", prompt)
      return bool(result)
    response = input(f"{prompt} [y/N]: ").strip().lower()
    return response in {"y", "yes"}

  def show_info(self, title: str, message: str) -> None:
    if messagebox is not None:
      messagebox.showinfo(title, message)
    else:
      log(f"{title}: {message}")


class NetworkScanner:
  def __init__(self, share_name: str, timeout: float = SCAN_TIMEOUT) -> None:
    self.share_name = share_name
    self.timeout = timeout

  def discover(self, hints: Iterable[Optional[str]]) -> Optional[str]:
    for hint in hints:
      if hint and self._verify_share(hint):
        return self._normalize_host(hint)

    subnet = self._local_subnet()
    if not subnet:
      log("Unable to determine local subnet. Skipping LAN scan.")
      return None

    log(f"Scanning subnet {subnet}.0/24 for share '{self.share_name}'...")
    for last_octet in range(2, 255):
      host = f"{subnet}.{last_octet}"
      if self._verify_share(host):
        log(f"Detected shared folder on {host}")
        return host
    log("Share not found on LAN.")
    return None

  def _verify_share(self, candidate: str) -> bool:
    unc = self._build_unc(candidate)
    if os.name == "nt":
      command = [
        "cmd",
        "/c",
        f'dir "{unc}" >nul 2>&1',
      ]
    else:
      command = ["smbclient", "-L", candidate, "-N"]

    try:
      result = subprocess.run(
        command,
        timeout=self.timeout,
        capture_output=True,
        check=False,
      )
      success = result.returncode == 0
      log(f"Checked {unc}: {'OK' if success else 'unreachable'}")
      return success
    except Exception as exc:  # pragma: no cover - network failure
      log(f"Share check failed for {candidate}: {exc}")
      return False

  def _local_subnet(self) -> Optional[str]:
    try:
      with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.connect(("8.8.8.8", 80))
        addr = sock.getsockname()[0]
    except Exception:
      try:
        addr = socket.gethostbyname(socket.gethostname())
      except Exception as exc:  # pragma: no cover
        log(f"Local subnet detection failed: {exc}")
        return None

    parts = addr.split(".")
    if len(parts) != 4:
      return None
    return ".".join(parts[:3])

  def _normalize_host(self, host: str) -> str:
    cleaned = host.strip()
    if cleaned.startswith("\\\\"):
      cleaned = cleaned[2:]
    if "\\" in cleaned:
      cleaned = cleaned.split("\\", 1)[0]
    return cleaned

  def _build_unc(self, host_or_unc: str) -> str:
    if host_or_unc.startswith("\\\\"):
      return host_or_unc
    normalized = self._normalize_host(host_or_unc)
    return f"\\\\{normalized}\\{self.share_name}"


class MdnsResolver:
  def __init__(self, service_prefix: str = "FreightSystem") -> None:
    self.service_prefix = service_prefix.lower()

  def discover(self, timeout: float = 3.0) -> Optional[Tuple[str, Dict[str, str]]]:
    if Zeroconf is None or ServiceBrowser is None:
      return None

    result: Dict[str, str] = {}
    event = threading.Event()
    zeroconf = Zeroconf()

    class _Listener:
      def __init__(self, prefix: str) -> None:
        self.info: Optional[Tuple[str, Dict[str, str]]] = None
        self.prefix = prefix

      def remove_service(self, *args, **kwargs):
        return

      def add_service(self, zc, service_type, name):
        if self.info or self.prefix not in name.lower():
          return
        info = zc.get_service_info(service_type, name)
        if not info:
          return
        host = info.server.rstrip(".") if info.server else None
        if not host and info.addresses:
          try:
            host = socket.inet_ntoa(info.addresses[0])
          except Exception:
            host = None
        payload = {}
        for key, value in (info.properties or {}).items():
          try:
            payload[key.decode("utf-8")] = value.decode("utf-8")
          except Exception:
            continue
        if host:
          self.info = (host, payload)
          event.set()

    listener = _Listener(self.service_prefix)
    browser = ServiceBrowser(zeroconf, "_http._tcp.local.", listener)  # type: ignore[arg-type]
    event.wait(timeout)
    browser.cancel()
    zeroconf.close()
    return listener.info


def share_folder_via_netshare(folder: pathlib.Path, share_name: str) -> bool:
  if os.name != "nt":
    log("Auto-sharing is only supported on Windows (net share). Skipping.")
    return False

  command = [
    "net",
    "share",
    f"{share_name}={folder}",
    "/grant:everyone,full",
  ]
  try:
    subprocess.run(command, check=True, capture_output=True)
    log(f"Shared folder via {' '.join(command)}")
    return True
  except Exception as exc:
    log(f"Failed to create Windows share: {exc}")
    return False


class SharedDatabaseManager:
  def __init__(self) -> None:
    self.config = ConfigStore()
    self.picker = FolderPicker()
    self.scanner = NetworkScanner(self.config.share_name)
    self.mdns = MdnsResolver()

  def resolve_path(self) -> pathlib.Path:
    steps = [
      self._path_from_pointer,
      self._path_from_config,
      self._path_from_network,
      self._path_from_user_prompt,
    ]
    for resolver in steps:
      path = resolver()
      if path is not None:
        path_str = str(path)
        ensure_pointer_file(path_str)
        if not self.config.database_file:
          self.config.database_file = path_str
        return pathlib.Path(path_str)
    raise RuntimeError("Database path could not be determined.")

  def _path_from_pointer(self) -> Optional[pathlib.Path]:
    if PATH_POINTER.exists():
      path_text = PATH_POINTER.read_text(encoding="utf-8").strip()
      if path_text:
        path = pathlib.Path(path_text)
        if self._path_is_available(path):
          log("Loaded database file via path.ini.")
          return path
        log(f"Pointer file path unavailable: {path_text}")
    return None

  def _path_from_config(self) -> Optional[pathlib.Path]:
    stored = self.config.database_file or self.config.storage_path
    if stored:
      path = pathlib.Path(stored)
      candidate = self._finalize_database_file(path)
      if self._path_is_available(candidate):
        log("Loaded database path via config.json.")
        return candidate
      log(f"Configured path unavailable: {stored}")
    return None

  def _path_from_network(self) -> Optional[pathlib.Path]:
    mdns_hit = self.mdns.discover()
    host = None
    if mdns_hit:
      host, payload = mdns_hit
      share_name = payload.get("shareName") or self.config.share_name
      self.config.share_name = share_name
      if payload.get("ip"):
        self.config.host_ip = payload["ip"]
      self.config.host_hint = host
      log(f"mDNS discovery succeeded via {host} using share {share_name}")
    if not host:
      host = self.scanner.discover(
        hints=[
          self.config.host_hint,
          self.config.host_ip,
        ]
      )
    if not host:
      return None
    unc = pathlib.Path(f"\\\\{host}\\{self.config.share_name}")
    candidate = self._finalize_database_file(unc)
    if self._path_is_available(candidate):
      log(f"Resolved UNC path via LAN discovery: {candidate}")
      return candidate
    return None

  def _path_from_user_prompt(self) -> Optional[pathlib.Path]:
    self._require_superadmin_authorization()
    selected = self.picker.choose_folder()
    if selected is None:
      return None
    if not selected.exists():
      selected.mkdir(parents=True, exist_ok=True)
    log(f"User selected base path {selected}")
    database_file = self._handle_admin_flow(selected.resolve())
    if database_file:
      self.config.storage_path = str(selected.resolve())
      self.config.database_file = str(database_file)
      self.config.path_locked = True
      return database_file
    return None

  def _handle_admin_flow(self, local_folder: pathlib.Path) -> Optional[pathlib.Path]:
    is_admin = self.picker.confirm_admin()
    self.config.is_admin = is_admin
    target = local_folder
    if is_admin:
      share_name = self.config.share_name
      shared = share_folder_via_netshare(local_folder, share_name)
      if shared:
        host = socket.gethostname()
        host_ip = self._local_ip()
        self.config.host_hint = host
        if host_ip:
          self.config.host_ip = host_ip
        target = pathlib.Path(f"\\\\{host}\\{share_name}")
        log(f"Admin node configured. UNC path: {target}")
      else:
        self.picker.show_info(
          "Share Not Created",
          "Failed to create a Windows share automatically. "
          "The local path will still be used for storage.",
        )
    else:
      log("Configured as client node; storing local folder path.")

    finalized = self._finalize_database_file(target)
    finalized.parent.mkdir(parents=True, exist_ok=True)
    return finalized

  def _path_is_available(self, path: pathlib.Path) -> bool:
    try:
      if path.exists():
        return True
      parent = path.parent
      return parent.exists()
    except OSError:
      return False

  def _local_ip(self) -> Optional[str]:
    try:
      with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except Exception:
      try:
        return socket.gethostbyname(socket.gethostname())
      except Exception:
        return None

  def _finalize_database_file(self, base_path: pathlib.Path) -> pathlib.Path:
    candidate = pathlib.Path(base_path)
    if candidate.suffix:
      return candidate
    return candidate / DB_FILENAME

  def _prompt_value(self, prompt: str, default: str = "", secret: bool = False) -> str:
    initial = default or ""
    root = getattr(self.picker, "_root", None)
    if simpledialog and root:
      value = simpledialog.askstring(
        "Superadmin Setup",
        prompt,
        initialvalue=initial,
        show="*" if secret else None,
        parent=root,
      )
      return (value or "").strip()
    if secret:
      return getpass.getpass(f"{prompt}: ").strip()
    suffix = f" [{default}]" if default else ""
    entered = input(f"{prompt}{suffix}: ").strip()
    return entered or default

  def _require_superadmin_authorization(self) -> None:
    if self.config.path_locked:
      return

    attempts = 3
    expected_email = SUPERADMIN_EMAIL.lower()
    while attempts > 0:
      email = self._prompt_value("Enter Superadmin email", default=SUPERADMIN_EMAIL)
      password = self._prompt_value("Enter Superadmin password", secret=True)
      if email.lower() == expected_email and password == SUPERADMIN_PASSWORD:
        log("Superadmin authorization accepted for storage configuration.")
        self.config.path_locked = True
        return

      attempts -= 1
      message = "Invalid Superadmin credentials. Please try again."
      self.picker.show_info("Access denied", message)

    raise SystemExit("Superadmin authorization failed. Exiting setup.")


def locate_database_path() -> pathlib.Path:
  manager = SharedDatabaseManager()
  return manager.resolve_path()


def main() -> None:
  path = locate_database_path()
  print(json.dumps({"database_path": str(path)}, indent=2))


if __name__ == "__main__":
  main()
