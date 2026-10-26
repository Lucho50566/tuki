FROM node:22-alpine

# La imagen oficial de Node ya trae el usuario `node` con UID 1000,
# que es justo lo que exige Hugging Face Spaces.
WORKDIR /home/node/app
COPY --chown=node:node server.js ./
COPY --chown=node:node public ./public

# Los datos (data/db.json) viven acá. En los planes gratis el disco se pierde al reiniciar.
RUN mkdir -p /data && chmod 777 /data

ENV TUKI_DATA=/data \
    PORT=8080 \
    NODE_ENV=production \
    HOME=/home/node

USER node
EXPOSE 8080

CMD ["node", "server.js"]
