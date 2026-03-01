const FIREBASE_URL = 'https://viisi-master-app-default-rtdb.firebaseio.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // IFTTT may send as JSON or form-encoded; Vercel auto-parses both into req.body
    const body = req.body || {};

    const entry = {
      url: String(body.url || '').trim(),
      title: String(body.title || '').trim(),
      source: 'ifttt-x-search',
      timestamp: new Date().toISOString(),
      status: 'pending'
    };

    if (!entry.url) {
      res.status(400).json({ error: 'url is required' });
      return;
    }

    const fbRes = await fetch(`${FIREBASE_URL}/tournament-queue.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });

    const fbData = await fbRes.json();

    if (!fbRes.ok) {
      res.status(fbRes.status).json({ error: 'Firebase error', detail: fbData });
      return;
    }

    res.status(200).json({ ok: true, key: fbData.name, entry });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
