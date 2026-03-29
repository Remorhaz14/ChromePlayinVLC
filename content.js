// Guard against being injected multiple times
if (!window.__vlcContentScriptLoaded) {
  window.__vlcContentScriptLoaded = true;

  let lastRightClickedVideo = null;

  document.addEventListener("contextmenu", (e) => {
    lastRightClickedVideo = e.target.closest("video") || null;
  }, true);

  // ── Site-specific extractors ────────────────────────────────────────────────

  function extractYouTube() {
    const url = new URL(window.location.href);
    const v = url.searchParams.get("v");
    if (v) return `https://www.youtube.com/watch?v=${v}`;
    const shorts = window.location.pathname.match(/\/shorts\/([^/?]+)/);
    if (shorts) return `https://www.youtube.com/watch?v=${shorts[1]}`;
    return window.location.href;
  }

  function extractVimeo() {
    const m = window.location.pathname.match(/\/(\d+)/);
    return m ? `https://vimeo.com/${m[1]}` : window.location.href;
  }

  function extractTwitch() {
    const channel = window.location.pathname.match(/^\/([^/]+)$/);
    const skip = ["directory","videos","clips","following","subscriptions","p","legal","store","jobs"];
    if (channel && !skip.includes(channel[1])) return `https://www.twitch.tv/${channel[1]}`;
    const vod = window.location.pathname.match(/\/videos\/(\d+)/);
    if (vod) return `https://www.twitch.tv/videos/${vod[1]}`;
    return window.location.href;
  }

  function extractReddit() {
    const video = lastRightClickedVideo || document.querySelector("video");
    if (video) {
      const src = video.currentSrc || video.src || "";
      if (src.includes("v.redd.it")) {
        return src.replace(/\/DASH_\d+\.mp4.*$/, "/DASHPlaylist.mpd");
      }
    }
    return window.location.href;
  }

  function extractGeneric() {
    const video = lastRightClickedVideo || document.querySelector("video");
    if (!video) return null;

    // currentSrc is what's actually playing
    let src = video.currentSrc || video.src || null;

    // blob: URLs are useless outside the browser
    if (src && src.startsWith("blob:")) src = null;

    // Try <source> children
    if (!src) {
      for (const s of video.querySelectorAll("source")) {
        const u = s.src || "";
        if (u && !u.startsWith("blob:")) { src = u; break; }
      }
    }

    // Prefer HLS/DASH manifests
    if (!src) {
      for (const s of video.querySelectorAll("source")) {
        const u = s.src || "";
        if (u.includes(".m3u8") || u.includes(".mpd")) { src = u; break; }
      }
    }

    return src;
  }

  function getBestVideoUrl() {
    const host = window.location.hostname;
    if (host.includes("youtube.com") || host.includes("youtu.be")) return extractYouTube();
    if (host.includes("vimeo.com"))   return extractVimeo();
    if (host.includes("twitch.tv"))   return extractTwitch();
    if (host.includes("twitter.com") || host.includes("x.com")) return window.location.href;
    if (host.includes("reddit.com"))  return extractReddit();
    return extractGeneric() || window.location.href;
  }

  // ── Message listener ──────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getVideoUrl") {
      sendResponse({ url: getBestVideoUrl() });
    }
    return true; // keep channel open for async
  });
}
