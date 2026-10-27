# Windows PowerShell. Creates a new build only; never starts a server or tunnel.
[CmdletBinding()]
param([string]$Revision = 'b3a5363fe4012c96361ca7b180e098289a1ef16c')
$ErrorActionPreference = 'Stop'
$repository = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Push-Location $repository
$oldApi = $env:NEXT_PUBLIC_API_URL
try {
    git -c core.fsmonitor=false cat-file -e "$Revision^{commit}"
    if ($LASTEXITCODE -ne 0) { throw 'Selected source commit is unavailable' }
    $candidate = Join-Path $repository ('tmp/loopback-frontend-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8))
    New-Item -ItemType Directory -Path $candidate | Out-Null
    $archive = Join-Path $candidate 'source.tar'
    git -c core.fsmonitor=false archive --format=tar "--output=$archive" $Revision frontend backend/src/utils
    if ($LASTEXITCODE -ne 0) { throw 'Source export failed' }
    tar -xf $archive -C $candidate
    if ($LASTEXITCODE -ne 0) { throw 'Source extraction failed' }
    $frontend = Join-Path $candidate 'frontend'
    # Never copy environment files from the working tree. Refuse tracked env files too.
    $envFiles = Get-ChildItem -LiteralPath $candidate -Recurse -File -Force | Where-Object { $_.Name -match '^\.env($|\.)' -and $_.Name -notmatch '\.example$' }
    if ($envFiles) { throw 'Source contains environment files; build refused' }
    New-Item -ItemType Junction -Path (Join-Path $frontend 'node_modules') -Target (Join-Path $repository 'frontend/node_modules') | Out-Null
    # Shared utility imports resolve the root backend packages during compilation.
    New-Item -ItemType Junction -Path (Join-Path $candidate 'backend/node_modules') -Target (Join-Path $repository 'backend/node_modules') | Out-Null
    $env:NEXT_PUBLIC_API_URL = 'http://localhost:5002/api/v1'
    Push-Location $frontend
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) { throw 'Isolated frontend build failed' }
    } finally { Pop-Location }
    Write-Output "Loopback-only frontend prepared: $frontend"
    Write-Output 'Not started. Next manual command: npm run start -- --hostname 127.0.0.1 --port 3002'
} finally {
    $env:NEXT_PUBLIC_API_URL = $oldApi
    Pop-Location
}
