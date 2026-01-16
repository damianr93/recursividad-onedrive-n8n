import axios from 'axios';
import { TokenStorage } from './TokenStorage.js';

export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export class OAuth2Service {
  constructor(private readonly config: OAuth2Config) {}

  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      response_mode: 'query',
      scope: 'https://graph.microsoft.com/Files.Read.All offline_access',
      state: state || 'default',
    });

    return `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<TokenResponse> {
    const tokenUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;

    try {
      const response = await axios.post<TokenResponse>(
        tokenUrl,
        new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code: code,
          redirect_uri: this.config.redirectUri,
          grant_type: 'authorization_code',
          scope: 'https://graph.microsoft.com/Files.Read.All offline_access',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      TokenStorage.setToken(response.data.access_token, response.data.expires_in);
      
      if (response.data.refresh_token) {
        TokenStorage.setRefreshToken(response.data.refresh_token);
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;
        throw new Error(
          `Error al intercambiar código por token: ${errorData?.error_description || error.message}`
        );
      }
      throw error;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const tokenUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;

    try {
      const response = await axios.post<TokenResponse>(
        tokenUrl,
        new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
          scope: 'https://graph.microsoft.com/Files.Read.All offline_access',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      TokenStorage.setToken(response.data.access_token, response.data.expires_in);
      
      if (response.data.refresh_token) {
        TokenStorage.setRefreshToken(response.data.refresh_token);
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;
        throw new Error(
          `Error al renovar token: ${errorData?.error_description || error.message}`
        );
      }
      throw error;
    }
  }
}
