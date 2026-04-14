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

// Executa uma única busca de texto e retorna os resultados brutos
async function runTextSearch(query: string, apiKey: string): Promise<any[]> {
  try {
    console.log(`[Maps Scraper] Buscando: "${query}"`);
    const response = await mapsClient.textSearch({ params: { query, key: apiKey } });
    const results = response.data.results || [];
    console.log(`[Maps Scraper] "${query}": ${results.length} resultados`);
    return results;
  } catch (err: any) {
    console.error(`[Maps Scraper] Falha na query "${query}":`, err?.message);
    return [];
  }
}

export async function searchCompanies(data: z.infer<typeof searchSchema>): Promise<Company[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('Configuração incompleta: API Key ausente.');
  }

  // Monta 3 variações da query para maximizar resultados únicos (até 60)
  // A paginação via next_page_token do Google é instável em Cloud Run, então
  // usamos múltiplas buscas paralelas com deduplicação por place_id.
  const { industry, city, neighborhood } = data;

  const query1 = [industry, neighborhood, city].filter(Boolean).join(' ');
  const query2 = [industry, city].filter(Boolean).join(' ');
  const query3 = neighborhood
    ? `${industry} em ${neighborhood} ${city}`
    : `melhores ${industry} ${city}`;

  console.log(`[Maps Scraper] Iniciando 3 buscas paralelas para: ${industry} / ${city}`);

  // Executa as 3 buscas em paralelo
  const [results1, results2, results3] = await Promise.all([
    runTextSearch(query1, apiKey),
    runTextSearch(query2, apiKey),
    runTextSearch(query3, apiKey),
  ]);

  // Deduplica todos os resultados por place_id
  const seen = new Set<string>();
  const uniqueResults: any[] = [];
  for (const r of [...results1, ...results2, ...results3]) {
    if (r.place_id && !seen.has(r.place_id)) {
      seen.add(r.place_id);
      uniqueResults.push(r);
    }
  }

  console.log(`[Maps Scraper] Total único após deduplicação: ${uniqueResults.length} (de ${results1.length + results2.length + results3.length} brutos)`);

  if (uniqueResults.length === 0) return [];

  try {
    const companies: Company[] = [];
    const batchSize = 15; // Processar em lotes para evitar timeout

    for (let i = 0; i < uniqueResults.length; i += batchSize) {
      const batch = uniqueResults.slice(i, i + batchSize);
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

