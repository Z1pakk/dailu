# Phase 5: voice (talk to the coach, hear the answer)

Goal: a mic button that turns speech into the chat input, and an optional "read replies aloud"
mode. Everything runs **in the browser** through the Web Speech API, so there's no backend work,
no cost and no new service.

| Direction | Browser API | Support (check MDN for current status) |
|---|---|---|
| Speech → text | `SpeechRecognition` (`webkitSpeechRecognition` in Chrome/Safari) | Chrome, Edge, Safari. **Not Firefox** |
| Text → speech | `speechSynthesis` + `SpeechSynthesisUtterance` | All modern browsers |

**Decision: use browser speech APIs only.** The trade-offs are no Firefox support for input, and
in Chrome the recognition audio is typically sent to Google's servers for processing. Say that
in the UI tooltip. A server-side alternative (a Whisper model behind an endpoint) is described
at the end if you need it later.

---

## Step 5.1: Types

The speech recognition types aren't in every TypeScript `lib.dom` version. Add:

```bash
npm i -D @types/dom-speech-recognition
```

and add `"dom-speech-recognition"` to `compilerOptions.types` in `tsconfig.app.json` if the
project restricts `types`.

---

## Step 5.2: `SpeechInputService` (speech → text)

`modules/ai-coach/lib/speech-input.service.ts`: a signal-based service, in the same style as the
rest of the app.

```ts
@Injectable({ providedIn: 'root' })
export class SpeechInputService {
  private readonly _Recognition =
    (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

  private _recognition: SpeechRecognition | null = null;

  public readonly isSupported = !!this._Recognition;
  public readonly $isListening = signal(false);
  public readonly $interim = signal('');          // live text while speaking
  public readonly $error = signal<string | null>(null);

  /** Resolves with the final transcript (empty string if nothing was heard). */
  public listenOnce(lang = navigator.language): Promise<string> {
    if (!this.isSupported) return Promise.reject(new Error('not-supported'));
    this.stop();

    return new Promise((resolve) => {
      const r: SpeechRecognition = new this._Recognition();
      r.lang = lang;
      r.interimResults = true;
      r.continuous = false;          // one utterance; stops after a pause
      r.maxAlternatives = 1;

      let finalText = '';
      r.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) finalText += res[0].transcript;
          else interim += res[0].transcript;
        }
        this.$interim.set(finalText + interim);
      };
      r.onerror = (e) => this.$error.set(e.error);   // 'not-allowed', 'no-speech', 'network', ...
      r.onend = () => {
        this.$isListening.set(false);
        this.$interim.set('');
        this._recognition = null;
        resolve(finalText.trim());
      };

      this._recognition = r;
      this.$error.set(null);
      this.$isListening.set(true);
      r.start();
    });
  }

  public stop(): void {
    this._recognition?.stop();       // triggers onend → resolves with what was heard so far
  }
}
```

Error mapping for the UI:
- `not-allowed`: "Microphone access is blocked. Allow it in the browser's site settings."
- `no-speech`: "I didn't hear anything, try again."
- `network`: "Voice input needs an internet connection in this browser."

The microphone needs a **secure context**: `https://` or `localhost`. Your Aspire HTTPS endpoint
already meets that.

---

## Step 5.3: `SpeechOutputService` (text → speech, while streaming)

Waiting for the whole answer before speaking feels slow. Instead, **speak each sentence as soon
as it's complete** in the stream. This also avoids Chrome's tendency to cut off long
utterances.

```ts
@Injectable({ providedIn: 'root' })
export class SpeechOutputService {
  public readonly isSupported = 'speechSynthesis' in window;
  public readonly $enabled = signal(this.readPref());   // "read replies aloud" toggle
  private _buffer = '';

  /** Feed streamed text; complete sentences are queued for speaking. */
  public push(delta: string, lang = navigator.language): void {
    if (!this.$enabled() || !this.isSupported) return;
    this._buffer += delta;

    const match = this._buffer.match(/^[\s\S]*?[.!?…](\s|$)/);   // up to the first sentence end
    if (!match) return;

    this.speak(match[0], lang);
    this._buffer = this._buffer.slice(match[0].length);
    this.push('', lang);                                          // there may be more sentences
  }

  /** Call on the stream's "done" event. */
  public flush(lang = navigator.language): void {
    if (this._buffer.trim()) this.speak(this._buffer, lang);
    this._buffer = '';
  }

  public cancel(): void {
    this._buffer = '';
    speechSynthesis.cancel();
  }

  private speak(text: string, lang: string): void {
    const clean = stripMarkdown(text);          // remove **, #, `, list markers, links
    if (!clean.trim()) return;
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = lang;
    u.voice = pickVoice(lang);                   // see below
    u.rate = 1.05;
    speechSynthesis.speak(u);                    // queued, plays in order
  }
}
```

- **Voices load asynchronously.** `speechSynthesis.getVoices()` can be empty at first, so listen
  for `voiceschanged`. Prefer a voice whose `lang` matches, and one marked `localService`
  (on-device, lower latency).
- **Strip Markdown** before speaking, or it reads out "asterisk asterisk".
- **Cancel** speech when the user sends a new message, presses Stop, or leaves the page.
- Store the toggle in `localStorage` wrapped in `try/catch`. It's a per-device preference.

---

## Step 5.4: Wire it into the chat input

In `ui/chat-input` (phase 4):

- Show a **mic button** only if `speechInput.isSupported`. Otherwise hide it, or show it disabled
  with the tooltip "Voice input isn't supported in this browser".
- **Push-to-talk flow:** click → `listenOnce()` → show `$interim()` live in the textarea → on
  resolve, put the text in the textarea.
- **Decision: don't auto-send by default.** Recognition makes mistakes, and the user should get
  a chance to fix "run" vs "ran". Offer an "auto-send voice messages" setting later if users
  want hands-free use.
- A **speaker toggle** in the chat header controls `speechOutput.$enabled`.
- In the stream handling from phase 4, call `speechOutput.push(event.text)` on `delta`,
  `flush()` on `done`, and `cancel()` on Stop or `error`.
- Accessibility: `aria-pressed` on both toggles, `aria-live="polite"` on the interim transcript,
  and a visible "listening" state (a pulsing icon), not only color.

**Language:** use the user's profile language if Dailu has one, otherwise `navigator.language`.
The system prompt already tells the coach to reply in the user's language, so speech in and
out stay consistent.

---

## ✅ Verify

1. In Chrome: click the mic, say "how was my week", and the text appears live, then lands in the
   textarea.
2. Deny mic permission, and you get a clear message, not a silent failure.
3. Firefox: the mic button is hidden or disabled, and everything else still works.
4. Turn on "read replies aloud" and ask a question. Speech starts after the **first sentence**,
   not after the whole answer. Markdown symbols aren't read out.
5. Press Stop mid-answer, and both the stream and the speech stop.

Commit: `feat(ai-coach): voice input and spoken replies`.

---

## Later (optional): server-side speech

Use this if you need Firefox support, consistent quality, or on-premise processing:

- **Speech-to-text:** record with `MediaRecorder` (webm/opus), then `POST` it to
  `/ai-coach/transcribe`, which forwards it to a Whisper model. Self-host it with
  `faster-whisper` or `whisper.cpp` in a container, or use a provider's OpenAI-compatible
  `/audio/transcriptions` endpoint. `Microsoft.Extensions.AI` has an experimental
  `ISpeechToTextClient` abstraction for this.
- **Text-to-speech:** a self-hosted TTS model such as Piper sounds better than many built-in
  browser voices.

Both need an audio format pipeline and add latency, so do them only if the browser version isn't
good enough.
