'use server';

import { z } from 'zod';
import { Client, PlaceData } from '@googlemaps/google-maps-services-js';

export interface Company {
  id: string;
  name: string;
  address: string;
  city: string;
  neighborhood?: string;
  phone?: string;
  niche: string;
  socialMedia?: string;
  website?: string;
  rating?: number;
  reviews?: number;
  enrichedInfo?: string;
}

const searchSchema = z.object({
  industry: z.string().min(1, 'Indústria é obrigatória'),
  city: z.string().min(1, 'Cidade é obrigatória'),
  neighborhood: z.string().optional(),
});

const mapsClient = new Client({});

async function getPlaceDetails(place_id: string, niche: string, city: string, neighborhood?: string): Promise<Company | null> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return null;
    
    const response = await mapsClient.placeDetails({
      params: {
        place_id,
        key: apiKey,
        fields: ['name', 'formatted_address', 'international_phone_number', 'website', 'rating', 'user_ratings_total', 'url', 'vicinity'],
      },
    });

    const place = response.data.result as Partial<PlaceData>;
    
    if (!place.name) return null;
    
    return {
      id: place_id,
      name: place.name,
      address: place.formatted_address || place.vicinity || 'Endereço não disponível',
      city,
      niche: niche,
      neighborhood: neighborhood,
      phone: place.international_phone_number,
      website: place.website,
      socialMedia: place.url,
      rating: place.rating,
      reviews: place.user_ratings_total,
    };
  } catch (error) {
    return null;
  }
}

// Busca uma página usando next_page_token com tentativas automáticas (retry)
// O Google exige que o token seja propagado antes de usá-lo, o que pode levar alguns segundos
async function fetchPageWithRetry(
  pagetoken: string,
  apiKey: string,
  maxRetries = 3,
  delayMs = 2500
): Promise<{ results: any[]; nextPageToken?: string } | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    try {
      const response = await mapsClient.textSearch({
        params: { pagetoken, key: apiKey },
      });
      const status = response.data.status;
      // Se o token ainda não está pronto, o Google retorna INVALID_REQUEST
      if (status === 'INVALID_REQUEST' && attempt < maxRetries) {
        console.log(`[Maps Scraper] Tentativa ${attempt}/${maxRetries}: token ainda não propagado. Aguardando...`);
        continue;
      }
      return {
        results: response.data.results || [],
        nextPageToken: response.data.next_page_token,
      };
    } catch (err: any) {
      console.error(`[Maps Scraper] Erro na tentativa ${attempt}/${maxRetries}:`, err?.message);
      if (attempt === maxRetries) return null;
    }
  }
  return null;
}

export async function searchCompanies(data: z.infer<typeof searchSchema>): Promise<Company[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('Configuração incompleta: API Key ausente.');
  }

  // Monta a query limpando espaços extras (ex: quando bairro não é informado)
  const queryParts = [data.industry, data.neighborhood, data.city].filter(Boolean);
  const query = queryParts.join(' ');

  let allResults: any[] = [];
  
  try {
    console.log(`[Maps Scraper] Iniciando busca: "${query}"`);
    const response = await mapsClient.textSearch({
      params: { query, key: apiKey },
    });
    
    if (response.data.results) {
      allResults = [...response.data.results];
    }

    console.log(`[Maps Scraper] Página 1: ${allResults.length} resultados. Token: ${response.data.next_page_token ? 'sim' : 'não'}`);

    let nextPageToken = response.data.next_page_token;
    let pageCount = 1;

    // Busca até 3 páginas (máximo de 60 resultados do Google)
    while (nextPageToken && pageCount < 3) {
      console.log(`[Maps Scraper] Buscando página ${pageCount + 1}/3...`);
      const pageData = await fetchPageWithRetry(nextPageToken, apiKey);

      if (!pageData) {
        console.warn(`[Maps Scraper] Página ${pageCount + 1} falhou após todas as tentativas. Retornando o que foi coletado.`);
        break;
      }
      
      allResults = [...allResults, ...pageData.results];
      nextPageToken = pageData.nextPageToken;
      pageCount++;
      console.log(`[Maps Scraper] Página ${pageCount}: +${pageData.results.length} resultados. Total: ${allResults.length}`);
    }

    console.log(`[Maps Scraper] Busca finalizada. Total de lugares encontrados: ${allResults.length}`);

    if (allResults.length === 0) return [];

    const companies: Company[] = [];
    const batchSize = 15; // Processar em lotes menores para evitar timeout
    
    for (let i = 0; i < allResults.length; i += batchSize) {
      const batch = allResults.slice(i, i + batchSize);
      const detailPromises = batch
        .filter(p => p.place_id)
        .map(p => getPlaceDetails(p.place_id!, data.industry, data.city, data.neighborhood));
      
      const batchResults = await Promise.all(detailPromises);
      companies.push(...batchResults.filter((c): c is Company => c !== null));
    }

    console.log(`[Maps Scraper] Detalhes coletados para ${companies.length} empresas.`);
    return companies;
  } catch(e: any) {
    console.error('[Maps Scraper] Erro crítico na busca:', e?.message);
    throw new Error('Falha ao processar busca no Google Maps.');
  }
}

export async function handleEnrichData({ companyName }: { companyName: string }): Promise<string> {
  const { enrichCompanyData } = await import('@/ai/flows/data-enrichment');
  try {
    const result = await enrichCompanyData({ companyName });
    return result.additionalInfo;
  } catch (error) {
    return 'Falha ao buscar informações adicionais com IA.';
  }
}

async function getGoogleAuthToken() {
  try {
    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return token.token;
  } catch (e) {
    return null;
  }
}

export async function saveCompanies(companies: Company[]): Promise<{ success: boolean; count: number }> {
  if (!companies.length) throw new Error('Nenhuma empresa para salvar.');

  const projectId = process.env.PROJECT_ID || 'scraper-maps-9268a';
  const token = await getGoogleAuthToken();
  
  if (!token) {
    return { success: true, count: companies.length };
  }

  try {
    const searchId = `search_${Date.now()}`;
    await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/searches?documentId=${searchId}`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            niche: { stringValue: companies[0].niche },
            city: { stringValue: companies[0].city },
            createdAt: { timestampValue: new Date().toISOString() },
            totalCompanies: { integerValue: companies.length.toString() },
          }
        }),
      }
    );

    return { success: true, count: companies.length };
  } catch (error) {
    throw new Error('Erro ao salvar no banco de dados.');
  }
}
