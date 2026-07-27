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
- Save recordings before background transcription and retry failed processing without uploading again.
- Import PDF and PPTX documents with page or slide citations.
- Preserve the pre-Gemini transcript and review highlighted before/after wording changes.
- Keep transcripts, summaries, decisions, and assignments hidden until the organizer or delegated reviewer publishes them.
- Search across transcripts, documents, decisions, and assignments.
- Return extractive answers linked to the supporting meeting evidence.

### Assignment workflow

- Detect action items, owners, deadlines, and source transcript ranges.
- Resolve spoken names and aliases to employee accounts.
- Create assignments automatically when an owner can be resolved safely.
- Let the meeting reviewer correct, reassign, or cancel pending work before publication.
- Let employees submit work for approval or revision.

### Access control

- Supports manager, team leader, and team member roles.
- Organizes employees into Web Development, Business Analysis, AI Engineering, and Sales teams.
- Supports meetings for entire teams, leaders, members, or selected employees.
- Restricts meetings, files, search results, assignments, and reviews to authorized users.
- Requires a one-time pilot privacy acknowledgment and a recorded confirmation before every browser recording.
- Deletes meeting artifacts after 30 days, with one 30-day extension; assignments receive a separate 30-day clock after approval or cancellation.

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

### n8n meeting-summary email

Typhoon produces the transcript, then Gemini 3.1 Flash-Lite proposes wording corrections and a structured summary. Saranote preserves the pre-Gemini transcript and keeps all generated output in a private draft until review. n8n sends only published summaries, task reminders, and retention notices. During the thesis pilot, every email is routed to one controlled mailbox configured in Settings.

Import the workflow and start n8n:

```bash
n8n import:workflow --input=n8n/send-meeting-summary-email.json
n8n import:workflow --input=n8n/send-task-reminders.json
n8n import:workflow --input=n8n/send-retention-notices.json
n8n start
```

In n8n, create a **Header Auth** credential with the header name `x-saranote-secret` and a long random value. Select it on the Saranote webhook and HTTP request nodes. Select the Gmail OAuth credential on every Gmail node. Test each workflow manually, then activate it.

The scheduled reminder workflow also uses PostgreSQL to prevent duplicate email deliveries and keep their status. Create the table once in the n8n PostgreSQL database:

```sql
CREATE TABLE automation_delivery_log (
  event_key TEXT PRIMARY KEY,
  workflow TEXT NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'sent', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  error_message TEXT
);
```

Create one **Postgres** credential in n8n and select it on **Reserve Delivery** and **Record Delivery Result**. The workflow reserves one reminder per recipient and Bangkok calendar date before Gmail runs. Existing `sent` rows are skipped, while failed or stale processing rows can be retried. Keep the database password only in n8n credentials, not in the workflow JSON or Git.

Run the web app with the matching secret and production webhook URL:

```bash
export N8N_MEETING_SUMMARY_WEBHOOK_URL="http://127.0.0.1:5678/webhook/saranote/meeting-summary"
export N8N_TASK_SUBMITTED_WEBHOOK_URL="http://127.0.0.1:5678/webhook/saranote/task-submitted"
export SARANOTE_N8N_WEBHOOK_SECRET="replace-with-the-same-secret"
export SARANOTE_APP_BASE_URL="http://localhost:3000"
```

The **Email participants** button appears when a meeting has a transcript. Recipients are derived from the meeting access rules. The transcript is sent to Gemini only after a manager requests the email.

The task-reminder workflow runs Monday through Friday at 08:30 in the `Asia/Bangkok` timezone. It reads open assignments from `GET /api/automation/tasks` with the same `x-saranote-secret` header, selects tasks due today or overdue, and sends one Gmail message per assignee. Saranote also sends an `assignment.submitted` event to the task-submitted webhook after an employee submits work; the payload contains reviewer addresses but not the attached file contents.

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

- 38 Python tests
- 22 web tests
- 5 n8n workflow tests
- ESLint and production Next.js build
- npm dependency audit with no reported vulnerabilities at the latest local check

## Local Setup

### Requirements

- Python 3.11 or newer
- Node.js 22
- PostgreSQL 14 or newer for n8n delivery logging
- `ffmpeg` for browser-recorded audio conversion
- Poppler `pdftotext` for PDF extraction

On Debian or Ubuntu:

```bash
sudo apt install ffmpeg poppler-utils postgresql
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

Set the Typhoon and Gemini keys plus the controlled pilot mailbox in the manager Settings page, or provide the keys to the server environment:

```bash
export TYPHOON_API_KEY="your-key"
export GEMINI_API_KEY="your-key"
export SARANOTE_PILOT_EMAIL_SINK="your-controlled-mailbox@example.com"
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

Meeting recordings, transcripts, documents, account data, and API credentials are stored locally and excluded from version control. This milestone is for fictional, registered-employee thesis data only. Every account accepts the pilot notice once, and the organizer must confirm that participants were informed before each recording.
