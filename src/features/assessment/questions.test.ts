import { describe, expect, it } from "vitest";
import {
  correctAnswerText,
  gradeResponse,
  parseBlanks,
  parseNumber,
  questionDataSchemas,
  seededShuffle,
  studentView,
} from "./questions";

const options = [
  { id: "a", text: "Apple" },
  { id: "b", text: "Banana" },
  { id: "c", text: "Cherry" },
  { id: "d", text: "Date" },
];

describe("authoring schemas", () => {
  it("validates choices", () => {
    expect(questionDataSchemas.SINGLE_CHOICE.safeParse({ options, correct: "a" }).success).toBe(true);
    expect(questionDataSchemas.SINGLE_CHOICE.safeParse({ options, correct: "z" }).success).toBe(false);
    expect(questionDataSchemas.SINGLE_CHOICE.safeParse({ options: [options[0]], correct: "a" }).success).toBe(false);
    expect(questionDataSchemas.MULTIPLE_CHOICE.safeParse({ options, correct: [] }).success).toBe(false);
    expect(questionDataSchemas.MULTIPLE_CHOICE.safeParse({ options: [options[0], options[0]], correct: ["a"] }).success).toBe(false);
  });

  it("requires blanks and valid patterns", () => {
    expect(questionDataSchemas.FILL_BLANKS.safeParse({ text: "No blanks here" }).success).toBe(false);
    expect(questionDataSchemas.FILL_BLANKS.safeParse({ text: "x [[ ]] y" }).success).toBe(false);
    expect(questionDataSchemas.SHORT_ANSWER.safeParse({ accepted: ["x"], patterns: ["(unclosed"] }).success).toBe(false);
  });
});

describe("gradeResponse", () => {
  it("single choice and true/false", () => {
    expect(gradeResponse("SINGLE_CHOICE", { options, correct: "b" }, { choice: "b" })).toBe(1);
    expect(gradeResponse("SINGLE_CHOICE", { options, correct: "b" }, { choice: "a" })).toBe(0);
    expect(gradeResponse("SINGLE_CHOICE", { options, correct: "b" }, { choice: null })).toBe(0);
    expect(gradeResponse("TRUE_FALSE", { correct: false }, { value: false })).toBe(1);
    expect(gradeResponse("TRUE_FALSE", { correct: false }, { value: null })).toBe(0);
  });

  it("multiple choice with and without partial credit", () => {
    const data = { options, correct: ["a", "c"] };
    expect(gradeResponse("MULTIPLE_CHOICE", data, { choices: ["a", "c"] })).toBe(1);
    expect(gradeResponse("MULTIPLE_CHOICE", data, { choices: ["a"] })).toBe(0.5);
    expect(gradeResponse("MULTIPLE_CHOICE", data, { choices: ["a", "b"] })).toBe(0);
    expect(gradeResponse("MULTIPLE_CHOICE", data, { choices: ["a", "b", "c", "d"] })).toBe(0);
    expect(gradeResponse("MULTIPLE_CHOICE", { ...data, partialCredit: false }, { choices: ["a"] })).toBe(0);
    expect(gradeResponse("MULTIPLE_CHOICE", { ...data, partialCredit: false }, { choices: ["c", "a"] })).toBe(1);
  });

  it("short answers: normalization, case and patterns", () => {
    const data = { accepted: ["Paris", "City of Light"] };
    expect(gradeResponse("SHORT_ANSWER", data, { text: "  paris " })).toBe(1);
    expect(gradeResponse("SHORT_ANSWER", data, { text: "city   of light" })).toBe(1);
    expect(gradeResponse("SHORT_ANSWER", { ...data, caseSensitive: true }, { text: "paris" })).toBe(0);
    expect(gradeResponse("SHORT_ANSWER", data, { text: "" })).toBe(0);
    expect(gradeResponse("SHORT_ANSWER", { accepted: ["photosynthesis"], patterns: ["photo ?synth[ae]sis"] }, { text: "Photo synthasis" })).toBe(1);
    // Patterns must match the whole answer.
    expect(gradeResponse("SHORT_ANSWER", { accepted: ["x"], patterns: ["cat"] }, { text: "concatenate" })).toBe(0);
  });

  it("numeric with tolerance and comma decimals", () => {
    expect(gradeResponse("NUMERIC", { answer: 3.14, tolerance: 0.01 }, { value: "3,141" })).toBe(1);
    expect(gradeResponse("NUMERIC", { answer: 3.14, tolerance: 0.01 }, { value: "3.2" })).toBe(0);
    expect(gradeResponse("NUMERIC", { answer: 10 }, { value: "1e1" })).toBe(1);
    expect(gradeResponse("NUMERIC", { answer: 10 }, { value: "ten" })).toBe(0);
    expect(parseNumber("-.5")).toBe(-0.5);
    expect(parseNumber("1 000")).toBe(1000);
    expect(parseNumber("1.2.3")).toBeNull();
  });

  it("matching and ordering with partial credit", () => {
    const pairs = [
      { id: "p1", left: "Spain", right: "Madrid" },
      { id: "p2", left: "France", right: "Paris" },
      { id: "p3", left: "Italy", right: "Rome" },
      { id: "p4", left: "Peru", right: "Lima" },
    ];
    expect(gradeResponse("MATCHING", { pairs }, { matches: { p1: "p1", p2: "p2", p3: "p4", p4: "p3" } })).toBe(0.5);
    expect(gradeResponse("MATCHING", { pairs, partialCredit: false }, { matches: { p1: "p1", p2: "p2", p3: "p3", p4: "p4" } })).toBe(1);
    expect(gradeResponse("ORDERING", { items: options }, { order: ["a", "b", "d", "c"] })).toBe(0.5);
    expect(gradeResponse("ORDERING", { items: options, partialCredit: false }, { order: ["a", "b", "d", "c"] })).toBe(0);
    expect(gradeResponse("ORDERING", { items: options }, { order: [] })).toBe(0);
  });

  it("fill in the blanks with alternatives", () => {
    const data = { text: "The [[colour|color]] of the sky is [[blue]]." };
    expect(gradeResponse("FILL_BLANKS", data, { blanks: ["Color", "blue"] })).toBe(1);
    expect(gradeResponse("FILL_BLANKS", data, { blanks: ["colour", "green"] })).toBe(0.5);
    expect(gradeResponse("FILL_BLANKS", data, { blanks: [] })).toBe(0);
  });

  it("leaves essays and uploads to the teacher, and scores malformed responses as 0", () => {
    expect(gradeResponse("ESSAY", {}, { text: "anything" })).toBeNull();
    expect(gradeResponse("FILE_UPLOAD", {}, { fileIds: [] })).toBeNull();
    expect(gradeResponse("SINGLE_CHOICE", { options, correct: "a" }, { choice: 42 })).toBe(0);
    expect(gradeResponse("ORDERING", { items: options }, "nonsense")).toBe(0);
  });
});

