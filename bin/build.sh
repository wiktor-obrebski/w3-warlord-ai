#!/usr/bin/env bash
set -euo pipefail

build_dir=_build
bundle=$build_dir/raw-warlord-ai.lua
output=$build_dir/warlord-ai.lua
template=runtime/runtime-template.lua

# build raw bundle
rm -rf $build_dir
npx tstl --luaBundle $bundle

# avoid conflicts with string delimiters inside the bundle
equals='===='
while grep -Fq "]${equals}]" "$bundle"; do
  equals+='='
done

# inject sources to template
while IFS= read -r line || [[ -n "$line" ]]; do
  if [[ "$line" == *'__WARLORD_BUNDLE_SOURCE__'* ]]; then
    printf '    local source = [%s[\n' "$equals"
    cat "$bundle"
    printf '\n]%s]\n' "$equals"
  else
    printf '%s\n' "$line"
  fi

done < "$template" > "$output.tmp"

mv "$output.tmp" "$output"
echo "Generated $output"
