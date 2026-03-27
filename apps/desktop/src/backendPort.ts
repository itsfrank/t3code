import * as Effect from "effect/Effect";
import { NetService } from "@t3tools/shared/Net";

export const DESKTOP_BACKEND_PORT_ENV = "T3CODE_DESKTOP_BACKEND_PORT";
const LOOPBACK_HOST = "127.0.0.1";

export class DesktopBackendPortError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DesktopBackendPortError";
  }
}

export function parseDesktopBackendPort(value: string | undefined): number {
  const normalized = value?.trim();
  if (!normalized) {
    throw new DesktopBackendPortError(
      `${DESKTOP_BACKEND_PORT_ENV} is required and must be set to a TCP port.`,
    );
  }

  if (!/^\d+$/.test(normalized)) {
    throw new DesktopBackendPortError(
      `${DESKTOP_BACKEND_PORT_ENV} must be an integer between 1 and 65535.`,
    );
  }

  const port = Number(normalized);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new DesktopBackendPortError(
      `${DESKTOP_BACKEND_PORT_ENV} must be an integer between 1 and 65535.`,
    );
  }

  return port;
}

export const requireDesktopBackendPort = (env: NodeJS.ProcessEnv) =>
  Effect.gen(function* () {
    const port = parseDesktopBackendPort(env[DESKTOP_BACKEND_PORT_ENV]);
    const net = yield* NetService;
    const available = yield* net.canListenOnHost(port, LOOPBACK_HOST);
    if (!available) {
      return yield* Effect.fail(
        new DesktopBackendPortError(
          `${DESKTOP_BACKEND_PORT_ENV}=${port} is unavailable on ${LOOPBACK_HOST}.`,
        ),
      );
    }
    return port;
  });
