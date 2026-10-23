import { describe, expect, it } from "vitest";
import { MINT_SOL } from "@/lib/cyber/carteira";
import { PROGRAMA_MEMO, assinar, base58, compactU16, deBase58, montarMensagem, publicaDe, transacaoAssinada } from "./devnetTx";
import crypto from "crypto";

const hex = (s: string) => Uint8Array.from(Buffer.from(s, "hex"));
describe("as transações do cofre (sem SDK)", () => {
  it("ed25519: o vetor 1 da RFC 8032 (semente → pública → assinatura)", () => {
    const semente = hex("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60");
    expect(Buffer.from(publicaDe(semente)).toString("hex")).toBe("d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a");
    expect(Buffer.from(assinar(semente, new Uint8Array())).toString("hex")).toBe("e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b");
  });
  it("base58: ida e volta, zeros à esquerda, endereços conhecidos", () => {
    for (let k = 0; k < 50; k++) { const b = Uint8Array.from(crypto.randomBytes(32)); expect(deBase58(base58(b))).toEqual(b); }
    expect(base58(new Uint8Array(32))).toBe("11111111111111111111111111111111");
    expect(deBase58(MINT_SOL)).toHaveLength(32); expect(base58(deBase58(PROGRAMA_MEMO))).toBe(PROGRAMA_MEMO);
  });
  it("compact-u16 e a mensagem: cabeçalho, contas (pagador, destino, programas), instruções", () => {
    expect(compactU16(0)).toEqual([0]); expect(compactU16(127)).toEqual([0x7f]); expect(compactU16(128)).toEqual([0x80, 0x01]); expect(compactU16(16383)).toEqual([0xff, 0x7f]);
    const semente = hex("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60"), pagador = base58(publicaDe(semente)), bh = base58(new Uint8Array(32).fill(7)), destino = "86xCnPeV69n6t3DnyGvkKobf9FdN2H9oiVDdaMpo2MMY";
    const m = montarMensagem(pagador, bh, [{ memo: "oi" }, { transferir: { para: destino, lamports: 5n } }]);
    expect([...m.slice(0, 4)]).toEqual([1, 0, 2, 4]);   // 1 assinante, 0 assinante só-leitura, 2 programas só-leitura, 4 contas
    expect(base58(m.slice(4, 36))).toBe(pagador); expect(base58(m.slice(36, 68))).toBe(destino);
    const tx = transacaoAssinada(semente, bh, [{ memo: "oi" }]), bytes = Buffer.from(tx.base64, "base64");
    expect(bytes[0]).toBe(1); expect(base58(bytes.subarray(1, 65))).toBe(tx.assinatura);
    expect(crypto.verify(null, bytes.subarray(65), crypto.createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(publicaDe(semente))]), format: "der", type: "spki" }), bytes.subarray(1, 65))).toBe(true);
  });
});
