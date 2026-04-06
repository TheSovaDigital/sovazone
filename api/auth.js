export default async function handler(req, res) {
  const client_id = process.env.GITHUB_CLIENT_ID;
  const host = req.headers.host;
  const redirect_uri = `https://${host}/api/callback`;

  const url =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${client_id}` +
    `&scope=repo` +
    `&redirect_uri=${encodeURIComponent(redirect_uri)}`;

  res.redirect(url);
}
