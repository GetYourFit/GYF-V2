export function isRemoteImage(url: string | null | undefined): url is string {
  return Boolean(url && /^https:\/\//i.test(url));
}
