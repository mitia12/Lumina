$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot

docker build --pull=false -t lumina-ubuntu-builder:24 -f "$PSScriptRoot/Dockerfile.ubuntu" "$PSScriptRoot"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

docker run --rm --pull=never --shm-size=1g `
  --mount "type=bind,source=$projectDirectory,target=/project" `
  --mount 'type=volume,source=lumina-linux-modules,target=/project/node_modules' `
  --mount 'type=volume,source=lumina-linux-cache,target=/root/.cache' `
  --mount 'type=volume,source=lumina-linux-npm,target=/root/.npm' `
  lumina-ubuntu-builder:24 bash scripts/build-ubuntu.sh
exit $LASTEXITCODE
