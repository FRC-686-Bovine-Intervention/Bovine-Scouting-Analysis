# Live Event Recorder

The event recorder polls The Blue Alliance and Statbotics during a live event and saves changed paired snapshots for later simulator playback.

## Before the event

1. Obtain a TBA read API key.
2. Open [scripts/start-event-recorder.bat](scripts/start-event-recorder.bat) in a text editor.
3. Replace both placeholder values:

   ```bat
   set "TBA_AUTH_KEY=your-tba-key"
   set "EVENT_CODE=your-event-code"
   ```

4. Save the file. Keep the key private and do not commit the edited file if it contains a real credential.
5. Run the batch file from Windows Explorer or a Command Prompt.

Start the recorder before competition begins. Its first successful observation is saved as cursor 0, normally tagged `pre-event`. It continues polling until the recorder process is stopped.

## Monitoring and stopping

The default polling intervals are 60 seconds for TBA and 120 seconds for Statbotics. Unchanged observations do not create new cursors.

While the recorder is running, open:

```text
http://127.0.0.1:8788/status
```

The status response shows each event, cursor count, last poll time, provider health, and Statbotics fallback use. Press `Ctrl+C` in the recorder window to stop it cleanly.

Recordings are written to:

```text
recordings/<event-code>/
```

Each event has its own independent cursor sequence. To record several events from a command prompt, use the recorder directly:

```bat
set TBA_AUTH_KEY=your-tba-key
node eventSimulator\recorder.mjs 2026chcmp 2026dcmp
```

## Validate and inspect a recording

From the repository root:

```bat
node eventSimulator\recording-tools.mjs validate recordings\2026chcmp
node eventSimulator\recording-tools.mjs inspect recordings\2026chcmp
```

To make an intentional copy for sharing:

```bat
node eventSimulator\recording-tools.mjs export recordings\2026chcmp exports\2026chcmp
```

Exports contain provider data and provenance, but not the TBA authentication key.

## Replay through the event simulator

In a separate Command Prompt:

```bat
set EVENT_SIMULATOR_RECORDING=recordings\2026chcmp
node eventSimulator\server.mjs
```

Open [http://127.0.0.1:8787/](http://127.0.0.1:8787/). The simulator displays the recorded event tag and cursor position, and its controls replay the saved cursors one at a time. Playback stops at the final cursor; it does not wrap or fabricate additional data.

The recorder uses Statbotics’ configured fallback site when the primary site is unavailable and stores that provenance with the cursor. If a provider is unavailable, the recorder preserves the last known state and marks the provider or endpoint stale/error rather than inventing values.
