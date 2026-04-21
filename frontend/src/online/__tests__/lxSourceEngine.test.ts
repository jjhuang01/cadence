import { describe, expect, test, vi } from "vitest";

vi.mock("../../utils/runtimeLog", () => ({
  writeRuntimeLog: vi.fn(async () => {}),
}));

import { LxSourceEngine } from "../lxSourceEngine";

describe("LxSourceEngine", () => {
  test("stays usable when inited event never arrives", async () => {
    vi.useFakeTimers();

    const invokeMock = vi.fn(async () => ({
      status: 200,
      ok: true,
      text: JSON.stringify({ code: 200, data: { url: "https://demo.test/song.mp3" } }),
    }));
    vi.stubGlobal("__TAURI_INTERNALS__", {
      invoke: invokeMock,
      transformCallback: vi.fn(),
      convertFileSrc: vi.fn(),
      ipc: vi.fn(),
      metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main" } },
      plugins: {},
    });

    const engine = new LxSourceEngine();
    const script = `
      const { EVENT_NAMES, on } = globalThis.lx;
      on(EVENT_NAMES.request, async ({ source }) => {
        return source === 'kw' ? 'https://demo.test/song.mp3' : '';
      });
    `;

    const loadPromise = engine.load(script);
    await vi.advanceTimersByTimeAsync(15000);

    await expect(loadPromise).resolves.toBeUndefined();
    expect(engine.isLoaded()).toBe(true);

    await expect(engine.resolveUrl("kw", "123", "128k")).resolves.toBe(
      "https://demo.test/song.mp3",
    );

    vi.useRealTimers();
  });
});
