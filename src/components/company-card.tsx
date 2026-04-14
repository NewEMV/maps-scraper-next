'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  MapPin,
  Phone,
  Globe,
  Star,
  Sparkles,
  Trash2,
  Loader2,
  Share2,
  LineChart,
} from 'lucide-react';
import type { Company } from '@/app/actions';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { LeadAnalysisCalculator } from './lead-analysis-calculator';

type ClientCompany = Company & { isEnriching?: boolean };

interface CompanyCardProps {
  company: ClientCompany;
  onDelete: (id: string) => void;
  onEnrich: (id: string, name: string) => void;
}

export function CompanyCard({ company, onDelete, onEnrich }: CompanyCardProps) {
  const fullAddress = [company.address, company.neighborhood, company.city].filter(Boolean).join(', ');
  
  return (
    <Card className="flex flex-col shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <CardHeader>
        <div className="flex justify-between items-start gap-4">
          <CardTitle className="text-lg">{company.name}</CardTitle>
          <Badge variant="secondary" className="whitespace-nowrap">{company.niche}</Badge>
        </div>
        {company.rating && (
          <CardDescription>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground pt-1">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span className="font-bold text-foreground">{company.rating}</span>
              <span>({company.reviews} avaliações)</span>
            </div>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex-grow space-y-4 text-sm">
        <InfoItem icon={MapPin} text={fullAddress} />
        {company.phone && <InfoItem icon={Phone} text={company.phone} link={`https://wa.me/${company.phone.replace(/\D/g, '')}`} />}
        {company.website && <InfoItem icon={Globe} text={company.website} link={company.website} />}
        {company.socialMedia && <InfoItem icon={Share2} text={company.socialMedia} link={company.socialMedia} />}
        {company.enrichedInfo && (
          <>
            <Separator />
            <div className="pt-2 space-y-2">
                <h4 className="font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary"/> Info Adicional (IA)</h4>
                <p className="text-muted-foreground italic text-xs leading-relaxed">{company.enrichedInfo}</p>
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-2 pt-4">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="analysis" className="border-b-0">
            <AccordionTrigger className="bg-muted hover:bg-accent/50 px-4 rounded-md text-sm font-semibold hover:no-underline [&[data-state=open]]:rounded-b-none">
              <div className="flex items-center gap-2">
                <LineChart className="w-4 h-4" />
                Análise de Potencial
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-4 bg-muted/30 rounded-b-md border-x border-b">
              <LeadAnalysisCalculator />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <div className="flex justify-end gap-2 mt-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => onEnrich(company.id, company.name)}
                  disabled={company.isEnriching}
                  aria-label="Enriquecer com IA"
                >
                  {company.isEnriching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Enriquecer com IA</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="destructive" size="icon" className="h-9 w-9" onClick={() => onDelete(company.id)} aria-label="Deletar empresa">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Deletar</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardFooter>
    </Card>
  );
}

const InfoItem = ({ icon: Icon, text, link }: { icon: React.ElementType, text: string, link?: string }) => (
  <div className="flex items-start gap-3">
    <Icon className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
    {link ? (
      <a
        href={link.startsWith('http') ? link : `https://${link}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline break-all"
      >
        {text}
      </a>
    ) : (
      <p className="text-foreground break-words">{text}</p>
    )}
  </div>
);
