#!/usr/bin/env bash

set -e

function handle_exit()
{
  echo "kill all bun processes"
  pgrep bun | xargs kill
  exit
}

trap handle_exit EXIT

# server instance count
COUNT=$1
if [[ $COUNT < 0 ]] then
  COUNT=$(nproc --all)
fi

# current file dir path
DIR="$(dirname "$(realpath "$0")")"

# start server instances
for i in $(seq 1 $COUNT); do
  bun run $DIR/src/index.ts &
  sleep 0.5
done

# print server instance list
ss -tlp | grep bun

# wati for all children processes
wait -n

