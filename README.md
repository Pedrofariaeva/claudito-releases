# Claudito Releases

Public installers for Claudito. The source code repository is private.

**These commands always install the newest version.** They carry no version
number, so they never go out of date — see *Latest version* below.

## Windows — one line

Open PowerShell and run:

```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force; irm https://github.com/Pedrofariaeva/claudito-releases/releases/latest/download/install.ps1 | iex; Read-Host "Press Enter to close"
```

## macOS / Linux — one line

Open Terminal and run:

```bash
curl -fsSL https://github.com/Pedrofariaeva/claudito-releases/releases/latest/download/claudito-macos.tar.gz -o claudito.tar.gz && tar -xzf claudito.tar.gz && cd claudito-external-v* && ./install.sh
```

The installer opens Claudito when it finishes. Afterwards, start it with `clt`.
If `clt` is not recognised, close the terminal and open a new one.

## Latest version

See **[Releases](https://github.com/Pedrofariaeva/claudito-releases/releases)**.
The newest release is the only one you should install; older ones are kept for
reference only.

Claudito updates itself: every time you run `clt` it checks for a newer version
and installs it. You never need to run the commands above twice.

---

### For maintainers and agents

**Publishing a release is not finished until the web pages agree.** Every
release must:

1. Attach all four versioned assets:
   `claudito-external-v<version>-macos.tar.gz`, `-macos.zip`, `-windows.zip`,
   and `install.ps1`.
2. **Also attach the version-free copies** `claudito-macos.tar.gz` and
   `claudito-windows.zip`. The one-line commands above point at
   `releases/latest/download/<name>`, which only resolves for an asset whose
   name never changes. Omit them and the install commands on this page break.
3. Leave this README's commands untouched — they are version-free by design.
   If a version number ever appears in them again, that is a bug.

Build every platform (`--platform all`), or the Windows assets are missing and
the Windows one-liner returns 404.
