import type { TokenEnum } from "@/model/NetworkEnum";

export const imagesPath = import.meta.glob<string>("@/assets/*.{png,svg}", {
  eager: true,
  query: "?url",
  import: "default",
});

export const getNetworkImage = (networkName: string): string => {
  const imageName = networkName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-');
  try {
    const path = Object.keys(imagesPath).find((key) =>
      key.endsWith(`${imageName}.svg`)
    );
    return path ? imagesPath[path] : "";
  } catch (error) {
    console.error("Error fetching network image");
    return "";
  }
};

export const getTokenImage = (tokenName: TokenEnum): string => {
  const path = Object.keys(imagesPath).find((key) =>
    key.endsWith(`${tokenName.toLowerCase()}.svg`)
  );
  return path ? imagesPath[path] : "";
};
