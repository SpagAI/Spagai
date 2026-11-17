# 10. Roadmap

A proposal, not a decision. Change it in `11-brainstorm-log.md` as we learn. Dates are relative to when we start each stage, since funding and hiring decide the real pace.

## Month 0–1: Get real

- [ ] Real phone calls: sign up with a Nigerian telephony provider; get the voice worker making real calls with rented ASR/LLM/TTS (Pipecat vs LiveKit spike: one week).
- [ ] Build the **Nigerian test set** (5–10 hours of real or realistic Nigerian phone speech, human-transcribed). Test Deepgram, Google, Azure, Whisper, Omnilingual ASR, SBPN, N-ATLAS, Spitch on it.
- [ ] Listening test of rented voices (Fish Audio, ElevenLabs, Azure, Spitch, YarnGPT) with 20 Nigerian listeners over the phone.
- [ ] First meeting with a lawyer (questions in `09`).
- [ ] Write the founding speech ML engineer job description; start conversations in Masakhane / DSN / Hugging Face circles.
- [ ] Contact NaijaVoices about commercial licensing; read WAXAL's Nigerian-language contents.

**Gate:** we know, with numbers, where rented providers fail Nigerian callers.

## Month 1–3: Stage 1, our first voices (Nigerian English)

- [ ] Hire the speech ML engineer (full-time or a 3-month contract).
- [ ] Voice actor auditions (phone test); sign 2–4 actors with licence agreements.
- [ ] Write the English recording script (domain sentences, names, numbers, styles).
- [ ] Pilot: 1 hour with one actor → fine-tune → listen. Fix the process.
- [ ] Full recordings: 2–5 hours per actor.
- [ ] TTS bake-off across 3–4 commercially licensed base models.
- [ ] Serve the best voice behind our TTS adapter with streaming; measure first-audio delay and calls per GPU.
- [ ] Blind listening test vs rented voices.

**Gate:** Nigerian listeners rate our voices at least as good as the best rented Nigerian voice, on the phone. Then ship them in the Studio as "Spag Voices".

## Month 3–6: Stage 2, our own ears + Pidgin

- [ ] Consent wording for using customer call audio to improve models (with the lawyer); customer contract updates.
- [ ] Collect and transcribe Nigerian English + Pidgin phone speech (paid collection + consented calls).
- [ ] Transcription style guide (Pidgin spelling, code-switching, numbers).
- [ ] Fine-tune ASR (bake-off: Whisper / Omnilingual / SBPN / NeMo); add context biasing for names.
- [ ] Record our voice actors in Pidgin; fine-tune Pidgin TTS.
- [ ] Hire the data operations lead when data volume needs it.

**Gate:** our ASR beats the best rented option on our test set, especially on names, numbers and Pidgin. Then switch our calls to it, keeping rented ASR as fallback.

## Month 6–12: Stage 3, Yoruba, Hausa, Igbo

- [ ] Linguist per language; tone-marked scripts; spelling/style guides.
- [ ] Native-speaker voice actors per language.
- [ ] Tone-mark restorer for Yoruba and Igbo (between LLM and TTS).
- [ ] Multilingual ASR fine-tune (licensed NaijaVoices, WAXAL, our data).
- [ ] Native-speaker listening panels for every release.
- [ ] Consider partnering for these languages in the meantime (Spitch or similar, through our adapters).
- [ ] Self-host in or near Nigeria once volume justifies it.

**Gate:** native-speaker panels approve; real customers run calls in each language.

## Year 2+: Stage 4, our own foundation

- [ ] Our own multi-speaker multilingual base TTS model, trained on our consented data.
- [ ] Explore speech-to-speech models on our conversation data.
- [ ] Voice marketplace with royalties for Nigerian voice actors.
- [ ] Sell our ASR/TTS as an API.
- [ ] More languages (Fulfulde, Kanuri, Tiv, Ibibio, Edo...) and more African countries.

## Numbers to track from day one

| Metric | Why |
|---|---|
| Voice-to-voice delay (median and slowest 5%) | Callers hang up on slow agents |
| ASR word error rate on our Nigerian test set, and entity accuracy | Proves our ears are better |
| MOS / preference vs rented voices | Proves our voices are better |
| Cost per call minute, by layer | Margins; when to self-host |
| Calls per GPU | Margins |
| Hours of consented, transcribed Nigerian speech owned | The moat, growing |
| Voice actors under licence; minutes of their voices used | Catalogue and royalties |
