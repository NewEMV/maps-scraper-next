'use server';

/**
 * @fileOverview A data enrichment AI agent that searches the web for additional information about a company.
 *
 * - enrichCompanyData - A function that handles the data enrichment process.
 * - EnrichCompanyDataInput - The input type for the enrichCompanyData function.
 * - EnrichCompanyDataOutput - The return type for the enrichCompanyData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EnrichCompanyDataInputSchema = z.object({
  companyName: z.string().describe('The name of the company to enrich data for.'),
});
export type EnrichCompanyDataInput = z.infer<typeof EnrichCompanyDataInputSchema>;

const EnrichCompanyDataOutputSchema = z.object({
  additionalInfo: z.string().describe('Additional information about the company found on the web.'),
});
export type EnrichCompanyDataOutput = z.infer<typeof EnrichCompanyDataOutputSchema>;

export async function enrichCompanyData(input: EnrichCompanyDataInput): Promise<EnrichCompanyDataOutput> {
  return enrichCompanyDataFlow(input);
}

const enrichCompanyDataPrompt = ai.definePrompt({
  name: 'enrichCompanyDataPrompt',
  input: {schema: EnrichCompanyDataInputSchema},
  output: {schema: EnrichCompanyDataOutputSchema},
  prompt: `You are a data enrichment specialist. Your goal is to find as much information as possible about a given company by searching the web.

  Company Name: {{{companyName}}}
  
  Provide any additional information that might be useful, such as social media links or website URLs. Focus on finding links and URLs.
  Please format your response as a concise paragraph.`,
});

const enrichCompanyDataFlow = ai.defineFlow(
  {
    name: 'enrichCompanyDataFlow',
    inputSchema: EnrichCompanyDataInputSchema,
    outputSchema: EnrichCompanyDataOutputSchema,
  },
  async input => {
    const {output} = await enrichCompanyDataPrompt(input);
    return output!;
  }
);
