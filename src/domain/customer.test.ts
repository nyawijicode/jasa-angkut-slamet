import { describe, expect, it } from "vitest";
import { validateCustomer } from "./customer";

describe("validateCustomer", () => {
  it("requires a name that is not only whitespace", () => {
    expect(validateCustomer({ name: "", phone: "081327623942" }).nameMissing).toBe(
      true,
    );
    expect(
      validateCustomer({ name: "   ", phone: "081327623942" }).nameMissing,
    ).toBe(true);
  });

  it("rejects an empty or malformed phone number", () => {
    expect(validateCustomer({ name: "Budi", phone: "" }).phoneInvalid).toBe(true);
    expect(validateCustomer({ name: "Budi", phone: "123" }).phoneInvalid).toBe(
      true,
    );
    expect(
      validateCustomer({ name: "Budi", phone: "0813" }).phoneInvalid,
    ).toBe(true);
  });

  it("accepts local and international phone formats", () => {
    for (const phone of [
      "081327623942",
      "0813-2762-3942",
      "+62 813 2762 3942",
      "6281327623942",
    ]) {
      expect(validateCustomer({ name: "Budi", phone }).phoneInvalid).toBe(false);
    }
  });

  it("is valid only when both fields pass", () => {
    expect(
      validateCustomer({ name: "Budi", phone: "081327623942" }).valid,
    ).toBe(true);
    expect(validateCustomer({ name: "Budi", phone: "" }).valid).toBe(false);
    expect(
      validateCustomer({ name: " ", phone: "081327623942" }).valid,
    ).toBe(false);
  });
});
