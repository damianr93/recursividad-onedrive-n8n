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
      ? `${this.baseUrl}/users/${userId}/drive/items/${folderId}/children`
      : `${this.baseUrl}/me/drive/items/${folderId}/children`;
    
    let nextLink: string | undefined = drivePath;

    while (nextLink) {
      try {
        const response: { data: MicrosoftGraphResponse } = await this.client.get<MicrosoftGraphResponse>(
          nextLink,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        allItems.push(...response.data.value);
        const odataNextLink: string | undefined = response.data['@odata.nextLink'];
        nextLink = odataNextLink ? odataNextLink.replace(this.baseUrl, '') : undefined;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const errorData = error.response?.data;
          const errorMessage = errorData?.error?.message || error.message;
          throw new Error(`Error al obtener items de Microsoft Graph: ${errorMessage}`);
        }
        throw error;
      }
    }

    return allItems;
  }
}
