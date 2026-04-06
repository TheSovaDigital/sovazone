export default async function handler(req, res) {
  const code = req.query.code;
  const host = req.headers.host;
  const redirect_uri = `https://${host}/api/callback`;

  const response = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri,
      }),
    }
  );

  const data = await response.json();

  if (!data.access_token) {
    res.status(500).send(JSON.stringify(data));
    return;
  }

  res.setHeader("Content-Type", "text/html");
  res.send(`
    <script>
      window.opener.postMessage(
        'authorization:github:success:' +
        JSON.stringify({ token: '${data.access_token}', provider: 'github' }),
        '*'
      );
      window.close();
    </script>
  `);
}
