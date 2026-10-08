# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# VITE_ vars are baked into the bundle at build time — pass them as build args
ARG VITE_API_URL=http://localhost:4000
ARG VITE_KEYCLOAK_BASE=https://vidaqa.cloudsolutions.com.sa/auth/realms/vidaqa
ARG VITE_KEYCLOAK_CLIENT_ID=app

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_KEYCLOAK_BASE=$VITE_KEYCLOAK_BASE
ENV VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Serve with nginx ─────────────────────────────────────────────────
FROM nginx:alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html

# SPA fallback: all routes serve index.html
RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
