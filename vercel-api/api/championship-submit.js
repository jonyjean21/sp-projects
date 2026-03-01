const FIREBASE_URL = 'https://viisi-master-app-default-rtdb.firebaseio.com';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = req.body || {};

    const entry = {
      venue_id: String(body.venue_id || '').trim(),
      block_id: String(body.block_id || '').trim(),
      venue_name: String(body.venue_name || '').trim(),
      rank: parseInt(body.rank) || 0,
      name: String(body.name || '').trim(),
      team: String(body.team || '').trim(),
      x_link: String(body.x_link || '').trim(),
      note: String(body.note || '').trim(),
      tweet_text: String(body.tweet_text || '').trim().slice(0, 1000),
      tweet_author: String(body.tweet_author || '').trim(),
      tweet_handle: String(body.tweet_handle || '').trim(),
      detected_rank: body.detected_rank != null ? (parseInt(body.detected_rank) || null) : null,
      submitted_at: new Date().toISOString(),
      status: 'pending'
    };

    if (!entry.venue_id || !entry.name || !entry.rank) {
      res.status(400).json({ error: '会場・名前・順位は必須です' });
      return;
    }

    // Save to Firebase
    const fbRes = await fetch(`${FIREBASE_URL}/championship-2026/submissions.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });

    const fbData = await fbRes.json();
    if (!fbRes.ok) {
      res.status(fbRes.status).json({ error: 'Firebase error', detail: fbData });
      return;
    }

    // Send LINE Notify (optional, fails gracefully)
    const lineToken = process.env.LINE_NOTIFY_TOKEN;
    if (lineToken) {
      try {
        const msg = `\n【選手権トラッカー】新しい投稿\n${entry.rank}位: ${entry.name}${entry.team ? ' (' + entry.team + ')' : ''}\n会場: ${entry.venue_name || entry.venue_id}${entry.x_link ? '\nX: ' + entry.x_link : ''}${entry.note ? '\nメモ: ' + entry.note : ''}`;
        await fetch('https://notify-api.line.me/api/notify', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lineToken}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: `message=${encodeURIComponent(msg)}`
        });
      } catch (lineErr) {
        console.error('LINE notify error:', lineErr.message);
      }
    }

    res.status(200).json({ ok: true, key: fbData.name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
