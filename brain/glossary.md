# Glossary

| Term | Plain meaning |
|---|---|
| **ASR** (automatic speech recognition), **STT** (speech-to-text) | Turning speech into text. "The ears." |
| **TTS** (text-to-speech) | Turning text into speech. "The mouth." |
| **LLM** (large language model) | The AI that reads the conversation and decides what to say. "The brain." |
| **NLP** (natural language processing) | Getting computers to understand language. Today mostly done by the LLM. |
| **VoIP** | Phone calls over the internet. |
| **SIP / SIP trunk** | The standard way phone systems connect; a SIP trunk is a "pipe" of phone lines from a carrier into our servers. |
| **G.711, μ-law, A-law** | The standard phone audio format: 8 kHz, compressed. Lower quality than studio audio. |
| **Sample rate (kHz)** | How many times per second sound is measured. Phone: 8 kHz. Studio: 44.1 or 48 kHz. |
| **WebRTC / WebSocket** | Ways to stream audio over the internet in real time. |
| **VAD** (voice activity detection) | Detects whether someone is speaking. |
| **Turn detection / endpointing** | Decides whether the caller has finished speaking. |
| **Barge-in** | The caller interrupting the agent; the agent should stop and listen. |
| **Latency** | Delay. For voice agents: from when the caller stops speaking to when the agent starts. |
| **TTFT** (time to first token) | How long until the LLM produces the first word of its reply. |
| **TTFB** (time to first byte) | How long until TTS produces the first bit of audio. |
| **Streaming** | Sending results in pieces as they're made instead of waiting for the whole thing. |
| **Cascade pipeline** | ASR → LLM → TTS as separate steps. |
| **Speech-to-speech model** | One model that hears audio and speaks audio directly. |
| **Tool calling / function calling** | The LLM asking our code to do something (look up an order, book an appointment). |
| **MCP** (Model Context Protocol) | A standard way to plug a set of tools into an AI agent. |
| **WER** (word error rate) | % of words ASR got wrong. Lower is better. **CER** is the same for characters. |
| **MOS** (mean opinion score) | People rate how natural speech sounds from 1 to 5. **CMOS**: compare two samples. |
| **Speaker similarity** | How much a synthetic voice sounds like the real person. |
| **Fine-tuning** | Taking a model already trained on lots of data and training it a bit more on our data. Much cheaper than training from scratch. |
| **Pretrained / base / foundation model** | A model trained on large general data, used as a starting point. |
| **Zero-shot cloning** | Copying a voice from a few seconds of audio without training. |
| **Vocoder** | The part of some TTS systems that turns a spectrogram into audio (e.g. HiFi-GAN). |
| **Spectrogram / mel spectrogram** | A picture of sound: frequencies over time. What many speech models actually "see". |
| **Phoneme** | The smallest sound unit of a language. **Phonetic coverage**: a script that includes all the sounds. |
| **Lexicon** | A pronunciation dictionary (e.g. our Nigerian names list). |
| **SSML** | Markup that tells TTS how to say things (pauses, pronunciation, emphasis). |
| **Text normalisation** | Turning "₦25,000" into "twenty-five thousand naira" before TTS. Our `sanitise.ts`. |
| **Diacritics / tone marks** | Accents on letters showing tone in Yoruba and Igbo (e.g. ọkọ̀, ọkọ́). Change the meaning. |
| **Diacritic (tone-mark) restoration** | Automatically adding missing tone marks to text. |
| **Code-switching** | Mixing languages in one conversation or sentence. |
| **Data augmentation** | Making training data harder on purpose (add noise, make it sound like a phone line). |
| **Held-out test set** | Data kept aside and never trained on, used only to measure quality honestly. |
| **Checkpoint** | A saved copy of a model during training. |
| **GPU** | The chip used to train and run AI models. |
| **Watermark (audio)** | An inaudible signal in generated audio that proves where it came from. |
| **CC-BY / CC-BY-SA / CC-BY-NC / CC0** | Common data and model licences. NC = **non-commercial**: not for paid products without permission. |
| **NDPA / NDPC** | Nigeria Data Protection Act 2023 / Nigeria Data Protection Commission. |
| **NCC** | Nigerian Communications Commission (telecoms regulator). |
