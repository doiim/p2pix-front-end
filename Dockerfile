FROM oven/bun:1.1-alpine
WORKDIR /app

COPY package.json bun.lock ./
COPY vendor ./vendor
RUN bun install --frozen-lockfile
COPY . .

EXPOSE 3000
CMD ["bun", "run", "start"]
