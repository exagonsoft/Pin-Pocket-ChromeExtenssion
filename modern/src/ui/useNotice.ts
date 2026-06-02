import { useState } from "react";

export type NoticeTone = "info" | "success" | "error" | "warn";

export function useNotice() {
  const [text, setText] = useState("");
  const [tone, setTone] = useState<NoticeTone>("info");

  const show = (next: string, nextTone: NoticeTone = "info") => {
    setText(next);
    setTone(nextTone);
  };

  return {
    notice: text ? { text, tone } : null,
    show,
    clear: () => setText(""),
  };
}
