'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Loader2, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { handleEnrichData, saveCompanies, searchCompanies, type Company } from '@/app/actions';
import { CompanyCard } from '@/components/company-card';
import { ResultsSkeleton } from '@/components/results-skeleton';

// Configuração de timeout para a página e suas ações
export const maxDuration = 120;

const searchFormSchema = z.object({
  industry: z.string().min(2, { message: 'Nicho deve ter pelo menos 2 caracteres.' }),
  city: z.string().min(2, { message: 'Cidade deve ter pelo menos 2 caracteres.' }),
  neighborhood: z.string().optional(),
});

type SearchFormValues = z.infer<typeof searchFormSchema>;

type ClientCompany = Company & { isEnriching?: boolean };

export default function Home() {
  const [companies, setCompanies] = useState<ClientCompany[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchFormSchema),
    defaultValues: {
      industry: '',
      city: '',
      neighborhood: '',
    },
  });

  async function onSubmit(data: SearchFormValues) {
    setIsSearching(true);
    setCompanies([]);
    try {
      const results = await searchCompanies(data);
      setCompanies(results);
      if (results.length === 0) {
        toast({
          title: 'Busca Concluída',
          description: 'Nenhuma empresa encontrada com os critérios informados.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro na Busca',
        description: error instanceof Error ? error.message : 'Não foi possível realizar a busca. Tente novamente.',
      });
    } finally {
      setIsSearching(false);
    }
  }

  const handleDeleteCompany = (id: string) => {
    setCompanies((prev) => prev.filter((company) => company.id !== id));
    toast({
      title: 'Empresa removida',
      description: 'A empresa foi removida da lista de resultados.',
    });
  };

  const handleEnrichCompany = async (id: string, name: string) => {
    setCompanies((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isEnriching: true } : c))
    );

    try {
      const additionalInfo = await handleEnrichData({ companyName: name });
      setCompanies((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, enrichedInfo: additionalInfo, isEnriching: false }
            : c
        )
      );
      toast({
        title: 'Informação Adicionada!',
        description: 'Novos dados da empresa foram buscados com IA.',
      });
    } catch (error) {
       toast({
        variant: 'destructive',
        title: 'Erro na IA',
        description: 'Não foi possível buscar dados com a IA.',
      });
       setCompanies((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, isEnriching: false }
            : c
        )
      );
    }
  };
  
  const handleSave = async () => {
    if (companies.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nenhuma empresa para salvar',
        description: 'A lista de resultados está vazia.',
      });
      return;
    }
    
    setIsSaving(true);
    try {
      const companiesToSave = companies.map(({ isEnriching, ...rest }) => rest);
      const result = await saveCompanies(companiesToSave);
      if (result.success) {
        toast({
          title: 'Sucesso!',
          description: `${result.count} empresas foram salvas com sucesso.`,
        });
        setCompanies([]);
        form.reset();
      }
    } catch (error) {
       toast({
        variant: 'destructive',
        title: 'Erro ao Salvar',
        description: error instanceof Error ? error.message : 'Não foi possível salvar os dados. Tente novamente.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background font-body text-foreground">
      <main className="container mx-auto px-4 py-8 md:px-6 md:py-12">
        <header className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-extrabold text-primary mb-2 tracking-tight">
            Google Maps Scraper
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Encontre, enriqueça e salve dados de empresas diretamente do Google Maps.
          </p>
        </header>

        <Card className="max-w-4xl mx-auto mb-12 shadow-lg border-2 border-transparent focus-within:border-primary transition-colors">
          <CardHeader>
            <CardTitle className="text-2xl">Nova Busca</CardTitle>
            <CardDescription>Preencha os campos abaixo para extrair até 60 resultados do Google Maps.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="industry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nicho de Atuação</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Restaurante, Mecânica" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: São Paulo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="md:col-span-2">
                    <FormField
                      control={form.control}
                      name="neighborhood"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bairro (Opcional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Pinheiros" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                 <div className="flex justify-end pt-2">
                   <Button type="submit" disabled={isSearching} size="lg" className="w-full sm:w-auto">
                     {isSearching && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                     {isSearching ? 'Buscando (pode levar 1 min)...' : 'Buscar Empresas'}
                   </Button>
                 </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {isSearching && <ResultsSkeleton />}
        
        {!isSearching && companies.length > 0 && (
          <section className="space-y-8">
            <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <h2 className="text-3xl font-bold tracking-tight">Resultados ({companies.length})</h2>
              <Button onClick={handleSave} disabled={isSaving || companies.length === 0} size="lg">
                {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                Salvar no Firestore
              </Button>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {companies.map((company) => (
                <CompanyCard
                  key={company.id}
                  company={company}
                  onDelete={handleDeleteCompany}
                  onEnrich={handleEnrichCompany}
                />
              ))}
            </div>
          </section>
        )}
        
        {!isSearching && companies.length === 0 && (
          <Card className="text-center p-12 border-2 border-dashed bg-card/50">
            <CardContent className="flex flex-col items-center gap-4">
               <div className="p-4 bg-primary/10 rounded-full">
                <Search className="w-8 h-8 text-primary" />
               </div>
              <h3 className="text-xl font-semibold text-foreground">Nenhum resultado para exibir</h3>
              <p className="text-muted-foreground max-w-sm">
                Realize uma busca utilizando o formulário acima para ver a lista de empresas aqui.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
      <Toaster />
    </div>
  );
}
