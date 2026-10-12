import { describe, expect, it } from "vitest";
import { completeOrder } from "./ordering";

describe("completeOrder", () => {
  it("keeps the requested order and appends items the client didn't know about", () => {
    expect(completeOrder(["b", "a"], ["a", "b", "c"])).toEqual(["b", "a", "c"]);
    expect(completeOrder(["c", "a", "b"], ["a", "b", "c"])).toEqual(["c", "a", "b"]);
  });

  it("rejects unknown or duplicated ids", () => {
    expect(completeOrder(["a", "x"], ["a", "b"])).toBeNull();
    expect(completeOrder(["a", "a"], ["a", "b"])).toBeNull();
  });
});
