#!/usr/bin/env python3
"""
Watch in VLC - Native Messaging Host v2
Receives messages from the Chrome extension and either:
  - Launches VLC fresh with the URL, or
  - Enqueues the URL into an already-running VLC via its HTTP interface
"""

import sys
import json
import struct
import subprocess
import os
import urllib.request
import urllib.parse
import urllib.error

# ── Configuration ─────────────────────────────────────────────────────────────

VLC_PATHS = [
    r"C:\Program Files\VideoLAN\VLC\vlc.exe",
    r"C:\Program Files (x86)\VideoLAN\VLC\vlc.exe",
    os.path.expanduser(r"~\AppData\Local\Programs\VideoLAN\VLC\vlc.exe"),
]

# VLC's built-in HTTP interface (must be enabled in VLC — see below)
VLC_HTTP_HOST = "http://localhost:8080"
VLC_HTTP_PASSWORD = "vlc"   # default; user can change in VLC prefs

# ── Native messaging I/O ──────────────────────────────────────────────────────

def read_message():
    raw = sys.stdin.buffer.read(4)
    if not raw or len(raw) < 4:
        return None
    length = struct.unpack("=I", raw)[0]
    data = sys.stdin.buffer.read(length)
    return json.loads(data.decode("utf-8"))

def send_message(msg):
    data = json.dumps(msg).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("=I", len(data)))
    sys.stdout.buffer.write(data)
    sys.stdout.buffer.flush()

# ── VLC helpers ───────────────────────────────────────────────────────────────

def find_vlc():
    for path in VLC_PATHS:
        if os.path.exists(path):
            return path
    return None

def vlc_http(path, password=VLC_HTTP_PASSWORD):
    """Make a request to VLC's HTTP interface. Returns response text or None."""
    url = VLC_HTTP_HOST + path
    # VLC HTTP uses basic auth with empty username and the password
    auth = urllib.parse.quote(f":{password}")
    req = urllib.request.Request(url)
    import base64
    credentials = base64.b64encode(f":{password}".encode()).decode()
    req.add_header("Authorization", f"Basic {credentials}")
    try:
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            return resp.read().decode("utf-8")
    except Exception:
        return None

def vlc_is_running():
    """Check if VLC's HTTP interface is reachable."""
    return vlc_http("/requests/status.json") is not None

def vlc_enqueue(url):
    """Add URL to VLC playlist via HTTP API. Returns True on success."""
    encoded = urllib.parse.quote(url, safe="")
    result = vlc_http(f"/requests/status.json?command=in_enqueue&input={encoded}")
    return result is not None

def vlc_launch(vlc_path, url):
    """Launch VLC fresh with the URL."""
    subprocess.Popen([vlc_path, url])

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    message = read_message()
    if not message:
        send_message({"success": False, "error": "No message received"})
        return

    url = message.get("url", "").strip()
    enqueue = message.get("enqueue", False)

    if not url:
        send_message({"success": False, "error": "No URL provided"})
        return

    vlc_path = find_vlc()
    if not vlc_path:
        send_message({"success": False, "error": "VLC not found. Install VLC or edit vlc_host.py with the correct path."})
        return

    if enqueue and vlc_is_running():
        # VLC is already open — add to its playlist
        ok = vlc_enqueue(url)
        if ok:
            send_message({"success": True, "queued": True})
        else:
            # HTTP enqueue failed — fall back to launching fresh
            try:
                vlc_launch(vlc_path, url)
                send_message({"success": True, "queued": False})
            except Exception as e:
                send_message({"success": False, "error": str(e)})
    else:
        # Launch fresh (or enqueue requested but VLC isn't running yet)
        try:
            vlc_launch(vlc_path, url)
            send_message({"success": True, "queued": False})
        except Exception as e:
            send_message({"success": False, "error": str(e)})

if __name__ == "__main__":
    main()
