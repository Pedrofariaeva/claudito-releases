# Claudito Windows Installer
# One-liner:
#   Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force; irm https://raw.githubusercontent.com/Pedrofariaeva/claudito-releases/master/install.ps1 | iex
#
# Downloads and installs Claudito automatically. No manual extraction.

$ErrorActionPreference = "Stop"

$ReleaseRepo = "Pedrofariaeva/claudito-releases"
$Version = "v2.2.0"
$ZipName = "claudito-external-v2.2.0-windows.zip"
$DownloadUrl = "https://github.com/$ReleaseRepo/releases/download/$Version/$ZipName"

$TempDir = Join-Path $env:TEMP "claudito-install-$(Get-Random)"
$ZipPath = Join-Path $TempDir $ZipName
$ConfigDir = Join-Path $env:APPDATA "claudito"

function Test-Command {
    param([string]$Name)
    return [bool](Get-Command -Name $Name -ErrorAction SilentlyContinue)
}

function Get-PythonExe {
    if (Test-Command "python3") { return "python3" }
    if (Test-Command "python") { return "python" }
    return $null
}

Write-Host ""
Write-Host "============================================="
Write-Host "  Claudito Windows Installer"
Write-Host "  Version: $Version"
Write-Host "============================================="
Write-Host ""

# ─── Ensure winget is available ──────────────────────────────────────

if (-not (Test-Command "winget")) {
    Write-Host "  ✗ winget is not available. Install manually:" -ForegroundColor Red
    Write-Host "    Python: https://www.python.org/downloads/"
    Write-Host "    Ollama: https://ollama.com/download/windows"
    exit 1
}
Write-Host "  ✓ Found winget"

# ─── Install Python if missing ───────────────────────────────────────

if (-not (Get-PythonExe)) {
    Write-Host "  → Installing Python..."
    & winget install --id Python.Python.3.11 --scope user --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ✗ Python installation failed." -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✓ Python installed. If the next step fails, close and reopen PowerShell, then run 'clt'."
}

$Python = Get-PythonExe
if (-not $Python) {
    Write-Host "  ✗ Python not found on PATH. Reopen PowerShell and try again." -ForegroundColor Red
    exit 1
}

& $Python -m pip --version | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ pip not found. Reinstall Python with 'Add Python to PATH' checked." -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Found Python + pip"

# ─── Install Ollama if missing ───────────────────────────────────────

if (-not (Test-Command "ollama")) {
    Write-Host "  → Installing Ollama..."
    & winget install --id Ollama.Ollama --scope user --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ⚠ Ollama install skipped. Install later from https://ollama.com/download/windows" -ForegroundColor Yellow
    } else {
        Write-Host "  ✓ Ollama installed"
    }
} else {
    Write-Host "  ✓ Found Ollama"
}

# ─── Download and extract Claudito ───────────────────────────────────

Write-Host "  → Downloading Claudito $Version ..."
New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

try {
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipPath -UseBasicParsing
} catch {
    Write-Host "  ✗ Download failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "  → Extracting..."
try {
    Expand-Archive -Path $ZipPath -DestinationPath $TempDir -Force
} catch {
    Write-Host "  ✗ Extraction failed: $_" -ForegroundColor Red
    exit 1
}

$ExtractedDir = Join-Path $TempDir "claudito-external-v2.2.0"
if (-not (Test-Path $ExtractedDir)) {
    Write-Host "  ✗ Extracted folder not found." -ForegroundColor Red
    exit 1
}

# ─── Install Claudito ────────────────────────────────────────────────

Write-Host "  → Installing Claudito..."
Push-Location $ExtractedDir
& $Python -m pip install . 2>&1 | Out-Host
Pop-Location
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ pip install failed." -ForegroundColor Red
    exit 1
}

# ─── Copy templates and default config ───────────────────────────────

Write-Host "  → Copying templates..."
New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
$TemplateSrc = Join-Path $ExtractedDir "templates"
if (Test-Path $TemplateSrc) {
    Copy-Item -Path "$TemplateSrc\*" -Destination $ConfigDir -Recurse -Force
}
$DefaultConfig = Join-Path $ExtractedDir "default_config" "config.json"
if (Test-Path $DefaultConfig) {
    $ConfigFile = Join-Path $ConfigDir "config.json"
    if (-not (Test-Path $ConfigFile)) {
        Copy-Item -Path $DefaultConfig -Destination $ConfigFile -Force
    }
}

Write-Host ""
Write-Host "============================================="
Write-Host "  Claudito is installed."
Write-Host "============================================="
Write-Host ""
Write-Host "  Run this to start:"
Write-Host "    clt"
Write-Host ""
Write-Host "  If 'clt' is not recognized, close PowerShell and open a new window."
Write-Host ""
