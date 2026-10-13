/**
 * Quick demo of the core logic. Run from the repo root with:  pnpm demo
 * Optional: pnpm demo clinic-booking   (any preset id)
 */
import {
  buildAddress,
  buildCallValues,
  compilePrompt,
  fromLagosParts,
  getPreset,
  isWithinCallingWindow,
  lintPrompt,
  normaliseSpokenEmail,
  parseNigerianPhone,
  PRESETS,
  presetToTemplate,
  sanitiseForSpeech,
} from "../src";

const presetId = process.argv[2] ?? "fintech-outbound-zara";
const preset = getPreset(presetId);
if (!preset) {
  console.error(`Unknown preset "${presetId}". Choose one of:\n  ${PRESETS.map((p) => p.id).join("\n  ")}`);
  process.exit(1);
}

const line = (title: string) => console.log(`\n=== ${title} ${"=".repeat(Math.max(0, 60 - title.length))}`);
const now = fromLagosParts(2026, 10, 13, 10, 30);

line("1. Address builder");
for (const lead of [
  { gender: "male", firstName: "chinedu", lastName: "okafor" },
  { gender: "female", title: "Ma", firstName: "Ngozi", lastName: "Eze" },
  { gender: "female", title: "Dr", firstName: "Amaka", lastName: "Obi" },
]) {
  const a = buildAddress(lead);
  console.log(`${JSON.stringify(lead)}\n   -> "${a.address}", suffix "${a.suffix}"`);
}

line("2. Spoken-text sanitiser (what the voice will say)");
const sample = "Hi Mr. Okafor! Your **₦25,000** repayment is due 15/10/2026 at 9:30am. Email support@spag.ai / call 0803 123 4567 😊";
console.log(`IN : ${sample}\nOUT: ${sanitiseForSpeech(sample)}`);

line("3. Spoken email -> stored value");
for (const e of ["ada dot obi gmail", "musa dash bello at yahoo dot co dot uk"]) {
  console.log(`"${e}" -> ${normaliseSpokenEmail(e).email}`);
}

line("4. Nigerian phone numbers");
for (const p of ["0803 123 4567", "+234 (0) 803-123-4567", "0722831876"]) {
  const r = parseNigerianPhone(p);
  console.log(`${p.padEnd(24)} -> ${r.valid ? r.e164 : `INVALID: ${r.reason}`}`);
}

line("5. Calling window (Africa/Lagos)");
for (const h of [7, 10, 21]) {
  const r = isWithinCallingWindow(fromLagosParts(2026, 10, 13, h, 0));
  console.log(`${String(h).padStart(2, "0")}:00 WAT -> ${r.allowed ? "OK to call" : `BLOCKED (${r.reason})`}`);
}

line(`6. Compiled prompt: ${preset.name} [${preset.status}]`);
const agentValues = Object.fromEntries(preset.variables.map((v) => [v.name, v.example ?? v.defaultValue ?? ""]));
const callValues = buildCallValues({ firstName: "Chinedu", lastName: "Okafor", gender: "male", lead_source: "website form" }, now);
const compiled = compilePrompt(presetToTemplate(preset), { values: { ...agentValues, ...callValues }, mode: "call" });
console.log(compiled.prompt);
console.log(`\nFirst message: ${compiled.firstMessage}`);
console.log(`Spoken as    : ${sanitiseForSpeech(compiled.firstMessage)}`);
console.log(`\n~${compiled.estimatedTokens} tokens, ${compiled.words} words. Compile errors: ${compiled.errors.length ? compiled.errors.join("; ") : "none"}`);

line("7. Prompt linter");
const lint = lintPrompt({ prompt: compiled.prompt, firstMessage: compiled.firstMessage });
console.log(`Score ${lint.score}/100. Errors ${lint.counts.error}, warnings ${lint.counts.warning}, info ${lint.counts.info}`);
const bad = lintPrompt({ prompt: 'You are a sales agent.\nSay "Hello Mr Okafor Sir, how are you? Can we talk now?"\nWe are closed after hours.' });
console.log(`\nA deliberately bad prompt scores ${bad.score}/100:`);
for (const i of bad.issues) console.log(`  [${i.severity}] ${i.rule}: ${i.message}`);
