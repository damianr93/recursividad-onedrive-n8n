export class TokenStorage {
  private static token: string | null = null;
  private static tokenExpiry: number | null = null;
  private static refreshToken: string | null = null;

  static setToken(token: string, expiresInSeconds?: number): void {
    this.token = token;
    if (expiresInSeconds) {
      this.tokenExpiry = Date.now() + (expiresInSeconds - 300) * 1000;
    } else {
      this.tokenExpiry = null;
    }
  }

  static setRefreshToken(refreshToken: string): void {
    this.refreshToken = refreshToken;
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

  static getRefreshToken(): string | null {
    return this.refreshToken;
  }

  static clearToken(): void {
    this.token = null;
    this.tokenExpiry = null;
    this.refreshToken = null;
  }

  static hasToken(): boolean {
    return this.getToken() !== null;
  }

  static hasRefreshToken(): boolean {
    return this.refreshToken !== null;
  }
}
