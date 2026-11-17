# 04. Training playbook

Two recipes: **A. Train a voice (TTS)** and **B. Train ears (ASR)**. Both follow the same shape:

```
Plan → Consent → Collect → Clean → Label → Train → Test → Serve → Improve
```

Most of the work, and most of the quality, is in Collect, Clean and Label. Training is the short part.

---

## A. Training a Spag voice (TTS)

### A1. Decide what kind of voice

| Approach | Data needed per voice | Quality | When to use |
|---|---|---|---|
| **Zero-shot clone** (copy a voice from a short sample) | 10 seconds to a few minutes | OK; can drift, accent may slip | Quick demos only. Never without the speaker's written consent. |
| **Fine-tune a pretrained model** | **1 to 5 hours** of studio speech | Good to very good | **Our default for Stage 1 and 2.** |
| **Train a single-speaker model from scratch** (e.g. Piper/VITS) | 10 to 20+ hours | Very good, very fast to run, less expressive | When we need a tiny fast model, or the language isn't in any base model. |
| **Train our own multi-speaker base model** | Hundreds to thousands of hours, many speakers | Best; ours alone | Stage 4. |

### A2. Find and contract the voice actor

- **Casting:** Nollywood dubbing artists, radio presenters, OAP voice talent, audiobook narrators. Hold auditions: everyone reads the same 2-minute script; play the recordings **down a phone line** to a panel of 10 Nigerians who rate them.
- Look for: clear and warm, steady pace, consistent energy across hours, no strong habits (lip smacks, heavy breathing), sounds trustworthy on the phone.
- **Contract before recording:** what the voice will be used for, for how long, exclusive or not, fee and/or royalty, right to see usage, right to withdraw for future uses, what we will never use it for (politics, adult content, fraud, impersonation). See `09-legal-consent-ethics.md`.
- Record a short spoken **consent statement** at the start of each session ("I, [name], agree that Spag AI may...").

### A3. Write the recording script

The script decides what the voice can say well.

- **2,000 to 4,000 sentences** for 2 to 5 hours. Short to medium sentences (5 to 20 words).
- **Cover all the sounds** of the language (phonetic coverage). Use a script tool to pick sentences that cover rare sound combinations.
- **Our domain:** greetings, Sir/Ma, apologies, confirmations, numbers (amounts in naira, phone numbers in groups, dates, times, account numbers), Nigerian names, bank/telco/delivery/clinic phrases, questions (rising tone) and statements.
- **Styles:** neutral, warm/friendly, apologetic, upbeat. Label each sentence with its style.
- Yoruba/Igbo scripts **must have full tone marks**, checked by a linguist. Pidgin follows our Pidgin style guide (write one).
- Write the text exactly as it should be spoken ("twenty-five thousand naira", not "₦25,000") or keep both forms (written + spoken) for each sentence.

### A4. Record

- **Room:** quiet, dead (no echo). A booth, a treated studio, or a wardrobe full of clothes for a pilot. Generator off, AC off, phones off.
- **Kit:** a good large-diaphragm condenser or broadcast dynamic mic, pop filter, audio interface, closed headphones. Record at **48 kHz, 24-bit, mono WAV**.
- **Same setup every session:** same mic, same distance (about 15 to 20 cm), same gain, same room. Mark the floor.
- **Pace:** at most 2 to 3 hours of recording per day; voices tire and change. Water, breaks.
- **A director** listens live and asks for re-takes (wrong word, wrong tone, noise, energy dropped).
- **Tools:** a simple recording app that shows one sentence at a time and saves one file per sentence named by sentence ID. Back up every evening, two places.

### A5. Clean and check

1. Trim silence at start and end (keep ~100 to 200 ms).
2. Normalise loudness (e.g. -23 to -20 LUFS) consistently.
3. Remove clips with noise, clipping, mouth clicks, wrong words.
4. **Check text matches audio:** run a strong ASR over each clip and flag clips where the transcript differs a lot from the script. A human listens to the flagged ones.
5. Native speaker listens to a sample for tone and pronunciation.
6. Split: ~95% train, ~5% held-out test (never trained on).

### A6. Fine-tune

