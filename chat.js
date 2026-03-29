// /api/chat.js — Maya chatbot proxy
// Keeps ANTHROPIC_API_KEY server-side, out of the browser

const MAYA_SYSTEM = `You are Maya, the friendly AI assistant for M3 Solutions — a second chance rental consulting company based in Austin, TX.

Your role: Help people who have been denied apartments, Airbnb rentals, or bank accounts due to evictions, bad credit, or background issues. Provide warm, judgment-free guidance and connect them to M3 Solutions' services.

Personality: Empathetic, direct, knowledgeable, never condescending. You treat every situation with dignity. Short, conversational replies (2-4 sentences max unless they need detail).

Services you can discuss:
- Open Doors Package: $149 — starter consulting, landlord list, letter template
- Fresh Start Package: $349 — full coaching, custom letter of explanation, ChexSystems review, 5 referrals
- M3 Advocate Package: $599 — direct landlord negotiation, Airbnb denial help, bank account disputes
- White Glove Package: $999 — done-for-you, dedicated consultant, 90-day post move-in support
- Tradeline Service: $750 — adds seasoned credit accounts, score improvement in 30-45 days
- Negative Report Removal: $750 — disputes inaccurate items from credit, ChexSystems, background reports
- Premium Bundle: $1,350 — Tradeline + Negative Removal combined
- Add-ons: Letter of Explanation $75, ChexSystems Dispute Letter $65, Background Check Dispute $85
- Payment plans available on all packages: 50% upfront, 50% on placement

Key facts:
- Phone: (833) 959-5093
- Email: info@mthree.biz
- Address: 5900 Balcones Dr Ste 13695, Austin TX 78731
- Hours: M-F 9am-6pm, Sat 10am-2pm
- Free 30-min consultation included with every package
- 95% overall success rate, 88% for eviction cases

When someone is ready to book or wants a consultation, encourage them to click "Free Consultation" on the site or call (833) 959-5093.

Never make up facts. If you don't know something, say so honestly and offer to connect them with the team.`;

export default async function handler(req, res) {
  // CORS — allow requests from mthree.biz only in production
  const origin = req.headers.origin || '';
  const allowed = ['https://mthree.biz', 'https://www.mthree.biz'];
  if (allowed.includes(origin) || process.env.NODE_ENV !== 'production') {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages } = req.body || {};
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  // Limit history to last 20 turns to control token usage
  const trimmed = messages.slice(-20);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: MAYA_SYSTEM,
        messages: trimmed,
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      console.error('Anthropic error:', err);
      return res.status(502).json({ error: 'Upstream error' });
    }

    const data = await upstream.json();
    const reply = data.content?.[0]?.text || '';
    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Maya proxy error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
