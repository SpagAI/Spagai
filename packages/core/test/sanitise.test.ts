import { describe, expect, it } from "vitest";
import { sanitiseForSpeech as s } from "../src/speech";

describe("sanitiseForSpeech", () => {
  it("handles the full example from the brief", () => {
    expect(s("Hi Mr. Okafor! Your **₦25,000** repayment is due 15/10/2026 at 9:30am.")).toBe(
      "Hi mister Okafor! Your twenty five thousand naira repayment is due the fifteenth of October, twenty twenty six at nine thirty in the morning.",
    );
  });

  describe("markdown and symbols", () => {
    it("strips markdown formatting", () => {
      expect(s("# Title\n- **Step 1**: open the app\n- Step 2: tap *Verify*")).toBe("Title\nStep one: open the app\nStep two: tap Verify");
      expect(s("See [our site](https://x.com) and `code`")).toBe("See our site and code");
    });

    it("never leaves slashes, brackets, asterisks or emoji", () => {
      const out = s("Rates/fees (see below) *apply* 😊 [note] {x} | done #1 ~ok~ <b>");
      expect(out).not.toMatch(/[/()[\]{}*#|~<>]/);
      expect(out).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(out).toContain("Rates or fees");
    });

    it("turns dashes into pauses or spaces", () => {
      expect(s("We call - then we book.")).toBe("We call, then we book.");
      expect(s("A follow-up call")).toBe("A follow up call");
      expect(s("Open Mon-Fri")).toBe("Open Monday to Friday");
      expect(s("Open 9-5")).toBe("Open nine to five");
    });

    it("expands common abbreviations and symbols", () => {
      expect(s("Traders, e.g. market women & artisans")).toBe("Traders, for example market women and artisans");
      expect(s("We are open 24/7")).toBe("We are open twenty four seven");
      expect(s("Choose yes and/or no")).toBe("Choose yes and or no");
    });
  });

  describe("titles", () => {
    it.each([
      ["Mr Okafor", "Mister Okafor"],
      ["Dr. Bello", "Doctor Bello"],
      ["Engr Musa", "Engineer Musa"],
      ["Barr. Eze", "Barrister Eze"],
      ["Prof Ade", "Professor Ade"],
      ["Mrs Okoro", "Missus Okoro"],
    ])("%s -> %s", (input, out) => {
      expect(s(input)).toBe(out);
    });

    it("can leave titles as written", () => {
      expect(s("Dr Bello", { expandTitles: false })).toBe("Dr Bello");
    });
  });

  describe("numbers, money, times and dates", () => {
    it("says naira amounts, including kobo and short scales", () => {
      expect(s("₦2,500.50")).toBe("Two thousand, five hundred naira and fifty kobo");
      expect(s("N1.5m")).toBe("One million, five hundred thousand naira");
      expect(s("NGN 5000")).toBe("Five thousand naira");
      expect(s("₦20k")).toBe("Twenty thousand naira");
      expect(s("₦1,005")).toBe("One thousand and five naira");
    });

    it("says percentages and plain numbers", () => {
      expect(s("2.5% interest")).toBe("Two point five percent interest");
      expect(s("120 customers")).toBe("One hundred and twenty customers");
    });

    it("reads long reference numbers digit by digit", () => {
      expect(s("Ref 4417390021")).toBe("Ref four four one seven three nine zero zero two one");
    });

    it("says times", () => {
      expect(s("at 9am.")).toBe("At nine in the morning.");
      expect(s("at 2:05 pm")).toBe("At two oh five in the afternoon");
      expect(s("at 14:00 WAT")).toBe("At two in the afternoon");
      expect(s("at 12:00")).toBe("At twelve noon");
      expect(s("at 19:30")).toBe("At seven thirty in the evening");
    });

    it("says dates (ISO, day-first, and written)", () => {
      expect(s("2026-10-15")).toBe("The fifteenth of October, twenty twenty six");
      expect(s("1/3/2026")).toBe("The first of March, twenty twenty six");
      expect(s("on 22nd October")).toBe("On the twenty second of October");
      expect(s("October 3rd, 2026")).toBe("The third of October, twenty twenty six");
    });

    it("says ordinals", () => {
      expect(s("your 1st call")).toBe("Your first call");
    });
  });

  describe("emails, phones and websites", () => {
    it("says emails with at and dot", () => {
      expect(s("Email ada.obi@gmail.com.")).toBe("Email ada dot obi at gmail dot com.");
    });

    it("reads Nigerian phone numbers in groups", () => {
      expect(s("Call 08031234567")).toBe("Call zero eight zero three, one two three, four five six seven");
      expect(s("Call +234 803 123 4567")).toBe("Call zero eight zero three, one two three, four five six seven");
    });

    it("says websites without symbols", () => {
      expect(s("Visit www.spagai.com/pricing.")).toBe("Visit www dot spagai dot com slash pricing.");
    });
  });

  it("returns clean text unchanged", () => {
    expect(s("Thank you for your time. Have a great day.")).toBe("Thank you for your time. Have a great day.");
  });
});

describe("sanitiseForSpeech pauses", () => {
  it("turns a spaced slash into a pause", () => {
    expect(s("Email us / call us")).toBe("Email us, call us");
  });
});
