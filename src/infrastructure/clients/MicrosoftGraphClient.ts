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
        const url = nextLink.startsWith('http') ? nextLink : nextLink;
        const authHeader = `Bearer ${accessToken.trim()}`;
        
        console.log('Llamando a Microsoft Graph:', url);
        console.log('Token usado - Longitud:', accessToken.trim().length);
        console.log('Token usado - Primeros 50 chars:', accessToken.trim().substring(0, 50));
        
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
          
          console.error('Error de Microsoft Graph:', {
            code: errorCode,
            message: errorMessage,
            status: error.response?.status,
            url: nextLink
          });
          
          if (errorCode === 'InvalidAuthenticationToken' || errorMessage.includes('JWT')) {
            throw new Error(
              `Error de autenticación: El token proporcionado no es válido para Microsoft Graph API. ` +
              `Asegúrate de que el token sea un JWT válido obtenido desde n8n usando el nodo Microsoft OAuth2. ` +
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
