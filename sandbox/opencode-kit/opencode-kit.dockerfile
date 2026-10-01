FROM docker/sandbox-templates:opencode-docker-0.7.0

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        lua5.4 \
        p7zip-full \
        jq \
        sqlite3 \
    && rm -rf /var/lib/apt/lists/*

RUN git config --system \
    url."https://github.com/".insteadOf "git@github.com:" \
    && git config --system --add \
    url."https://github.com/".insteadOf "ssh://git@github.com/"

USER agent

ENV OPENCODE_DISABLE_AUTOUPDATE=1

