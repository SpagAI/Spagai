# 06. Learning path

What to read, watch and build, in order. Three tracks; everyone does Track 1.

## Track 1. Everyone: understand voice agents (about 2 weeks, part-time)

1. **Read** `01-how-voice-ai-works.md` in this folder.
2. **Read** *Voice AI & Voice Agents: An Illustrated Primer* by Kwindla Hultman Kramer (Daily/Pipecat), at voiceaiandvoiceagents.com. The best single overview of how production voice agents work: latency, turn-taking, pipelines.
3. **Use the competition.** Build the same agent (a delivery confirmation call) in Vapi, Retell, ElevenLabs Agents and Bland. Call it yourself from a Nigerian number. Write down: delay, interruptions, mishearings, how Nigerian it sounds. Put the notes in `11-brainstorm-log.md`.
4. **Listen.** Generate the same 10 Nigerian sentences (names, naira, Pidgin, Yoruba) in ElevenLabs, Fish Audio, Azure, Spitch, YarnGPT. Rank them. This trains your ear, which is the main quality tool.
5. **Watch:** 3Blue1Brown's *Neural Networks* series on YouTube (what training a model means, no maths needed).

## Track 2. Engineers: build the real-time pipeline (4 to 6 weeks)

1. **Pipecat docs and examples** (docs.pipecat.ai): run the phone-bot example.
2. **LiveKit Agents docs** (docs.livekit.io/agents): run the telephony quickstart.
3. **Telephony:** Twilio Media Streams docs (audio over WebSockets, μ-law 8 kHz), SIP basics, Africa's Talking voice API docs.
4. **Audio basics:** sample rate, bit depth, μ-law, resampling, VAD (Silero VAD repo), echo cancellation.
5. **Project:** in `services/voice-worker`, get a real call working end to end with rented ASR/LLM/TTS, then measure each step's delay (see the latency table in `01`).
6. **Project:** swap TTS for an open model running on a rented GPU (e.g. Kokoro or Piper). Notice what changes in delay and cost.

## Track 3. ML: train speech models (3 to 6 months to get good)

### Foundations
- **fast.ai** *Practical Deep Learning for Coders* (free), or Andrej Karpathy's *Neural Networks: Zero to Hero* (YouTube). Pick one and finish it.
- **PyTorch** tutorials (pytorch.org/tutorials).

### Speech specifically
- **Hugging Face Audio Course** (huggingface.co/learn/audio-course). Free. Covers audio data, spectrograms, ASR, TTS, fine-tuning. **Start here.**
- Jurafsky & Martin, *Speech and Language Processing* (3rd ed. draft, free online): the chapter on ASR and TTS.
- Hugging Face blog: *Fine-Tune Whisper For Multilingual ASR with Transformers*. Do it on a Yoruba or Pidgin dataset.
- NVIDIA NeMo tutorials (ASR fine-tuning; SBPN is NeMo-based).
- Piper's training guide (train a small single-speaker voice from scratch: the best way to really understand TTS).
- The repos and READMEs of Kokoro, StyleTTS 2, Orpheus, CosyVoice, Chatterbox, F5-TTS: each explains how to fine-tune.

### Papers to read (in this order; read the abstract, figures and conclusion first)

**TTS: how it evolved**
1. Tacotron 2 (2017): text → spectrogram → audio, the classic design.
2. FastSpeech 2 (2020): faster, non-autoregressive.
3. HiFi-GAN (2020): the "vocoder" that turns spectrograms into audio.
4. VITS (2021): all in one model; what Piper and MMS-TTS use.
5. VALL-E (2023): TTS as a language model over audio tokens; started zero-shot cloning.
6. StyleTTS 2 (2023): human-level naturalness on small data.
7. F5-TTS (2024) and CosyVoice (2024): flow matching; modern streaming TTS.
8. Any LLM-based TTS (e.g. Orpheus, YarnGPT's write-up): how today's expressive voices are made.

**ASR**
1. wav2vec 2.0 (2020): learning from unlabelled audio. Key for low-resource languages.
2. Whisper (2022): training on huge weakly-labelled data.
3. MMS (2023) and Omnilingual ASR (2025): ASR for 1,000+ languages.
4. Moshi (2024): a speech-to-speech model that listens and speaks at once.

**Nigerian and African speech (read all of these)**
- NaijaVoices dataset paper (Interspeech 2025, arXiv 2505.20564)
- AfriSpeech-200 (2023)
- BibleTTS (2022)
- WAXAL (2026, arXiv 2602.02734)
- SBPN: Improving Multilingual ASR for Nigerian Languages (2026, arXiv 2605.17710)
- Masakhane papers on Yoruba diacritic restoration and Nigerian language NLP

## Communities to join

- **Masakhane** (African NLP research community)
- **Data Science Nigeria**
- **Deep Learning Indaba** (annual African ML conference; great for hiring and partners)
- Hugging Face Discord (audio channels), Pipecat Discord, LiveKit community
- NaijaVoices community

## Hands-on milestones (proof you've learnt it)

| # | Build this | Who |
|---|---|---|
| 1 | A real phone call to your own phone with a rented-stack agent, under 1.2 s delay | Engineer |
| 2 | A small Piper voice trained from a public single-speaker dataset | ML |
| 3 | Whisper fine-tuned on a Pidgin dataset, with WER before/after on a held-out set | ML |
| 4 | A listening-test page: play sentences from 4 voices blind and collect votes | Engineer |
| 5 | The first Spag voice fine-tuned on a 1-hour pilot recording of a voice actor | ML |
