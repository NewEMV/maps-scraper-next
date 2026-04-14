import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function ResultsSkeleton() {
  return (
    <section className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-12 w-full sm:w-52" />
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="flex flex-col">
            <CardHeader>
              <div className="flex justify-between items-start gap-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-5 w-20" />
              </div>
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
              <div className="flex items-start gap-3">
                <Skeleton className="w-4 h-4 rounded-sm mt-1" />
                <Skeleton className="h-4 w-full" />
              </div>
              <div className="flex items-start gap-3">
                <Skeleton className="w-4 h-4 rounded-sm mt-1" />
                <Skeleton className="h-4 w-2/3" />
              </div>
               <div className="flex items-start gap-3">
                <Skeleton className="w-4 h-4 rounded-sm mt-1" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2 pt-4">
              <Skeleton className="h-9 w-9" />
              <Skeleton className="h-9 w-9" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
}
