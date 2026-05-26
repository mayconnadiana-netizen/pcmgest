export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  try {
    const token = req.headers.authorization;
    const r = await fetch('https://api.s360web.com/api/v3/resultadoAmostra/list', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': token},
      body: JSON.stringify(req.body)
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch(e) {
    res.status(500).json({error: e.message});
  }
}
