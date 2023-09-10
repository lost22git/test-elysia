#!/usr/bin/env bash

DIR="$(dirname "$(realpath "$0")")"

bun run $DIR/src/index.ts
