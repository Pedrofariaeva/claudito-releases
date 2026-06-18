# Claudito Releases

Public releases and installers for Claudito.

This repository does **not** contain source code. The source code repository is private.

## Windows Install (one command)

1. Open **PowerShell** (press `Win + X`, then choose **Terminal** or **PowerShell**).
2. Copy and paste this entire line, then press **Enter**:

   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force; Invoke-WebRequest -Uri "https://raw.githubusercontent.com/Pedrofariaeva/claudito-releases/master/install.ps1" -OutFile "$env:TEMP\claudito-install.ps1"; & "$env:TEMP\claudito-install.ps1"
   ```

3. Wait for the installer to finish.
4. Run:
   ```powershell
   clt
   ```

If `clt` is not recognized, close PowerShell and open a new window.

## What does the installer do?

- Installs Python 3.11 via `winget` (if not present)
- Installs Ollama via `winget` (if not present)
- Downloads and extracts Claudito from this public releases repo
- Installs Claudito and copies templates/docs to your PC
- Runs `clt --setup` to configure your name, research folder, and optional Kimi key
