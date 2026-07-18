"use client";

import { useEffect, useRef, useState } from "react";
import { FileUp, Mic, Pause, Play, RefreshCw, Square, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type UploadKind = "audio" | "document";

export function MeetingCapture({ meetingId, canRetry = false }: { meetingId: number; canRetry?: boolean }) {
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

  async function upload(file: File, kind: UploadKind) {
    setBusy(true);
    setMessage(null);
    const data = new FormData();
    data.set("file", file);
    data.set("kind", kind);
    try {
      const response = await fetch(`/api/meetings/${meetingId}/files`, { method: "POST", body: data });
      const result = (await response.json()) as { error?: string; processing?: { status: "completed"; actions: number; assigned: number } | { status: "failed"; error: string } };
      if (!response.ok) throw new Error(result.error || "Upload failed.");
      if (result.processing?.status === "failed") {
        setMessage({ text: result.processing.error, error: true });
        router.refresh();
        return;
      }
      if (result.processing?.status === "completed") {
        setMessage({ text: `Transcript generated. ${result.processing.assigned} of ${result.processing.actions} detected assignments added to My work.`, error: false });
      }
      router.refresh();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Upload failed.", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    setMessage(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMessage({ text: "Audio recording is not supported in this browser.", error: true });
      return;
    }
    try {
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
      recorder.start();
      setRecording(true);
    } catch {
      setMessage({ text: "Microphone permission was denied or no microphone is available.", error: true });
    }
  }

  async function retry() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/meetings/${meetingId}/process`, { method: "POST" });
      const result = (await response.json()) as { error?: string; processing?: { status: "completed"; actions: number; assigned: number } | { status: "failed"; error: string } };
      if (!response.ok || !result.processing) throw new Error(result.error || "Retry failed.");
      if (result.processing.status === "failed") throw new Error(result.processing.error);
      setMessage({ text: `Transcript generated. ${result.processing.assigned} new assignments added to My work.`, error: false });
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
      {busy ? <p className="text-[12px] text-subtle">Saving file… Audio transcription may take a few minutes.</p> : null}
      {message ? <Alert variant={message.error ? "destructive" : "default"}><AlertDescription>{message.text}</AlertDescription></Alert> : null}
    </div>
  );
}
