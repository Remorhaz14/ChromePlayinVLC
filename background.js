// ── Context menu setup ────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "watch-in-vlc",        title: "▶  Watch in VLC",               contexts: ["video"] });
    chrome.contextMenus.create({ id: "enqueue-in-vlc",      title: "➕ Add to VLC playlist",         contexts: ["video"] });
    chrome.contextMenus.create({ id: "watch-link-in-vlc",   title: "▶  Open link in VLC",            contexts: ["link"]  });
    chrome.contextMenus.create({ id: "enqueue-link-in-vlc", title: "➕ Add link to VLC playlist",     contexts: ["link"]  });
  });
});

// ── Context menu click handler ────────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const enqueue = info.menuItemId.startsWith("enqueue");
  const isLink  = info.menuItemId.includes("link");

  if (isLink) {
    if (info.linkUrl) dispatch(info.linkUrl, tab.id, enqueue);
    return;
  }

  // For video elements: info.srcUrl is set by Chrome for <video src="...">
  // but is often missing for sites that set src via JS. We try it first,
  // then fall back to injecting the content script to extract the URL.
  const quickUrl = info.srcUrl && !info.srcUrl.startsWith("blob:") ? info.srcUrl : null;

  if (quickUrl) {
    dispatch(quickUrl, tab.id, enqueue);
  } else {
    getVideoUrlFromTab(tab, (videoUrl) => {
      if (videoUrl) {
        dispatch(videoUrl, tab.id, enqueue);
      } else {
        showOverlay(tab.id, null, null, "Could not find a playable video URL on this page.");
      }
    });
  }
});

// ── Get video URL from tab (with auto-inject fallback) ────────────────────────

function getVideoUrlFromTab(tab, callback) {
  // First try messaging the already-running content script
  chrome.tabs.sendMessage(tab.id, { action: "getVideoUrl" }, (response) => {
    if (chrome.runtime.lastError || !response || !response.url) {
      // Content script not present (tab was open before extension loaded)
      // — inject it now, then ask again
      chrome.scripting.executeScript(
        { target: { tabId: tab.id }, files: ["content.js"] },
        () => {
          if (chrome.runtime.lastError) {
            callback(null);
            return;
          }
          // Small delay to let the script initialise
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, { action: "getVideoUrl" }, (response2) => {
              if (chrome.runtime.lastError) { callback(null); return; }
              callback(response2 && response2.url ? response2.url : null);
            });
          }, 100);
        }
      );
    } else {
      callback(response.url);
    }
  });
}

// ── Dispatch to native host ───────────────────────────────────────────────────

function dispatch(url, tabId, enqueue) {
  chrome.runtime.sendNativeMessage(
    "com.vlc.opener",
    { url, enqueue: !!enqueue },
    (response) => {
      if (chrome.runtime.lastError) {
        showOverlay(tabId, url, null, chrome.runtime.lastError.message);
        return;
      }
      if (response && response.success) {
        const msg = enqueue
          ? (response.queued ? "Added to VLC playlist!" : "VLC launched with video!")
          : "VLC launched!";
        showOverlay(tabId, url, msg);
      } else {
        showOverlay(tabId, url, null, (response && response.error) || "Unknown error");
      }
    }
  );
}

// ── Overlay UI (injected into page) ──────────────────────────────────────────

function showOverlay(tabId, url, successMsg, errorMsg) {
  chrome.scripting.executeScript({
    target: { tabId },
    func: injectOverlay,
    args: [url || null, successMsg || null, errorMsg || null]
  });
}

