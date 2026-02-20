import { describe, it, expect } from "vitest";
import { parseSettingsJson, extractAtReferences } from "./parser";

describe("parseSettingsJson", () => {
  it("有効なJSONをパースする", () => {
    const result = parseSettingsJson('{"hooks": {}}');
    expect(result).toEqual({ hooks: {} });
  });

  it("不正なJSONはnullを返す", () => {
    const result = parseSettingsJson("invalid json");
    expect(result).toBeNull();
  });

  it("オブジェクト以外はnullを返す", () => {
    const result = parseSettingsJson('"just a string"');
    expect(result).toBeNull();
  });
});

describe("extractAtReferences", () => {
  it("行頭の@参照を抽出する", () => {
    const content = `# CLAUDE.md
@rules/typescript.md
some text
@skills/my-skill/SKILL.md`;
    const refs = extractAtReferences(content);
    expect(refs).toEqual(["rules/typescript.md", "skills/my-skill/SKILL.md"]);
  });

  it("行中の@は無視する", () => {
    const content = `email: user@example.com`;
    const refs = extractAtReferences(content);
    expect(refs).toEqual([]);
  });

  it("空文字列はからの配列を返す", () => {
    const refs = extractAtReferences("");
    expect(refs).toEqual([]);
  });
});
