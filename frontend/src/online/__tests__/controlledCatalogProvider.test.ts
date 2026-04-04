import { describe, expect, test } from "vitest";

import {
  DEFAULT_CONTROLLED_CATALOG_LIMIT,
  searchControlledCatalog,
} from "../controlledCatalogProvider";

describe("searchControlledCatalog", () => {
  test("matches tokens across title and artist", () => {
    let result = searchControlledCatalog("blue soundhelix");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      sourceId: "controlled-demo",
      title: "Blue Sky Drive",
      trackId: "blue-sky-drive",
    });
  });

  test("returns empty result for blank query", () => {
    expect(searchControlledCatalog("   ")).toEqual([]);
  });

  test("applies explicit result limit", () => {
    let result = searchControlledCatalog("soundhelix", { limit: 3 });

    expect(result).toHaveLength(3);
  });

  test("uses default result limit when limit is not provided", () => {
    let result = searchControlledCatalog("soundhelix");

    expect(result.length).toBeLessThanOrEqual(DEFAULT_CONTROLLED_CATALOG_LIMIT);
  });
});
