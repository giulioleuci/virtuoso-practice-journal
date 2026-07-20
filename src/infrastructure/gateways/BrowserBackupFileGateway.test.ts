import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserBackupFileGateway } from "./BrowserBackupFileGateway";

describe("BrowserBackupFileGateway", () => {
  afterEach(() => vi.restoreAllMocks());

  it("downloads backup content through a temporary object URL", async () => {
    const createObjectURL = vi.fn(() => "blob:backup");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    await new BrowserBackupFileGateway().save("backup.json", "{\"version\":2}");

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:backup");
  });

  it("reads selected backup text and returns null when picker is cancelled", async () => {
    const gateway = new BrowserBackupFileGateway();
    const click = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function () {
      Object.defineProperty(this, "files", { value: [new File(["backup text"], "backup.json")], configurable: true });
      this.onchange?.(new Event("change"));
    });
    await expect(gateway.pick()).resolves.toBe("backup text");
    expect(click).toHaveBeenCalledOnce();
  });
});
