/**
 * Generates an initial title deterministically from selected text.
 * Uses the first meaningful sentence or a trimmed substring.
 */
export function generateTitleFromSelection(selection: string): string {
  if (!selection) return '';
  
  let title = selection.trim();
  
  // Try to find first sentence ending in period, newline, or question mark
  const firstSentenceMatch = title.match(/^([^\n.?!]{5,60})[.?!]/);
  
  if (firstSentenceMatch && firstSentenceMatch[1]) {
    title = firstSentenceMatch[1].trim();
  } else if (title.length > 50) {
    // Or just take the first 50 chars up to a space
    const substring = title.substring(0, 50);
    const lastSpace = substring.lastIndexOf(' ');
    title = (lastSpace > 10 ? substring.substring(0, lastSpace) : substring).trim();
  }
  
  // Remove trailing punctuations
  title = title.replace(/[^\w\s]$/, '');
  
  return title;
}
