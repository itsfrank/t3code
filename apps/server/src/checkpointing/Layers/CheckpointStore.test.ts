import * as NodeServices from "@effect/platform-node/NodeServices";
import { CheckpointRef } from "@t3tools/contracts";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { CheckpointStoreLive } from "./CheckpointStore.ts";
import { CheckpointStore } from "../Services/CheckpointStore.ts";
import { GitCore, type ExecuteGitInput, type GitCoreShape } from "../../git/Services/GitCore.ts";

describe("CheckpointStoreLive", () => {
  it("uses an extended timeout for checkpoint capture git commands", async () => {
    const calls: Array<ExecuteGitInput> = [];

    const gitCore = {
      execute: (input) =>
        Effect.sync(() => {
          calls.push(input);

          const command = input.args.join(" ");
          if (command === "rev-parse --verify HEAD") {
            return { code: 0, stdout: "HEAD\n", stderr: "" };
          }
          if (command === "read-tree HEAD") {
            return { code: 0, stdout: "", stderr: "" };
          }
          if (command === "add -A -- .") {
            return { code: 0, stdout: "", stderr: "" };
          }
          if (command === "write-tree") {
            return { code: 0, stdout: "treeoid\n", stderr: "" };
          }
          if (command === "commit-tree treeoid -m t3 checkpoint ref=refs/t3/test") {
            return { code: 0, stdout: "commitoid\n", stderr: "" };
          }
          if (command === "update-ref refs/t3/test commitoid") {
            return { code: 0, stdout: "", stderr: "" };
          }

          throw new Error(`Unexpected git command: ${command}`);
        }),
    } satisfies Pick<GitCoreShape, "execute">;

    const layer = CheckpointStoreLive.pipe(
      Layer.provideMerge(Layer.succeed(GitCore, gitCore as unknown as GitCoreShape)),
      Layer.provideMerge(NodeServices.layer),
    );

    await Effect.runPromise(
      Effect.gen(function* () {
        const checkpointStore = yield* CheckpointStore;
        yield* checkpointStore.captureCheckpoint({
          cwd: "/tmp/workspace",
          checkpointRef: CheckpointRef.makeUnsafe("refs/t3/test"),
        });
      }).pipe(Effect.provide(layer)),
    );

    expect(calls.map((call) => call.timeoutMs)).toEqual([
      undefined,
      300_000,
      300_000,
      300_000,
      300_000,
      300_000,
    ]);
  });
});
