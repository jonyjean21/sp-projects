export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.DRIVE_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'DRIVE_API_KEY not configured' });
    return;
  }

  const { folderId } = req.query;
  if (!folderId) {
    res.status(400).json({ error: 'folderId is required' });
    return;
  }

  try {
    const driveUrl = `https://www.googleapis.com/drive/v3/files?q='${encodeURIComponent(folderId)}'+in+parents+and+trashed=false&key=${apiKey}&fields=files(id,name,mimeType)&pageSize=200&orderBy=name`;
    const driveRes = await fetch(driveUrl, {
      headers: { 'Referer': 'https://jonyjean21.github.io/' }
    });
    const data = await driveRes.json();

    if (!driveRes.ok) {
      res.status(driveRes.status).json(data);
      return;
    }

    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
