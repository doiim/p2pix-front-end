import type { NetworkEnum, TokenEnum } from "@/model/NetworkEnum";

export const imagesPath = import.meta.glob<string>('@/assets/*.{png,svg}', { eager: true, query: '?url', import: 'default' });

export const getNetworkImage = (networkName: string): string => {
    const path = Object.keys(imagesPath).find((key) =>
        key.endsWith(`${networkName.toLowerCase()}.svg`)
    );
    return path ? imagesPath[path] : "";
};

export const getTokenImage = (tokenName: TokenEnum): string => {
    const path = Object.keys(imagesPath).find((key) =>
        key.endsWith(`${tokenName.toLowerCase()}.svg`)
    );
    return path ? imagesPath[path] : "";
};