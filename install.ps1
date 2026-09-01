# Claudito installer — always installs the newest release.
#
# This file used to be a full installer pinned to one version, so anyone who
# kept the link installed that old version for ever. It now forwards to the
# installer attached to the latest release, which cannot go stale.
#
#   irm https://raw.githubusercontent.com/Pedrofariaeva/claudito-releases/main/install.ps1 | iex

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

Write-Host ""
Write-Host "  Fetching the latest Claudito installer..."

$latest = "https://github.com/Pedrofariaeva/claudito-releases/releases/latest/download/install.ps1"
try {
    $script = (Invoke-WebRequest -Uri $latest -UseBasicParsing).Content
} catch {
    Write-Host "  Could not download the installer: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Check your internet connection, or download it manually from:"
    Write-Host "    https://github.com/Pedrofariaeva/claudito-releases/releases/latest"
    exit 1
}

Invoke-Expression $script