1. **Bake-off first:** pick 3 or 4 commercially licensed base models (see `02-the-stack-rent-vs-own.md`). Fine-tune each on the **same** voice actor's data. Compare.
2. Typical setup: one GPU with 24 to 80 GB memory (RTX 4090, A100, H100, L40S); a few hours to a day per voice.
3. Watch the training curves; save checkpoints; listen to the test sentences at each checkpoint. **Your ears are the main tool:** loss numbers alone don't tell you if it sounds good.
4. Common problems: mumbling or skipped words (too little data or overtrained), robotic pauses, wrong stress on names, accent slipping toward American (the base model's habits; needs more data or more training).

### A7. Test

| Test | How | Pass mark (starting point) |
|---|---|---|
| Naturalness (MOS) | 20+ Nigerian listeners rate 1 to 5, mixed with real recordings and rival voices, without knowing which is which | Ours ≥ rented Nigerian voices; target ≥ 4.0 |
| Side-by-side preference (CMOS/A-B) | "Which sounds better on a call, A or B?" | Ours preferred ≥ 50% vs. the rented voice |
| Intelligibility | Run our TTS output through ASR; measure word error | Close to the error on the real recordings |
| Speaker similarity | Automatic speaker-embedding score + "is this the same person?" | Voice actor recognises their own voice |
| Phone test | Play over a real call (8 kHz) | Still clear and pleasant |
| Domain test | Names, naira amounts, phone numbers, dates, account numbers | Zero mistakes on our 200-item checklist |
| Speed | Time to first audio, on our server, under load | < 250 ms; faster than real time |
| Tone (Yoruba/Igbo/Hausa) | Linguist marks wrong tones on 100 sentences | < 2% of words wrong |

### A8. Serve

- Wrap the model behind the same interface as rented voices (`synthesise()` in `apps/web/src/server/providers`, and a streaming version in the voice worker).
- **Streaming** output (audio in chunks as it's made), GPU server close to our telephony, autoscaling, a rented voice as fallback if our server is down.
- Add an **inaudible watermark** to all generated audio so we can prove a clip came from us (deepfake defence).
- Log which voice, which customer, how many seconds: for royalties and billing.

### A9. Improve

- Collect complaints from calls ("customer said 'what?' twice") and add those words or phrases to the next recording session.
- Re-record a top-up session every few months (same setup!).

---

## B. Training Spag ears (ASR)

### B1. Build the test set first

Before training anything, build a **test set of real Nigerian phone speech**: 5 to 10 hours, with careful human transcripts, covering:

- Nigerian English from different regions, Pidgin, code-switched speech, then Yoruba/Hausa/Igbo
- Names, numbers, amounts, dates, account numbers, emails, addresses
- Noisy places, cheap phones, poor network

Test every rented provider on it. This tells us how far behind they are, and later proves we've beaten them.

### B2. Gather training data

1. **Open datasets** (see `05-datasets.md`): AfriSpeech (accented English, non-commercial), WAXAL (CC-BY), Common Voice (CC0), FLEURS, Pidgin corpora, NaijaVoices (needs a commercial waiver).
2. **Our own calls** (with consent and per our privacy policy): the most valuable data we will ever have, because it matches real usage exactly.
3. **Paid collection:** pay speakers to read and to speak freely on given topics, through a phone line (so it's phone quality).
4. **Simulated phone audio:** convert clean data to 8 kHz G.711, add background noise (market, traffic, generator), packet loss. Called **augmentation**.

### B3. Transcribe

- Write a **transcription guide**: how to spell Pidgin words, whether to keep tone marks, how to mark code-switching, numbers as words or digits, what to do with "ehn", "abi", laughter, unclear speech.
- Use a strong model to make a first draft; humans correct it (much faster than typing from scratch).
- A second person checks a sample of every transcriber's work. Pay per audio hour; pay bonuses for accuracy.

### B4. Fine-tune

- Start from Whisper, Omnilingual ASR, SBPN or a NeMo/w2v-BERT model (bake-off again).
- Mix our data with open data so the model doesn't forget general English.
- **Context biasing:** give the model a list of expected words for each call (customer name, business name, product names) so it gets them right.
- For real-time use, prefer models built for streaming, or use chunked/streaming tricks.

### B5. Test

- Word error rate on our test set, **overall and broken down**: by region, language, noise level, gender.
- **Entity accuracy:** % of names, numbers, amounts, dates correct. This matters more than overall WER.
- Speed: time from end of speech to final text.

---

## Building blocks to set up once

- **Data store:** every clip with its text, speaker, consent record, licence, source, quality flags. Never lose track of where a clip came from or who agreed to what.
- **Experiment tracking:** Weights & Biases or MLflow. Which data, which model, which settings, which scores.
- **Listening tool:** a simple web page to play test sentences from several models side by side and vote (we can build this in the Studio).
- **Evaluation scripts:** WER, MOS collection, speaker similarity, timing. Run them on every new model.
