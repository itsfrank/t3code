import { describe, expect, it } from "vitest";

import { parseDiffRouteSearch } from "./diffRouteSearch";

describe("parseDiffRouteSearch", () => {
  it("parses valid diff search values", () => {
    const parsed = parseDiffRouteSearch({
      diff: "1",
      diffScope: "git",
      diffTurnId: "turn-1",
      diffFilePath: "src/app.ts",
    });

    expect(parsed).toEqual({
      diff: "1",
      diffScope: "git",
      diffTurnId: "turn-1",
      diffFilePath: "src/app.ts",
    });
  });

  it("treats numeric and boolean diff toggles as open", () => {
    expect(
      parseDiffRouteSearch({
        diff: 1,
        diffTurnId: "turn-1",
      }),
    ).toEqual({
      diff: "1",
      diffScope: "session",
      diffTurnId: "turn-1",
    });

    expect(
      parseDiffRouteSearch({
        diff: true,
        diffTurnId: "turn-1",
      }),
    ).toEqual({
      diff: "1",
      diffScope: "session",
      diffTurnId: "turn-1",
    });
  });

  it("drops turn and file values when diff is closed", () => {
    const parsed = parseDiffRouteSearch({
      diff: "0",
      diffTurnId: "turn-1",
      diffFilePath: "src/app.ts",
    });

    expect(parsed).toEqual({});
  });

  it("drops file value when turn is not selected", () => {
    const parsed = parseDiffRouteSearch({
      diff: "1",
      diffFilePath: "src/app.ts",
    });

    expect(parsed).toEqual({
      diff: "1",
      diffScope: "session",
    });
  });

  it("normalizes whitespace-only values", () => {
    const parsed = parseDiffRouteSearch({
      diff: "1",
      diffTurnId: "  ",
      diffFilePath: "  ",
    });

    expect(parsed).toEqual({
      diff: "1",
      diffScope: "session",
    });
  });

  it("defaults diff scope to session when absent", () => {
    expect(
      parseDiffRouteSearch({
        diff: "1",
      }),
    ).toEqual({
      diff: "1",
      diffScope: "session",
    });
  });

  it("drops invalid diff scope values back to session", () => {
    expect(
      parseDiffRouteSearch({
        diff: "1",
        diffScope: "workspace",
      }),
    ).toEqual({
      diff: "1",
      diffScope: "session",
    });
  });

  it("preserves turn and file state in git diff scope", () => {
    expect(
      parseDiffRouteSearch({
        diff: "1",
        diffScope: "git",
        diffTurnId: "turn-1",
        diffFilePath: "src/app.ts",
      }),
    ).toEqual({
      diff: "1",
      diffScope: "git",
      diffTurnId: "turn-1",
      diffFilePath: "src/app.ts",
    });
  });
});
