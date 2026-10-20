import { afterEach, describe, expect, it, vi } from "vitest";
import { geminiTextLocation, vertexHost, vertexTextClientOpts } from "./vertex-credentials";

afterEach(() => vi.unstubAllEnvs());

describe("geminiTextLocation", () => {
  it("sem GEMINI_TEXT_LOCATION = comportamento antigo (GOOGLE_LOCATION) — é o rollback", () => {
    vi.stubEnv("GEMINI_TEXT_LOCATION", "");
    vi.stubEnv("GOOGLE_LOCATION", '"us-central1"');
    expect(geminiTextLocation()).toBe("us-central1");
  });

  it("GEMINI_TEXT_LOCATION manda no texto, com ou sem aspas do .env", () => {
    vi.stubEnv("GOOGLE_LOCATION", "us-central1");
    vi.stubEnv("GEMINI_TEXT_LOCATION", '"global"');
    expect(geminiTextLocation()).toBe("global");
  });

  it("nada setado → us-central1", () => {
    vi.stubEnv("GEMINI_TEXT_LOCATION", "");
    vi.stubEnv("GOOGLE_LOCATION", "");
    expect(geminiTextLocation()).toBe("us-central1");
  });
});

describe("vertexHost", () => {
  it("global não tem prefixo de região (global-aiplatform… não existe)", () => {
    expect(vertexHost("global")).toBe("aiplatform.googleapis.com");
  });
  it("região vira prefixo", () => {
    expect(vertexHost("us-central1")).toBe("us-central1-aiplatform.googleapis.com");
  });
});

describe("vertexTextClientOpts", () => {
  it("global leva apiEndpoint explícito (o SDK 1.10 erra o host sozinho)", () => {
    vi.stubEnv("GEMINI_TEXT_LOCATION", "global");
    expect(vertexTextClientOpts()).toEqual({ location: "global", apiEndpoint: "aiplatform.googleapis.com" });
  });
  it("região: só a location, sem apiEndpoint (o SDK monta igual a antes)", () => {
    vi.stubEnv("GEMINI_TEXT_LOCATION", "");
    vi.stubEnv("GOOGLE_LOCATION", "us-central1");
    expect(vertexTextClientOpts()).toEqual({ location: "us-central1" });
  });
});
