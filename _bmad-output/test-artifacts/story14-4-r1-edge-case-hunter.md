[
  {
    "location": "src/components/resources/BookingEditor.tsx:154-155",
    "trigger_condition": "Open discard confirmation, submit Save, then click its still-enabled discard button",
    "guard_snippet": "disabled={pending}; onClick={() => { if (!pending) onClose(); }}",
    "potential_consequence": "Editor closes during an in-flight write, losing draft state and persistence confirmation."
  },
  {
    "location": "src/features/resources/booking-editor-input.ts:24-28",
    "trigger_condition": "Editing one timestamp while the untouched endpoint contains seconds or microseconds",
    "guard_snippet": "endsAt: endChanged ? convert(endsAtLocal) : original.endsAt",
    "potential_consequence": "The untouched endpoint is silently rounded to minutes and persisted."
  },
  {
    "location": "src/features/resources/booking-editor-input.ts:15",
    "trigger_condition": "A generated aggregate capacity warning contains at least 94 booking UUIDs",
    "guard_snippet": "logicalId: hash(identity), signedIdentity: identity",
    "potential_consequence": "The genuine warning identity exceeds 4000 characters, preventing any reviewed save."
  }
]