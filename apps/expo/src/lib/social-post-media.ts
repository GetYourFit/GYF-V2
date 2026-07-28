import { isRemoteImage } from "@/components/ui/catalog-image-url";

export function primaryActionablePostImageUrl(urls: readonly string[]): string | null {
  for (const url of urls) {
    if (isRemoteImage(url)) return url;
  }
  return null;
}
