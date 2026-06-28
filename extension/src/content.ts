// Content script for NexTask Extension

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'GET_SELECTION') {
    const selection = window.getSelection();
    let text = selection ? selection.toString() : '';
    
    // Trim intelligently if too long (e.g. 5000 chars)
    if (text.length > 5000) {
      text = text.substring(0, 5000);
      // Trim to last complete word
      const lastSpaceIndex = text.lastIndexOf(' ');
      if (lastSpaceIndex > 0) {
        text = text.substring(0, lastSpaceIndex);
      }
      text += '...';
    }

    sendResponse({ selection: text.trim() });
  }
});
