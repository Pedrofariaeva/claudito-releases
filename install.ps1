# Claudito Windows Installer
# One-liner:
#   Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force; irm https://raw.githubusercontent.com/Pedrofariaeva/claudito-releases/master/install.ps1 | iex

$ErrorActionPreference = "Stop"

$ReleaseRepo = "Pedrofariaeva/claudito-releases"
$Version = "v2.2.1"
$ZipName = "claudito-external-v2.2.1-windows.zip"
$DownloadUrl = "https://github.com/$ReleaseRepo/releases/download/$Version/$ZipName"

$TempDir = Join-Path $env:TEMP "claudito-install-$(Get-Random)"
$ZipPath = Join-Path $TempDir $ZipName
$ConfigDir = Join-Path $env:APPDATA "claudito"
$LogFile = Join-Path $env:TEMP "claudito-install.log"

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "HH:mm:ss"
    "$timestamp  $Message" | Tee-Object -FilePath $LogFile -Append | Write-Host
}

function Test-Command {
    param([string]$Name)
    return [bool](Get-Command -Name $Name -ErrorAction SilentlyContinue)
}

function Refresh-Path {
    # Reload PATH from registry so newly installed apps are found in this session
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath"
}

function Test-PythonHasPip {
    param([string]$PythonExe)
    & $PythonExe -m pip --version 2>&1 | Out-Null
    return $LASTEXITCODE -eq 0
}

function Find-PythonExe {
    Refresh-Path

    # On Windows, 'python3' is often a broken Microsoft Store shim. Prefer 'python'.
    $commands = @("python", "python3")
    foreach ($cmd in $commands) {
        if (Test-Command $cmd) {
            if (Test-PythonHasPip $cmd) {
                return $cmd
            }
        }
    }

    # Common Python install paths from winget
    $candidates = @(
        Join-Path $env:LOCALAPPDATA "Programs\Python\Python311\python.exe"
        Join-Path $env:LOCALAPPDATA "Programs\Python\Python310\python.exe"
        Join-Path $env:LOCALAPPDATA "Programs\Python\Python39\python.exe"
        "C:\Python311\python.exe"
        "C:\Python310\python.exe"
        "C:\Python39\python.exe"
    )
    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            if (Test-PythonHasPip $candidate) {
                return $candidate
            }
        }
    }
    return $null
}

try {
    # Ensure TLS 1.2 is enabled for downloads on older Windows
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    Write-Log ""
    Write-Log "============================================="
    Write-Log "  Claudito Windows Installer"
    Write-Log "  Version: $Version"
    Write-Log "============================================="
    Write-Log ""

    # ─── Ensure winget is available ──────────────────────────────────────

    if (-not (Test-Command "winget")) {
        throw "winget is not available. Install Python and Ollama manually.`n  Python: https://www.python.org/downloads/`n  Ollama: https://ollama.com/download/windows"
    }
    Write-Log "  ✓ Found winget"

    # ─── Install Python if missing ───────────────────────────────────────

    $Python = Find-PythonExe
    if (-not $Python) {
        Write-Log "  → Installing Python..."
        & winget install --id Python.Python.3.11 --scope user --accept-source-agreements --accept-package-agreements
        if ($LASTEXITCODE -ne 0) {
            throw "Python installation failed. Install manually from https://www.python.org/downloads/"
        }
        Write-Log "  ✓ Python installed via winget"

        # Try again to find Python (refresh PATH + common paths)
        $Python = Find-PythonExe
        if (-not $Python) {
            throw "Python was installed but is not on PATH. Close PowerShell, reopen it, and run 'clt'."
        }
    }

    Write-Log "  ✓ Using Python: $Python"

    # ─── Ensure pip is available ─────────────────────────────────────────

    if (-not (Test-PythonHasPip $Python)) {
        Write-Log "  → pip not found; trying to install it..."
        & $Python -m ensurepip --default-pip 2>&1 | Out-Null
        if (-not (Test-PythonHasPip $Python)) {
            throw "pip is missing. Reinstall Python from https://www.python.org/downloads/ and check 'Add Python to PATH'."
        }
        Write-Log "  ✓ pip installed via ensurepip"
    }
    Write-Log "  ✓ Found pip"

    # ─── Install Ollama if missing ───────────────────────────────────────

    if (-not (Test-Command "ollama")) {
        Write-Log "  → Installing Ollama..."
        & winget install --id Ollama.Ollama --scope user --accept-source-agreements --accept-package-agreements
        if ($LASTEXITCODE -ne 0) {
            Write-Log "  ⚠ Ollama install skipped. Install later from https://ollama.com/download/windows"
        } else {
            Write-Log "  ✓ Ollama installed"
        }
    } else {
        Write-Log "  ✓ Found Ollama"
    }

    # ─── Download and extract Claudito ───────────────────────────────────

    Write-Log "  → Downloading Claudito $Version ..."
    New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

    try {
        Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipPath -UseBasicParsing
    } catch {
        throw "Download failed: $_"
    }

    Write-Log "  → Extracting..."
    try {
        Expand-Archive -Path $ZipPath -DestinationPath $TempDir -Force
    } catch {
        throw "Extraction failed: $_"
    }

    $ExtractedDir = Join-Path $TempDir "claudito-external-v2.2.1"
    if (-not (Test-Path $ExtractedDir)) {
        throw "Extracted folder not found at $ExtractedDir"
    }

    # ─── Install Claudito ────────────────────────────────────────────────

    Write-Log "  → Installing Claudito..."
    Push-Location $ExtractedDir
    & $Python -m pip install . 2>&1 | Tee-Object -FilePath $LogFile -Append | Out-Host
    Pop-Location
    if ($LASTEXITCODE -ne 0) {
        throw "pip install failed."
    }

    # ─── Copy templates and default config ───────────────────────────────

    Write-Log "  → Copying templates..."
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

    Write-Log ""
    Write-Log "============================================="
    Write-Log "  Claudito is installed."
    Write-Log "============================================="
    Write-Log ""
    Write-Log "  Run this to start:"
    Write-Log "    clt"
    Write-Log ""
    Write-Log "  If 'clt' is not recognized, close PowerShell and open a new window."
    Write-Log ""
} catch {
    Write-Log ""
    Write-Log "============================================="
    Write-Log "  INSTALLATION FAILED"
    Write-Log "============================================="
    Write-Log ""
    Write-Log "  Error: $_"
    Write-Log ""
    Write-Log "  Full log saved to:"
    Write-Log "    $LogFile"
    Write-Log ""
    Write-Log "  Please send that log file or a screenshot of this window."
    Write-Log ""
    Read-Host "  Press Enter to close"
    exit 1
}
