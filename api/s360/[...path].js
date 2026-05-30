// api/s360/[...path].js
// Proxy serverless S360 — usa Basic Auth (sem endpoint /login)

export default async function handler(req, res) {
  const segments = req.query.path;

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

  // Endpoint especial: /login → não existe na S360, só valida credenciais
  // fazendo uma chamada real leve (tipoCompartimento/list)
  if (rest.join('/') === 'login') {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'username e password obrigatórios' });
    }
    const basicToken = Buffer.from(`${username}:${password}`).toString('base64');
    try {
      const test = await fetch(`${host}/api/v1/tipoCompartimento/list`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${basicToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (test.ok || test.status === 200) {
        // Credenciais válidas — retorna o token Basic para o frontend guardar
        return res.status(200).json({
          access_token: basicToken,
          token_type: 'Basic',
          username,
        });
      } else {
        return res.status(test.status).json({ error: 'Credenciais inválidas' });
      }
    } catch (err) {
      return res.status(502).json({ error: 'Erro ao validar: ' + err.message });
    }
  }

  // Demais endpoints — repassa com Basic Auth
  const authHeader = req.headers['authorization'] || '';
  const apiPath   = rest.join('/');
  const targetURL = `${host}/${apiPath}`;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': authHeader,
  };

  try {
    const upstream = await fetch(targetURL, {
      method: req.method,
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
