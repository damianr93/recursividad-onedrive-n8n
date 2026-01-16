import axios, { type AxiosInstance } from 'axios';
import type { OneDriveItem } from '../../domain/entities/File.js';

export interface MicrosoftGraphResponse {
  value: OneDriveItem[];
  '@odata.nextLink'?: string;
}

export class MicrosoftGraphClient {
  private readonly baseUrl = 'https://graph.microsoft.com/v1.0';
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async getItemsByFolderId(
    folderId: string,
    accessToken: string,
    userId?: string
  ): Promise<OneDriveItem[]> {
    const allItems: OneDriveItem[] = [];
    const drivePath = userId 
      ? `/users/${userId}/drive/items/${folderId}/children`
      : `/me/drive/items/${folderId}/children`;
    
    let nextLink: string | undefined = drivePath;

    while (nextLink) {
      try {
        const url = nextLink.startsWith('http') ? nextLink : `${this.baseUrl}${nextLink}`;
        const authHeader = `Bearer ${accessToken.trim()}`;
        
        const response: { data: MicrosoftGraphResponse } = await this.client.get<MicrosoftGraphResponse>(
          url,
          {
            headers: {
              Authorization: authHeader,
            },
          }
        );

        allItems.push(...response.data.value);
        const odataNextLink: string | undefined = response.data['@odata.nextLink'];
        nextLink = odataNextLink || undefined;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const errorData = error.response?.data;
          const errorMessage = errorData?.error?.message || error.message;
          const errorCode = errorData?.error?.code;
          
          if (errorCode === 'InvalidAuthenticationToken' || errorMessage.includes('JWT')) {
            throw new Error(
              `Error de autenticación: El token proporcionado no es válido para Microsoft Graph API. ` +
              `Detalles: ${errorMessage}`
            );
          }
          
          throw new Error(`Error al obtener items de Microsoft Graph: ${errorMessage}`);
        }
        throw error;
      }
    }

    return allItems;
  }
}
