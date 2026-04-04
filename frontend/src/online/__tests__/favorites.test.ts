import { beforeEach, describe, expect, test, vi } from "vitest";

import { loadFavorites, saveFavorites } from "../favorites";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

describe("favorites helper", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  test("loads online favorites via tauri command", async () => {
    invokeMock.mockResolvedValueOnce(["demo:1", "demo:2", "demo:1"]);

    let favorites = await loadFavorites();

    expect(invokeMock).toHaveBeenCalledWith("load_online_favorites");
    expect(favorites).toBeInstanceOf(Set);
    expect([...favorites]).toEqual(["demo:1", "demo:2"]);
  });

  test("saves deduplicated favorite ids via tauri command", async () => {
    invokeMock.mockResolvedValueOnce(undefined);

    await saveFavorites(["demo:1", "demo:1", "demo:3"]);

    expect(invokeMock).toHaveBeenCalledWith("save_online_favorites", {
      ids: ["demo:1", "demo:3"],
    });
  });
});
