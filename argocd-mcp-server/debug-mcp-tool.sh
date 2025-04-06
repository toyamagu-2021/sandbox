#!/bin/bash
set -x

curl -s -H "Accept:text/event-stream" -N http://localhost:58082/sse >/tmp/sse.log &
pid=$!

function cleanup() {
    kill $pid >/dev/null 2>&1
}

trap "cleanup" EXIT

sleep 1

session_id=$(cat /tmp/sse.log | grep -oP 'sessionId=.*' | cut -d'=' -f2)
curl -s -X POST "http://localhost:58082/message?sessionId=$session_id" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
echo ""

curl -s -X POST "http://localhost:58082/message?sessionId=$session_id" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_applications","arguments":{}}}'
echo ""

sleep 1

cat /tmp/sse.log
wait $pid
