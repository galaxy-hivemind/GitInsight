// GitInsight – Background Service Worker (Manifest V3)
// Detects GitHub repository pages and coordinates with content script

const GITHUB_REPO_PATTERN = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/;

// Listen for tab updates to detect GitHub repo pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const match = tab.url.match(GITHUB_REPO_PATTERN);
    if (match) {
      chrome.tabs.sendMessage(tabId, {
        type: 'REPO_DETECTED',
        owner: match[1],
        repo: match[2]
      }).catch(() => {
        // Content script not yet loaded – ignore
      });
    }
  }
});

// Handle extension icon click – toggle dashboard
chrome.action.onClicked.addListener((tab) => {
  if (tab.url && GITHUB_REPO_PATTERN.test(tab.url)) {
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_DASHBOARD' }).catch(() => { });
  }
});

// Listen for messages from content script / dashboard
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_API') {
    // Read token from storage, then proxy the API request
    chrome.storage.local.get(['githubToken'], (result) => {
      const token = result.githubToken || message.token || null;
      fetch(message.url, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          ...(token ? { 'Authorization': `token ${token}` } : {})
        }
      })
        .then(async (response) => {
          const data = await response.json();
          const linkHeader = response.headers.get('Link');
          sendResponse({
            data,
            linkHeader,
            status: response.status,
            rateLimitRemaining: response.headers.get('X-RateLimit-Remaining'),
            rateLimitReset: response.headers.get('X-RateLimit-Reset')
          });
        })
        .catch(err => {
          sendResponse({ error: err.message });
        });
    });
    return true; // Keep message channel open for async response
  }
});
