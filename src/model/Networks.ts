import { NetworkEnum } from "@/model/NetworkEnum";

export const NetworkById = (
  chainId: string | number
): NetworkEnum | undefined => {
  const normalizedChainId =
    typeof chainId === "number" ? chainId : Number(chainId);

  for (const [network, details] of Object.entries(Networks)) {
    if (Number(details.chainId) === normalizedChainId) {
      return network as unknown as NetworkEnum;
    }
  }

  return undefined;
};

export const Networks = {
  [NetworkEnum.sepolia]: {
    chainId: "0xAA36A7",
    chainName: "Sepolia Testnet",
  },
  [NetworkEnum.rootstock]: {
    chainId: "0x1F",
    chainName: "Rootstock Testnet",
    rpcUrls: ["https://public-node.testnet.rsk.co/"],
    iconUrls: [
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAoCAYAAACWwljjAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAPOSURBVHgBxVhNUhpBFH6vGdxp4S4LoSYnEE8gnEA4AbpMJUQ4gXgCRJK1egLxBOIJJCdwJElVllMu49Cd1z04zD/dY1H5qihmut/M93VPv59uhHdAXFaPAaEDgA2/BaeA4hq/zG+gIBAKQoyr9yshid4Jdn+2oQAYFIC4rA2zxUhgS3yrDqEAjGdIDD/YYG09aRl7L7vYd10wgPkMlcoNfdvtFhjCXJBAeyO2S5gLQuFo25bEIxjCCt8oN2Z46I+Mu4A4SbjwojQBi1+BDl5LP+JNYlhtQRmPsjjQN1ILldwY7JTXOuD9bWL/jxO8dFy7oL9TyMcIu/PeSghxlLduQUA9jwPXiAk98HLw5jFiaFfAEjRLImPR0qi7z+2VmArZ7zzqcDAS01ljCKqf7QSjxb7jKkIhTohu6rOCq64RjsNiFEo7x7ocSNMvlddhPWb0CQ6gAAw4HKZpKGFDcWhzSEG6kbQCm4dLbi9m+XlpBTHea2D31zTSNtxrAGMNdcP5FPuxfhlKdCHgASUJxcd7zUcobkAPXvkzWGyf7uVCt2M2DtkMljaHSxu92WWLAz8OjWsD+juD/4tzcpqBSh3yQrmwoNFFMZNuDB7bJRsp/hzMMQqeT+NQ96KtNEBK+SG+23XgHgUyy8FPjpPozy3M4sZwh1/nLRMOK26Mn50Z5IHjA6XkBugJSn1XHkeBbK8dJsxsl0jMEOUpm0o9+gkX+7+TI0E+0x6Hsk0ijyNYQ/4OAqWn2aF+5cLxEoRq6idqtyEPtFhp/XyMNI2p9ADFUc/iYL5h7YzEXEEyptj04mvVHxkGP4F8MS4sWDsqRr4DbyGZRiIcqCKtpRMYeTMcpVVAFewqMVPSjUkMVQTBp6BPVKeiTqN65E0qP1AvIArWC98qcQsms39oDeBEtoXFKFgLbQ76ZKiXiRH2E01UF9Go+kGDh32/LWHZAD2OQ7mGdLO4ndrqWaHZyNyD6XJUWEq6yIQqReOweCe49ivD2DNUIutjJgXpHwyUtyPbY/IMWehfBA0IZxQSQoW9rKXL+ltq0oKqYC+RB6yLKys4xEw/Idde5R02cTGOcgh1LSNnid+nihIqcN0tr48MhL89L2uoG+Dqv5Px/IwqAhkqnEi296M1OyLPqVCgdKhcuKNjlUnQL4X78cRk1E1JlMkBME1sFE0gRrRJZGs3iT44bRZP5z0wQJHzIZMMbpztN1t+FDhsMBe0YNfatimHDetgLGiZGkYapqPwYt6YIAWPDYI9fSrETfjkwwSFT2EVrV/USY+r+/GGNp2I7zoW/gdR9aOdZ/lPGgAAAABJRU5ErkJggg==",
    ],
    nativeCurrency: {
      name: "tRBTC",
      symbol: "tRBTC",
      decimals: 18,
    },
    blockExplorerUrls: ["https://explorer.testnet.rootstock.io/"],
  },
};
