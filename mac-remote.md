# Remote Mac Setup

This guide assumes:

- your local machine is a Mac with internet access
- the remote machine is a Mac without internet access
- you want to run T3 Code on the remote machine
- you want to forward its port back to your local Mac over SSH

## 0. Build the mac release artifact on your local Mac

From the repo root on your local Mac:

```bash
bun run dist:desktop:dmg
```

That produces release artifacts in `release/`, including:

- `release/T3-Code-0.0.14-arm64.dmg`
- `release/T3-Code-0.0.14-arm64.zip`

For remote copy/setup, the `.zip` is usually easier than the `.dmg`.

If you need an Intel build instead, run:

```bash
node scripts/build-desktop-artifact.ts --platform mac --target dmg --arch x64
```

Then use the matching `release/T3-Code-*-x64.zip` artifact below.

## 1. Check the remote Mac architecture

Run this on the remote Mac:

```bash
uname -m
```

Use the matching artifact:

- `arm64` -> `release/T3-Code-0.0.14-arm64.zip`
- `x86_64` -> build and use the x64 artifact instead

## 2. Copy the app to the remote Mac

From your local Mac:

```bash
scp release/T3-Code-0.0.14-arm64.zip user@remote-mac:~/
```

Replace `user@remote-mac` with your actual SSH target.

## 3. Unpack the app on the remote Mac

On the remote Mac:

```bash
cd ~
unzip -o T3-Code-0.0.14-arm64.zip
```

This should give you `T3 Code.app`.

## 4. Launch T3 Code on a fixed port

On the remote Mac:

```bash
T3CODE_DESKTOP_BACKEND_PORT=3773 "$HOME/T3 Code.app/Contents/MacOS/T3 Code"
```

Notes:

- this app build now requires `T3CODE_DESKTOP_BACKEND_PORT`
- it exits if the port is missing, invalid, or already in use
- the remote Mac does not need Node.js installed for this packaged app to run

## 5. Forward the port back to your local Mac

From your local Mac:

```bash
ssh -L 3773:127.0.0.1:3773 user@remote-mac
```

Keep that SSH session open.

## 6. Open T3 Code in your local browser

On your local Mac, open:

```text
http://localhost:3773
```

## Optional: run it in the background on the remote Mac

On the remote Mac:

```bash
nohup env T3CODE_DESKTOP_BACKEND_PORT=3773 "$HOME/T3 Code.app/Contents/MacOS/T3 Code" >/tmp/t3code.log 2>&1 &
```

Then inspect logs with:

```bash
tail -f /tmp/t3code.log
```

## Troubleshooting

- `address already in use` -> choose another port and use the same port in both the app launch command and SSH tunnel
- app does not open because of Gatekeeper -> right-click the app in Finder and choose Open, or remove quarantine with:

```bash
xattr -dr com.apple.quarantine "$HOME/T3 Code.app"
```

- remote Mac is Intel -> do not use the arm64 zip; build/copy the x64 artifact instead
