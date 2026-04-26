export interface ProblemDetailsModel {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  requestId: string;
  traceId: string;
  errors?: Record<string, string[]>;
}
