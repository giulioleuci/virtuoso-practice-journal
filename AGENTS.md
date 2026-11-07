# Architecture rules
- Keep reference-tone audio in a dedicated hook with fade-in/out and cleanup; the metronome and tuning tone are mutually exclusive to keep the pitch reference clear.
- Keep chromatic pitch conversion in domain logic and microphone lifecycle in a hook; the tuner screen only presents readings and controls so audio cleanup and note math stay independently testable.