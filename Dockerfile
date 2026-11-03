FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY tests ./tests
COPY scripts ./scripts
COPY public ./public
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/infrastructure/database/migrations ./src/infrastructure/database/migrations
COPY --from=build /app/src/infrastructure/database/seeds ./src/infrastructure/database/seeds
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "dist/api/server.js"]
