FROM node:16 AS stage-one

# Install DEB dependencies and others.
RUN \
 set -x \
 && apt-get update \
 && apt-get install -y net-tools build-essential python3 python3-pip valgrind sqlite3 \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* && apt-get clean \
  && rm -rf /var/lib/apt/lists/*e

ENV TINI_VERSION v0.19.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini

WORKDIR /app

COPY . .

RUN \
  cd webapp \
  && npm install --production \
  && npm run build \
  && cd ..  \
  && npm install --production

EXPOSE 4443

ENTRYPOINT ["/tini", "--"]
CMD ["node", "/app/index.js"]