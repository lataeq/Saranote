# Saranote

Saranote is a Thai meeting workspace that turns meeting audio and documents into searchable records, structured summaries, and accountable assignments.

The project combines a notebook-driven Thai speech recognition study with a working team application. It covers the full path from audio transcription and transcript retrieval to task assignment, submission, and manager review.

## What It Does

```text
meeting audio and documents
          |
          v
Thai speech-to-text and text extraction
          |
          v
cleaned transcript and meeting evidence
          |
          +--> decisions, risks, important points, follow-ups
          +--> evidence-linked assignments
          +--> workspace search and grounded answers
```

### Meeting workspace

- Record audio in the browser or upload an existing recording.
- Transcribe Thai meeting audio and retry failed processing without uploading again.
- Import PDF and PPTX documents with page or slide citations.
- Review cleaned transcripts and structured meeting summaries.
- Search across transcripts, documents, decisions, and assignments.
- Return extractive answers linked to the supporting meeting evidence.

### Assignment workflow

- Detect action items, owners, deadlines, and source transcript ranges.
- Resolve spoken names and aliases to employee accounts.
- Create assignments automatically when an owner can be resolved safely.
- Let managers and team leaders correct, reassign, or delete pending work.
- Let employees submit work for approval or revision.

### Access control

- Supports manager, team leader, and team member roles.
- Organizes employees into Web Development, Business Analysis, AI Engineering, and Sales teams.
- Supports meetings for entire teams, leaders, members, or selected employees.
- Restricts meetings, files, search results, assignments, and reviews to authorized users.

## Technical Approach

### Thai speech recognition

The research workflow uses the LOTUSDIS Thai meeting-room dataset for ASR experiments. It includes streaming dataset exploration, text normalization, Whisper baselines, CER/WER evaluation, long-audio chunking, and error analysis.

Two transcription paths are available:

- **Whisper:** open-weight local baseline and the main reproducible research path.
- **Typhoon ASR:** optional API-based experimental backend for stronger Thai transcription during application testing.

LOTUSDIS is used for audio-to-transcript work. It does not provide official meeting-minute summaries or query-answer labels, so retrieval and summarization are evaluated separately from ASR.

### Grounded retrieval

The retrieval layer uses timestamp-preserving chunks, keyword matching, and Thai character n-gram fallback. A no-evidence threshold prevents unsupported questions from returning unrelated meeting content. Answers remain extractive to reduce hallucination risk.

### Application stack

- Python, PyTorch, Transformers, and Librosa
- Next.js 16, React 19, and TypeScript
- SQLite with `better-sqlite3`
- Tailwind CSS and shadcn/ui components
- Vitest and Python `unittest`

## Architecture

```text
notebooks/              Experiment and evaluation workflow
src/asr/                Thai normalization and ASR metrics
src/transcript/         Audio chunking, timestamps, and transcript cleaning
src/documents/          PDF and PPTX text extraction
src/retrieval/          Evidence chunking and retrieval
src/summarization/      Grounded answers, summaries, and action items
src/pipeline/           End-to-end transcription and processing commands
tests/                  Python behavior and regression tests
web/                    Authenticated Next.js meeting workspace
configs/                Runtime model and processing configuration
```

The web server stores users, meetings, access rules, files, and assignments in a local SQLite database. Audio processing calls the Python pipeline, while uploaded files and generated state remain outside Git.

## Evaluation

Saved notebook results currently record:

| Experiment | Result |
| --- | ---: |
| Whisper-tiny, 5 LOTUSDIS samples | 46.88% CER |
| Whisper-small, 20 validation samples | 29.25% average CER |
| Query-based summary checks | 4/4 passed |
| Final pipeline checks | 4/4 passed |
| Targeted error-analysis cases | 5/5 passed |

CER is emphasized because Thai text does not consistently use spaces as word boundaries, making WER unusually sensitive to segmentation.

Current automated verification:

- 37 Python tests
- 10 web tests
- ESLint and production Next.js build
- npm dependency audit with no reported vulnerabilities at the latest local check

## Local Setup

### Requirements

- Python 3.11 or newer
- Node.js 22
- `ffmpeg` for browser-recorded audio conversion
- Poppler `pdftotext` for PDF extraction

On Debian or Ubuntu:

```bash
sudo apt install ffmpeg poppler-utils
```

### Python environment

```bash
cd Saranote

python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Web application

```bash
cd web
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The first visit creates the initial manager account. Managers can then add teams and employee accounts from the Team section.

### Transcription configuration

The default demo configuration is stored in `configs/final_demo.yaml`.

For the Typhoon experiment, either set the key in the manager Settings page or provide it to the server environment:

```bash
export TYPHOON_API_KEY="your-key"
```

API keys, local databases, uploads, generated transcripts, recordings, datasets, and model checkpoints are excluded from Git.

## Command-Line Demo

```bash
PYTHONPATH=. .venv/bin/python -m src.pipeline.run_demo \
  --audio path/to/meeting.wav \
  --question "ฝ่ายดำเนินงานต้องทำอะไร" \
  --config configs/final_demo.yaml
```

The command returns cleaned transcript rows, retrieved evidence, a grounded answer, and detected action items.

## Verification

Run the Python suite from the repository root:

```bash
.venv/bin/python -m unittest discover -s tests
```

Run the web checks from `web/`:

```bash
npm run check
npm audit --audit-level=moderate
```

## Current Limitations

- ASR accuracy remains the main end-to-end bottleneck, especially for noisy or far-field audio.
- Local fine-tuning experiments did not yet outperform the stable Whisper baseline.
- Retrieval is intentionally lightweight and should be evaluated on more real meetings before introducing embeddings or reranking.
- The current answer generator is conservative and extractive rather than a free-form generative summary model.
- PDF and PPTX text extraction requires selectable text; scanned documents need OCR before import.
- The application is currently designed for local or controlled-team use rather than an internet-scale production deployment.

## Privacy

Meeting recordings, transcripts, documents, account data, and API credentials are stored locally and excluded from version control. Use only recordings and documents that participants have authorized for processing.
