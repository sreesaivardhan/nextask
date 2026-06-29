// Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log('NexTask Extension Installed.');
});

// Listener for messages from popup or content script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'GET_ACTIVE_TAB_INFO') {
    // Request content script for selected text, or fallback to dynamic injection or metadata
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
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
            // Content script not ready (e.g. existing page before install), inject dynamically
            if (activeTab.url && !activeTab.url.startsWith('chrome://')) {
              chrome.scripting.executeScript({
                target: { tabId: activeTab.id! },
                func: () => {
                  let text = window.getSelection()?.toString() || '';
                  if (!text && document.activeElement) {
                    const el = document.activeElement as any;
                    if ((el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') && el.selectionStart !== undefined) {
                      text = el.value.substring(el.selectionStart, el.selectionEnd);
                    }
                  }
                  return text.trim();
                }
              }, (results) => {
                if (!chrome.runtime.lastError && results && results[0] && results[0].result) {
                  tabInfo.selection = results[0].result;
                }
                sendResponse(tabInfo);
              });
            } else {
              sendResponse(tabInfo);
            }
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
