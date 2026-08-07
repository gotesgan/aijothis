#!/usr/bin/env bash
# Applies supabase/migrations/*.sql to the production DB via the Supabase
# Management API query endpoint. Needs only SUPABASE_ACCESS_TOKEN +
# SUPABASE_PROJECT_REF. All migrations are idempotent (IF NOT EXISTS).
set -euo pipefail

for f in supabase/migrations/*.sql; do
  echo "::group::Applying $f"
  python3 - "$SUPABASE_PROJECT_REF" "$SUPABASE_ACCESS_TOKEN" "$f" <<'PYEOF'
import json, sys, urllib.request, urllib.error
ref, token, f = sys.argv[1], sys.argv[2], sys.argv[3]
sql = open(f).read()
req = urllib.request.Request(
    f"https://api.supabase.com/v1/projects/{ref}/database/query",
    data=json.dumps({"query": sql}).encode(),
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
)
try:
    resp = urllib.request.urlopen(req)
    print(f"  -> HTTP {resp.status}")
except urllib.error.HTTPError as e:
    body = e.read().decode()[:400]
    print(f"  -> HTTP {e.code}: {body}")
    sys.exit(1)
PYEOF
  echo "::endgroup::"
done

echo "All migrations applied."
