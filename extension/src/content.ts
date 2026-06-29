// Content script for NexTask Extension

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'GET_SELECTION') {
    const selection = window.getSelection();
    let text = selection ? selection.toString() : '';
    
    // Fallback for inputs/textareas
    if (!text && document.activeElement) {
      const el = document.activeElement as any;
      if ((el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') && el.selectionStart !== undefined) {
        text = el.value.substring(el.selectionStart, el.selectionEnd);
      }
    }
    
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
