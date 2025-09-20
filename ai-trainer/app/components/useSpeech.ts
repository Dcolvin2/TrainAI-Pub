"use client";
import { useEffect, useRef, useState } from "react";

type UseSpeechOptions = { lang?: string; interim?: boolean };

export function useSpeechRecognition(options?: UseSpeechOptions) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [continuous, setContinuous] = useState(false);
  const recRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SR: typeof window.SpeechRecognition | undefined =
      (typeof window !== "undefined" ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : undefined);

    if (!SR) return;

    const rec: SpeechRecognition = new (SR as any)();
    rec.continuous = continuous;
    rec.interimResults = !!options?.interim;
    rec.lang = options?.lang ?? "en-US";

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const text = Array.from(e.results).map(r => r[0]?.transcript ?? "").join(" ").trim();
      setTranscript(text);
    };

    rec.onend = () => setListening(false);
    recRef.current = rec;
  }, [continuous, options?.interim, options?.lang]);

  const start = () => {
    if (!recRef.current) return;
    setTranscript("");
    setListening(true);
    recRef.current.start();
  };

  const stop = () => recRef.current?.stop();

  return { listening, transcript, start, stop, continuous, setContinuous };
}

export function speak(text: string) {
  if (typeof window === "undefined") return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
