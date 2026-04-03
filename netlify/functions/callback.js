exports.handler = async function (event) {
  const code = event.queryStringParameters?.code;
  const siteUrl = process.env.URL || "https://vocal-pony-d77133.netlify.app";

  if (!code) {
    return {
      statusCode: 400,
      body: "Missing OAuth code",
    };
  }

  const body = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    client_secret: process.env.GITHUB_CLIENT_SECRET,
    code,
    redirect_uri: `${siteUrl}/callback`,
  });

  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await response.json();

  if (!data.access_token) {
    return {
      statusCode: 500,
      body: `OAuth error: ${JSON.stringify(data)}`,
    };
  }

  const postMsgContent = {
    token: data.access_token,
    provider: "github",
  };

  const script = `
    <script>
      (function() {
        function receiveMessage(e) {
          window.opener.postMessage(
            'authorization:github:success:${JSON.stringify(postMsgContent)}',
            e.origin
          );
          window.close();
        }
        window.addEventListener("message", receiveMessage, false);
        window.opener.postMessage("authorizing:github", "*");
      })();
    </script>
  `;

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
    },
    body: script,
  };
};
