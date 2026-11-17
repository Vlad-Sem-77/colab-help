const allowedColabHostSuffixes = [
  "trycloudflare.com",
  "ngrok-free.app",
  "ngrok.app",
  "ngrok.io",
];

export function isAllowedColabUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    const isKnownTunnel = allowedColabHostSuffixes.some(
      (suffix) => url.hostname === suffix || url.hostname.endsWith(`.${suffix}`),
    );
    return (
      url.protocol === "https:"
      && !url.username
      && !url.password
      && !url.port
      && !url.search
      && !url.hash
      && (url.pathname === "/" || url.pathname === "")
      && isKnownTunnel
    );
  } catch {
    return false;
  }
}
