# 11. Brainstorm log

The working page. Add questions, ideas, test results and decisions here, newest at the top of each section. Put a date on everything.

## Decisions

| Date | Decision | Why | Who |
|---|---|---|---|
| 2026-11-17 | *(proposed)* Rent telephony and the LLM; own TTS and ASR for Nigerian speech, built in stages (see `03`) | Commodity layers vs our edge | *founders to confirm* |
| 2026-11-17 | *(proposed)* Nigerian English voices first, then Pidgin, then Yoruba/Hausa/Igbo | Biggest market and easiest data first; Pidgin is nationwide and has almost no TTS competition | *founders to confirm* |
| 2026-11-17 | *(proposed)* Fine-tune open, commercially licensed models before training anything from scratch | Cheaper, faster; data is the moat, not the model | *founders to confirm* |

## Open questions

- Pipecat or LiveKit Agents for the voice worker? (One-week spike.)
- Which telephony provider for Nigerian numbers: Africa's Talking, a carrier SIP trunk, or both?
- Which accents for the first 3 voices? Ask our first customers what they want their callers to hear.
- Build a recording booth or rent studio time?
- Voice actor payment: flat fee, royalty per minute, or both?
- Partner with Spitch/Intron/others for Yoruba/Hausa/Igbo while we build, or wait?
- How do we get commercial access to NaijaVoices? What does it cost?
- Can we legally use customer call audio for training? (Lawyer.)
- Where to host GPUs: Lagos, Johannesburg, or Europe?
- What does "beat the rented voice" mean exactly? Define the listening test and pass mark before recording.

## Ideas parking lot

- **WhatsApp voice notes agent.** Nigerians live on WhatsApp voice notes. An agent that replies with voice notes in a local voice needs no real-time pipeline (delay matters much less), so our voices could ship there first.
- **Public Nigerian voice benchmark.** Publish a test set and leaderboard for Nigerian ASR/TTS. Builds credibility, attracts talent, shows we're ahead.
- **Named voice actors as a brand.** "Book a call with Ngozi's voice." Real people with consent and royalties, unlike anonymous clones.
- **Voice marketplace** for Nigerian voice actors (Stage 4).
- **IVR replacement for banks and telcos:** "press 1 for..." replaced by speaking naturally in any Nigerian language.
- **Radio/audio ads and announcements** generated in local voices (non-real-time, uses the same TTS).
- **Dubbing/narration** for Nollywood, e-learning, audiobooks. Another revenue line for the same voices.
- **University recording-booth partnership:** a booth on campus, students as transcribers, linguists as reviewers.
- **Pronunciation lexicon as a product feature:** businesses upload their customers' names; our voices say them right.
- **Code-switching as a headline feature:** "the only agent that understands 'abeg send am to my GTB account'".

## Experiment notes

Template:

```
### YYYY-MM-DD: <what we tried>
- Goal:
- Setup (data, model, settings):
- Result (numbers + what it sounded like):
- What we learnt / next step:
```
