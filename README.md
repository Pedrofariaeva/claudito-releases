# Claudito Windows Installer

Public Windows installer for Claudito. The source code repository is private.

## Install — one line

Open PowerShell and run:

```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force; irm https://raw.githubusercontent.com/Pedrofariaeva/claudito-releases/master/install.ps1 | iex; Read-Host "Press Enter to close"
```

Wait for it to finish, then run:

```powershell
clt
```

If `clt` is not recognized, close PowerShell and open a new window.

## What it does

- Installs Python 3.11 via `winget` (if missing)
- Installs Ollama via `winget` (if missing)
- Downloads the latest Claudito release from this public repo
- Installs Claudito and copies templates/config to your PC
