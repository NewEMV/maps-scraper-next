'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowDown, ArrowUp, ChevronsRight, Clock, DollarSign, TrendingUp, CalendarDays } from 'lucide-react';

const analysisSchema = z.object({
  attendants: z.coerce.number().min(0).default(1),
  sellers: z.coerce.number().min(0).default(1),
  avgTicket: z.coerce.number().min(0).default(0),
  dailyServices: z.coerce.number().min(0).default(0),
  dailySales: z.coerce.number().min(0).default(0),
  avgServiceTime: z.coerce.number().min(0).default(15),
  avgSaleTime: z.coerce.number().min(0).default(30),
  workdayHours: z.coerce.number().min(1).max(24).default(8),
  lostSales: z.coerce.number().min(0).default(0),
  simulatedAttendants: z.coerce.number().min(0).default(0),
  simulatedSellers: z.coerce.number().min(0).default(0),
});

type AnalysisFormValues = z.infer<typeof analysisSchema>;

const formatCurrency = (value: number) => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatHours = (hours: number) => {
    if (hours < 0) return '0h 0m';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
}

export function LeadAnalysisCalculator() {
  const form = useForm<AnalysisFormValues>({
    resolver: zodResolver(analysisSchema),
    defaultValues: {
      attendants: 1,
      sellers: 1,
      avgTicket: 0,
      dailyServices: 0,
      dailySales: 0,
      avgServiceTime: 15,
      avgSaleTime: 30,
      workdayHours: 8,
      lostSales: 0,
      simulatedAttendants: 0,
      simulatedSellers: 0,
    },
  });

  const [formValues, setFormValues] = useState<AnalysisFormValues>(form.getValues());
  
  useEffect(() => {
    const subscription = form.watch((value) => {
      setFormValues(value as AnalysisFormValues);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const calculations = useMemo(() => {
    const {
      attendants,
      sellers,
      avgTicket,
      dailyServices,
      dailySales,
      avgServiceTime,
      avgSaleTime,
      workdayHours,
      lostSales,
      simulatedAttendants,
      simulatedSellers,
    } = formValues;

    const dailyRevenue = dailySales * avgTicket;
    const conversionRate = dailyServices > 0 ? (dailySales / dailyServices) * 100 : 0;
    
    const totalServiceTimeHours = (dailyServices * avgServiceTime) / 60;
    const totalSaleTimeHours = (dailySales * avgSaleTime) / 60;
    const totalWorkTimeHours = totalServiceTimeHours + totalSaleTimeHours;
    
    const totalAvailableHours = (attendants + sellers) * workdayHours;
    const idleTimeWorkday = Math.max(0, totalAvailableHours - totalWorkTimeHours);

    const lostTimeMinutes = lostSales * avgSaleTime;
    const lostTimeHours = lostTimeMinutes / 60;
    const lostRevenue = lostSales * avgTicket;

    const real = {
        dailyRevenue,
        monthlyRevenue: dailyRevenue * 30,
        semiAnnualRevenue: dailyRevenue * 180,
        annualRevenue: dailyRevenue * 365,
        conversionRate,
        idleTimeWorkday,
        lostTimeHours,
        lostRevenue
    };

    const totalAttendantsSim = attendants + simulatedAttendants;
    const totalSellersSim = sellers + simulatedSellers;
    const servicesPerAttendant = attendants > 0 ? dailyServices / attendants : 0;
    const salesPerSeller = sellers > 0 ? dailySales / sellers : 0;

    const dailyServicesSim = Math.round(totalAttendantsSim * servicesPerAttendant);
    const dailySalesSim = Math.round(totalSellersSim * salesPerSeller);
    
    const dailyRevenueSim = dailySalesSim * avgTicket;
    const recoveredRevenue = lostSales * avgTicket;
    
    const simulated = {
      monthlyRevenue: dailyRevenueSim * 30,
      semiAnnualRevenue: dailyRevenueSim * 180,
      annualRevenue: dailyRevenueSim * 365,
      recoveredRevenue
    };

    return { real, simulated };
  }, [formValues]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Dados Coletados</h3>
        <Form {...form}>
          <form className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="attendants" render={({ field }) => ( <FormItem> <FormLabel>Atendentes</FormLabel> <FormControl> <Input type="number" {...field} /> </FormControl> </FormItem> )} />
              <FormField control={form.control} name="sellers" render={({ field }) => ( <FormItem> <FormLabel>Vendedores</FormLabel> <FormControl> <Input type="number" {...field} /> </FormControl> </FormItem> )} />
              <FormField control={form.control} name="avgTicket" render={({ field }) => ( <FormItem> <FormLabel>Ticket Médio (R$)</FormLabel> <FormControl> <Input type="number" {...field} /> </FormControl> </FormItem> )} />
              <FormField control={form.control} name="workdayHours" render={({ field }) => ( <FormItem> <FormLabel>Jornada (horas)</FormLabel> <FormControl> <Input type="number" {...field} /> </FormControl> </FormItem> )} />
              <FormField control={form.control} name="dailyServices" render={({ field }) => ( <FormItem> <FormLabel>Atend./dia</FormLabel> <FormControl> <Input type="number" {...field} /> </FormControl> </FormItem> )} />
              <FormField control={form.control} name="dailySales" render={({ field }) => ( <FormItem> <FormLabel>Vendas/dia</FormLabel> <FormControl> <Input type="number" {...field} /> </FormControl> </FormItem> )} />
              <FormField control={form.control} name="avgServiceTime" render={({ field }) => ( <FormItem> <FormLabel>T. Médio Atend. (min)</FormLabel> <FormControl> <Input type="number" {...field} /> </FormControl> </FormItem> )} />
              <FormField control={form.control} name="avgSaleTime" render={({ field }) => ( <FormItem> <FormLabel>T. Médio Venda (min)</FormLabel> <FormControl> <Input type="number" {...field} /> </FormControl> </FormItem> )} />
              <FormField control={form.control} name="lostSales" render={({ field }) => ( <FormItem className="col-span-2"> <FormLabel>Vendas Perdidas/dia</FormLabel> <FormControl> <Input type="number" {...field} /> </FormControl> </FormItem> )} />
            </div>
          </form>
        </Form>
      </div>

      <div className="space-y-6">
        <Card className="bg-background/50 border-muted shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 font-bold"><ChevronsRight className="text-primary w-5 h-5"/> Cenário Atual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Metric title="Receita Mensal" value={formatCurrency(calculations.real.monthlyRevenue)} icon={DollarSign} />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Metric title="Semestral" value={formatCurrency(calculations.real.semiAnnualRevenue)} size="sm" icon={CalendarDays} />
              <Metric title="Anual" value={formatCurrency(calculations.real.annualRevenue)} size="sm" icon={CalendarDays} />
            </div>
            <Separator />
            <h4 className="font-bold text-destructive flex items-center gap-2 text-sm uppercase">Argumentos de Perda</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
                <Metric title="Ociosidade (Mês)" value={formatHours(calculations.real.idleTimeWorkday * 30)} size="sm" icon={Clock} iconColor="text-amber-500" />
                <Metric title="Receita Perdida (Mês)" value={formatCurrency(calculations.real.lostRevenue * 30)} size="sm" icon={ArrowDown} iconColor="text-destructive" />
            </div>
             <p className="text-[10px] text-muted-foreground leading-tight italic">O tempo ocioso mensal total é de {formatHours(calculations.real.idleTimeWorkday * 30)}, o que representa uma grande oportunidade de otimização.</p>
          </CardContent>
        </Card>

        <Card className="border-primary border-2 shadow-lg bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 font-bold text-primary"><TrendingUp className="w-5 h-5"/> Cenário Simulado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <h4 className="font-semibold text-xs mb-2 uppercase tracking-wider">Simular Contratação</h4>
                 <Form {...form}>
                    <form className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="simulatedAttendants" render={({ field }) => ( <FormItem> <FormLabel className="text-[10px]">Novos Atendentes</FormLabel> <FormControl> <Input type="number" {...field} className="h-8 text-xs bg-white dark:bg-card"/> </FormControl> </FormItem> )} />
                        <FormField control={form.control} name="simulatedSellers" render={({ field }) => ( <FormItem> <FormLabel className="text-[10px]">Novos Vendedores</FormLabel> <FormControl> <Input type="number" {...field} className="h-8 text-xs bg-white dark:bg-card"/> </FormControl> </FormItem> )} />
                    </form>
                </Form>
            </div>
            <Metric title="Nova Receita Mensal" value={formatCurrency(calculations.simulated.monthlyRevenue)} icon={DollarSign} iconColor="text-green-500" />
            <div className="grid grid-cols-2 gap-4 text-sm">
                <Metric title="Receita Semestral" value={formatCurrency(calculations.simulated.semiAnnualRevenue)} size="sm" />
                <Metric title="Recuperado/Mês" value={formatCurrency(calculations.simulated.recoveredRevenue * 30)} size="sm" icon={ArrowUp} iconColor="text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const Metric = ({ title, value, icon: Icon, size = 'md', iconColor = 'text-primary' }: { title: string; value: string | number, icon?: React.ElementType, size?: 'sm' | 'md', iconColor?: string }) => {
    return (
        <div className="flex items-start gap-2">
            {Icon && size === 'md' && <div className="p-1.5 bg-primary/10 rounded-md mt-0.5"><Icon className={`w-4 h-4 ${iconColor}`} /></div>}
            {Icon && size === 'sm' && <Icon className={`w-3 h-3 mt-1 ${iconColor}`} />}
            <div className="flex flex-col">
                <p className={`font-bold leading-none ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>{value}</p>
                <p className={`text-muted-foreground ${size === 'sm' ? 'text-[10px]' : 'text-xs'}`}>{title}</p>
            </div>
        </div>
    )
}