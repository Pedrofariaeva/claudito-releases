# Claudito Windows Installer
# One-liner:
#   Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force; irm https://raw.githubusercontent.com/Pedrofariaeva/claudito-releases/master/install.ps1 | iex

$ErrorActionPreference = "Stop"

$ReleaseRepo = "Pedrofariaeva/claudito-releases"
$Version = "v2.2.3"
$ZipName = "claudito-external-v2.2.3-windows.zip"
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

function Show-Popup {
    param(
        [string]$Message,
        [string]$Title = "Claudito Installer",
        [System.Windows.Forms.MessageBoxButtons]$Buttons = [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]$Icon = [System.Windows.Forms.MessageBoxIcon]::Information
    )
    Add-Type -AssemblyName System.Windows.Forms | Out-Null
    return [System.Windows.Forms.MessageBox]::Show($Message, $Title, $Buttons, $Icon)
}

function Refresh-Path {
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath"
}

function Test-PythonHasPip {
    param([string]$PythonExe)
    & $PythonExe -m pip --version 2>&1 | Out-Null
    return $LASTEXITCODE -eq 0
}

function Test-IsMicrosoftStoreAlias {
    param([string]$Name)
    $cmd = Get-Command -Name $Name -ErrorAction SilentlyContinue
    if (-not $cmd) { return $false }
    if ($cmd.Source -like "*\Microsoft\WindowsApps\*") { return $true }
    try {
        $output = & $Name --version 2>&1 | Out-String
    } catch {
        $output = $_ | Out-String
    }
    $storePatterns = @(
        "Microsoft Store",
        "Microsoft.Store",
        "executar sem argumentos para instalar",
        "run without arguments to install",
        "desativar este atalho",
        "disable this shortcut"
    )
    foreach ($pattern in $storePatterns) {
        if ($output -like "*$pattern*") { return $true }
    }
    return $false
}

function Find-RealPython {
    $candidates = @()
    $userBase = Join-Path $env:LOCALAPPDATA "Programs\Python"
    if (Test-Path $userBase) {
        $candidates += Get-ChildItem -Path $userBase -Directory -Filter "Python3*" -ErrorAction SilentlyContinue |
            ForEach-Object { Join-Path $_.FullName "python.exe" }
    }
    $candidates += Get-ChildItem -Path "C:\Program Files\Python*" -Filter "python.exe" -Recurse -ErrorAction SilentlyContinue |
        ForEach-Object { $_.FullName }
    $candidates += Get-ChildItem -Path "C:\Python3*" -Filter "python.exe" -Recurse -ErrorAction SilentlyContinue |
        ForEach-Object { $_.FullName }
    foreach ($exe in $candidates) {
        if ((Test-Path $exe) -and (Test-PythonHasPip $exe)) { return $exe }
    }
    return $null
}

