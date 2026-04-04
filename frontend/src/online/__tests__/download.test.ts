import { beforeEach, describe, expect, test, vi } from "vitest";

import { downloadOnlineTrack } from "../download";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

describe("download helper", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  test("throws if online stream URL is missing", async () => {
    await expect(
      downloadOnlineTrack({
        title: "No URL",
      }),
    ).rejects.toThrow("missing online stream url");

    expect(invokeMock).not.toHaveBeenCalled();
  });

  test("invokes tauri download command with url and title", async () => {
    invokeMock.mockResolvedValueOnce("/tmp/app/downloads/Blue Sky.mp3");

    let path = await downloadOnlineTrack({
      title: "Blue Sky",
      online_stream_url: "https://demo.test/blue-sky.mp3",
    });

    expect(invokeMock).toHaveBeenCalledWith("download_online_track", {
      url: "https://demo.test/blue-sky.mp3",
      title: "Blue Sky",
    });
    expect(path).toBe("/tmp/app/downloads/Blue Sky.mp3");
  });
});
