#!/bin/bash
SESSION_ID="${KATA_MOCK_SESSION_ID:-test-sid}"
TIMEOUT="${KATA_MOCK_TIMEOUT:-100}"

IFS= read -r input_line
case "$input_line" in
  *"fail-login"*)
    echo '{"type":"system","subtype":"init","session_id":"fail-sid"}'
    echo '{"type":"assistant","message":{"content":[{"type":"text","text":"401 Unauthorized"}]}}'
    echo '{"type":"result","is_error":true,"result":"401 Unauthorized"}'
    ;;
  *)
    echo '{"type":"system","subtype":"init","session_id":"'"$SESSION_ID"'"}'
    echo '{"type":"assistant","message":{"content":[{"type":"text","text":"Mock reply"}]}}'
    echo '{"type":"result","total_cost_usd":0.0,"duration_ms":'"$TIMEOUT"'}'
    ;;
esac
