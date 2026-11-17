# 08. Compute and costs

**All prices are rough, as of late 2026, in US dollars.** GPU prices fall every year. Get real quotes before budgeting. Fill in the blanks below as we learn real numbers.

## The big picture

- **Training our first voices is cheap in compute.** The expensive parts are people (voice actors, studio, linguists, transcribers, engineers).
- **Serving calls** is where compute costs grow with the business, and where owning our TTS/ASR saves money at scale.
- **Training a foundation model from scratch** (Stage 4) is the only stage with big compute bills.

## GPUs, in plain words

| GPU | Memory | Good for | Rough rental price per hour |
|---|---|---|---|
| RTX 4090 / 5090 | 24 / 32 GB | Fine-tuning small TTS, experiments | $0.30 – $0.90 |
| L4 | 24 GB | Cheap serving of small models | $0.40 – $0.90 |
| A10 / L40S | 24 / 48 GB | Fine-tuning, serving | $0.80 – $1.50 |
| A100 | 40 / 80 GB | Fine-tuning larger models, ASR training | $1.00 – $2.50 |
| H100 / H200 | 80 / 141 GB | Big training runs, fast serving of LLM-based TTS | $2.00 – $4.00 |

Where to rent: RunPod, Lambda, Vast.ai, Modal, Together, CoreWeave, and the big clouds (more expensive, more reliable). Buying our own 1 to 2 RTX-class GPUs for experiments pays back in a few months of constant use; production should run in a data centre.

## Training cost estimates

| Job | Compute | Rough compute cost |
|---|---|---|
| Fine-tune one TTS voice on 2–5 h of speech | 5–30 GPU-hours | $10 – $100 |
| A TTS bake-off (4 models × 1 voice × a few tries) | 50–200 GPU-hours | $100 – $500 |
| Train a Piper/VITS voice from scratch (10–20 h data) | 50–200 GPU-hours | $50 – $400 |
| Fine-tune ASR on ~500 h of speech | 50–300 A100-hours per run | $100 – $700 per run (expect several runs) |
| Train our own multi-speaker base TTS (Stage 4) | thousands to tens of thousands of GPU-hours | $10,000 – $150,000+ |

## Data and people costs (fill in with real Nigerian quotes)

| Item | Unit | Our quote | Notes |
|---|---|---|---|
| Recording studio (Lagos) | per day | ₦____ | Compare with building a booth: mic, interface, treatment, laptop |
| Home/office booth build | one-off | ₦____ | Pays off after ~20–30 studio days |
| Voice director / engineer | per session | ₦____ | |
| Voice actor | per session + licence fee and/or royalty | ₦____ | See `09` for licence models |
| Linguist (script + review) | per language per month | ₦____ | |
| Transcription | per audio hour | ₦____ | Typically 4–8 hours of work per audio hour if from scratch; much less when correcting a model's draft |
| Native-speaker listening panel | per listener per test | ₦____ | 20+ listeners per test |
| Lawyer (contracts, NDPA) | retainer | ₦____ | |

**Stage 1 budget shape** (3 voices, Nigerian English): studio/booth + 3 actors × ~5 sessions + director + compute ($200–$800) + listening tests + legal + one ML engineer for 3 months. People dominate.

## Serving cost: owning vs renting

During a call the agent speaks roughly 40–60% of the time, and the caller the rest. So one call minute needs roughly 0.5 minutes of TTS and 1 minute of ASR.

| | Rented | Self-hosted (busy GPU) |
|---|---|---|
| TTS | Several cents per minute of speech (premium voices more) | Well under 1 cent per minute, **if** the GPU is kept busy |
| ASR | ~0.5–1.5 cents per minute (streaming) | Fraction of a cent per minute at volume |

**The catch:** a GPU costs the same whether it's busy or idle. Self-hosting only wins once we have steady call volume. Small, fast TTS models (Kokoro, Piper) can serve many streams on one GPU; LLM-based TTS (Orpheus-style) serves fewer. **Measure: how many simultaneous calls can one GPU handle with first audio under 250 ms?** That number decides our margins.

Rule of thumb: rent until a self-hosted GPU would be busy at least ~30–40% of the day, then switch, keeping the rented provider as overflow and fallback.

## Where to host

| Option | Delay to Nigerian callers | Notes |
|---|---|---|
| Lagos data centres (e.g. Rack Centre, Equinix LG / MainOne, Open Access) | Lowest | GPU supply limited; data stays in Nigeria (good for banks and NDPA) |
| Africa cloud regions (Johannesburg / Cape Town on AWS, Azure, Google) | Medium | Easy; GPU types may be limited |
| Europe (London, Frankfurt, Paris) | Medium | Plenty of GPUs, good undersea-cable links to Lagos |
| USA | Highest | Avoid for live calls |

Check data-transfer rules under the NDPA before sending call audio outside Nigeria (see `09`).

## Unit economics to track (per call minute)

```
Price we charge (₦/min)
 − Telephony (₦/min)
 − ASR (₦/min)
 − LLM (₦/min, depends on prompt length and model)
 − TTS (₦/min)
 − Voice royalty (₦/min, if we pay actors per use)
 − Servers, payments, support
 = Margin
```

Our billing already charges per minute in kobo (`packages/core/src/billing`). Add the real cost of each layer next to it as soon as real calls run.
