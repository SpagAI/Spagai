# 03. The local voices strategy

## What "local voices" means for us

Three different things, often mixed up:

1. **Local accent:** English spoken the way Nigerians speak it. Rhythm, vowels, stress, how names and numbers are said, "Sir" and "Ma" said naturally. **Biggest market, easiest to build.** Most business calls in Nigeria start in English.
2. **Local languages:** Nigerian Pidgin, Yoruba, Hausa, Igbo (then others: Fulfulde, Kanuri, Tiv, Ibibio, Edo...). Each needs its own data, and Yoruba, Igbo and Hausa are tonal.
3. **Local people:** real, named Nigerian voice actors whose voices we license and pay for. A voice catalogue that is ours, legally clean, and that a bank or telco can trust.

**Our product is all three:** a catalogue of licensed Nigerian voices that speak Nigerian English well first, then Pidgin, then Yoruba, Hausa and Igbo, plus ears that understand Nigerians in all of them, including when they mix languages.

## Why the big players don't do it (and why it's hard)

| Difficulty | What it means | What we do about it |
|---|---|---|
| **Little data** | Thousands of hours of clean English speech exist; a few hundred for Yoruba, much less for Pidgin TTS. | Record our own; use open datasets for pre-training (see `05-datasets.md`); build a community collection programme. |
| **Tones** | In Yoruba, *ọkọ́* (hoe), *ọkọ̀* (vehicle), *ọkọ* (husband) are spelled the same without tone marks. Igbo and Hausa are tonal too. | Train TTS on text **with** tone marks. Add a tone-mark restorer between the LLM and TTS. Native-speaker review. |
| **Spelling isn't standard** | Pidgin has no single spelling ("dey"/"de", "wetin"/"wotin"). People write Yoruba without tone marks on phones. Hausa doesn't mark tone or vowel length at all. | Write a Spag style guide per language; normalise text before TTS; train ASR on varied spellings. |
| **Code-switching** | "Abeg, send me the account details, I go pay am today." Several languages in one sentence. | Record and transcribe real mixed speech; train ASR and TTS on it on purpose. Foreign models are worst at this, so it's our biggest edge. |
| **Phone audio** | 8 kHz, compressed, noisy, with dropouts. | Train ASR with telephone-quality audio; test TTS after converting to 8 kHz G.711. |
| **Names** | Oluwaseun, Chiamaka, Abdulrahman, Nnamdi. Foreign TTS butchers them. | Grow `names-pronunciation.json` into a verified lexicon; pass pronunciations to TTS. |
| **Evaluation** | You can't judge a Hausa voice if you don't speak Hausa. | Pay native-speaker listening panels for every language. |

## The ladder: five stages

Don't jump to the top. Each stage pays for and feeds the next.

### Stage 0. Rent and learn (now)

- Agents run on rented voices (Fish Audio) and rented ASR.
- **Do now:** set up real phone calls; measure where rented ASR and TTS fail on Nigerian callers; start collecting (with consent) real call audio and transcripts, which become training data later.
- **Exit when:** real paying customers are making real calls, and we have a list of failures ranked by how much they hurt.

### Stage 1. Our first voices: Nigerian English (about 3 months)

- Hire 2 to 4 voice actors (male and female, different ages, a Lagos voice, a Northern voice, an Eastern voice).
- Record 2 to 5 hours each in a studio, with signed licences (see `09-legal-consent-ethics.md`).
- Fine-tune an open, commercially licensed TTS model on each. Serve it ourselves.
- **Exit when:** in a blind test, Nigerian listeners prefer our voices to the rented ones (or score them as good), and our voice reaches first audio in under about 250 ms on our servers.

### Stage 2. Our own ears: Nigerian English and Pidgin ASR (about 3 months, overlapping)

- Fine-tune an open ASR model (Whisper, Omnilingual ASR, SBPN or a NeMo model) on open Nigerian datasets plus our own call recordings, with telephone audio.
- Add Pidgin TTS for our existing voice actors (record them speaking Pidgin).
- **Exit when:** our ASR has a lower word error rate than the best rented option on our own test set of real Nigerian calls, especially on names, numbers and Pidgin.

### Stage 3. Yoruba, Hausa, Igbo (6 to 12 months)

- Recruit native-speaker voice actors and a linguist per language.
- Record with fully tone-marked scripts; build the tone-mark restorer.
- Fine-tune multilingual ASR on NaijaVoices-style data (licensed), WAXAL (open, CC-BY) and our own.
- **Exit when:** native-speaker panels rate the voices natural and correct, and real customers run calls in these languages.

### Stage 4. Our own foundation (year 2 and later)

- With thousands of hours of consented Nigerian conversation, train our own multi-speaker, multilingual base TTS model (and maybe a speech-to-speech model).
- **Voice marketplace:** Nigerian voice actors upload, license and earn royalties from their voices on Spag AI.
- Offer our ASR and TTS as an API to other companies, as well as inside our agent platform.

## Where the moat comes from

Models are open and get better every month, so the model alone is no moat. Ours is:

1. **Licensed voice catalogue:** exclusive contracts with Nigerian voice actors.
2. **Data flywheel:** every call on the platform (with consent) improves our ASR on real Nigerian callers. Competitors can't buy this.
3. **Language know-how:** tone-marked text, Pidgin style guide, name lexicon, native-speaker review processes.
4. **The full product:** agents, compliance (NCC, NDPA), Naira billing, local phone numbers. A voice alone is easy to copy; a working local product is not.
5. **Trust:** banks, telcos and government will only buy voices with clean consent and data kept under Nigerian law.

## Who we compete with (know them well)

- **Global agent platforms:** Vapi, Retell, Bland, Synthflow. Strong tools, foreign voices and ears.
- **Global voice companies:** ElevenLabs, Cartesia, Fish Audio. Great quality; Nigerian voices are community clones or few.
- **African speech companies:** Spitch (Nigerian TTS/ASR), Intron (African-accent ASR), Lelapa AI (South Africa), YarnGPT (Nigerian open TTS). Possible partners too: we could start on their voices for Yoruba/Hausa/Igbo while we build ours.
- **Government and research:** N-ATLAS, NaijaVoices, Masakhane, Data Science Nigeria. Mostly sources and allies, not competitors.

## Brainstorm questions to settle

- Which accent first: Lagos English, or a "neutral" Nigerian English? (Ask customers. Probably several voices.)
- Do we buy studio time or build a small recording booth? (A booth pays off after about 20 to 30 studio days.)
- Exclusive or non-exclusive voice licences? Flat fee or royalty per minute? (See `09-legal-consent-ethics.md`.)
- Partner with Spitch/Intron for Stage 3 languages while we build ours, or wait?
- Pidgin before Yoruba? (Pidgin is understood nationwide and is closer to English, so it is probably easier and wider-reaching.)
