// Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log('NexTask Extension Installed.');
});

// Listener for messages from popup or content script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'GET_ACTIVE_TAB_INFO') {
    // Request content script for selected text, or fallback to background tab metadata
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab || !activeTab.id) {
        sendResponse({ error: 'No active tab' });
        return;
      }
      
      const tabInfo = {
        title: activeTab.title || '',
        url: activeTab.url || '',
        selection: ''
      };

      // Try to get selection from content script
      chrome.tabs.sendMessage(
        activeTab.id,
        { action: 'GET_SELECTION' },
        (response) => {
          if (chrome.runtime.lastError) {
            // Content script not ready or cannot be injected (e.g. chrome://)
            console.log('Content script not reachable:', chrome.runtime.lastError);
            sendResponse(tabInfo);
          } else if (response && response.selection) {
            tabInfo.selection = response.selection;
            sendResponse(tabInfo);
          } else {
            sendResponse(tabInfo);
          }
        }
      );
    });
    
    // Return true to indicate we will send a response asynchronously
    return true; 
  }
});
