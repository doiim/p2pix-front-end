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

### API
For full operation of the application, it is necessary to correctly configure the variable that points to the api in the .env file, in the repository there is an .env.example file, just rename it to just .env and modify the variable `VITE_API_URL`. The api can be run locally see [https://github.com/liftlearning/Pix-Explorer-Back-End](https://github.com/liftlearning/Pix-Explorer-Back-End), or it can be pointed to just her staging address: [https://p2pix-block-explorer-api-staging.vercel.app/](https://p2pix-block-explorer-api-staging.vercel.app/)

### Alchemy Keys
In the .env file, set `VITE_GOERLI_API_URL=https://eth-goerli.g.alchemy.com/v2/Zu9m4b2U_EzVU_zd-vgZDOleY8OF1DNP` and `VITE_MUMBAI_API_URL=https://polygon-mumbai.g.alchemy.com/v2/ZANeCqfj6VsXGpOH6gWAP6SIVIgD9Pwv`

You can also replace it with your own Alchemy Keys if you have one.

## Build Setup

The application can be tested by its trial version [https://p2pix-staging.vercel.app/](https://p2pix-staging.vercel.app/), the only requirement is to be running the smart contract of local way. To run the application locally, there are two different ways:

### Run with yarn
```sh
# Clone the repo
git clone https://github.com/liftlearning/P2Pix-Front-End
cd P2Pix-Front-End

# Install dependencies with yarn
yarn install

# Type-Check, Compile and Minify for Production
yarn build

# Compile and Hot-Reload for Development (port 3000)
yarn start

# Lint with [ESLint](https://eslint.org/)
yarn lint
```
### Run with docker-compose

```sh
# Clone the repo
git clone https://github.com/liftlearning/P2Pix-Front-End
cd P2Pix-Front-End

#1. Install [Docker](https://docs.docker.com/install/linux/docker-ce/ubuntu/);
#2. Install [Docker Compose](https://docs.docker.com/compose/install/).

# Run docker-compose up command
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