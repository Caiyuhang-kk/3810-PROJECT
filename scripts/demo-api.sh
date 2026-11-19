#!/usr/bin/env bash
# D: Local curl demonstration; modifies only the loan created by this run.
set -euo pipefail

command -v curl >/dev/null || { echo 'curl is required.' >&2; exit 1; }
command -v node >/dev/null || { echo 'Node.js is required.' >&2; exit 1; }

BASE="${BASE:-http://127.0.0.1:8099}"
BASE="${BASE%/}"
TEMP_DIR="$(mktemp -d)"
RESPONSE="$TEMP_DIR/response.json"
OWN_ID=''

cleanup() {
  local result=$?
  if [[ -n "$OWN_ID" ]]; then
    local status
    status="$(curl --silent --show-error --connect-timeout 5 --max-time 20 \
      -o /dev/null -w '%{http_code}' -X DELETE "$BASE/api/loans/$OWN_ID")" || status='000'
    if [[ "$status" != '204' && "$status" != '404' ]]; then
      echo "Cleanup failed (HTTP $status). Remove only this demo record: $OWN_ID" >&2
      result=1
    fi
  fi
  rm -f -- "$RESPONSE"
  rmdir -- "$TEMP_DIR"
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

request() {
  local method=$1 path=$2 expected=$3 payload=${4-}
  local status
  local args=(--silent --show-error --connect-timeout 5 --max-time 20
    -o "$RESPONSE" -w '%{http_code}' -X "$method")
  if [[ -n "$payload" ]]; then
    args+=(-H 'Content-Type: application/json' --data "$payload")
  fi
  status="$(curl "${args[@]}" "$BASE$path")"
  printf '%s %s -> %s\n' "$method" "$path" "$status"
  if [[ "$status" != "$expected" ]]; then
    printf 'Expected HTTP %s; response:\n' "$expected" >&2
    cat "$RESPONSE" >&2
    printf '\n' >&2
    return 1
  fi
}

MARKER="$(node -e "console.log('Demo-' + Date.now() + '-' + require('node:crypto').randomBytes(4).toString('hex'))")"
CODE="$(node -e "console.log('TST-' + require('node:crypto').randomBytes(6).toString('hex').toUpperCase())")"
BODY="$(node -e "console.log(JSON.stringify({itemCode:process.argv[2],itemName:process.argv[1],category:'camera',condition:'good',notes:'API demo',borrower:'Demo Student',contactPhone:'+852 9123 4567',contactEmail:'demo@example.com',borrowDate:'2099-12-20',dueDate:'2099-12-31',status:'borrowed'}))" "$MARKER" "$CODE")"

request POST /api/loans 201 "$BODY"
OWN_ID="$(node -e "const d=JSON.parse(require('node:fs').readFileSync(process.argv[1],'utf8')); if(!/^[a-f0-9]{24}$/i.test(d._id)) throw Error('Missing/invalid created ID'); process.stdout.write(d._id);" "$RESPONSE")"

request GET "/api/loans/$OWN_ID" 200
node - "$RESPONSE" "$OWN_ID" "$MARKER" "$CODE" <<'NODE'
const assert = require('node:assert/strict');
const doc = JSON.parse(require('node:fs').readFileSync(process.argv[2], 'utf8'));
assert.equal(doc._id, process.argv[3]);
assert.equal(doc.itemName, process.argv[4]);
assert.equal(doc.itemCode, process.argv[5]);
assert.equal(doc.category, 'camera');
assert.equal(doc.condition, 'good');
assert.equal(doc.status, 'borrowed');
assert.equal(doc.borrower, 'Demo Student');
assert.equal(doc.contactPhone, '+852 9123 4567');
assert.equal(doc.contactEmail, 'demo@example.com');
assert.equal(doc.borrowDate, '2099-12-20');
assert.equal(doc.dueDate, '2099-12-31');
NODE

request GET "/api/loans?q=$MARKER&category=camera&status=borrowed" 200
node - "$RESPONSE" "$OWN_ID" <<'NODE'
const assert = require('node:assert/strict');
const docs = JSON.parse(require('node:fs').readFileSync(process.argv[2], 'utf8'));
assert.ok(Array.isArray(docs), 'Search must return an array');
assert.ok(docs.some(doc => doc._id === process.argv[3]), 'Search must include the new loan');
assert.ok(docs.every(doc => doc.category === 'camera' && doc.status === 'borrowed'));
NODE

UPDATED="$(node -e "const doc=JSON.parse(process.argv[1]); doc.status='available'; doc.borrower=''; doc.contactPhone=''; doc.contactEmail=''; doc.borrowDate=''; doc.dueDate=''; console.log(JSON.stringify(doc));" "$BODY")"
request PUT "/api/loans/$OWN_ID" 200 "$UPDATED"
node - "$RESPONSE" "$OWN_ID" <<'NODE'
const assert = require('node:assert/strict');
const doc = JSON.parse(require('node:fs').readFileSync(process.argv[2], 'utf8'));
assert.equal(doc._id, process.argv[3]);
assert.equal(doc.status, 'available');
NODE

DELETED_ID="$OWN_ID"
request DELETE "/api/loans/$OWN_ID" 204
OWN_ID=''
request GET "/api/loans/$DELETED_ID" 404
echo 'PASS: create, read, combined search, update, delete, and missing-record status.'
