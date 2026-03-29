# Watch in VLC - Chrome Extension v3

Right-click any video on a webpage and open it in VLC, or add it to VLC's playlist.

## Features
- Smart URL extraction for Vimeo, Twitter/X, Reddit, and generic sites
- "Watch in VLC" — launches VLC with the video
- "Add to VLC playlist" — queues video into an already-running VLC without interrupting playback

## Setup (one-time)

### Prerequisites
- VLC installed
- Python 3 installed (check "Add Python to PATH" during install)

### Step 1 — Load the extension
1. Go to chrome://extensions
2. Enable Developer Mode (top-right toggle)
3. Click Load unpacked → select this folder
4. Copy your extension ID (32-letter string under the name)

### Step 2 — Run setup.bat
Double-click setup.bat and paste your extension ID when prompted.
Then reload the extension in chrome://extensions (click the ↺ refresh icon).

### Step 3 — Enable VLC HTTP interface (for "Add to playlist")
This is only needed if you want the "Add to VLC playlist" feature.

In VLC:  Tools → Preferences → Show settings: All → Interface → Main interfaces
  → Check "Web" → expand "Main interfaces" → click "Lua" → set Password to: vlc
  → Restart VLC

The HTTP interface runs on localhost:8080 and is only accessible from your own PC.

## Usage
Right-click any video element or video link:
  ▶  Watch in VLC          — opens VLC with the video
  ➕ Add to VLC playlist   — queues it in a running VLC (launches fresh if VLC is closed)

## Troubleshooting
- "Native host not set up" → re-run setup.bat, reload extension
- "Add to playlist" launches VLC instead of queuing → enable VLC HTTP interface (Step 3)
- YouTube not playing → update VLC to latest version
- Netflix/DRM content → cannot be opened in VLC
