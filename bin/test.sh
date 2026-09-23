#!/bin/sh

set -eu

JAR=/home/wurstuser/.wurst/wurst-compiler/wurstscript.jar
test_files=/tmp/w3-warlord-test-files

trap 'rm -f "$test_files"' EXIT

find /workspace/spec -type f -name '*.test.wurst' -print0 > "$test_files"

if [ ! -s "$test_files" ]; then
    printf 'No *.test.wurst files found in spec\n' >&2
    exit 1
fi

cp /workspace/warcraft-api/common.ai /tmp/ai-common.j
cd /tmp

xargs -0 java -jar "$JAR" \
    -noPJass \
    -runtests \
    /workspace/lib/stdlib \
    -lib /workspace/wurst \
    -lib /workspace/spec \
    /workspace/warcraft-api/common.j \
    /tmp/ai-common.j < "$test_files"
