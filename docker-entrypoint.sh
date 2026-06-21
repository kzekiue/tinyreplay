#!/bin/sh
# Start as root only long enough to make the data dir writable (it may be a
# fresh bind mount owned by root), then drop to the unprivileged 'node' user to
# run the server. The app process itself never runs as root.
set -e

DATA_DIR="${DATA_DIR:-/app/data}"
mkdir -p "$DATA_DIR"
chown -R node:node "$DATA_DIR"

exec su-exec node:node "$@"
