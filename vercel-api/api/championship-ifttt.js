const FIREBASE_URL = 'https://viisi-master-app-default-rtdb.firebaseio.com';

function detectRank(text) {
  const t = (text || '').replace(/\s+/g, ' ');
  if (/優勝|1位|🏆/.test(t)) return 1;
  if (/準優勝|2位/.test(t)) return 2;
  if (/3位/.test(t)) return 3;
  const m = t.match(/(\d+)\s*位/);
  if (m) return parseInt(m[1]);
  return null;
}

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
    const tweetUrl = String(body.url || '').trim();
    const userName = String(body.title || '').trim(); // IFTTT sends UserName as title
    const source = String(body.source || 'ifttt-championship');

    if (!tweetUrl) {
      res.status(400).json({ error: 'url is required' });
      return;
    }

    // Extract tweet ID
    const idMatch = tweetUrl.match(/status\/(\d+)/);
    let tweetText = '';
    let tweetAuthor = userName;
    let tweetHandle = '';
    let detectedRank = null;

    if (idMatch) {
      // Fetch tweet via syndication API
      try {
        const tweetRes = await fetch(
          `https://cdn.syndication.twimg.com/tweet-result?id=${idMatch[1]}&token=x`
        );
        if (tweetRes.ok) {
          const tweetData = await tweetRes.json();
          tweetText = tweetData.text || '';
          tweetAuthor = tweetData.user?.name || userName;
          tweetHandle = tweetData.user?.screen_name || '';
          detectedRank = detectRank(tweetText);
        }
      } catch (tweetErr) {
        console.error('Tweet fetch error:', tweetErr.message);
      }
    }

    const entry = {
      x_link: tweetUrl,
      name: tweetAuthor,
      team: '',
      rank: detectedRank || 0,
      venue_id: '',
      block_id: '',
      venue_name: '',
      note: '',
      tweet_text: tweetText.slice(0, 1000),
      tweet_author: tweetAuthor,
      tweet_handle: tweetHandle,
      detected_rank: detectedRank,
      source,
      submitted_at: new Date().toISOString(),
      status: 'pending'
    };

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

    // LINE Notify (optional)
    const lineToken = process.env.LINE_NOTIFY_TOKEN;
    if (lineToken) {
      try {
        const msg = `\n【選手権IFTTT】新ツイート検知\n@${tweetHandle}: ${tweetText.slice(0, 100)}${detectedRank ? '\n検出順位: ' + detectedRank + '位' : ''}`;
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

    res.status(200).json({ ok: true, key: fbData.name, detected_rank: detectedRank, handle: tweetHandle });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
