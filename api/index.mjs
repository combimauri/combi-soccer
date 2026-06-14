// Vercel serverless entry for Angular SSR.
//
// Vercel sits in front as a proxy and always sends x-forwarded-* headers.
// Angular 21's SSR engine treats untrusted forwarded headers as a security risk
// and deopts to client-side rendering. We normalize them here: promote the real
// host from x-forwarded-host, then strip the forwarded headers so the engine
// renders on the server. allowedHosts is handled via angular.json / NG_ALLOWED_HOSTS.
const FORWARDED = [
  'x-forwarded-host',
  'x-forwarded-for',
  'x-forwarded-proto',
  'x-forwarded-port',
];

export default async (req, res) => {
  const forwardedHost = req.headers['x-forwarded-host'];
  if (forwardedHost) {
    req.headers.host = Array.isArray(forwardedHost)
      ? forwardedHost[0]
      : forwardedHost;
  }
  for (const header of FORWARDED) {
    delete req.headers[header];
  }

  const { reqHandler } = await import(
    '../dist/combi-soccer/server/server.mjs'
  );
  return reqHandler(req, res);
};
