#!/bin/bash
set -e
printf '%s\n' '{"email":"dsc-23@yandex.ru","password":"123123123"}' > /tmp/login.json
TOKEN=$(curl -s http://127.0.0.1:3075/api/auth/login -X POST -H 'Content-Type: application/json' -d @/tmp/login.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))")
API_KEY_ID="${1:-}"
if [ -n "$API_KEY_ID" ]; then
  curl -s "http://127.0.0.1:3075/api/analytics/recalculate-billing?apiKeyId=${API_KEY_ID}" -X POST -H "Authorization: Bearer $TOKEN"
else
  curl -s http://127.0.0.1:3075/api/analytics/recalculate-billing -X POST -H "Authorization: Bearer $TOKEN"
fi
echo
