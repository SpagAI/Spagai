/**
 * Turn numbers into English words, British/Nigerian style
 * ("one hundred and twenty", not "one hundred twenty").
 */

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const SCALES: Array<[number, string]> = [
  [1_000_000_000_000, "trillion"],
  [1_000_000_000, "billion"],
  [1_000_000, "million"],
  [1_000, "thousand"],
];

export const DIGIT_WORDS = ONES.slice(0, 10);

function underHundred(n: number): string {
  if (n < 20) return ONES[n]!;
  const tens = TENS[Math.floor(n / 10)]!;
  const rest = n % 10;
  return rest === 0 ? tens : `${tens}-${ONES[rest]}`;
}

function underThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds === 0) return underHundred(rest);
  const head = `${ONES[hundreds]} hundred`;
  return rest === 0 ? head : `${head} and ${underHundred(rest)}`;
}

/** 1520 -> "one thousand, five hundred and twenty". Integers only. */
export function integerToWords(value: number): string {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`integerToWords expects an integer, got ${value}`);
  }
  if (value < 0) return `minus ${integerToWords(-value)}`;
  if (value === 0) return "zero";

  const parts: string[] = [];
  let rest = value;
  for (const [size, name] of SCALES) {
    if (rest >= size) {
      parts.push(`${integerToWords(Math.floor(rest / size))} ${name}`);
      rest %= size;
    }
  }
  if (rest > 0) {
    // "one thousand and five" reads naturally; "one thousand, five hundred" too.
    parts.push(parts.length > 0 && rest < 100 ? `and ${underThousand(rest)}` : underThousand(rest));
  }
  return parts.join(", ").replace(/, and /g, " and ");
}

/** "2.5" -> "two point five". Accepts a string so trailing zeros are kept. */
export function decimalToWords(value: string | number): string {
  const text = String(value);
  const [whole, fraction] = text.split(".");
  const head = integerToWords(Number(whole));
  if (!fraction) return head;
  const digits = fraction.split("").map((d) => ONES[Number(d)]).join(" ");
  return `${head} point ${digits}`;
}

const ORDINAL_IRREGULAR: Record<string, string> = {
  one: "first", two: "second", three: "third", five: "fifth", eight: "eighth",
  nine: "ninth", twelve: "twelfth",
};

/** 21 -> "twenty-first", 13 -> "thirteenth". */
export function ordinalToWords(value: number): string {
  const words = integerToWords(value);
  const match = words.match(/([a-z]+)$/);
  if (!match) return words;
  const last = match[1]!;
  let ordinal: string;
  if (ORDINAL_IRREGULAR[last]) ordinal = ORDINAL_IRREGULAR[last]!;
  else if (last.endsWith("y")) ordinal = `${last.slice(0, -1)}ieth`;
  else ordinal = `${last}th`;
  return words.slice(0, words.length - last.length) + ordinal;
}

/** "0803" -> "zero eight zero three" */
export function digitsToWords(digits: string): string {
  return digits
    .replace(/\D/g, "")
    .split("")
    .map((d) => ONES[Number(d)])
    .join(" ");
}

/** 2026 -> "twenty twenty-six", 2000 -> "two thousand", 2005 -> "two thousand and five". */
export function yearToWords(year: number): string {
  if (year >= 2000 && year < 2010) return integerToWords(year);
  if (year >= 1100 && year < 10000 && year % 100 !== 0) {
    return `${underHundred(Math.floor(year / 100))} ${underHundredWithOh(year % 100)}`;
  }
  return integerToWords(year);
}

function underHundredWithOh(n: number): string {
  return n < 10 ? `oh ${ONES[n]}` : underHundred(n);
}
