# 02. The stack: what to rent, what to own

Every layer of a voice agent can be **rented** (pay per minute to a provider) or **owned** (run an open model on our own servers, usually after training it on our data). The rule for Spag AI:

> **Rent what is a commodity. Own what makes us different.**
> The phone line and the language model are commodities. Nigerian ears (ASR) and Nigerian mouths (TTS) are not. Those we own, step by step.

Licences change. **Everything marked "check" must be confirmed on the model's own page before we use it in a paid product.** Last checked: November 2026.

## Layer 1: Phone line (telephony)

| Option | Notes |
|---|---|
| Africa's Talking | Pan-African, Nigerian numbers, voice API. Natural first choice for +234. |
| Local carrier SIP trunk (via a licensed partner) | Best price and call quality at volume; slower to set up, needs NCC paperwork. |
| Twilio, Telnyx, Vonage | Excellent developer tools; Nigerian numbers and pricing vary. Useful for testing and for international clients. |
| LiveKit SIP / Pipecat transports | Connect any SIP trunk into our pipeline. |

**Decision: rent.** Owning telephony means becoming a licensed operator. Not our business. Build adapters so we can switch providers.

## Layer 2: The code that joins everything (orchestration)

| Option | Licence | Notes |
|---|---|---|
| **Pipecat** (Daily) | BSD-2 (open) | Python. Pipeline of pluggable steps. Many providers built in. Good for custom models. |
| **LiveKit Agents** | Apache 2.0 (open) | Python/Node. Strong real-time media, SIP, a turn-detector model, scales well. |
| Vapi, Retell, Bland | Rented platforms | These are our **competitors**, not our building blocks. Study them. |

**Decision: own (on open source).** `services/voice-worker` is already planned around LiveKit Agents or Pipecat (decisions D5 and D85). Pick one after a one-week spike: build the same delivery call in both, measure delay, and see which makes plugging in our own TTS and ASR easier.

## Layer 3: The ears (speech-to-text, ASR)

### Rented

| Provider | Notes |
|---|---|
| Deepgram | Fast streaming, popular for voice agents. Test on Nigerian English and Pidgin. |
| AssemblyAI, Google, Azure, OpenAI | Test each on our own recordings; results on Nigerian speech vary a lot. |
| **Intron** (Nigerian) | Built for African-accented speech, especially healthcare. Competitor and possible partner. |
| **Spitch** (Nigerian) | ASR and TTS for Yoruba, Hausa, Igbo and Nigerian English (Amharic too). Competitor and possible partner. |

### Open models we can run and fine-tune

| Model | Languages | Commercial use? | Notes |
|---|---|---|---|
| Whisper (OpenAI), incl. large-v3-turbo | ~99, weak on Yoruba/Igbo | Yes (MIT) | Best-known starting point. Not streaming by design; needs tricks for real time. |
| **Omnilingual ASR** (Meta, Nov 2025) | 1,600+ | Yes (Apache 2.0) | Big step for African languages. Its corpus is CC-BY. Check which Nigerian languages and how good. |
| MMS (Meta, 2023) | 1,100+ | **No** (CC-BY-NC) | Fine for research only. |
| **SBPN** (May 2026) | Yoruba, Hausa, Igbo, Pidgin, Nigerian English | Check | 120M and 600M models on Hugging Face (`ogunlao/SBPN_multilingual_*`). Built for Nigeria; NeMo-based. Test first. |
| **N-ATLAS** (Nigerian government + Awarri, Sept 2025) | Yoruba, Hausa, Igbo, Nigerian English | Free to experiment; a formal arrangement is reported to be needed beyond 1,000 users | Check the model card's terms. |
| w2v-BERT 2.0 / wav2vec 2.0 / NeMo Conformer models | Any, after fine-tuning | Mostly yes; check each | Good bases to fine-tune on our own data, smaller and faster than Whisper. |

**Decision: rent now, own soon.** ASR is the cheaper of the two to own: fine-tuning an existing model on a few hundred hours of Nigerian phone speech can beat foreign providers on our callers. Do it in Stage 2 (see `03-local-voices-strategy.md`).

## Layer 4: The brain (language model)

Rent from Anthropic, OpenAI, Google, or open models (Llama, Qwen, Mistral) hosted on fast inference services (Groq, Together, Fireworks). Our adapter already accepts any OpenAI-compatible API (decision D55).

