export interface TimingModel {
  /** Wall-clock start time as sent by the API, "HH:mm:ss"; null = any time. */
  at: string | null;
  /** null = no duration. */
  durationMinutes: number | null;
}