function injectOverlay(url, successMsg, errorMsg) {
  const existing = document.getElementById("vlc-launcher-overlay");
  if (existing) existing.remove();

  const style = document.createElement("style");
  style.textContent = `
    @keyframes vlc-slide-in { from{transform:translateX(120%);opacity:0} to{transform:translateX(0);opacity:1} }
    #vlc-launcher-overlay button { transition:opacity .15s,transform .15s; }
    #vlc-launcher-overlay button:hover { opacity:.8!important; transform:translateY(-1px)!important; }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement("div");
  overlay.id = "vlc-launcher-overlay";
  overlay.style.cssText = `
    position:fixed;top:20px;right:20px;z-index:2147483647;
    font-family:'Segoe UI',system-ui,sans-serif;
    background:#1a1a2e;border:1px solid #FF6B00;border-radius:12px;
    padding:16px 20px;min-width:340px;max-width:460px;
    box-shadow:0 8px 32px rgba(0,0,0,.5);
    animation:vlc-slide-in .3s ease;
  `;

  const shortUrl = url ? (url.length > 60 ? url.slice(0,57)+"…" : url) : "";
  const icon = `<svg width="28" height="28" viewBox="0 0 100 100">
    <polygon points="10,5 90,5 100,20 50,95 0,20" fill="#FF6B00"/>
    <polygon points="20,20 80,20 85,30 50,80 15,30" fill="#FFB347"/>
    <polygon points="30,32 70,32 65,42 50,65 35,42" fill="white"/>
  </svg>`;

  let bodyHtml = "";
  if (successMsg) {
    const isQueue = successMsg.includes("playlist");
    bodyHtml = `<div style="color:#4caf50;font-size:14px;font-weight:600;">${isQueue?"➕":"▶"} ${successMsg}</div>`;
  } else if (errorMsg) {
    const isSetupError = ["not found","Native host","Specified native","cannot find","Access to the specified"].some(s => errorMsg.includes(s));
    bodyHtml = `
      <div style="background:#2a0a0a;border:1px solid #8b0000;border-radius:8px;padding:12px;margin-bottom:12px;">
        <div style="color:#ff6b6b;font-weight:600;font-size:12px;margin-bottom:6px;">
          ⚠ ${isSetupError ? "Native host not connected" : "Error"}
        </div>
        <div style="color:#aaa;font-size:11px;line-height:1.6;">
          ${isSetupError
            ? `Re-run <strong style="color:#fff">setup.bat</strong> with your current extension ID, then click ↺ reload at <strong style="color:#fff">chrome://extensions</strong>.`
            : errorMsg}
        </div>
      </div>
      ${url ? `<button id="vlc-copy-btn" style="width:100%;background:#2a2a3e;color:#ccc;border:1px solid #444;border-radius:8px;padding:10px 16px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:8px;">
        <span>📋</span><span>Copy URL — paste into VLC → Media → Open Network Stream</span>
      </button>` : ""}
    `;
  }

  overlay.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:${url||errorMsg?12:0}px;">
      ${icon}
      <div>
        <div style="color:#FF6B00;font-weight:700;font-size:14px;">WATCH IN VLC</div>
        <div style="color:#888;font-size:11px;">Media Player</div>
      </div>
      <button id="vlc-close-btn" style="margin-left:auto;background:none;border:none;color:#666;cursor:pointer;font-size:20px;line-height:1;">×</button>
    </div>
    ${url ? `<div style="background:#0d0d1a;border-radius:6px;padding:8px 10px;margin-bottom:12px;word-break:break-all;">
      <span style="color:#555;font-size:10px;text-transform:uppercase;letter-spacing:1px;">URL</span><br>
      <span style="color:#aaa;font-size:11px;">${shortUrl}</span>
    </div>` : ""}
    ${bodyHtml}
  `;

  document.body.appendChild(overlay);
  document.getElementById("vlc-close-btn").onclick = () => overlay.remove();

  const copyBtn = document.getElementById("vlc-copy-btn");
  if (copyBtn && url) {
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(url).then(() => {
        copyBtn.innerHTML = "<span>✅</span><span>Copied!</span>";
        setTimeout(() => { copyBtn.innerHTML = "<span>📋</span><span>Copy URL — paste into VLC → Media → Open Network Stream</span>"; }, 2500);
      });
    };
  }

  setTimeout(() => {
    const el = document.getElementById("vlc-launcher-overlay");
    if (el) { el.style.transition="opacity .4s"; el.style.opacity="0"; setTimeout(()=>el.remove(),400); }
  }, successMsg ? 4000 : 20000);
}
