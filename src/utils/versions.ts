import type { AppVersion } from "@/model/AppVersion";

export const appVersions: AppVersion[] = [
  {
    tag: "1.1.0",
    ipfsHash: "bafybeiaffdxrxoex3qh7kirnkkufnvpafb4gmkt7mjxufnnpbrq6tmqoha",
    releaseDate: "2025-11-06",
    description: "Explorer and versioning features added"
  },
  {
    tag: "1.0.0",
    ipfsHash: "bafybeiagfqnxnb5zdrks6dicfm7kxjdtzzzzm2ouluxgdseg2hrrotayzi",
    releaseDate: "2023-01-28",
    description: "Initial release"
  },
];

export function getLatestVersion(): AppVersion | null {
  return appVersions.length > 0 ? appVersions[0] : null;
}

export function getVersionByTag(tag: string): AppVersion | null {
  return appVersions.find((v) => v.tag === tag) || null;
}

export function getIpfsUrl(ipfsHash: string): string {
  return `https://${ipfsHash}.ipfs.dweb.link`;
}