describe("student view", () => {
  it("never includes answers", () => {
    for (const [type, data] of [
      ["SINGLE_CHOICE", { options, correct: "c" }],
      ["MULTIPLE_CHOICE", { options, correct: ["a", "c"] }],
      ["TRUE_FALSE", { correct: true }],
      ["SHORT_ANSWER", { accepted: ["secret-answer"] }],
      ["NUMERIC", { answer: 424242 }],
      ["FILL_BLANKS", { text: "Say [[hidden-word]] now" }],
    ] as const) {
      const json = JSON.stringify(studentView(type, data, "seed", true));
      expect(json).not.toMatch(/correct|accepted|secret-answer|424242|hidden-word/);
    }
  });

  it("shuffles deterministically and never shows ordering answers in order", () => {
    const a = studentView("SINGLE_CHOICE", { options, correct: "a" }, "attempt1:q1", true);
    const b = studentView("SINGLE_CHOICE", { options, correct: "a" }, "attempt1:q1", true);
    expect(a).toEqual(b);
    expect(studentView("SINGLE_CHOICE", { options, correct: "a" }, "x", false)).toEqual({ type: "SINGLE_CHOICE", options });
    for (let i = 0; i < 50; i++) {
      const v = studentView("ORDERING", { items: options.slice(0, 2) }, `s${i}`, false);
      expect(v.type === "ORDERING" && v.items.map((x) => x.id)).not.toEqual(["a", "b"]);
    }
  });

  it("shuffles all items (a permutation)", () => {
    const shuffled = seededShuffle([1, 2, 3, 4, 5, 6], "abc");
    expect([...shuffled].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("splits fill-in-the-blank text", () => {
    expect(parseBlanks("A [[b]] c [[d|e]]")).toEqual({ parts: ["A ", { blank: 0 }, " c ", { blank: 1 }], answers: [["b"], ["d", "e"]] });
  });
});

describe("correctAnswerText", () => {
  it("describes answers", () => {
    expect(correctAnswerText("MULTIPLE_CHOICE", { options, correct: ["a", "c"] })).toBe("Apple, Cherry");
    expect(correctAnswerText("NUMERIC", { answer: 2, tolerance: 0.5 })).toBe("2 (± 0.5)");
    expect(correctAnswerText("ESSAY", {})).toBeNull();
  });
});
