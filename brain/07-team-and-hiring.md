# 07. Team and hiring

## The short answer: what we actually need

To reach Stage 1 and 2 (our own Nigerian English and Pidgin voices and ears), we need **two strong engineers plus contractors**, not a big lab:

1. **A speech ML engineer** who has trained or fine-tuned TTS or ASR before. **The most important hire.**
2. **A real-time voice engineer** who can make phone calls work fast and reliably.
3. **Contractors:** voice actors, a voice director/audio engineer, linguists, transcribers, a lawyer.

Founders cover product, sales, customers, operations, and the listening tests.

## Roles, in hiring order

### Phase 1: Stage 0 to 2

| Role | Type | What they do | Must have | Nice to have |
|---|---|---|---|---|
| **Founding speech ML engineer** | Full-time | Picks and fine-tunes TTS/ASR models, builds data pipelines and evaluation, serves models | Has shipped or published a TTS or ASR model; PyTorch; knows Hugging Face/NeMo; can explain their training choices | Speaks a Nigerian language; low-resource language experience; Masakhane background |
| **Real-time voice engineer** | Full-time | Pipecat/LiveKit pipeline, telephony (SIP, WebSockets), latency, scaling, the voice worker | Python async; built something real-time with audio or WebRTC; debugging network problems | Telephony/VoIP experience; Africa's Talking or carrier integration |
| **Voice director / audio engineer** | Contract (per session) | Runs recording sessions, sets up the booth, keeps quality consistent | Studio experience; good ears | Voiceover/dubbing industry contacts |
| **Voice actors** | Contract + licence | The voices | Clear, warm, consistent; passes the phone test | Speak 2+ of English/Pidgin/Yoruba/Hausa/Igbo |
| **Linguists** (one per language) | Part-time contract | Write scripts with tone marks, style guides, review pronunciation, run native-speaker panels | Native speaker + formal linguistics training | University connection (UNILAG, UI, OAU, UNN, ABU, BUK) |
| **Transcribers / annotators** | Contract (pay per audio hour) | Transcribe and check audio | Native speakers, careful, pass a test | Can be students; organise through a university or a data company |
| **Lawyer** | Retainer | Voice licence contracts, NDPA, NCC, IP | Nigerian data protection + IP/contracts | Entertainment/performers' rights |

### Phase 2: Stage 3 (more languages, more customers)

- **Data operations lead:** runs collection programmes, transcriber teams, quality checks, consent records. Becomes critical once data volume grows.
- **Second ML engineer (ASR focus)**, so the first can focus on TTS.
- **ML infrastructure / MLOps engineer:** GPU servers, model serving, autoscaling, monitoring, cost.
- **Language leads** for Yoruba, Hausa, Igbo (may grow from the linguist contractors).

### Phase 3: Stage 4

- Research scientist(s) to train our own base models.
- Voice marketplace team (voice talent relations, royalties).

## Can we avoid hiring (or delay it)?

Yes, partly:

- **Fractional/contract ML engineer** for a 3-month Stage 1 project (fixed scope: "fine-tune and serve 3 voices, beat Fish Audio in a blind test"). Then hire full-time if it works.
- **University partnership:** a research lab provides students, linguists, a recording space; we provide funding, a real problem, data and GPU access. Co-publish where appropriate (but agree IP ownership in writing first).
- **Data companies** for transcription instead of building a team early.
- **Partner instead of build** for Yoruba/Hausa/Igbo at first (e.g. Spitch or another provider through our adapters) while we focus on Nigerian English and Pidgin.
- **Credits and grants** for GPU costs: cloud startup programmes (AWS, Google, Microsoft, NVIDIA Inception) and African language-data funds. Check current programmes before applying.

**Don't outsource the core:** the speech ML engineer should be ours. The models and data are the company.

## Where to find people

- **Masakhane**, **Data Science Nigeria**, **Deep Learning Indaba**, **Hugging Face** (look at who published Nigerian speech models and datasets: SBPN, YarnGPT, NaijaVoices, AfriSpeech, 9jaLingo).
- Nigerian diaspora speech engineers (UK, Canada, US, Europe) who want to work on home languages. Offer remote + equity.
- Nigerian AI startups (Spitch, Intron, Awarri and others): experienced people, but respect their contracts.
- Voice actors: Nollywood dubbing studios, radio stations, Nigerian voiceover agencies and associations, audiobook narrators.
- Linguists: linguistics departments at the universities above.

## How to test candidates

### Speech ML engineer: paid take-home (1 week)
> Here is a ~1 hour single-speaker dataset (public, or a pilot recording). Fine-tune a TTS model of your choice. Send us 20 test sentences including Nigerian names and naira amounts, your training notes, and what you'd do with 10x the data.

Interview questions:

- Walk me through a speech model you trained. What went wrong and how did you fix it?
- How would you make a TTS voice sound good on an 8 kHz phone line?
- Yoruba text from our LLM has no tone marks. What do you do?
- How do you know a voice is "good"? How would you run the test?
- Whisper vs. a CTC model (wav2vec/NeMo) for real-time Nigerian ASR: trade-offs?
- How would you check a dataset's licence and record where each clip came from?

### Real-time voice engineer: paid take-home
> Build a phone agent with Pipecat or LiveKit that answers a call and holds a 3-turn conversation. Measure and report the delay of each step. Then make it faster.

Interview questions:

- Where does delay come from in a voice agent, and what would you cut first?
- How do you handle barge-in? Echo?
- A call sounds choppy only for some callers. How do you debug it?

### Voice actors

- Read a 2-minute script (English, then Pidgin, then their other language). Play it down a phone line to 10 Nigerian listeners. Pick the top scores.
- Second round: a 30-minute pilot session to check consistency and stamina.

### Linguists and transcribers

- Transcribe or tone-mark a 5-minute test clip. Compare with a gold reference.

## Culture to build from day one

- **Ears over numbers:** every model change gets listened to by humans.
- **Consent and provenance are non-negotiable:** if we can't prove where data came from and who agreed, we don't use it.
- **Write things down here** in the brain.
