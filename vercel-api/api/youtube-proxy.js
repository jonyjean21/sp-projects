const ALLOWED_ORIGINS = [
  'https://jonyjean21.github.io',
  'https://yt-dash-two.vercel.app'
];

function setCors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(req, res);
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'YOUTUBE_API_KEY not configured' });
    return;
  }

  // endpoint: channels, search, videos
  const { endpoint, ...params } = req.query;
  const allowed = ['channels', 'search', 'videos'];
  if (!endpoint || !allowed.includes(endpoint)) {
    res.status(400).json({ error: 'endpoint must be one of: ' + allowed.join(', ') });
    return;
  }

  try {
    const qs = new URLSearchParams(params);
    qs.set('key', apiKey);
    const url = `https://www.googleapis.com/youtube/v3/${endpoint}?${qs}`;
    const ytRes = await fetch(url);
    const data = await ytRes.json();

    if (!ytRes.ok) {
      res.status(ytRes.status).json(data);
      return;
    }

    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
