# Claudito Windows Installer
# One-liner to run this script:
#   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force; Invoke-WebRequest -Uri "https://raw.githubusercontent.com/Pedrofariaeva/claudito-releases/master/install.ps1" -OutFile "$env:TEMP\claudito-install.ps1"; & "$env:TEMP\claudito-install.ps1"
#
# This script downloads the latest Claudito Windows release, extracts it,
# and runs the local installer. The private source repo is never accessed.

$ErrorActionPreference = "Stop"

$ReleaseRepo = "Pedrofariaeva/claudito-releases"
$Version = "v2.2.0"
$ZipName = "claudito-external-v2.2.0-windows.zip"
$DownloadUrl = "https://github.com/$ReleaseRepo/releases/download/$Version/$ZipName"

$TempDir = Join-Path $env:TEMP "claudito-install-$(Get-Random)"
$ZipPath = Join-Path $TempDir $ZipName

function Test-Command {
    param([string]$Name)
    return [bool](Get-Command -Name $Name -ErrorAction SilentlyContinue)
}

Write-Host ""
Write-Host "============================================="
Write-Host "  Claudito Windows Installer"
Write-Host "  Version: $Version"
Write-Host "============================================="
Write-Host ""

# ─── Ensure winget is available ──────────────────────────────────────

if (-not (Test-Command "winget")) {
    Write-Host "  ✗ winget is not available on this system." -ForegroundColor Red
    Write-Host ""
    Write-Host "  winget is included in Windows 10 version 1809+ and Windows 11."
    Write-Host "  If you see this message, install the prerequisites manually:"
    Write-Host "    Python : https://www.python.org/downloads/"
    Write-Host "    Ollama : https://ollama.com/download/windows"
    Write-Host ""
    exit 1
}
Write-Host "  ✓ Found winget"

# ─── Download release ────────────────────────────────────────────────

Write-Host "  → Downloading Claudito $Version ..."
New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

try {
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipPath -UseBasicParsing
} catch {
    Write-Host "  ✗ Download failed: $_" -ForegroundColor Red
    Write-Host "    URL: $DownloadUrl"
    exit 1
}

Write-Host "  ✓ Downloaded to $ZipPath"

# ─── Extract ─────────────────────────────────────────────────────────

Write-Host "  → Extracting..."
try {
    Expand-Archive -Path $ZipPath -DestinationPath $TempDir -Force
} catch {
    Write-Host "  ✗ Extraction failed: $_" -ForegroundColor Red
    exit 1
}

$ExtractedDir = Join-Path $TempDir "claudito-external-v2.2.0"
if (-not (Test-Path $ExtractedDir)) {
    Write-Host "  ✗ Extracted folder not found at $ExtractedDir" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Extracted to $ExtractedDir"

# ─── Run local installer ─────────────────────────────────────────────

$LocalInstaller = Join-Path $ExtractedDir "install.ps1"
if (-not (Test-Path $LocalInstaller)) {
    Write-Host "  ✗ Local installer not found in extracted archive." -ForegroundColor Red
    exit 1
}

Write-Host "  → Running local installer..."
& $LocalInstaller

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Local installer failed." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "============================================="
Write-Host "  Claudito is ready."
Write-Host "============================================="
Write-Host ""
Write-Host "  Start Claudito: clt"
Write-Host ""
Write-Host "  (Downloaded files are kept at $ExtractedDir"
Write-Host "   for debugging. You can delete this folder.)"
Write-Host ""
