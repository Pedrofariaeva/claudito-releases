# Claudito Releases

Public releases and installers for Claudito. The source code repository is private.

## Windows — one line

Open PowerShell and run:

```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force; irm https://github.com/Pedrofariaeva/claudito-releases/releases/download/v2.2.9/install.ps1 | iex; Read-Host "Press Enter to close"
```

Then run `clt`.

If `clt` is not recognized, close PowerShell and open a new window.

## macOS / Linux — one line

Open Terminal and run:

```bash
curl -fsSL https://github.com/Pedrofariaeva/claudito-releases/releases/download/v2.2.9/claudito-external-v2.2.9-macos.tar.gz -o claudito.tar.gz && tar -xzf claudito.tar.gz && cd claudito-external-v2.2.9 && ./install.sh
```

Then run `clt`.
