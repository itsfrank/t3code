# Remote Mac Setup

This guide assumes:

- your local machine is a Mac with internet access
- the remote machine is a Mac without internet access
- you want to run T3 Code on the remote machine and open it in your local browser over SSH

## Preferred path: server bundle

The packaged desktop `.app` can fail when started from a non-GUI SSH session on macOS. For remote use over SSH, the better path is a self-contained server bundle.

## 1. Check the remote Mac architecture

Run this on the remote Mac:

```bash
uname -m
```

Results:

- `arm64` -> Apple Silicon
- `x86_64` -> Intel

Important: build the bundle on a Mac with the same architecture as the remote Mac. The bundle includes native Node modules.

## 2. Build the server bundle on your local Mac

From the repo root on your local Mac:

```bash
bun run dist:server:mac
```

That builds web + server assets, downloads an official Node runtime for your current Mac architecture, installs production dependencies into a staging directory, and writes a tarball to `release/`.

Example output:

```text
release/t3-server-mac-arm64-v0.0.14.tar.gz
```

If you need to force the architecture explicitly:

```bash
node scripts/build-mac-server-bundle.ts --arch arm64
```

or:

```bash
node scripts/build-mac-server-bundle.ts --arch x64
```

## 3. Copy the bundle to the remote Mac

From your local Mac:

```bash
scp release/t3-server-mac-arm64-v0.0.14.tar.gz user@remote-mac:~/
```

Replace `user@remote-mac` with your actual SSH target, and replace `arm64` with `x64` if needed.

## 4. Unpack the bundle on the remote Mac

On the remote Mac:

```bash
cd ~
tar -xzf t3-server-mac-arm64-v0.0.14.tar.gz
cd t3-server-mac-arm64-v0.0.14
```

## 5. Start T3 Code on a fixed port

On the remote Mac:

```bash
T3CODE_PORT=3773 ./run-t3-server.sh
```

This launcher starts the bundled Node runtime and runs T3 Code with:

- `--no-browser`
- `--host 127.0.0.1`
- `--port "$T3CODE_PORT"`

If you do not set `T3CODE_PORT`, it defaults to `3773`.

## 6. Forward the port back to your local Mac

From your local Mac:

```bash
ssh -L 3773:127.0.0.1:3773 user@remote-mac
```

Keep that SSH session open.

## 7. Open T3 Code locally

On your local Mac, open:

```text
http://localhost:3773
```

## Optional: run it in the background on the remote Mac

On the remote Mac:

```bash
nohup env T3CODE_PORT=3773 ./run-t3-server.sh >/tmp/t3code.log 2>&1 &
```

Then inspect logs with:

```bash
tail -f /tmp/t3code.log
```

## Troubleshooting

- `address already in use` -> choose another port and use the same port in both `T3CODE_PORT` and the SSH tunnel
- `bad CPU type in executable` -> rebuild the bundle for the remote Mac's architecture
- `codex` not found -> the T3 Code UI can still start, but Codex-backed sessions need the Codex CLI available on the remote machine
