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
  it("rejects IPv6 loopback via bracket notation", () => {
    expect(isSafePublicHttpUrl("http://[::1]/x")).toBe(false);
  });
  it("rejects IPv6 link-local via bracket notation", () => {
    expect(isSafePublicHttpUrl("http://[fe80::1]/x")).toBe(false);
  });
  it("rejects IPv6 ULA fc:: range via bracket notation", () => {
    expect(isSafePublicHttpUrl("http://[fc00::1]/x")).toBe(false);
  });
  it("rejects IPv6 ULA fd:: range via bracket notation", () => {
    expect(isSafePublicHttpUrl("http://[fd00::1]/x")).toBe(false);
  });
  it("rejects IPv4-mapped IPv6 via bracket notation", () => {
    expect(isSafePublicHttpUrl("http://[::ffff:127.0.0.1]/x")).toBe(false);
  });
  it("rejects localhost with trailing dot", () => {
    expect(isSafePublicHttpUrl("http://localhost./x")).toBe(false);
  });
  it("rejects loopback IPv4 with trailing dot", () => {
    expect(isSafePublicHttpUrl("http://127.0.0.1./x")).toBe(false);
  });
  it("still allows a public https URL", () => {
    expect(isSafePublicHttpUrl("https://arxiv.org/pdf/1706.03762.pdf")).toBe(true);
  });
});