What matters for voice: fast first token, reliable tool calling, follows rules (Sir and Ma, never invent prices), handles Pidgin and code-switching in the **text**. Test models on our own scripted Nigerian conversations.

**Decision: rent.** Training our own LLM is the most expensive thing we could do and would not make our voices better. Maybe fine-tune a small open model much later, for cost or to run in Nigeria.

## Layer 5: The mouth (text-to-speech, TTS)

### Rented

| Provider | Notes |
|---|---|
| **Fish Audio** | What we use today (decision D111). About 200 Nigerian-accented voices in its community library. Voice ownership and consent of community voices is unclear: a risk for a business product. |
| ElevenLabs | Best-known quality and cloning; free plan blocked our server (D111). Paid plans give commercial rights. |
| Cartesia, Rime, Deepgram Aura, OpenAI, Google, Azure | Fast streaming voices. Azure and Google have a few Nigerian English voices. |
| Spitch, YarnGPT (hosted) | Nigerian TTS; local competitors. |

### Open models we can run and fine-tune

| Model | Style | Commercial use? | Notes |
|---|---|---|---|
| **Piper** / VITS | Small, fast, one voice per model | Older version MIT, newer version GPL: check | Runs on a CPU. Great for a first single-speaker voice trained from scratch. Less expressive. |
| **Kokoro-82M** | Small, StyleTTS2-based | Yes (Apache 2.0) | Very fast, good quality for its size. Fine-tunable. |
| StyleTTS 2 | Expressive, single or multi-speaker | Code MIT; pretrained weights have conditions: check | Strong naturalness on small data. |
| **Orpheus TTS** | LLM-based (Llama 3.2 3B), emotive | Apache 2.0, but built on Llama: check Llama licence | Natural, supports tags like laughing. Needs a GPU. Streams. |
| **Chatterbox** (Resemble AI) | Zero-shot cloning, emotion control | Yes (MIT): check | Has a multilingual version; Nigerian languages not included out of the box. |
| CosyVoice 2/3 (Alibaba) | LLM + flow matching, streaming | Apache 2.0: check | Strong streaming quality. |
| F5-TTS | Flow matching, zero-shot cloning | Code MIT; released weights **non-commercial** | Train our own weights to use commercially. |
| Fish Speech / OpenAudio | LLM-based | Weights **non-commercial** | Research only unless licensed. |
| XTTS-v2 (Coqui) | Zero-shot cloning, multilingual | **Non-commercial** (Coqui closed in 2024) | Avoid for the product. |
| MMS-TTS (Meta) | VITS per language, includes Yoruba and Hausa | **Non-commercial** | Useful to hear a baseline. |
| **YarnGPT** | LLM-based (SmolLM2-360M), Nigerian English, Yoruba, Igbo, Hausa | Check (licence not confirmed) | Proof that a small team can do this cheaply. Trained on public Nigerian media: check data rights before building on it. |

**Decision: own. This is the core of Spag AI.** Start by fine-tuning a commercially licensed open model (Kokoro, StyleTTS 2, Orpheus, CosyVoice, Chatterbox or Piper, chosen by a bake-off) on voice actors we record ourselves. See `04-training-playbook.md`.

## Layer 6: Speech-to-speech models (later)

OpenAI Realtime, Gemini Live, Kyutai Moshi, Ultravox (open weights). Lower delay and more natural, but hard to control and weak on Nigerian languages. Revisit when we have thousands of hours of our own consented Nigerian conversation data.

## The target architecture (end of Stage 3)

```
Nigerian SIP trunk / Africa's Talking
        │
LiveKit Agents or Pipecat  (our servers, close to Nigeria)
  ├─ Silero VAD + turn detector
  ├─ Spag ASR  (fine-tuned on Nigerian phone speech)      ← OWN
  ├─ Rented LLM via our OpenAI-compatible adapter          ← RENT
  ├─ Spag text cleaner + tone-mark restorer (core/speech)  ← OWN
  └─ Spag TTS  (our licensed Nigerian voice actors)        ← OWN
        │
Studio web app: prompts, tools, compliance gate, billing, calls log
```

Keep every layer behind an adapter so a rented provider can stand in for ours at any time (as a fallback, or for languages we have not trained yet).
