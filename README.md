<p align="center">
  <img src="./src/assets/colored_logo.svg" alt="Logo P2Pix" width="40%"/>
</p>
<br />

<center>

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=liftlearning_P2Pix-Front-End&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=liftlearning_P2Pix-Front-End)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=liftlearning_P2Pix-Front-End&metric=coverage)](https://sonarcloud.io/summary/new_code?id=liftlearning_P2Pix-Front-End)

</center>

This application aims to create a democratic and secure solution for the purchase and sale of ERC20 tokens, through the PIX, integrating the functionalities of smart contracts (smart contracts) of the blockchain with a receipt by digital signature. Allowing the integration of national financial system transactions to public blockchains, dispensing with custody through intermediaries.

# Table of Contents
* [Metamask Tutorial](#metamask-tutorial)
* [Recommended IDE Setup](#recommended-ide-setup)
* [Dependencies](#dependencies)
* [Build Setup](#build-setup)
## Metamask Tutorial
### Installation

Install the Metamask extension at https://metamask.io/download/

### Enable Testnets on Metamask

Go to Settings -> Advanced -> Show Testnets

Now you can select the Goerli testnet.

### Add Polygon Mumbai to your Metamask

To add the Mumbai network, follow the instructions at:
https://www.youtube.com/watch?v=Jegmru0Q0j4

### Import the MBRL token

Go to Import Tokens and paste the following address: `0x294003F602c321627152c6b7DED3EAb5bEa853Ee`

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur) + [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin).

### Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin) to make the TypeScript language service aware of `.vue` types.

If the standalone TypeScript plugin doesn't feel fast enough to you, Volar has also implemented a [Take Over Mode](https://github.com/johnsoncodehk/volar/discussions/471#discussioncomment-1361669) that is more performant. You can enable it by the following steps:

1. Disable the built-in TypeScript Extension
    1) Run `Extensions: Show Built-in Extensions` from VSCode's command palette
    2) Find `TypeScript and JavaScript Language Features`, right click and select `Disable (Workspace)`
2. Reload the VSCode window by running `Developer: Reload Window` from the command palette.

### Customize configuration

See [Vite Configuration Reference](https://vitejs.dev/config/).


## Dependencies

### API + RPC

Copy `.env.example` to `.env` and set the per-network variables:

| Var | Purpose |
|---|---|
| `VITE_APP_API_URL` | zkPix middleware base URL (default `http://localhost:3001`) |
| `VITE_SEPOLIA_API_URL`, `VITE_MAINNET_API_URL`, `VITE_RSK_API_URL` | RPC endpoints per network (Alchemy, Infura, public RPC) |
| `VITE_SEPOLIA_TOKEN_ADDRESS`, `VITE_MAINNET_TOKEN_ADDRESS`, `VITE_RSK_TOKEN_ADDRESS` | BRZ token address per network |
| `VITE_SEPOLIA_SUBGRAPH_URL`, `VITE_MAINNET_SUBGRAPH_URL`, `VITE_RSK_SUBGRAPH_URL` | The Graph subgraph endpoints |

## Build Setup

The application can be tested by its trial version [https://p2pix-staging.vercel.app/](https://p2pix-staging.vercel.app/), the only requirement is to be running the smart contract of local way. To run the application locally, there are two different ways:

### Run with bun

```sh
# Pull the smart-contracts submodule (skip if you cloned with --recurse-submodules)
git submodule update --init

# Install front-end dependencies
bun install

# One-time bootstrap of the smart-contracts submodule (needed before wagmi:gen)
cd p2pix-smart-contracts && bun install && cd ..

# Generate ABI bindings from the submodule (run again whenever contracts change)
bun run wagmi:gen

# Type-Check, Compile and Minify for Production
bun run build

# Compile and Hot-Reload for Development (port 3000)
bun start

# Lint with [ESLint](https://eslint.org/)
bun run lint
```
### Run with docker-compose

```sh
# Pull the smart-contracts submodule (skip if you cloned with --recurse-submodules)
git submodule update --init

#1. Install [Docker](https://docs.docker.com/install/linux/docker-ce/ubuntu/);
#2. Install [Docker Compose](https://docs.docker.com/compose/install/).

docker-compose up
```

### Backend Communication

Backend Repo: `https://gitea.kosmos.org/hueso/helpix`

Backend Endpoint: `https://api.p2pix.co/release/1279331`

curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {api-key}" \
  -d '{"query": "{ depositAddeds { id seller token amount } }"}' \
https://api.studio.thegraph.com/query/113713/p-2-pix/sepolia

https://api.studio.thegraph.com/query/113713/p-2-pix/1

curl --request POST --url 'https://api.hm.bb.com.br/testes-portal-desenvolvedor/v1/boletos-pix/pagar?gw-app-key=95cad3f03fd9013a9d15005056825665' --header 'content-type: application/json' --data '{"pix":"00020101021226070503***63041654" }'