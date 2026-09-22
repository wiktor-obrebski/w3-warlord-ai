project_owner=$(stat -c '%u:%g' .)

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
        /workspace/wurst
)
