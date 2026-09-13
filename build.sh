#!/bin/sh

set -eu

output_file="_build/w3-warlord.ai"
project_owner=$(stat -c '%u:%g' .)

trap 'chown -R "$project_owner" _build 2>/dev/null || true' EXIT
mkdir -p _build
(
    cd /tmp
    java -jar /home/wurstuser/.wurst/wurst-compiler/wurstscript.jar \
        /workspace/warcraft-api/common.j /workspace/warcraft-api/common.ai \
        /workspace/wurst \
        -out "/workspace/$output_file"
)

printf 'Built %s\n' "$output_file"
