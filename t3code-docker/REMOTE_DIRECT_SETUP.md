# Remote Direct Setup

This flow uses Docker only on your Mac as a Linux build environment. The remote machine runs T3 Code directly on the host, not inside Docker.

That matters for Claude auth: T3 Code runs as your normal remote user, so it can use the same `claude` install and auth state that already works in your SSH session.

## What this produces

The build creates a tarball with:

- a Linux `x86_64` Node runtime
- built T3 Code server files
- built web UI assets bundled into the server
- Linux-built `node_modules`
- a launcher script for the remote host

Output file:

- `t3code-docker/out/t3code-remote-linux-x64.tar.gz`

## 1) Build the Linux bundle on your Mac

From the repo root:

```bash
bash t3code-docker/build-remote-bundle.sh
```

Optional: pin a different Node version for the bundled runtime.

```bash
NODE_VERSION=24.13.1 bash t3code-docker/build-remote-bundle.sh
```

## 2) Copy the bundle to the remote host

```bash
scp t3code-docker/out/t3code-remote-linux-x64.tar.gz user@remote:~/
```

## 3) Unpack it on the remote host

SSH into the remote host and run:

```bash
mkdir -p "$HOME/t3code-remote"
tar -xzf ~/t3code-remote-linux-x64.tar.gz -C "$HOME/t3code-remote"
```

That gives you:

- `$HOME/t3code-remote/node`
- `$HOME/t3code-remote/t3code`
- `$HOME/t3code-remote/run-t3code.sh`

## 4) Start T3 Code directly on the remote host

From the workspace you want T3 Code to operate on:

```bash
cd /path/to/your/workspace
T3CODE_PORT=3773 T3CODE_HOST=127.0.0.1 "$HOME/t3code-remote/run-t3code.sh"
```

Or pass the workspace explicitly:

```bash
T3CODE_PORT=3773 T3CODE_HOST=127.0.0.1 "$HOME/t3code-remote/run-t3code.sh" /path/to/your/workspace
```

Defaults:

- host: `127.0.0.1`
- port: `3773`
- state dir: `$HOME/.t3code-remote`

## 5) Tunnel the port back to your Mac

On your Mac:

```bash
ssh -L 3773:127.0.0.1:3773 user@remote
```

Then open:

```text
http://localhost:3773
```

## 6) Verify Claude works on the remote host

Because T3 Code is running directly on the host, it should see the same Claude auth that works in your shell.

Quick checks on the remote host:

```bash
which claude
claude --help
```

If needed, set the Claude binary path in T3 Code settings to the exact output of `which claude`.

## Updating later

On your Mac:

```bash
bash t3code-docker/build-remote-bundle.sh
scp t3code-docker/out/t3code-remote-linux-x64.tar.gz user@remote:~/
```

On the remote host:

```bash
rm -rf "$HOME/t3code-remote"
mkdir -p "$HOME/t3code-remote"
tar -xzf ~/t3code-remote-linux-x64.tar.gz -C "$HOME/t3code-remote"
```

## Useful environment variables

- `T3CODE_PORT` - server port, default `3773`
- `T3CODE_HOST` - bind host, default `127.0.0.1`
- `T3CODE_HOME` - state dir, default `$HOME/.t3code-remote`
- `T3CODE_AUTH_TOKEN` - optional WebSocket auth token if you ever expose it beyond SSH tunneling

## Quick sanity checks

On the remote host:

```bash
"$HOME/t3code-remote/node/bin/node" --version
ls "$HOME/t3code-remote/t3code/apps/server/dist"
ps aux | grep 'apps/server/dist/index.mjs'
```