function Disable-MicrosoftStoreAlias {
    param([string]$Name)
    $aliasPath = Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps\$Name.exe"
    if (-not (Test-Path $aliasPath)) { return $true }
    try {
        Remove-Item -Path $aliasPath -Force -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

function Resolve-PythonExe {
    Refresh-Path
    foreach ($name in @("python", "python3")) {
        if ((Test-Command $name) -and -not (Test-IsMicrosoftStoreAlias $name) -and (Test-PythonHasPip $name)) {
            return $name
        }
    }
    $msg = "Windows is redirecting 'python' to the Microsoft Store.`n`n" +
           "Claudito needs the real Python that is already installed on this PC.`n`n" +
           "Remove the Microsoft Store shortcut and continue installation?"
    $answer = Show-Popup -Message $msg -Buttons YesNo -Icon Question
    if ($answer -ne [System.Windows.Forms.DialogResult]::Yes) {
        Write-Log "  Installation cancelled by user."
        exit 0
    }
    foreach ($name in @("python", "python3")) {
        Disable-MicrosoftStoreAlias $name | Out-Null
    }
    Get-Command python, python3 -ErrorAction SilentlyContinue | Out-Null
    foreach ($name in @("python", "python3")) {
        if ((Test-Command $name) -and -not (Test-IsMicrosoftStoreAlias $name) -and (Test-PythonHasPip $name)) {
            return $name
        }
    }
    $realPython = Find-RealPython
    if ($realPython) {
        Write-Log "  → Found real Python at $realPython"
        return $realPython
    }
    return $null
}

function Download-File {
    param(
        [string]$Url,
        [string]$OutPath,
        [int]$MaxRetries = 3
    )
    Write-Log "  → Downloading from:"
    Write-Log "      $Url"
    for ($i = 1; $i -le $MaxRetries; $i++) {
        try {
            Write-Log "  → Attempt $i/$MaxRetries via Invoke-WebRequest..."
            Invoke-WebRequest -Uri $Url -OutFile $OutPath -UseBasicParsing -TimeoutSec 180
            if ((Test-Path $OutPath) -and (Get-Item $OutPath).Length -gt 1024) { return }
        } catch {
            Write-Log "  ⚠ Attempt $i failed: $_"
            if ($i -lt $MaxRetries) { Start-Sleep -Seconds (3 * $i) }
        }
    }
    if (Test-Command "curl.exe") {
        Write-Log "  → Trying curl.exe fallback..."
        try {
            & curl.exe -fsSL -o $OutPath $Url --max-time 180 2>&1 | Out-Null
            if ((Test-Path $OutPath) -and (Get-Item $OutPath).Length -gt 1024) { return }
        } catch {
            Write-Log "  ⚠ curl.exe failed: $_"
        }
    }
    if (Test-Command "bitsadmin.exe") {
        Write-Log "  → Trying bitsadmin fallback..."
        try {
            & bitsadmin.exe /transfer claudito /download /priority normal $Url $OutPath 2>&1 | Out-Null
            if ((Test-Path $OutPath) -and (Get-Item $OutPath).Length -gt 1024) { return }
        } catch {
            Write-Log "  ⚠ bitsadmin failed: $_"
        }
    }
    throw "Could not download file after $MaxRetries attempts and all fallbacks.`nURL: $Url"
}

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    Write-Log ""
    Write-Log "============================================="
    Write-Log "  Claudito Windows Installer"
    Write-Log "  Version: $Version"
    Write-Log "============================================="
    Write-Log ""

    if (-not (Test-Command "winget")) {
        throw "winget is not available. Install Python and Ollama manually.`n  Python: https://www.python.org/downloads/`n  Ollama: https://ollama.com/download/windows"
    }
    Write-Log "  ✓ Found winget"

    $Python = Resolve-PythonExe
    if (-not $Python) {
        Write-Log "  → Python not found. Trying winget..."
        & winget install --id Python.Python.3.11 --scope user --accept-source-agreements --accept-package-agreements
        $Python = Resolve-PythonExe
    }

    if (-not $Python) {
        Write-Log "  → winget did not make Python available. Downloading from python.org..."
        $PythonInstaller = Join-Path $env:TEMP "python-3.11.9-amd64.exe"
        Download-File -Url "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe" -OutPath $PythonInstaller
        Write-Log "  → Running Python installer (this may take a minute)..."
        & $PythonInstaller /quiet InstallAllUsers=0 PrependPath=1 Include_test=0
        if ($LASTEXITCODE -ne 0) { throw "Python installer failed with code $LASTEXITCODE" }
        Start-Sleep -Seconds 5
        $Python = Resolve-PythonExe
    }

    if (-not $Python) {
        throw "Python could not be installed automatically. Install Python 3.11 manually from https://www.python.org/downloads/ and check 'Add Python to PATH'."
    }
    Write-Log "  ✓ Using Python: $Python"

    if (-not (Test-PythonHasPip $Python)) {
        Write-Log "  → pip not found; trying to install it..."
        & $Python -m ensurepip --default-pip 2>&1 | Out-Null
        if (-not (Test-PythonHasPip $Python)) {
            throw "pip is missing. Reinstall Python from https://www.python.org/downloads/ and check 'Add Python to PATH'."
        }
        Write-Log "  ✓ pip installed via ensurepip"
    }
    Write-Log "  ✓ Found pip"

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

    Write-Log "  → Downloading Claudito $Version ..."
    New-Item -ItemType Directory -Path $TempDir -Force | Out-Null
    Download-File -Url $DownloadUrl -OutPath $ZipPath

    Write-Log "  → Extracting..."
    try {
        Expand-Archive -Path $ZipPath -DestinationPath $TempDir -Force
    } catch {
        throw "Extraction failed: $_"
    }

    $ExtractedDir = Join-Path $TempDir "claudito-external-v2.2.3"
    if (-not (Test-Path $ExtractedDir)) {
        throw "Extracted folder not found at $ExtractedDir"
    }

    Write-Log "  → Installing Claudito..."
    Push-Location $ExtractedDir
    & $Python -m pip install . 2>&1 | Tee-Object -FilePath $LogFile -Append | Out-Host
    Pop-Location
    if ($LASTEXITCODE -ne 0) { throw "pip install failed." }

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
