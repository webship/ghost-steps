#!/usr/bin/env bash
# Builds the site the suite runs against: a self-hosted Ghost install inside
# ONE DDEV project, without the setup screens.
#
#   - the web container runs Node.js and starts Ghost as an extra daemon; the
#     DDEV router serves it on the project address (https://<project>.ddev.site);
#   - MySQL 8 comes from the DDEV database container;
#   - mail goes to the Mailpit of the DDEV project, so no real e-mail leaves;
#   - the update check, Gravatar, the directory ping and the other outbound
#     calls are switched off; no payment or hosted service is connected;
#   - scripts/seed-site.js completes the setup through the Admin API and creates
#     the staff accounts, the content, a member and the navigation.
#
# Settings (environment variables, all optional):
#   GHOST_VERSION   the release to install             (default 6.77.0)
#   NODE_VERSION    the Node.js version of the container (default 22.23.5: Ghost asks for ^22.23.5 or ^24.22.3)
#   PROJECT_NAME    the DDEV project name              (default ghoststeps)
#   SITE_DIR        the project folder                 (default a new temporary folder)
# The accounts are configuration: they are created once by scripts/seed-site.js
# and named in cucumber.js; the features never create or delete staff users.
set -euo pipefail

GHOST_VERSION="${GHOST_VERSION:-6.77.0}"
GHOST_CLI_VERSION="${GHOST_CLI_VERSION:-1.34.1}"
NODE_VERSION="${NODE_VERSION:-22.23.5}"
PROJECT_NAME="${PROJECT_NAME:-ghoststeps}"
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_DIR="${SITE_DIR:-$(mktemp -d)}"
SITE_URL="https://${PROJECT_NAME}.ddev.site"

mkdir -p "$SITE_DIR/.ddev"
# mktemp makes a private folder; the installer refuses a folder others cannot read.
chmod 755 "$SITE_DIR"
cd "$SITE_DIR"

# A generic web server: DDEV starts no nginx and no PHP; the router sends ports
# 80 and 443 of the project address to Ghost's port 2368. The daemon waits for
# the install below to finish before it starts Ghost.
cat > .ddev/config.yaml <<YAML
name: ${PROJECT_NAME}
type: generic
docroot: ""
webserver_type: generic
nodejs_version: "${NODE_VERSION}"
database:
  type: mysql
  version: "8.0"
web_extra_exposed_ports:
  - name: ghost
    container_port: 2368
    http_port: 80
    https_port: 443
web_extra_daemons:
  - name: ghost
    command: "bash -c 'while [ ! -f /var/www/html/ghost/.ready ]; do sleep 2; done; cd /var/www/html/ghost && NODE_ENV=production exec node current/index.js'"
    directory: /var/www/html
YAML

ddev start

# The official install path: ghost-cli downloads the release and its
# dependencies. --no-setup: the configuration is written below instead of asked.
if [ ! -e ghost/current/index.js ]; then
  rm -rf ghost && mkdir -p ghost
  ddev exec "cd /var/www/html/ghost && npx --yes ghost-cli@${GHOST_CLI_VERSION} install ${GHOST_VERSION} --no-setup --no-stack --no-start --no-prompt --dir /var/www/html/ghost"
fi

cat > ghost/config.production.json <<JSON
{
  "url": "${SITE_URL}",
  "server": { "host": "0.0.0.0", "port": 2368 },
  "database": {
    "client": "mysql",
    "connection": { "host": "db", "port": 3306, "user": "db", "password": "db", "database": "db" }
  },
  "mail": {
    "transport": "SMTP",
    "from": "'Test site' <noreply@example.com>",
    "options": { "host": "127.0.0.1", "port": 1025, "secure": false, "ignoreTLS": true }
  },
  "logging": { "transports": ["file", "stdout"] },
  "process": "local",
  "paths": { "contentPath": "/var/www/html/ghost/content" },
  "privacy": { "useTinfoil": true },
  "explore": { "update_url": "" },
  "security": { "staffDeviceVerification": false },
  "spam": {
    "user_login": { "freeRetries": 100000 },
    "staff_invite_block": { "freeRetries": 100000 },
    "member_login": { "freeRetries": 100000 },
    "global_block": { "freeRetries": 100000 },
    "global_reset": { "freeRetries": 100000 },
    "private_block": { "freeRetries": 100000 },
    "content_api_key": { "freeRetries": 100000 },
    "email_preview_block": { "freeRetries": 100000 },
    "webmentions_block": { "freeRetries": 100000 }
  }
}
JSON

touch ghost/.ready
ddev exec "supervisorctl restart webextradaemons:ghost" || true

# Ghost creates its tables on the first start: wait for the Admin API.
echo "Waiting for Ghost to answer ..."
for ATTEMPT in $(seq 1 120); do
  if ddev exec "curl -fsS -o /dev/null -H 'X-Forwarded-Proto: https' http://127.0.0.1:2368/ghost/api/admin/site/"; then
    break
  fi
  if [ "$ATTEMPT" = 120 ]; then
    echo "Ghost did not start; the end of its log:" >&2
    ddev exec "tail -n 60 /var/www/html/ghost/content/logs/*.log" >&2 || true
    exit 1
  fi
  sleep 5
done

mkdir -p "$SITE_DIR/seed"
cp "$SCRIPTS_DIR/seed-site.js" "$SITE_DIR/seed/seed-site.js"
cp "$SCRIPTS_DIR/../tests/fixtures/feature.png" "$SITE_DIR/seed/feature.png"
ddev exec "SITE_URL=${SITE_URL} node /var/www/html/seed/seed-site.js"

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "LAUNCH_URL=$SITE_URL" >> "$GITHUB_ENV"
fi
echo "Built Ghost ${GHOST_VERSION} at ${SITE_URL}"
