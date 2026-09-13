#!/bin/sh

set -eu

output_file="_build/w3-warlord.ai"
project_owner=$(stat -c '%u:%g' .)

read_commit_sha() {
    IFS= read -r head < /workspace/.git/HEAD
    case "$head" in
        "ref: "*)
            ref=${head#ref: }
            if [ -f "/workspace/.git/$ref" ]; then
                IFS= read -r commit_sha < "/workspace/.git/$ref"
                printf '%s' "$commit_sha"
                return
            fi
            while IFS=' ' read -r commit_sha packed_ref; do
                if [ "$packed_ref" = "$ref" ]; then
                    printf '%s' "$commit_sha"
                    return
                fi
            done < /workspace/.git/packed-refs
            return 1
            ;;
        *)
            printf '%s' "$head"
            ;;
    esac
}

commit_sha=$(read_commit_sha)

trap 'chown -R "$project_owner" _build 2>/dev/null || true' EXIT
mkdir -p _build
(
    JAR=/home/wurstuser/.wurst/wurst-compiler/wurstscript.jar

    cp ./warcraft-api/common.ai /tmp/ai-common.j
    cd /tmp

    java -jar $JAR \
        -noPJass \
        /workspace/warcraft-api/common.j \
        /tmp/ai-common.j \
        /workspace/wurst \
        -out "/workspace/$output_file"

    jar xf "$JAR" pjass
    chmod +x pjass

    ./pjass /workspace/warcraft-api/common.j /workspace/warcraft-api/common.ai /workspace/$output_file
)

if ! grep -q '__SCRIPT_COMMIT_SHA' "$output_file"; then
    printf 'Missing script commit placeholder in %s\n' "$output_file" >&2
    exit 1
fi
sed -i "s/__SCRIPT_COMMIT_SHA/$commit_sha/g" "$output_file"

printf 'Built %s\n' "$output_file"
