# 01. How voice AI works

This follows the illustration in `assets/tech-behind-voice-ai.webp`, one box at a time, then puts it together with a real example and the numbers that matter.

## The loop

```
 Caller's phone
      │  (audio, 8 kHz)
      ▼
 ① VoIP provider ──► ② Audio captured ──► ③ Speech-to-text (ASR) ──► ④ Text
  (Twilio, Telnyx,      (streamed in          (Deepgram, Whisper,        "I wan
   Vonage, Africa's      20 ms chunks;         our own model later)       reschedule
   Talking, SIP trunk)   VAD hears speech)                                 my delivery"
      ▲                                                                       │
      │                                                                       ▼
 ⑧ Audio back to caller ◄── ⑦ Text-to-speech (TTS) ◄── ⑥ Reply text ◄── ⑤ Language model (LLM)
                              (ElevenLabs, Fish Audio,   "No wahala, Sir.     (Claude, GPT, Gemini,
                               our own voices later)      Which day work       Llama...) + tools:
                                                          for you?"            check order, book slot
```

### ① The phone line (VoIP provider)

A VoIP provider connects the public phone network to the internet. It gives us phone numbers, rings people (outbound) or answers them (inbound), and streams the call audio to our server, usually over a **WebSocket** (Twilio Media Streams, Telnyx) or **SIP** (the standard protocol phone systems use to talk to each other).

- Phone audio is **8,000 samples per second, compressed with G.711 (μ-law or A-law)**. It sounds muffled next to a studio recording. Everything downstream has to cope with it.
- For Nigeria the questions are: who sells Nigerian numbers (+234), at what price per minute, with what call quality, and under which NCC rules. Options: Africa's Talking, a local carrier's SIP trunk (MTN, Airtel, Glo, 9mobile through a licensed partner), or international providers with Nigerian numbers.
- **Where the server sits matters.** Audio from Lagos to a US server and back adds 200 to 300 ms per turn. Use servers in Africa or Europe.

### ② Capturing the voice

The audio arrives in small chunks (often 20 ms). Two small models run all the time:

- **VAD (voice activity detection)** decides "is someone speaking right now?" Silero VAD is the free standard.
- **Turn detection (endpointing)** decides "has the caller **finished** their turn, or are they just pausing to think?" This is one of the hardest parts of a natural agent. Reply too fast and you interrupt people. Wait too long and the agent feels slow. Newer turn detectors use a small model that reads the words as well as the silence ("my account number is..." is clearly not finished).
- **Barge-in:** if the caller starts talking while the agent is speaking, the agent must stop speaking at once and listen. Nigerians often talk over each other politely ("yes, yes, ehen"). The agent should not treat every "mm" as an interruption.
- **Echo cancellation and noise:** markets, traffic, generators, and the agent's own voice coming back down the line.

### ③ Speech-to-text (ASR, "the ears")

ASR turns audio into text. In real time it **streams**: it sends guesses as the caller speaks ("partial" results) and corrects them, then sends a "final" result.

- Deepgram, AssemblyAI, Google, Azure, and OpenAI-hosted models are the rented options. Whisper, Meta's MMS and Omnilingual ASR, NVIDIA's NeMo models, and Nigerian projects such as SBPN and N-ATLAS are the open options (see `05-datasets.md` and `02-the-stack-rent-vs-own.md`).
- **How we measure it:** WER (word error rate), the percentage of words it gets wrong. Lower is better. For a voice agent, getting **names, numbers, amounts, dates and "yes/no"** right matters more than the average.
- **Where foreign ASR fails Nigerians:** accents, Pidgin ("I no fit come today"), Yoruba, Hausa and Igbo words in English sentences ("abeg", "oya", "na so"), Nigerian names, and phone-quality audio.

### ④ The text

Now we have the caller's words as text. The illustration calls this step NLP (natural language processing). Today the language model does almost all of that work itself.

### ⑤ The language model (LLM, "the brain")

The LLM reads:

- the **system prompt** (who the agent is, the business, rules like Sir and Ma, calling hours, what never to say). In our code: `packages/core/src/prompt`.
- the **conversation so far**,
- the **tools** it may use.

It decides what to say and whether to call a tool:

- **Tool calling:** the model asks our code to do something ("look up order 4471", "book Tuesday 10:00", "end the call"). Our code does it and gives the result back to the model.
- **MCP connection:** a standard way to plug in a set of tools from another system (a CRM, Make.com). Already partly in the Studio.
- **API execution:** the actual call to the bank's, clinic's or shop's system.
- The ✅ and ❌ in the illustration: the brain checks whether the action worked, and says so honestly.

For voice, **time to first token** (how fast the first word of the reply arrives) matters more than raw intelligence. Small, fast models usually beat big, slow ones on the phone. Keep the prompt short (our linter warns above about 1,500 tokens, decision D23).

### ⑥ The reply text

