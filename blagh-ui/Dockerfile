# ── Stage 1: Build ────────────────────────────────────────────────────────────
# build.js uses esbuild to transpile (ES5) and minify blagh.js → dist/blagh.min.js
FROM node:20-alpine AS builder

WORKDIR /app

ARG ENABLE_MEDIA_RECORDING=false

COPY . .
RUN printf 'ENABLE_MEDIA_RECORDING=%s\n' "${ENABLE_MEDIA_RECORDING}" > .env \
    && npm install esbuild \
    && npm run build

# ── Stage 2: Serve with nginx ─────────────────────────────────────────────────
# Host apps load it with: <script src="http://<host>:3000/blagh.js">
FROM nginx:alpine AS production

COPY --from=builder /app/dist/blagh.min.js /usr/share/nginx/html/blagh.js

RUN printf 'server {\n\
    listen 3000;\n\
    root /usr/share/nginx/html;\n\
    location /blagh.js {\n\
        add_header Cache-Control "no-cache";\n\
        add_header Access-Control-Allow-Origin *;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
