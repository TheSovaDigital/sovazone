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
    }),
  });

  const data = await response.json();

  if (!data.access_token) {
    res.status(500).send("Error: " + JSON.stringify(data));
    return;
  }

  const token = data.access_token;

  // Отправляем скрипт, который передает токен в основное окно Decap CMS
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`
    <!doctype html>
    <html>
    <body>
      <script>
        (function() {
          function receiveMessage(e) {
            if (e.data === "authorizing:github") {
              window.opener.postMessage(
                'authorization:github:success:{"token":"${token}","provider":"github"}',
                e.origin
              );
            }
          }
          window.addEventListener("message", receiveMessage, false);
          // Сообщаем основному окну, что мы готовы передать токен
          window.opener.postMessage("authorizing:github", "*");
        })()
      </script>
    </body>
    </html>
  `);
}
