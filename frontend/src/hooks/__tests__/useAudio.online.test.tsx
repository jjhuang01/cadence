import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("../../utils/runtimeLog", () => ({
  writeRuntimeLog: vi.fn(async () => {}),
}));

import { useAudio } from "../useAudio";

type MockAudioOptions = {
  play?: ReturnType<typeof vi.fn>;
  pause?: ReturnType<typeof vi.fn>;
};

function installAudioMock(options: MockAudioOptions = {}) {
  let play = options.play ?? vi.fn(() => Promise.resolve());
  let pause = options.pause ?? vi.fn();
  let audioInstances: MockAudio[] = [];

  class MockAudio {
    src = "";
    currentSrc = "";
    currentTime = 0;
    paused = true;
    ended = false;
    duration = 0;
    volume = 1;
    error = null;
    play = play;
    pause = pause;
    load = vi.fn();
    addEventListener = vi.fn();
    removeEventListener = vi.fn();

    constructor() {
      audioInstances.push(this);
    }
  }

  vi.stubGlobal("Audio", MockAudio);

  return {
    play,
    pause,
    getAudioInstance() {
      for (let index = audioInstances.length - 1; index >= 0; index -= 1) {
        let instance = audioInstances[index];
        if (instance.src) {
          return instance;
        }
      }

      let audioInstance = audioInstances[audioInstances.length - 1];
      if (!audioInstance) {
        throw new Error("audio instance was not created");
      }
      return audioInstance;
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useAudio online playback", () => {
  test("plays online track via online_stream_url", () => {
    let audioMock = installAudioMock();
    let { result } = renderHook(() => useAudio());

    act(() => {
      result.current.setTracks([
        {
          path: "/should/not/be/used.mp3",
          title: "Net Song",
          subtitle: "Artist",
          is_online: true,
          online_stream_url: "https://demo.test/song.mp3",
        },
      ]);
      result.current.playAtIndex(0);
    });

    expect(audioMock.getAudioInstance().src).toBe(
      "online://proxy/https%3A%2F%2Fdemo.test%2Fsong.mp3",
    );
    expect(audioMock.play).toHaveBeenCalledOnce();
    expect(result.current.currentIndex).toBe(0);
  });

  test("keeps cloud playback on cached presigned URLs", () => {
    let audioMock = installAudioMock();
    let { result } = renderHook(() => useAudio());

    act(() => {
      result.current.setTracks([
        {
          path: "/ignored.mp3",
          title: "Cloud Song",
          subtitle: "Artist",
          is_cloud: true,
          cloud_key: "tips-music/cloud-song.mp3",
          is_online: true,
          online_stream_url: "https://demo.test/online-fallback.mp3",
        },
      ]);
      result.current.setPresignedUrl(
        "tips-music/cloud-song.mp3",
        "https://signed.example.com/cloud-song.mp3",
      );
      result.current.playAtIndex(0);
    });

    expect(audioMock.getAudioInstance().src).toBe(
      "online://proxy/https%3A%2F%2Fsigned.example.com%2Fcloud-song.mp3",
    );
    expect(audioMock.play).toHaveBeenCalledOnce();
  });

  test("keeps local playback on the stream protocol", () => {
    let audioMock = installAudioMock();
    let { result } = renderHook(() => useAudio());

    act(() => {
      result.current.setTracks([
        {
          path: "/Users/os/Music/Local Song.mp3",
          title: "Local Song",
          subtitle: "Artist",
        },
      ]);
      result.current.playAtIndex(0);
    });

    expect(audioMock.getAudioInstance().src).toBe(
      "stream://localhost/%2FUsers%2Fos%2FMusic%2FLocal%20Song.mp3",
    );
    expect(audioMock.play).toHaveBeenCalledOnce();
  });
});
