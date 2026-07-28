/** Only credential-free absolute HTTPS image URLs may reach a remote image surface. */
export function isRemoteImage(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url.trim());
    return (
      parsed.protocol === "https:" &&
      Boolean(parsed.hostname) &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}
