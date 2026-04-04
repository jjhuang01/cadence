interface LxSourceScriptEventNames {
  inited: string;
  request: string;
  updateAlert: string;
}

interface LxSourceScriptHost {
  EVENT_NAMES: LxSourceScriptEventNames;
  env: string;
  on(event: string, handler: (...args: unknown[]) => unknown): void;
  request(...args: unknown[]): never;
  send(event: string, payload: unknown): void;
  utils: Record<string, never>;
  version: string;
}

export interface LxSourceInspectionEntry {
  actions: string[];
  qualitys: string[];
}

export interface LxSourceInspectionResult {
  sources: Record<string, LxSourceInspectionEntry>;
  supportsSearch: boolean;
}

function createNetworkDisabledError(): Error {
  return new Error("network disabled in inspection mode");
}

function disabledNetworkRequest(): never {
  throw createNetworkDisabledError();
}

function createDisabledNetworkClass() {
  return class DisabledNetworkClass {
    constructor() {
      throw createNetworkDisabledError();
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function normalizeSources(value: unknown): Record<string, LxSourceInspectionEntry> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([sourceId, sourceValue]) => {
      if (!isRecord(sourceValue)) {
        return [sourceId, { actions: [], qualitys: [] }];
      }

      return [
        sourceId,
        {
          actions: normalizeStringArray(sourceValue.actions),
          qualitys: normalizeStringArray(sourceValue.qualitys),
        },
      ];
    }),
  );
}

export async function inspectLxSourceScript(
  script: string,
): Promise<LxSourceInspectionResult> {
  let initedPayload: unknown = null;
  let handlers = new Map<string, (...args: unknown[]) => unknown>();
  let eventNames: LxSourceScriptEventNames = {
    inited: "inited",
    request: "request",
    updateAlert: "updateAlert",
  };

  let lx: LxSourceScriptHost = {
    EVENT_NAMES: eventNames,
    env: "desktop",
    on(event, handler) {
      handlers.set(event, handler);
    },
    request() {
      disabledNetworkRequest();
    },
    send(event, payload) {
      if (event === eventNames.inited) {
        initedPayload = payload;
      }
    },
    utils: {},
    version: "0-test",
  };

  let sandboxGlobal = {
    WebSocket: createDisabledNetworkClass(),
    XMLHttpRequest: createDisabledNetworkClass(),
    fetch: disabledNetworkRequest,
    globalThis: undefined as unknown,
    lx,
  };

  sandboxGlobal.globalThis = sandboxGlobal;

  let runner = new Function(
    "globalThis",
    "fetch",
    "XMLHttpRequest",
    "WebSocket",
    '"use strict";\n' + script,
  );

  await Promise.resolve(
    runner(
      sandboxGlobal,
      disabledNetworkRequest,
      sandboxGlobal.XMLHttpRequest,
      sandboxGlobal.WebSocket,
    ),
  );

  if (!isRecord(initedPayload) || !isRecord(initedPayload.sources)) {
    throw new Error("LX script did not send inited sources");
  }

  let sources = normalizeSources(initedPayload.sources);

  return {
    sources,
    supportsSearch: Object.values(sources).some((source) =>
      source.actions.includes("search"),
    ),
  };
}
