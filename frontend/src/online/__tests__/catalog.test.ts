import { afterEach, describe, expect, test, vi } from "vitest";

import { searchCatalog } from "../catalog";
import * as musicSearch from "../musicSearch";
import { DEFAULT_SOURCE_CONFIG, type LoadedSourceMeta } from "../sourceConfig";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const FAKE_SOURCE: LoadedSourceMeta = {
  id: "test-src",
  name: "测试音源",
  scriptContent: "",
  apiBaseUrl: "https://example.com",
};

const FAKE_SOURCE_NO_API: LoadedSourceMeta = {
  id: "test-src-2",
  name: "无API音源",
  scriptContent: "",
  apiBaseUrl: "",
};

const CONFIG_WITH_SOURCE = { ...DEFAULT_SOURCE_CONFIG, loadedSources: [FAKE_SOURCE] };
const CONFIG_WITH_SOURCE_NO_API = { ...DEFAULT_SOURCE_CONFIG, loadedSources: [FAKE_SOURCE_NO_API] };
const CONFIG_WITH_API = { ...DEFAULT_SOURCE_CONFIG, apiBaseUrl: "https://api.example.com" };

describe("searchCatalog", () => {
  test("uses searchViaLxApi when source has apiBaseUrl, maps results to Track", async () => {
    vi.spyOn(musicSearch, "searchViaLxApi").mockResolvedValue([
      { id: "123", name: "晴天", artist: "周杰伦", album: "叶惠美", source: "wy", duration: 0 },
    ]);

    const result = await searchCatalog("晴天", CONFIG_WITH_SOURCE, "wy");

    expect(result).toEqual([
      {
        path: "",
        title: "晴天",
        subtitle: "周杰伦",
        online_album: "叶惠美",
        duration_secs: undefined,
        is_online: true,
        online_id: "123",
        online_source_id: "wy",
        online_stream_url: undefined,
      },
    ]);
  });

  test("uses searchMusic when only legacy apiBaseUrl is configured", async () => {
    vi.spyOn(musicSearch, "searchMusic").mockResolvedValue([
      { id: "456", name: "稻香", artist: "周杰伦", album: "魔杰座", source: "wy", duration: 0 },
    ]);

    const result = await searchCatalog("稻香", CONFIG_WITH_API, "wy");

    expect(result[0].online_id).toBe("456");
  });

  test("falls back to searchNetease163 when no source configured (wy platform)", async () => {
    vi.spyOn(musicSearch, "searchNetease163").mockResolvedValue([
      { id: "789", name: "稻香", artist: "周杰伦", album: "魔杰座", source: "wy", duration: 0 },
    ]);
    const result = await searchCatalog("稻香", DEFAULT_SOURCE_CONFIG, "wy");
    expect(result[0].online_id).toBe("789");
  });

  test("falls back to searchNetease163 when source API returns empty", async () => {
    vi.spyOn(musicSearch, "searchViaLxApi").mockResolvedValue([]);
    vi.spyOn(musicSearch, "searchNetease163").mockResolvedValue([
      { id: "111", name: "晴天", artist: "周杰伦", album: "叶惠美", source: "wy", duration: 0 },
    ]);
    const result = await searchCatalog("晴天", CONFIG_WITH_SOURCE, "wy");
    expect(result[0].online_id).toBe("111");
  });

  test("falls back to searchNetease163 when source API throws", async () => {
    vi.spyOn(musicSearch, "searchViaLxApi").mockRejectedValue(new Error("500 error"));
    vi.spyOn(musicSearch, "searchNetease163").mockResolvedValue([
      { id: "222", name: "青花瓷", artist: "周杰伦", album: "我很忙", source: "wy", duration: 0 },
    ]);
    const result = await searchCatalog("青花瓷", CONFIG_WITH_SOURCE, "wy");
    expect(result[0].online_id).toBe("222");
  });

  test("returns empty array for kw platform with no source configured", async () => {
    await expect(searchCatalog("anything", DEFAULT_SOURCE_CONFIG, "kw")).resolves.toEqual([]);
  });

  test("returns empty array for kg platform with no source configured", async () => {
    await expect(searchCatalog("anything", DEFAULT_SOURCE_CONFIG, "kg")).resolves.toEqual([]);
  });
});
