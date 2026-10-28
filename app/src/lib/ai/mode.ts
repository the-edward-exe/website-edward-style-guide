export function aiMode(): { gemini: 'live' | 'demo'; claude: 'live' | 'demo' } {
  return {
    gemini: process.env.GEMINI_API_KEY ? 'live' : 'demo',
    claude: process.env.ANTHROPIC_API_KEY ? 'live' : 'demo',
  };
}
