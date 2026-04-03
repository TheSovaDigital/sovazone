exports.handler = async function (event) {
  const siteUrl = process.env.URL || "https://vocal-pony-d77133.netlify.app";
  const scope = event.queryStringParameters?.scope || "repo";

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: `${siteUrl}/callback`,
    scope,
  });

  return {
    statusCode: 302,
    headers: {
      Location: `https://github.com/login/oauth/authorize?${params.toString()}`,
      "Cache-Control": "no-cache",
    },
    body: "",
  };
};
