"use client";

import { useEffect, useRef, useState } from "react";
import { FileUp, Mic, Pause, Play, RefreshCw, Square, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { confirmMeetingRecordingAction } from "@/app/actions/meetings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type UploadKind = "audio" | "document";

export function MeetingCapture({
  meetingId,
  processingStatus,
  canRetry = false,
}: {
  meetingId: number;
  processingStatus: "idle" | "processing" | "completed" | "failed";
  canRetry?: boolean;
}) {
  const router = useRouter();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    if (!recording || paused) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [paused, recording]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  useEffect(() => {
    if (processingStatus !== "processing") return;
    const timer = window.setInterval(() => router.refresh(), 4_000);
    return () => window.clearInterval(timer);
  }, [processingStatus, router]);

  async function upload(file: File, kind: UploadKind) {
    setBusy(true);
    setMessage(null);
    const data = new FormData();
    data.set("file", file);
    data.set("kind", kind);
    try {
      const response = await fetch(`/api/meetings/${meetingId}/files`, { method: "POST", body: data });
      const result = (await response.json()) as { error?: string; processing?: { status: "processing" } };
      if (!response.ok) throw new Error(result.error || "Upload failed.");
      if (result.processing?.status === "processing") setMessage({ text: "Audio saved. Transcription is running in the background.", error: false });
      router.refresh();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Upload failed.", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    setMessage(null);
    if (!window.confirm("Confirm that every participant has been informed before recording starts.")) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMessage({ text: "Audio recording is not supported in this browser.", error: true });
      return;
    }
    try {
      if (!await confirmMeetingRecordingAction(meetingId)) throw new Error("Only the meeting organizer can confirm recording consent.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      setSeconds(0);
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onpause = () => setPaused(true);
      recorder.onresume = () => setPaused(false);
      recorder.onstop = async () => {
        setPaused(false);
        const mime = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        await upload(new File([blob], `recording-${stamp}.webm`, { type: mime }), "audio");
      };
      if ("speechSynthesis" in window) {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance("Recording has started"));
      }
      recorder.start();
      setRecording(true);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Microphone permission was denied or no microphone is available.", error: true });
    }
  }

  async function retry() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/meetings/${meetingId}/process`, { method: "POST" });
      const result = (await response.json()) as { error?: string; processing?: { status: "processing" } };
      if (!response.ok || !result.processing) throw new Error(result.error || "Retry failed.");
      setMessage({ text: "Retry started. The saved audio will not be deleted if processing fails.", error: false });
      router.refresh();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Retry failed.", error: true });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  function togglePause() {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.pause();
    else if (recorder?.state === "paused") recorder.resume();
  }

  function selectedFile(event: React.ChangeEvent<HTMLInputElement>, kind: UploadKind) {
    const file = event.target.files?.[0];
    if (file) void upload(file, kind);
    event.target.value = "";
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {recording ? (
          <>
            <Button type="button" variant="outline" onClick={togglePause}>{paused ? <Play className="size-4" /> : <Pause className="size-4" />} {paused ? "Resume" : "Pause"}</Button>
            <Button type="button" variant="destructive" onClick={stopRecording}><Square className="size-3.5 fill-current" /> Stop {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</Button>
          </>
        ) : (
          <Button type="button" variant="outline" onClick={() => void startRecording()} disabled={busy}><Mic className="size-4" /> Start recording</Button>
        )}
        <Button type="button" variant="outline" onClick={() => audioInputRef.current?.click()} disabled={busy}><Upload className="size-4" /> Upload audio</Button>
        <input ref={audioInputRef} className="sr-only" type="file" accept="audio/*,.wav,.mp3,.m4a,.flac" onChange={(event) => selectedFile(event, "audio")} disabled={busy} />
        <Button type="button" variant="outline" onClick={() => documentInputRef.current?.click()} disabled={busy}><FileUp className="size-4" /> Import document</Button>
        <input ref={documentInputRef} className="sr-only" type="file" accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,application/pdf" onChange={(event) => selectedFile(event, "document")} disabled={busy} />
        {canRetry ? <Button type="button" variant="outline" onClick={() => void retry()} disabled={busy}><RefreshCw className="size-4" /> Retry processing</Button> : null}
      </div>
      {recording ? <p className="font-medium text-red-700" role="status" aria-live="assertive">● Recording in progress · participants informed</p> : null}
      {busy ? <p className="text-[12px] text-subtle">Saving file…</p> : null}
      {processingStatus === "processing" ? <p className="text-[12px] text-subtle" role="status">Audio is safely stored. Transcription is processing…</p> : null}
      {message ? <Alert variant={message.error ? "destructive" : "default"}><AlertDescription>{message.text}</AlertDescription></Alert> : null}
    </div>
  );
}
