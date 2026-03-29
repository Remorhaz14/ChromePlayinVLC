document.getElementById("openCurrentVideo").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Ask content script for the video URL
  chrome.tabs.sendMessage(tab.id, { action: "getVideoUrl" }, (response) => {
    let url = response && response.url ? response.url : tab.url;

    // Close popup and launch
    window.close();
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (videoUrl) => {
        window.location.href = "vlc://" + videoUrl;
      },
      args: [url]
    });
  });
});
