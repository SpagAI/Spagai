# 05. Datasets bank

Open speech data for Nigerian speech. **Always read the licence on the dataset's own page before use**, and record in our data store which dataset each clip came from.

Licence key:

- **CC0 / CC-BY / CC-BY-SA:** commercial use allowed (CC-BY: credit them; CC-BY-SA: share changes to the *data* under the same licence; check with a lawyer whether that reaches a trained model).
- **CC-BY-NC / NC-SA:** **no commercial use** without a separate agreement. Fine for research and for building our test sets internally only if the licence allows.

Last checked: November 2026. Figures below come from the dataset papers or pages and sometimes disagree between sources.

## Nigerian languages (Yoruba, Hausa, Igbo)

| Dataset | What | Size | Licence | Notes |
|---|---|---|---|---|
| **NaijaVoices** | Read speech, Igbo, Hausa, Yoruba, community-built | ~1,800 h (paper: ~605 h Hausa, ~626 h Igbo, ~607 h Yoruba; 5,000+ speakers) | CC-BY-NC-SA 4.0; commercial use needs a waiver / membership from NaijaVoices | Best-sized open source for the three big languages. **Contact them about a commercial licence early.** Gated on Hugging Face. |
| **WAXAL** (Google, 2026) | ASR (natural, image-prompted speech) + TTS corpus; 20+ African languages incl. Hausa, Igbo, Yoruba | ~1,250 to 2,340 h ASR across languages (sources differ) + ~235 h TTS | **CC-BY 4.0** (commercial OK) | Big, permissive. Check how much is in each Nigerian language. `huggingface.co/datasets/google/WaxalNLP` |
| **African Next Voices** (Gates/Meta-funded, Data Science Nigeria for Nigeria) | Hausa, Igbo, Yoruba, Nigerian Pidgin (+ Bambara) | ~9,000 h across 18 languages in Kenya, Nigeria, South Africa | Reported open access; licence not confirmed | Watch for its release. Pidgin data is rare: important for us. |
| **Omnilingual ASR Corpus** (Meta, 2025) | Speech for 350 under-served languages | varies | CC-BY | Check which Nigerian languages. |
| **Common Voice** (Mozilla) | Read speech, crowd-sourced | Small for Yoruba/Igbo/Hausa | CC0 | Free to use; quality varies. Now distributed via Mozilla Data Collective. |
| **FLEURS** (Google) | Same sentences read in 100+ languages, incl. Hausa, Igbo, Yoruba | ~10 h per language | CC-BY 4.0 | Standard benchmark; use for testing more than training. |
| **BibleTTS** | Studio-quality single-speaker Bible readings incl. Yoruba and Hausa | tens of hours per language | CC-BY-SA 4.0 | Good for TTS pre-training; religious style, not conversational. |
| **Mozilla Data Collective** listings (e.g. Nupe, Ekpeye) | Smaller Nigerian languages | small | varies, often NC | For later languages. |

## Nigerian English (accent)

| Dataset | What | Size | Licence | Notes |
|---|---|---|---|---|
| **AfriSpeech-200** (Intron) | African-accented English, clinical and general, many Nigerian speakers | ~200 h | CC-BY-NC-SA 4.0 | Research/test only unless licensed. |
| N-ATLAS training data | Nigerian-accented English + 3 languages | unknown | check | Check what is published. |
| Our own calls | Real Nigerian phone speech | grows with the business | ours, under our privacy policy and consent | Most valuable source. Plan consent wording now. |

## Nigerian Pidgin

| Dataset | What | Size | Licence | Notes |
|---|---|---|---|---|
| `asr-nigerian-pidgin/nigerian-pidgin-1.0` | Read speech | ~8.6 h, 10 speakers | CC-BY 4.0 | Small but usable. Combined version: `michaelodafe/pidgin-asr-combined` (warning: speakers overlap between splits). |
| Naija-ASR-Corpus (from Universal Dependencies Naija Spoken Corpus) | Natural speech | ~5,900 clips | CC-BY-SA 4.0 | Spontaneous speech: valuable. |
| Rufai/Ajisafe et al. (2020) | Read speech + model | ~4,300 utterances | check | Academic baseline. |
| Pidgin Science Voices (NeurIPS 2025) | Science-focused Pidgin corpus | in progress | check | Watch for release. |
| Dexterity Pidgin Voice Dataset | Storytelling clips, sample | small sample; full set paid | research only | Possible paid source. |

**Pidgin TTS data is almost non-existent. That is an opportunity:** recording our voice actors in Pidgin makes us one of very few with it.

## Models trained on Nigerian speech (to test and learn from)

- **SBPN** (`ogunlao/SBPN_multilingual_base`, `_large`): ASR for Yoruba, Hausa, Igbo, Pidgin, Nigerian English. Paper: arXiv 2605.17710.
- **N-ATLAS** (NCAIR + Awarri): LLM + ASR for Yoruba, Hausa, Igbo, Nigerian English.
- **YarnGPT / YarnGPT2** (`saheedniyi/YarnGPT2`): Nigerian-accent TTS in English, Yoruba, Igbo, Hausa.
- **9jaLingo** (Hugging Face org): Nigerian TTS experiments (e.g. a Spark-TTS African voice).
- Intron Sahara, Spitch: commercial.

## Text data (for language models, tone restoration, scripts)

- **Masakhane** datasets (MasakhaNER, MAFAND-MT, etc.): text in Nigerian languages.
- **JW300 / Bible / Wikipedia** in Yoruba, Igbo, Hausa: check licences; JW300 is restricted.
- Yoruba tone-marked text corpora (e.g. from the Yoruba diacritic-restoration research): needed to train our tone-mark restorer.
- Naija (Pidgin) Wikipedia, BBC Pidgin (BBC content is copyrighted: read for style, don't train on without permission).

## Rules for using data

1. Never train a **commercial** model on NC data without a written agreement.
2. Never use audio scraped from YouTube, Nollywood films, radio or podcasts for a commercial voice without rights. It may be "public" but it is not licensed, and voices belong to people.
3. Keep a **datasheet** for every dataset we use: source, licence, date downloaded, what we used it for.
4. Keep our test sets separate from all training data, forever.
