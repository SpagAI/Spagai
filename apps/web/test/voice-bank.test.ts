import { describe, expect, it } from "vitest";
import { bankVoiceId, fishModelToBankVoice, parseBankVoiceId, workspaceVoiceToVoice } from "@/lib/voice-bank";

const ID = "f248b08382a244a087ab5ee5fda8f6c2";

const model = {
  _id: ID,
  title: " Nigerian Storyteller ",
  description: "A clear and expressive female voice with a captivating Nigerian accent.",
  tags: ["female", "middle-aged", "narration", "warm"],
  languages: ["en"],
  type: "tts",
  state: "trained",
  like_count: 38,
  task_count: 4410,
  samples: [{ title: "Default Sample", audio: "https://platform.r2.fish.audio/task/3e3b789d4812463c8fb237f3cfa7394d.mp3" }],
};

describe("fishModelToBankVoice", () => {
  it("maps a Fish Audio model to a bank voice", () => {
    expect(fishModelToBankVoice(model)).toEqual({
      providerVoiceId: ID,
      name: "Nigerian Storyteller",
      gender: "female",
      age: "middle",
      language: "en-NG",
      accent: "Nigerian",
      category: "Narration",
      description: "A clear and expressive female voice with a captivating Nigerian accent.",
      sampleUrl: "https://platform.r2.fish.audio/task/3e3b789d4812463c8fb237f3cfa7394d.mp3",
      likes: 38,
      uses: 4410,
    });
  });

  it("reads gender, age, language and style from tags", () => {
    const v = fishModelToBankVoice({ ...model, tags: ["male", "young", "conversational"], languages: ["yo"] })!;
    expect([v.gender, v.age, v.language, v.category]).toEqual(["male", "young", "yo", "Conversational"]);
    expect(fishModelToBankVoice({ ...model, tags: ["old"] })!.age).toBe("mature");
  });

  it("only keeps sample files from Fish Audio's own servers", () => {
    expect(fishModelToBankVoice({ ...model, samples: [{ audio: "https://evil.example/x.mp3" }] })!.sampleUrl).toBeNull();
    expect(fishModelToBankVoice({ ...model, samples: [] })!.sampleUrl).toBeNull();
  });

  it("rejects bad ids, untrained voices and non-speech models", () => {
    expect(fishModelToBankVoice({ ...model, _id: "../../etc" })).toBeNull();
    expect(fishModelToBankVoice({ ...model, state: "training" })).toBeNull();
    expect(fishModelToBankVoice({ ...model, type: "svc" })).toBeNull();
    expect(fishModelToBankVoice(null)).toBeNull();
  });

  it("limits long text", () => {
    const v = fishModelToBankVoice({ ...model, title: "x".repeat(200), description: "y".repeat(500) })!;
    expect(v.name).toHaveLength(80);
    expect(v.description).toHaveLength(240);
  });
});

describe("bank voice ids", () => {
  it("builds and parses ids", () => {
    expect(bankVoiceId("fish_audio", ID)).toBe(`fish_audio:${ID}`);
    expect(parseBankVoiceId(`fish_audio:${ID}`)).toEqual({ provider: "fish_audio", providerVoiceId: ID });
    expect(parseBankVoiceId("mock-en-ng-female-1")).toBeNull();
    expect(parseBankVoiceId(`fish_audio:${ID}x`)).toBeNull();
    expect(parseBankVoiceId(null)).toBeNull();
  });
});

describe("workspaceVoiceToVoice", () => {
  it("shapes a saved voice like a catalogue voice", () => {
    const v = workspaceVoiceToVoice({ provider: "fish_audio", providerVoiceId: ID, name: "Ada", gender: "male", language: "xx", accent: "Nigerian", description: "d", age: "young" });
    expect(v).toMatchObject({ id: `fish_audio:${ID}`, gender: "male", language: "en-NG", status: "available", provider: "fish_audio", age: "young" });
  });
});

import { browserSpeechSettings, fishTtsBody } from "@/lib/voice-bank";

describe("voice settings", () => {
  it("sends speed, loudness, expressiveness and number reading to Fish Audio", () => {
    const body = fishTtsBody(ID, "Hello", { speed: 1.5, volume: -4, expressiveness: 0.3, naturalNumbers: false });
    expect(body).toMatchObject({ reference_id: ID, text: "Hello", normalize: false, temperature: 0.3, prosody: { speed: 1.5, volume: -4 } });
    expect(fishTtsBody(ID, "Hi")).toMatchObject({ normalize: true, prosody: { speed: 1, volume: 0 } });
  });

  it("maps settings to browser speech (which cannot go louder than normal)", () => {
    expect(browserSpeechSettings({ speed: 0.8, volume: 5, expressiveness: 0.7, naturalNumbers: true })).toEqual({ rate: 0.8, volume: 1 });
    expect(browserSpeechSettings({ speed: 1, volume: -10, expressiveness: 0.7, naturalNumbers: true }).volume).toBeCloseTo(0.2);
  });
});

import { friendlyVoiceName } from "@/lib/voice-bank";

describe("friendly voice names", () => {
  it("keeps real names and gives generic titles a Nigerian first name", () => {
    expect(friendlyVoiceName("Bukola", "female", ID)).toBe("Bukola");
    const f = friendlyVoiceName("Female Nigerian", "female", ID);
    expect(f).not.toMatch(/nigeria|female/i);
    expect(friendlyVoiceName("Female Nigerian", "female", ID)).toBe(f);
    expect(friendlyVoiceName("nigerian", "male", "abc")).not.toMatch(/nigeria/i);
  });
});
