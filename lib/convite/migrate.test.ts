import { describe, it, expect } from "vitest";
import { buildUserUpdateData } from "./migrate";

describe("buildUserUpdateData", () => {
  it("maps student pending data to user fields", () => {
    const data = buildUserUpdateData({
      name: "Ana Costa",
      age: 20,
      area: "Biologia",
      role: "student",
      subject: null,
      institution: "USP",
      verificationDoc: null,
      referredBy: null,
      inviteCode: "ZA3K-X9QM",
      myInviteCode: "NEW1-CODE",
    });
    expect(data.name).toBe("Ana Costa");
    expect(data.course).toBe("Biologia");
    expect(data.role).toBe("student");
    expect(data.subject).toBeUndefined();
    expect(data.inviteCodeUsed).toBe("ZA3K-X9QM");
    expect(data.myInviteCode).toBe("NEW1-CODE");
  });

  it("maps teacher pending data and includes subject", () => {
    const data = buildUserUpdateData({
      name: "João Silva",
      age: 35,
      area: "Ciências Exatas",
      role: "teacher",
      subject: "Química",
      institution: "UNICAMP",
      verificationDoc: null,
      referredBy: "owner-id-123",
      inviteCode: "BX7P-R2NV",
      myInviteCode: "NEW2-CODE",
    });
    expect(data.course).toBe("Ciências Exatas");
    expect(data.subject).toBe("Química");
    expect(data.referredBy).toBe("owner-id-123");
  });

  it("includes verificationDoc when provided", () => {
    const data = buildUserUpdateData({
      name: "Maria",
      age: 22,
      area: "Medicina",
      role: "student",
      subject: null,
      institution: "UNIFESP",
      verificationDoc: "data:image/jpeg;base64,abc123",
      referredBy: null,
      inviteCode: "ZA3K-X9QM",
      myInviteCode: "NEW3-CODE",
    });
    expect(data.verificationDoc).toBe("data:image/jpeg;base64,abc123");
  });
});