Before speaking, the text must be **cleaned for speech**: "₦25,000" becomes "twenty-five thousand naira", "08031234567" becomes digits read in groups, emails get spelled out, and so on. We already do this in `packages/core/src/speech/sanitise.ts`. For Yoruba and Igbo this step later also has to **add tone marks**, because the model often writes without them and TTS cannot guess the right tone (see `03-local-voices-strategy.md`).

### ⑦ Text-to-speech (TTS, "the mouth")

TTS turns text into audio in a chosen voice.

- In real time it must **stream**: start sending audio after the first few words, not after the whole sentence. The number that matters is **time to first byte (TTFB)**, ideally under 200 ms.
- Quality is measured by **MOS** (mean opinion score: people rate naturalness from 1 to 5), **intelligibility** (play it to an ASR and count errors), and **speaker similarity** (does it sound like the voice actor).
- **This is where "local voices" live.** The voice's accent, rhythm, tone, warmth, how it says names and numbers. Today we rent this from Fish Audio. The plan is to own it.

### ⑧ Back to the caller

The audio goes back through the VoIP provider, converted to 8 kHz G.711. Then the loop starts again, for every turn, until someone hangs up.

## The latency budget (why speed is everything)

People expect a reply about 200 to 500 ms after they stop talking. A phone agent that takes under about 800 ms feels good. Above 1.5 s it feels broken.

| Step | Typical time | How to cut it |
|---|---|---|
| Network: caller to our server | 50–150 ms | Servers close to Nigeria (Lagos, Johannesburg, Europe) |
| Turn detection (deciding they finished) | 200–500 ms | Smart turn detector instead of a fixed silence timer |
| ASR final result | 100–300 ms | Streaming ASR; start the LLM on partial text |
| LLM first token | 150–500 ms | Small fast model, short prompt, prompt caching |
| TTS first audio | 75–250 ms | Streaming TTS, send text sentence by sentence |
| Network back | 50–150 ms | Same as above |
| **Total** | **~600 ms – 1.8 s** | Target under 1 s |

**The trick everyone uses:** do the steps at the same time, not one after another. Stream ASR into the LLM, stream the LLM's words into TTS sentence by sentence, stream TTS audio straight to the phone.

## A worked example: a delivery confirmation call in Pidgin and English

1. Our dialer checks the compliance gate (hours, opt-out, consent), then asks the phone provider to call +234 803 ... .
2. The customer picks up: "Hello?" VAD hears speech, turn detection decides the turn is over after "Hello?".
3. The agent's first line is already prepared, so TTS speaks at once: "Good afternoon, Sir. This is Ada from QuickShip about your parcel."
4. Customer: "Ehen, abeg I no go dey house tomorrow, fit you bring am Friday?"
5. ASR (if it understands Pidgin) returns that text. A US-trained ASR might return "and abet I know go they house tomorrow fit you bring a Friday", and the agent would fail here. **This is the gap we fill.**
6. The LLM understands: reschedule to Friday. It calls the tool `reschedule_delivery(order_id, "2026-11-20")`. Our code calls QuickShip's API. Success ✅.
7. LLM reply: "No wahala, Sir. I don move am to Friday, twenty November. Anything else?"
8. Sanitise → TTS in a Nigerian voice that can speak Pidgin naturally → phone.
9. The call ends; the transcript, tool calls and duration go back to the Studio for billing and the calls log.

## Two architectures: cascade vs speech-to-speech

| | **Cascade** (ASR → LLM → TTS) | **Speech-to-speech** (one model hears and speaks) |
|---|---|---|
| Examples | Almost every production agent today; what the illustration shows | OpenAI Realtime, Gemini Live, Kyutai Moshi, Ultravox |
| Pros | Swap any part; easy to debug (you can read the text); use our own voices and ASR; tools and guardrails are simple | Lower delay, hears tone of voice and emotion, more natural turn-taking |
| Cons | More moving parts, more delay | Hard to control, hard to use a custom voice, expensive, weak on Nigerian languages, hard to audit |
| For Spag AI | **Use this now.** It lets us plug in our own voices and ASR one piece at a time. | Watch it. Revisit once we have lots of Nigerian speech data (stage 4 in `03-local-voices-strategy.md`). |

## What can go wrong on a real call (checklist)

- Agent interrupts the caller (turn detection too eager), or waits too long.
- Agent keeps talking after the caller interrupts (no barge-in).
- Mishears a number, name or amount, then acts on it. **Always confirm important values back to the caller.**
- Reads "₦5,000" as "N five comma zero zero zero" (cleaning step missing).
- Wrong tone in Yoruba changes the meaning of the word.
- Silence: the caller walked away (our silence settings: check in after 7 s, end after 15 s).
- Voicemail picks up and the agent talks to a machine.
- Network drops; audio stutters.
- The model says something false or promises something the business never offered (guardrails).
