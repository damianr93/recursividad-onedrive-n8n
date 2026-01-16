export class TokenStorage {
  private static token: string | null = null;
  private static tokenExpiry: number | null = null;

  static setToken(token: string, expiresInSeconds?: number): void {
    this.token = token;
    if (expiresInSeconds) {
      this.tokenExpiry = Date.now() + expiresInSeconds * 1000;
    } else {
      this.tokenExpiry = null;
    }
  }

  static getToken(): string | null {
    if (!this.token) {
      return null;
    }

    if (this.tokenExpiry && Date.now() >= this.tokenExpiry) {
      this.token = null;
      this.tokenExpiry = null;
      return null;
    }

    return this.token;
  }

  static clearToken(): void {
    this.token = null;
    this.tokenExpiry = null;
  }

  static hasToken(): boolean {
    return this.getToken() !== null;
  }
}
