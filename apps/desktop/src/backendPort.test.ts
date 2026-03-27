import * as Net from "node:net";

import * as Effect from "effect/Effect";
import { describe, expect, it } from "vitest";

import { NetError, NetService } from "@t3tools/shared/Net";
import {
  DESKTOP_BACKEND_PORT_ENV,
  DesktopBackendPortError,
  parseDesktopBackendPort,
  requireDesktopBackendPort,
} from "./backendPort";

const closeServer = async (server: Net.Server) =>
  await Effect.runPromise(
    Effect.sync(() => {
      try {
        server.close();
      } catch {
        // Ignore cleanup failures in tests.
      }
    }),
  );

const getPort = (server: Net.Server): number => {
  const address = server.address();
  return typeof address === "object" && address !== null ? address.port : 0;
};

const openLoopbackServer = async (): Promise<Net.Server> =>
  await Effect.runPromise(
    Effect.callback<Net.Server, NetError>((resume) => {
      const server = Net.createServer();
      let settled = false;

      const settle = (effect: Effect.Effect<Net.Server, NetError>) => {
        if (settled) return;
        settled = true;
        resume(effect);
      };

      server.once("error", (cause) => {
        settle(Effect.fail(new NetError({ message: "Failed to open test server", cause })));
      });

      server.listen(0, "127.0.0.1", () => settle(Effect.succeed(server)));

      return Effect.sync(() => {
        try {
          server.close();
        } catch {
          // Ignore cleanup failures in tests.
        }
      });
    }),
  );

describe("backendPort", () => {
  describe("parseDesktopBackendPort", () => {
    it("parses a valid port", () => {
      expect(parseDesktopBackendPort("3773")).toBe(3773);
    });

    it("rejects a missing port", () => {
      expect(() => parseDesktopBackendPort(undefined)).toThrowError(
        new DesktopBackendPortError(
          `${DESKTOP_BACKEND_PORT_ENV} is required and must be set to a TCP port.`,
        ),
      );
    });

    it("rejects a non-numeric port", () => {
      expect(() => parseDesktopBackendPort("abc")).toThrowError(
        new DesktopBackendPortError(
          `${DESKTOP_BACKEND_PORT_ENV} must be an integer between 1 and 65535.`,
        ),
      );
    });

    it("rejects an out-of-range port", () => {
      expect(() => parseDesktopBackendPort("65536")).toThrowError(
        new DesktopBackendPortError(
          `${DESKTOP_BACKEND_PORT_ENV} must be an integer between 1 and 65535.`,
        ),
      );
    });
  });

  describe("requireDesktopBackendPort", () => {
    it("returns the configured port when it is available", async () => {
      const availablePort = await Effect.runPromise(
        Effect.gen(function* () {
          const net = yield* NetService;
          return yield* net.reserveLoopbackPort();
        }).pipe(Effect.provide(NetService.layer)),
      );

      const port = await Effect.runPromise(
        requireDesktopBackendPort({
          [DESKTOP_BACKEND_PORT_ENV]: String(availablePort),
        }).pipe(Effect.provide(NetService.layer)),
      );

      expect(port).toBe(availablePort);
    });

    it("fails when the configured port is missing", async () => {
      await expect(
        Effect.runPromise(requireDesktopBackendPort({}).pipe(Effect.provide(NetService.layer))),
      ).rejects.toThrowError(
        new DesktopBackendPortError(
          `${DESKTOP_BACKEND_PORT_ENV} is required and must be set to a TCP port.`,
        ),
      );
    });

    it("fails when the configured port is unavailable", async () => {
      const server = await openLoopbackServer();
      const port = getPort(server);

      try {
        await expect(
          Effect.runPromise(
            requireDesktopBackendPort({
              [DESKTOP_BACKEND_PORT_ENV]: String(port),
            }).pipe(Effect.provide(NetService.layer)),
          ),
        ).rejects.toThrowError(
          new DesktopBackendPortError(
            `${DESKTOP_BACKEND_PORT_ENV}=${port} is unavailable on 127.0.0.1.`,
          ),
        );
      } finally {
        await closeServer(server);
      }
    });
  });
});
