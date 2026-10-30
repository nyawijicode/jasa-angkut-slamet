import { describe, expect, it } from "vitest";
import { formatPickupDate, formatPickupTime, formatSchedule } from "./schedule";

describe("schedule formatting", () => {
  it("formats a full Indonesian date", () => {
    expect(formatPickupDate("2026-11-02")).toBe("Senin, 2 November 2026");
  });

  it("rejects impossible dates", () => {
    expect(formatPickupDate("2026-02-31")).toBeNull();
    expect(formatPickupDate("2026-13-01")).toBeNull();
    expect(formatPickupDate("02-11-2026")).toBeNull();
  });

  it("formats time as WIB", () => {
    expect(formatPickupTime("08:00")).toBe("08.00 WIB");
    expect(formatPickupTime("25:00")).toBeNull();
  });

  it("combines date and time, including partial input", () => {
    expect(formatSchedule("2026-11-02", "08:00")).toBe(
      "Senin, 2 November 2026, pukul 08.00 WIB",
    );
    expect(formatSchedule("2026-11-02")).toBe("Senin, 2 November 2026");
    expect(formatSchedule(undefined, "08:00")).toBe("pukul 08.00 WIB");
    expect(formatSchedule()).toBeNull();
  });
});
