export default async function handler(req, res) {
  const code = req.query.code;

  if (!code) {
    res.status(400).send("Missing code");
    return;
  }

  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: "https://sovazone.vercel.app/api/callback",
    }),
  });

  const data = await response.json();

  if (!data.access_token) {
    res.status(500).send(`
      <pre>${JSON.stringify(data, null, 2)}</pre>
    `);
    return;
  }

  const payload = {
    token: data.access_token,
    provider: "github",
  };

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`
    <!doctype html>
    <html>
      <body>
        <script>
          (function() {
            const payload = ${JSON.stringify(payload)};
            if (window.opener) {
              window.opener.postMessage(
                "authorization:github:success:" + JSON.stringify(payload),
                window.location.origin
              );
              window.close();
            } else {
              document.body.innerHTML = "<pre>OAuth success, but no opener window found.</pre>";
            }
          })();
        </script>
      </body>
    </html>
  `);
}
