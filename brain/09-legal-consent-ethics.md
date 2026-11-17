# 09. Legal, consent and ethics

> **Not legal advice.** This is a list of things to raise with a Nigerian lawyer. The app's compliance items live in `docs/COMPLIANCE_TODO.md`.

## Why this matters more for us than for most

A voice is a person. Training voices means holding recordings that can identify people and could be misused to impersonate them. Banks, telcos and government clients will ask hard questions. Being the company with **clean, provable consent** is part of the product.

## 1. Voice actor agreements

Every voice actor signs a written agreement **before** recording. Points to cover with the lawyer:

- **What is licensed:** recordings, and the right to train a synthetic voice from them.
- **Uses allowed:** e.g. business phone agents on Spag AI. **Uses banned:** politics and elections, adult content, religious content (unless agreed), fraud, impersonating real people, anything defamatory, content the actor finds objectionable (list it).
- **Exclusive or non-exclusive:** may the actor license their voice to others? Exclusive costs more but protects our catalogue.
- **Payment model** (pick one, or mix):
  - Flat fee per session + buyout for a period
  - Flat fee + **royalty per minute** of generated speech (fairer; encourages good actors; needs usage tracking)
  - Revenue share (for a future voice marketplace)
- **Duration and territory:** how long, where.
- **Credit:** is the actor named in the product? (Named voices can be a selling point.)
- **Transparency:** the actor can ask which customers use their voice and hear samples.
- **Withdrawal:** what happens if they want to stop? (Usually: no new customers, existing contracts run out, models deleted after a notice period.)
- **Who owns what:** we own the model weights; they keep their natural voice and identity rights.
- **Moral rights / performers' rights** under the Nigerian Copyright Act 2022.
- **Death or incapacity:** what happens to the voice.
- A recorded spoken **consent statement** at the start of each session, kept with the files.

## 2. Nigeria Data Protection Act 2023 (NDPA)

Points to check with the lawyer:

- **Voice recordings are personal data.** A voice used to identify someone may count as **biometric data**, which the NDPA treats as **sensitive personal data** needing explicit consent and stronger protection.
- **Lawful basis and consent** for: voice actors (contract + explicit consent), people who contribute to data collection, and **callers on customer calls** (whose audio we may want for ASR training).
- **Call recordings for training:** callers must be told, and the basis must be valid. Our customers (the businesses) are often the data controllers and we are the processor. Our contracts with them must say whether we may use call audio to improve our models, and callers must be informed. Consider an opt-out and anonymisation.
- **Data Protection Impact Assessment** before large-scale processing of voice data.
- **Registration** with the Nigeria Data Protection Commission (NDPC) if we qualify as a data controller/processor of major importance; Data Protection Officer; annual compliance audit returns. Check the NDPC's current implementation directive for details.
- **Cross-border transfer:** sending audio to servers or providers outside Nigeria (US/EU cloud, rented TTS/ASR) needs a valid transfer basis. Another reason to host in Nigeria eventually.
- **Retention:** how long we keep recordings and transcripts (`docs/COMPLIANCE_TODO.md` item 3).
- **Data subject rights:** access, deletion, objection. A caller asking us to delete their voice must be possible.

## 3. Telecoms (NCC)

Already tracked in `docs/COMPLIANCE_TODO.md`: number registration, calling hours, the Do-Not-Disturb register, consumer code. For synthetic voices, ask the lawyer:
- Must the caller be told they are speaking to an AI? (Even if not required, **we should disclose by default**. It builds trust and is becoming the global norm.)

## 4. Data we didn't record ourselves

- Respect dataset licences (see `05-datasets.md`). NC means no commercial use without an agreement.
- **Never** build a commercial voice from audio scraped from films, radio, YouTube, podcasts or social media, even if it's "public".

## 5. Deepfake and misuse safeguards (build into the product)

- **No cloning of a voice without verified consent of that person.** If we ever let customers clone voices: the speaker reads a random consent phrase live; we check it matches the sample.
- **No voices of public figures** (politicians, celebrities, religious leaders) without written permission from them.
- **Watermark** all generated audio (inaudible), and keep logs: which customer, which voice, when, what text.
- **Know your customer** for businesses that use our voices, especially for outbound calls.
- **Content rules:** block scripts that impersonate banks, the police, EFCC, telcos, or that ask for PINs/OTPs, unless the business is verified as that organisation. Fraud calls are a real problem in Nigeria; we must not become a tool for them.
- **Abuse reporting:** a way for anyone to report a misused voice, and a process to act fast.

## 6. Fairness and quality

- Test ASR accuracy by region, gender, age and language, so it doesn't work only for Lagos English speakers.
- Pay data contributors, transcribers and native-speaker panels fairly.
- Give back where we can: credit communities, contribute to open data or benchmarks when it doesn't hurt the business.

## Questions for the first meeting with the lawyer

1. Is a voice recording "biometric" under the NDPA, and what does that require of us?
2. Can we use customers' call audio to train our ASR? What must the caller hear, and what must our customer contracts say?
3. What should a synthetic-voice licence agreement with a Nigerian voice actor include? Flat fee vs royalty?
4. Do we need to register with the NDPC now? As what tier?
5. Can we send call audio to providers or servers outside Nigeria today? On what basis?
6. Must AI callers disclose that they are AI?
7. Does a CC-BY-SA dataset licence affect the models we train on it?
