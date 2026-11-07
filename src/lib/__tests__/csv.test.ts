import { describe, expect, it } from "vitest";
import { toCsv } from "../csv";

describe("toCsv", () => {
  it("opens in a French spreadsheet: BOM, semicolons, CRLF", () => {
    const csv = toCsv(["N°", "Nom"], [["B1", "Dupont"]]);
    expect(csv).toBe("﻿N°;Nom\r\nB1;Dupont\r\n");
  });

  it("quotes cells that hold a separator, a quote or a newline", () => {
    expect(toCsv(["a"], [['dit "oui"; non'], ["deux\nlignes"]])).toContain('"dit ""oui""; non"');
    expect(toCsv(["a"], [["deux\nlignes"]])).toContain('"deux\nlignes"');
  });

  it("defuses a cell a spreadsheet would run as a formula", () => {
    expect(toCsv(["a"], [["=HYPERLINK(\"x\")"], ["+33 6 12"], ["@x"]])).toContain("'=HYPERLINK");
    expect(toCsv(["a"], [["+33 6 12"]])).toContain("'+33 6 12");
  });

  it("writes missing values as empty cells", () => {
    expect(toCsv(["a", "b"], [[null, undefined], [0, "x"]])).toBe("﻿a;b\r\n;\r\n0;x\r\n");
  });
});
