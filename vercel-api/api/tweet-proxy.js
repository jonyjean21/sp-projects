export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { id } = req.query;
  if (!id || !/^\d+$/.test(id)) {
    res.status(400).json({ error: 'Valid tweet id is required' });
    return;
  }

  try {
    const resp = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=x`
    );
    const data = await resp.json();

    if (!resp.ok) {
      res.status(resp.status).json(data);
      return;
    }

    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
