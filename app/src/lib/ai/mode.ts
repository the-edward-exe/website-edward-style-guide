export function aiMode(): { gemini: 'live' | 'demo'; claude: 'live' | 'demo' } {
  return {
    gemini: process.env.GEMINI_API_KEY ? 'live' : 'demo',
    claude: process.env.ANTHROPIC_API_KEY ? 'live' : 'demo',
  };
}

/** Demo mode's stand-in for a model call's wait. Stop cuts it short like a real call. */
export function demoDelay(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, Number(process.env.DEMO_DELAY_MS ?? 3000));
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new Error('STOPPED.')); }, { once: true });
  });
}
