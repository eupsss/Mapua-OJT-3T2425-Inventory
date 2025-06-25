// api/routes/insights.js
import express from 'express';
const router = express.Router();

router.post('/', async (req, res) => {
  const apiKey = process.env.GEMINI_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_KEY missing' });

  const { prompt } = req.body;
  if (typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Invalid prompt' });
  }

  const url = `https://generativelanguage.googleapis.com/v1/models/` +
              `gemini-2.0-flash-001:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [ { parts: [ { text: prompt } ] } ]
      })
    });

    if (!r.ok) return res.status(r.status).send(await r.text());

    const data   = await r.json();
    const output = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.json({ text: output });
  } catch (err) {
    console.error('Gemini proxy error:', err);
    return res.status(502).json({ error: err.message });
  }
});

export default router;
