import { describe, it, expect } from "vitest";
import { upsertCitation, type SavedCitation } from "./useSavedCitations";
const c = (id: string): SavedCitation => ({ id, abnt:"A", title:"T", authors:[], savedAt: 1 });
describe("upsertCitation", () => {
  it("adds newest first", () => {
    expect(upsertCitation([c("1")], c("2")).map(x=>x.id)).toEqual(["2","1"]);
  });
  it("dedupes by id (replaces, moves to front)", () => {
    const out = upsertCitation([c("1"), c("2")], { ...c("1"), abnt:"NEW" });
    expect(out.map(x=>x.id)).toEqual(["1","2"]);
    expect(out[0].abnt).toBe("NEW");
  });
});
