// Firebase Realtime Database REST client
const FIREBASE_URL = process.env.FIREBASE_URL || 'https://viisi-master-app-default-rtdb.firebaseio.com';

export async function getQueue(queueName) {
  const res = await fetch(`${FIREBASE_URL}/${queueName}.json`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Firebase GET /${queueName} failed: ${res.status}`);
  return res.json();
}

export async function getPendingItems(queueName) {
  const data = await getQueue(queueName);
  if (!data) return [];
  return Object.entries(data)
    .filter(([_, v]) => v && v.pending === true)
    .map(([key, val]) => ({ key, ...val }));
}

export async function markProcessed(queueName, key) {
  const res = await fetch(`${FIREBASE_URL}/${queueName}/${key}.json`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pending: false, processedAt: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Firebase PATCH /${queueName}/${key} failed: ${res.status}`);
  return res.json();
}

export async function writeLog(logPath, data) {
  const res = await fetch(`${FIREBASE_URL}/${logPath}.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, timestamp: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Firebase POST /${logPath} failed: ${res.status}`);
  return res.json();
}
