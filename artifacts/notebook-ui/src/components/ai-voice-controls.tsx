import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Mic, Pause, Play, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AiProviderId } from "@/lib/ai-settings";

type VoiceRecordButtonProps = {
  providerId: AiProviderId;
  available: boolean;
  disabled: boolean;
  onTranscript: (text: string) => void;
};

function errorFromResponse(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const message = (payload as { error?: unknown }).error;
    if (typeof message === "string" && message.trim()) return message;
  }
  return `Запрос не выполнен (HTTP ${status}).`;
}

export function VoiceRecordButton({
  providerId,
  available,
  disabled,
  onTranscript,
}: VoiceRecordButtonProps) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const maxDurationRef = useRef<number | null>(null);

  const releaseMicrophone = () => {
    if (maxDurationRef.current !== null) {
      window.clearTimeout(maxDurationRef.current);
      maxDurationRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => () => releaseMicrophone(), []);

  const startRecording = async () => {
    setErrorMessage("");
    if (!available) {
      setErrorMessage("Для этого провайдера голосовой ввод не настроен.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setErrorMessage("Этот браузер не поддерживает запись с микрофона.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferredTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
      const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        releaseMicrophone();
        setRecording(false);
        setErrorMessage("Не удалось записать звук. Проверьте разрешение браузера на микрофон.");
      };
      recorder.onstop = async () => {
        releaseMicrophone();
        setRecording(false);
        const audio = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        if (!audio.size) {
          setErrorMessage("Запись пустая. Попробуйте ещё раз.");
          return;
        }

        setTranscribing(true);
        try {
          const response = await fetch(`/api/ai/voice/transcribe?providerId=${encodeURIComponent(providerId)}`, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": audio.type.split(";")[0] || "application/octet-stream" },
            body: audio,
          });
          const payload = await response.json().catch(() => null) as unknown;
          if (!response.ok) throw new Error(errorFromResponse(payload, response.status));
          const text = payload && typeof payload === "object" && "text" in payload
            ? (payload as { text?: unknown }).text
            : null;
          if (typeof text !== "string" || !text.trim()) throw new Error("Не удалось распознать речь.");
          if (text.trim().length > 2000) throw new Error("Распознанный вопрос длиннее допустимых 2 000 символов.");
          onTranscript(text.trim());
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : "Не удалось распознать речь.");
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start();
      setRecording(true);
      maxDurationRef.current = window.setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 30_000);
    } catch {
      releaseMicrophone();
      setErrorMessage("Не удалось включить микрофон. Разрешите доступ в настройках браузера.");
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
  };

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || !available || transcribing}
        onClick={recording ? stopRecording : startRecording}
        aria-label={recording ? "Остановить запись вопроса" : "Записать вопрос голосом"}
        data-testid="button-record-assistant-question"
        className="border-[#bfd2c6] bg-white text-[#285d47] hover:bg-[#eaf2ed]"
      >
        {transcribing ? (
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : recording ? (
          <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
        ) : (
          <Mic className="h-4 w-4" aria-hidden="true" />
        )}
        {transcribing ? "Распознаю…" : recording ? "Остановить запись" : "Спросить голосом"}
      </Button>
      {recording && <p className="text-xs text-slate-500" role="status">Идёт запись. Максимум 30 секунд.</p>}
      {errorMessage && <p className="text-xs text-rose-700" role="alert">{errorMessage}</p>}
    </div>
  );
}

type SpeechPlaybackButtonProps = {
  providerId: AiProviderId;
  text: string;
};

export function SpeechPlaybackButton({ providerId, text }: SpeechPlaybackButtonProps) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const currentUrl = audioUrl;
    return () => {
      audioRef.current?.pause();
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [audioUrl]);

  const speak = async () => {
    setErrorMessage("");
    setLoading(true);
    try {
      const response = await fetch("/api/ai/voice/speech", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, text: text.slice(0, 6000) }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as unknown;
        throw new Error(errorFromResponse(payload, response.status));
      }
      const blob = await response.blob();
      if (blob.size === 0) throw new Error("Провайдер не вернул аудиофайл.");
      setAudioUrl(URL.createObjectURL(blob));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось озвучить ответ.");
    } finally {
      setLoading(false);
    }
  };

  const play = async () => {
    const player = audioRef.current;
    if (!player) return;
    setErrorMessage("");
    try {
      await player.play();
    } catch {
      setErrorMessage("Не удалось начать воспроизведение. Нажмите «Играть ответ» ещё раз.");
    }
  };

  const pause = () => audioRef.current?.pause();

  const stop = () => {
    const player = audioRef.current;
    if (!player) return;
    player.pause();
    player.currentTime = 0;
  };

  return (
    <div className="mt-3 space-y-2">
      {!audioUrl ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => void speak()}
          data-testid="button-speak-assistant-answer"
          className="h-7 border-[#d5e2d9] bg-white px-2.5 text-xs text-[#285d47] hover:bg-[#eaf2ed]"
        >
          {loading ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {loading ? "Готовлю аудио…" : "Озвучить ответ"}
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Управление озвученным ответом">
          <audio
            ref={audioRef}
            src={audioUrl}
            preload="none"
            className="sr-only"
            aria-hidden="true"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            data-testid="audio-assistant-answer"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void play()}
            data-testid="button-play-assistant-answer"
            aria-label="Играть ответ"
            className="h-8 border-[#d5e2d9] bg-white px-3 text-xs text-[#285d47] hover:bg-[#eaf2ed]"
          >
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            Играть
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={pause}
            disabled={!playing}
            data-testid="button-pause-assistant-answer"
            aria-label="Пауза"
            className="h-8 border-[#d5e2d9] bg-white px-3 text-xs text-[#285d47] hover:bg-[#eaf2ed]"
          >
            <Pause className="h-3.5 w-3.5" aria-hidden="true" />
            Пауза
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={stop}
            data-testid="button-stop-assistant-answer"
            aria-label="Стоп"
            className="h-8 border-[#d5e2d9] bg-white px-3 text-xs text-[#285d47] hover:bg-[#eaf2ed]"
          >
            <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            Стоп
          </Button>
        </div>
      )}
      {errorMessage && <p className="text-xs text-rose-700" role="alert">{errorMessage}</p>}
    </div>
  );
}
