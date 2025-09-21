"use client";
import { useEffect, useRef, useState } from "react";

type UseSpeechOptions = { lang?: string; interim?: boolean };

type RecLike = {
  start: () => void;
  stop: () => void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: any) => void) | null;
  onend: (() => void) | null;
};

export function useSpeechRecognition(options?: UseSpeechOptions) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [continuous, setContinuous] = useState(false);
  const recRef = useRef<RecLike | null>(null);

  useEffect(() => {
    const SR: any =
      typeof window !== "undefined"
        ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
        : undefined;

    if (!SR) return;

    const rec: any = new SR();
    rec.continuous = continuous;
    rec.interimResults = !!options?.interim;
    rec.lang = options?.lang ?? "en-US";

    rec.onresult = (e: any) => {
      const results = Array.from(e?.results as ArrayLike<any>);
      const text = results.map((r: any) => (r?.[0]?.transcript ?? "")).join(" ").trim();
      if (process.env.NODE_ENV !== "production") console.debug("[speech] onresult:", text);
      setTranscript(text);
    };

    rec.onend = () => setListening(false);
    recRef.current = rec;
  }, [continuous, options?.interim, options?.lang]);

  const start = () => {
    if (!recRef.current) return;
    setTranscript("");
    setListening(true);
    if (process.env.NODE_ENV !== "production") console.debug("[speech] start (continuous:", continuous, ")");
    (recRef.current as any).start();
  };

  const stop = () => {
    if (process.env.NODE_ENV !== "production") console.debug("[speech] stop");
    (recRef.current as any)?.stop?.();
  };

  return { listening, transcript, start, stop, continuous, setContinuous };
}

export function speak(text: string) {
  if (typeof window === "undefined") return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
