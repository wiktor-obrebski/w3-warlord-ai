export {
  type DecisionRecord,
  type RecordNote,
  type RecordNoteFields,
  type DecisionRecorder,
};

/** What the mind decided in one step, and why. */
interface DecisionRecord {
  readonly notes: readonly RecordNote[];
}

/**
 * A decision and why, as the part of the mind that made it puts it in
 * words; for now the whole content of the decision record.
 */
interface RecordNote {
  readonly message: string;
  readonly fields?: RecordNoteFields;
}

/** The facts behind a note, written to the record's log with it. */
type RecordNoteFields = Readonly<Record<string, string | number | boolean>>;

/** Collects the notes of the tick being run. */
interface DecisionRecorder {
  note({ message, fields }: RecordNote): void;
}
