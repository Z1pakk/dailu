export interface LoginRequest {
  email: string;
  password: string;
  captchaPayload?: string;
}
