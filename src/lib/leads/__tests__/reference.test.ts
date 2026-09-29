import { describe, expect, it } from "vitest";
import { generateReference, isLeadReference, REFERENCE_ALPHABET } from "@/lib/leads/reference";

describe("generateReference", () => {
  it("produces CX-XXXXXX with 6 unambiguous uppercase alphanumerics", () => {
    const ref = generateReference();
    expect(ref).toMatch(/^CX-[A-HJ-NP-Z2-9]{6}$/);
    expect(isLeadReference(ref)).toBe(true);
  });

  it("never uses the ambiguous characters 0, O, 1, I", () => {
    expect(REFERENCE_ALPHABET).toHaveLength(32);
    for (const forbidden of ["0", "O", "1", "I"]) expect(REFERENCE_ALPHABET).not.toContain(forbidden);
    for (let i = 0; i < 500; i += 1) {
      const body = generateReference().slice(3);
      for (const ch of body) expect(REFERENCE_ALPHABET).toContain(ch);
    }
  });

  it("is effectively unique", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2_000; i += 1) seen.add(generateReference());
    expect(seen.size).toBe(2_000);
  });

  it("supports a custom prefix", () => {
    expect(generateReference("CT")).toMatch(/^CT-[A-HJ-NP-Z2-9]{6}$/);
  });

  it("isLeadReference rejects other shapes", () => {
    expect(isLeadReference("CX-ABC12")).toBe(false);
    expect(isLeadReference("CX-ABC0DE")).toBe(false);
    expect(isLeadReference("cx-ABCDEF")).toBe(false);
    expect(isLeadReference(123)).toBe(false);
  });
});
