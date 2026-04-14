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
  pageNumber: number,
  maxRetries = 4,
  delayMs = 3000
): Promise<{ results: any[]; nextPageToken?: string } | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Delay acumulativo: quanto mais tentativas, mais tempo espera
    const waitMs = delayMs * attempt;
    console.log(`[Maps Scraper] Página ${pageNumber} - tentativa ${attempt}/${maxRetries}: aguardando ${waitMs}ms...`);
    await new Promise(resolve => setTimeout(resolve, waitMs));
    try {
      const response = await mapsClient.textSearch({
        params: { pagetoken, key: apiKey },
      });
      const status = response.data.status;
      console.log(`[Maps Scraper] Página ${pageNumber} - tentativa ${attempt}: status=${status}, resultados=${response.data.results?.length ?? 0}`);
      // INVALID_REQUEST significa que o token ainda não está pronto
      if (status === 'INVALID_REQUEST' && attempt < maxRetries) {
        continue;
      }
      if (status === 'OK' || status === 'ZERO_RESULTS') {
        return {
          results: response.data.results || [],
          nextPageToken: response.data.next_page_token,
        };
      }
      // Qualquer outro status na última tentativa, retorna o que tiver
      if (attempt === maxRetries) {
        return { results: response.data.results || [] };
      }
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
    // pageNumber representa a PRÓXIMA página a ser buscada (2 e 3)
    let pageNumber = 2;

    // Busca as pages 2 e 3 (Google limita a 60 resultados = 3 páginas de 20)
    while (nextPageToken && pageNumber <= 3) {
      const pageData = await fetchPageWithRetry(nextPageToken, apiKey, pageNumber);

      if (!pageData) {
        console.warn(`[Maps Scraper] Página ${pageNumber} falhou após todas as tentativas.`);
        break;
      }
      
      allResults = [...allResults, ...pageData.results];
      nextPageToken = pageData.nextPageToken;
      console.log(`[Maps Scraper] Página ${pageNumber} coletada: +${pageData.results.length} resultados. Total acumulado: ${allResults.length}`);
      pageNumber++;
    }

    if (pageNumber === 2) {
      console.warn('[Maps Scraper] ATENÇÃO: next_page_token não foi retornado pelo Google na página 1. Apenas 20 resultados disponíveis.');
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

// Converte um valor JS para o formato de campo do Firestore REST API
function toFirestoreField(value: any): any {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return { integerValue: value.toString() };
    return { doubleValue: value };
  }
  if (typeof value === 'boolean') return { booleanValue: value };
  return { stringValue: String(value) };
}

export async function saveCompanies(companies: Company[]): Promise<{ success: boolean; count: number }> {
  if (!companies.length) throw new Error('Nenhuma empresa para salvar.');

  const projectId = process.env.PROJECT_ID || 'scraper-maps-9268a';
  const token = await getGoogleAuthToken();
  
  if (!token) {
    console.warn('[Maps Scraper] Sem token de autenticação. Salvamento ignorado.');
    return { success: true, count: companies.length };
  }

  const niche = companies[0].niche;
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  try {
    // 1. Cria/atualiza o documento do nicho com metadados
    const nicheDocName = `projects/${projectId}/databases/(default)/documents/niche/${encodeURIComponent(niche)}`;
    await fetch(`${baseUrl}/niche/${encodeURIComponent(niche)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        fields: {
          name: toFirestoreField(niche),
          lastSearchedAt: { timestampValue: new Date().toISOString() },
          lastCity: toFirestoreField(companies[0].city),
          totalLastSearch: toFirestoreField(companies.length),
        }
      }),
    });

    // 2. Salva cada empresa como documento individual via batchWrite
    const writes = companies.map((company) => ({
      update: {
        name: `${nicheDocName}/companies/${company.id}`,
        fields: {
          name: toFirestoreField(company.name),
          address: toFirestoreField(company.address),
          city: toFirestoreField(company.city),
          neighborhood: toFirestoreField(company.neighborhood ?? null),
          phone: toFirestoreField(company.phone ?? null),
          website: toFirestoreField(company.website ?? null),
          socialMedia: toFirestoreField(company.socialMedia ?? null),
          rating: toFirestoreField(company.rating ?? null),
          reviews: toFirestoreField(company.reviews ?? null),
          niche: toFirestoreField(company.niche),
          savedAt: { timestampValue: new Date().toISOString() },
        },
      },
    }));

    const batchResponse = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:batchWrite`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ writes }),
      }
    );

    if (!batchResponse.ok) {
      const errorBody = await batchResponse.text();
      console.error('[Maps Scraper] Erro no batchWrite:', errorBody);
      throw new Error('Erro ao salvar empresas no Firestore.');
    }

    console.log(`[Maps Scraper] ${companies.length} empresas salvas em niche/${niche}/companies`);
    return { success: true, count: companies.length };
  } catch (error: any) {
    console.error('[Maps Scraper] Erro ao salvar:', error?.message);
    throw new Error('Erro ao salvar no banco de dados.');
  }
}

