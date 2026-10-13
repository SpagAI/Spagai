import { describe, expect, it } from "vitest";
import { emailToSpeech, normaliseSpokenEmail } from "../src/email";

describe("normaliseSpokenEmail", () => {
  it.each([
    ["john underscore doe at gmail dot com", "john_doe@gmail.com"],
    ["ada dot obi at gmail", "ada.obi@gmail.com"],
    ["ada dot obi gmail", "ada.obi@gmail.com"],
    ["musa dash bello at yahoo dot co dot uk", "musa-bello@yahoo.co.uk"],
    ["musa hyphen bello at hotmail", "musa-bello@hotmail.com"],
    ["info at spag ai dot org", "info@spagai.org"],
    ["chidi two three at g mail dot com", "chidi23@gmail.com"],
    ["Tolu at Outlook", "tolu@outlook.com"],
    ["kemi full stop ade at yahoo", "kemi.ade@yahoo.com"],
    ["bisi at company dot com dot ng", "bisi@company.com.ng"],
  ])("%s -> %s", (spoken, email) => {
    expect(normaliseSpokenEmail(spoken)).toEqual({ email, valid: true, reason: null });
  });

  it("marks incomplete emails as invalid", () => {
    expect(normaliseSpokenEmail("just my name").valid).toBe(false);
    expect(normaliseSpokenEmail("john at").valid).toBe(false);
  });
});

describe("emailToSpeech", () => {
  it("never speaks symbols", () => {
    expect(emailToSpeech("ada.obi_2@gmail.com")).toBe("ada dot obi underscore two at gmail dot com");
    expect(emailToSpeech("musa-bello@yahoo.co.uk")).toBe("musa dash bello at yahoo dot co dot uk");
  });

  it("round-trips through the normaliser", () => {
    for (const e of ["ada.obi_2@gmail.com", "musa-bello@yahoo.co.uk", "info@spagai.org"]) {
      expect(normaliseSpokenEmail(emailToSpeech(e)).email).toBe(e);
    }
  });
});
