FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node . .
RUN mkdir -p data site/uploads && chown -R node:node data site/uploads
USER node
ENV HOST=0.0.0.0 PORT=4380
EXPOSE 4380
VOLUME ["/app/data", "/app/site/uploads"]
CMD ["node", "server.mjs"]
