import { describe, it, expect } from "vitest";
import { isSafePublicHttpUrl } from "./ssrf";

describe("isSafePublicHttpUrl", () => {
  it("allows public https", () => {
    expect(isSafePublicHttpUrl("https://arxiv.org/pdf/1706.03762.pdf")).toBe(true);
  });
  it("rejects non-http schemes", () => {
    expect(isSafePublicHttpUrl("file:///etc/passwd")).toBe(false);
    expect(isSafePublicHttpUrl("ftp://x/y")).toBe(false);
  });
  it("rejects localhost and loopback", () => {
    expect(isSafePublicHttpUrl("http://localhost/x")).toBe(false);
    expect(isSafePublicHttpUrl("http://127.0.0.1/x")).toBe(false);
  });
  it("rejects private ipv4 ranges", () => {
    expect(isSafePublicHttpUrl("http://10.0.0.5/x")).toBe(false);
    expect(isSafePublicHttpUrl("http://192.168.1.1/x")).toBe(false);
    expect(isSafePublicHttpUrl("http://169.254.169.254/latest")).toBe(false);
  });
  it("rejects garbage", () => {
    expect(isSafePublicHttpUrl("not a url")).toBe(false);
  });
});
