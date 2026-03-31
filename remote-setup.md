# T3 Code — Remote Setup Guide

> **Note:** The commands below are written for a **macOS laptop** as the local machine. If you are running from a Windows local machine, you may need to adapt commands (e.g., use PowerShell equivalents for `scp`, `ssh`, etc.).

---

## Prerequisites

- SSH access to your remote
- A browser on your local machine

---

## Mac Remotes (ARM64)

### 1. Download the artifact (on your laptop)

```sh
curl -L -O "https://github.com/itsfrank/t3code/releases/download/v0.1.0/t3-server-mac-arm64-v0.1.0.tar.gz"
```

### 2. Copy it to your remote

```sh
scp t3-server-mac-arm64-v0.1.0.tar.gz <remote>:~
```

### 3. SSH into your remote and start the T3 server

```sh
ssh <remote>
```

Then, inside the SSH session:

```sh
tar -zxf t3-server-mac-arm64-v0.1.0.tar.gz
./t3-server-mac-arm64-v0.1.0/run-t3-server.sh > t3-server.log 2>&1 & disown
```

> **Note:** Starting the server this way will kill your current SSH session, but the T3 server will keep running in the background.

### 4. Forward the port to your laptop

```sh
ssh -L 3773:127.0.0.1:3773 <remote>
```

### 5. Open T3 Code

Open [http://localhost:3773/](http://localhost:3773/) in your preferred browser.

---

## Windows Remotes (x64)

### 1. Download the artifact (on your laptop)

```sh
curl -L -O "https://github.com/itsfrank/t3code/releases/download/v0.1.0/t3-server-win-x64-v0.1.0.zip"
```

### 2. Copy it to your remote

```sh
scp t3-server-win-x64-v0.1.0.zip <remote>:~
```

### 3. SSH into your remote and extract

```sh
ssh <remote>
```

Then, inside the SSH session (PowerShell):

```powershell
tar -xf .\t3-server-win-x64-v0.1.0.zip
```

### 4. Warm up Claude (important!)

Claude may be slow on first startup and T3 Code will time out if Claude hasn't been initialized. **Run `claude` at least once** before starting the T3 server (you only need to do this once per remote startup):

```powershell
claude
```

### 5. Start the T3 server

```powershell
Start-Process -FilePath "cmd.exe" -ArgumentList '/c', '".\t3-server-win-x64-v0.1.0\run-t3-server.cmd"'
```

### 6. Disconnect and forward the port to your laptop

```sh
ssh -L 3773:127.0.0.1:3773 <remote>
```

### 7. Open T3 Code

Open [http://localhost:3773/](http://localhost:3773/) in your preferred browser.

---

## About This Build

This build is based on the main branch of T3 Code as of ~2 days ago (~60 commits behind current main) and includes the following improvements to the **diff panel**:

- **Red toggle** — Switch between **full git diff mode** and **per turn/session diff mode**.
  - *Full git diff mode* is much more performant on large repos and shows a review view for the entire git diff.
  - *Per turn/session diff mode* is an internally tracked diff in T3 Code that tries to show only the changes the agent made. Per-turn diffs can be useful, but this mode is slower on large repos.
- **Blue toggle** — Collapse or expand all diffs at once.
- **More compact diff view** — The diff layout has been tightened up for a better UX when reviewing larger diffs.
