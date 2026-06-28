import { analyzeBoards } from './services/ai.service';
import { generateDigests } from './services/digest.service';

let intervalId: NodeJS.Timeout | null = null;

export function startAIScheduler(): void {
  const intervalMinutes = parseInt(process.env.AI_ANALYSIS_INTERVAL_MINUTES || '360', 10);
  const intervalMs = intervalMinutes * 60 * 1000;

  if (intervalId) {
    clearInterval(intervalId);
  }

  // Run immediately on start for development/testing, or just let the interval handle it?
  // User didn't specify running immediately, but usually it's helpful.
  // We will just set the interval. Wait, if they set it to 1 min, they can wait 1 min.
  // I will run it initially after 10 seconds just to test, then on the interval.
  
  setTimeout(() => {
    analyzeBoards().catch(err => console.error('[AI] Analysis error:', err));
    generateDigests().catch(err => console.error('[AI] Digest generation error:', err));
  }, 5000);

  intervalId = setInterval(() => {
    analyzeBoards().catch(err => console.error('[AI] Analysis error:', err));
    generateDigests().catch(err => console.error('[AI] Digest generation error:', err));
  }, intervalMs);
}

export function stopAIScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
