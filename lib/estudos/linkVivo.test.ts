import { describe, expect, it } from "vitest";
import { hostAceitavel, ipPublico, lookupSeguro, vivo } from "./linkVivo";

describe("linkVivo — a checagem de link não vira scanner da rede interna", () => {
  it("IPs internos não passam (inclusive CGNAT da Tailscale e v4 mapeado em v6)", () => {
    for (const ip of ["127.0.0.1", "10.0.0.8", "172.20.1.1", "192.168.0.1", "169.254.169.254", "100.113.137.74", "0.0.0.0", "::1", "::", "fd12::1", "fe80::1", "::ffff:127.0.0.1"]) expect(ipPublico(ip), ip).toBe(false);
    for (const ip of ["8.8.8.8", "140.82.112.3", "2606:4700::1111"]) expect(ipPublico(ip), ip).toBe(true);
  });
  it("host sem ponto (serviço do Docker) e IP literal interno não passam", () => {
    expect(hostAceitavel("web")).toBe(false); expect(hostAceitavel("zaeon_web")).toBe(false);
    expect(hostAceitavel("100.113.137.74")).toBe(false); expect(hostAceitavel("[::1]")).toBe(false);
    expect(hostAceitavel("github.com")).toBe(true);
  });
  it("vivo() recusa sem nem tentar conectar", async () => {
    expect(await vivo("http://web:3000/api")).toBe(false);
    expect(await vivo("http://100.113.137.74:4000/")).toBe(false);
    expect(await vivo("http://localhost:3000/")).toBe(false);
  });
  it("o lookup recusa nome que resolve pra endereço interno", async () => {
    const err = await new Promise<unknown>((r) => lookupSeguro("localhost", {}, (e) => r(e)));
    expect(err).toBeTruthy();
  });
});

describe("baixarPdfSeguro", () => {
  it("recusa host interno e não-http sem conectar", async () => {
    const { baixarPdfSeguro } = await import("./linkVivo");
    expect(await baixarPdfSeguro("http://web:3000/a.pdf", 1e6)).toBeNull();
    expect(await baixarPdfSeguro("http://100.113.137.74:4000/a.pdf", 1e6)).toBeNull();
    expect(await baixarPdfSeguro("file:///etc/passwd", 1e6)).toBeNull();
  });
});
