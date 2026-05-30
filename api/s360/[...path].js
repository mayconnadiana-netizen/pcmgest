// api/s360/[...path].js
// Proxy serverless — o primeiro segmento do path é o ambiente (teste/producao)

export default async function handler(req, res) {
  const segments = req.query.path; // array: ['teste','login'] ou ['producao','v1','equipamento','list']

  if (!segments || segments.length < 2) {
    return res.status(400).json({ error: 'Formato: /api/s360/{ambiente}/{endpoint}' });
  }

  const [env, ...rest] = segments;

  const HOSTS = {
    producao: 'https://api.s360web.com',
    teste:    'https://integration.s360web.com',
  };

  const host = HOSTS[env];
  if (!host) {
    return res.status(400).json({ error: `Ambiente inválido: "${env}". Use "teste" ou "producao".` });
  }

  const apiPath  = rest.join('/');
  const targetURL = `${host}/${apiPath}`;

  const headers = { 'Content-Type': 'application/json' };
  if (req.headers['authorization']) {
    headers['Authorization'] = req.headers['authorization'];
  }

  try {
    const upstream = await fetch(targetURL, {
      method:  req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method)
        ? undefined
        : JSON.stringify(req.body),
    });

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Proxy error: ' + err.message });
  }
}
