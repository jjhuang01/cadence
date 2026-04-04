import { describe, expect, test } from "vitest";

import { inspectLxSourceScript } from "../lxScriptContract";
import {
  lxNetworkOnInitFixture,
  lxResolverFixture,
} from "./fixtures/lxResolver.fixture";

describe("inspectLxSourceScript", () => {
  test("extracts supported actions from inited payload", async () => {
    let result = await inspectLxSourceScript(lxResolverFixture);

    expect(result.sources.kw.actions).toEqual(["musicUrl"]);
    expect(result.sources.kw.qualitys).toEqual(["128k"]);
  });

  test("marks search as unsupported for LX custom source contract", async () => {
    let result = await inspectLxSourceScript(lxResolverFixture);

    expect(result.supportsSearch).toBe(false);
  });

  test("blocks real network requests during inspection", async () => {
    await expect(inspectLxSourceScript(lxNetworkOnInitFixture)).rejects.toThrow(
      "network disabled in inspection mode",
    );
  });
});
