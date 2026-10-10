// Chat view — DOM port of PromptView / ChatBubble / TypingDotsView from
// IslandViewContent.swift.

import { h, svg, clear } from "./dom";
import { ICONS } from "./icons";
import { Bridge, onEvent, type ChatContext } from "../core/bridge";
import { Sound } from "../core/sound";
import { State, type ChatMessage } from "../core/state";
import type { ViewHost } from "./views";

let nextId = 1;

function bubble(message: ChatMessage): HTMLElement {
  if (message.role === "user") {
    return h(
      "div",
      { class: "chat-row user" },
      h("div", { class: "bubble", text: message.content }),
    );
  }
  return h("div", { class: "chat-row" }, h("div", { class: "reply", text: message.content }));
}

function typingDots(): HTMLElement {
  return h(
    "div",
    { class: "chat-row" },
    h("div", { class: "typing" }, h("i"), h("i"), h("i")),
  );
}

/** The coloured chip showing what the question is about (a dropped file). */
function contextChip(label: string): HTMLElement {
  const chip = h("div", { class: "chip" }, h("i", { class: "chip-dot" }), h("span", { text: label }));
  requestAnimationFrame(() => chip.classList.add("settled"));
  return chip;
}

export function buildPrompt(onHeightChange: () => void): ViewHost {
  const chipRow = h("div", { class: "chip-row" });
  const log = h("div", { class: "chat-log" });
  const input = h("input", {
    type: "text",
    class: "chat-input",
    placeholder: "Ask me anything…",
    spellcheck: "false",
  }) as HTMLInputElement;
  const send = h("button", { class: "send-btn", title: "Send" }, svg(ICONS.arrowUp, 11));
  const mic = h("button", { class: "mic-btn", title: "Talk" }, svg(ICONS.mic, 12));
  const bar = h("div", { class: "chat-bar" }, input, mic, send);

  const el = h(
    "div",
    { class: "view" },
    h("div", { class: "card wash chat-card" }, h("div", { class: "chat-body" }, chipRow, log, bar)),
  );
  (el.querySelector(".card") as HTMLElement).style.setProperty("--wash", "rgba(99,102,241,0.5)");

  let sending = false;
  let listening = false;
  let renderedCount = -1;

  // The reply finished being read aloud: Mochi stops "speaking".
  void onEvent("speech-ended", () => {
    if (State.stateOverride === "speaking") {
      State.stateOverride = null;
      State.notify();
    }
  });

  function stopSpeaking() {
    if (State.stateOverride === "speaking") State.stateOverride = null;
    void Bridge.speakStop();
  }

  function showNote(err: unknown) {
    State.stateOverride = null;
    State.noteMessage = String(err).replace(/^Error:\s*/, "");
    State.view = "note";
    Sound.play("error");
    State.notify();
  }

  /** Mic toggle: first click listens, second click transcribes and sends. */
  async function toggleMic() {
    if (sending) return;
    if (!listening) {
      stopSpeaking();
      try {
        await Bridge.voiceStart();
      } catch (err) {
        showNote(err);
        return;
      }
      listening = true;
      mic.classList.add("on");
      State.stateOverride = "listening";
      State.notify();
      // Never leave the microphone open by accident.
      window.setTimeout(() => {
        if (listening) void toggleMic();
      }, 30_000);
      return;
    }
    listening = false;
    mic.classList.remove("on");
    State.stateOverride = "thinking"; // transcribing
    State.notify();
    try {
      const said = await Bridge.voiceStop();
      input.value = said;
      State.stateOverride = null;
      await submit();
    } catch (err) {
      showNote(err);
    }
  }

  async function submit() {
    const query = input.value.trim();
    if (!query || sending) return;
    input.value = "";
    sending = true;
    stopSpeaking();
    Sound.play("send");

    State.chatHistory.push({ id: nextId++, role: "user", content: query });
    State.stateOverride = "thinking";
    State.notify();
    onHeightChange();

    const file = State.droppedFile;
    const context: ChatContext | null =
      State.chatHistory.length === 1 && file
        ? { kind: "file", name: file.name, path: file.path }
        : State.settings.screenAware
          ? { kind: "screen" }
          : null;

    try {
      const reply = await Bridge.chatSend(query, context);
      State.chatHistory.push({ id: nextId++, role: "assistant", content: reply.text });
      State.stateOverride = null;
      Sound.play("finish");
      if (State.settings.speakReplies) {
        State.stateOverride = "speaking";
        void Bridge.speak(reply.text);
      }
    } catch (err) {
      State.stateOverride = null;
      State.noteMessage = String(err).replace(/^Error:\s*/, "");
      State.view = "note";
      Sound.play("error");
    } finally {
      sending = false;
      State.notify();
      onHeightChange();
      input.focus();
    }
  }

  send.addEventListener("click", () => void submit());
  mic.addEventListener("click", () => void toggleMic());
  input.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") {
      e.preventDefault();
      void submit();
    }
    e.stopPropagation(); // Escape closes the island, not the chat
  });

  return {
    el,
    sync() {
      const file = State.droppedFile;
      const wantChip = file?.name ?? "";
      if (chipRow.dataset.label !== wantChip) {
        chipRow.dataset.label = wantChip;
        clear(chipRow);
        if (wantChip) chipRow.append(contextChip(wantChip));
      }

      const thinking = State.stateOverride === "thinking";
      const count = State.chatHistory.length + (thinking ? 0.5 : 0);
      if (count !== renderedCount) {
        renderedCount = count;
        clear(log);
        for (const m of State.chatHistory) log.append(bubble(m));
        if (thinking) log.append(typingDots());
        log.scrollTop = log.scrollHeight;
      }

      input.placeholder = State.chatHistory.length === 0 ? "Ask me anything…" : "Continue…";
      input.disabled = sending;
      mic.disabled = sending;
    },
    focus() {
      input.focus();
      input.select();
    },
  };
}
