import { ClientCostSummary } from '@/lib/clientPortalUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDuration, formatCurrency } from '@/lib/formatTime';
import { Car, Clock, Wrench, DollarSign } from 'lucide-react';

interface ClientCostBreakdownProps {
  costSummary: ClientCostSummary;
}

const statusColors: Record<string, string> = {
  completed: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
  billed: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30',
  paid: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
  'in-progress': 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30',
  pending: 'bg-muted text-muted-foreground border-border',
  paused: 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30',
};

export const ClientCostBreakdown = ({ costSummary }: ClientCostBreakdownProps) => {
  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-4">
      {/* Client greeting */}
      <div className="text-center py-2">
        <h2 className="text-xl font-bold text-foreground">
          Hello, {costSummary.client.name}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Your cost breakdown</p>
      </div>

      {/* Vehicle sections */}
      {costSummary.vehicles.map((vehicleSummary, vIdx) => {
        const v = vehicleSummary.vehicle;
        const vehicleName = [v.year, v.make, v.model].filter(Boolean).join(' ') || 'Vehicle';

        return (
          <Card key={vIdx} className="overflow-hidden">
            <CardHeader className="py-3 px-4 bg-primary/10">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Car className="h-4 w-4 text-primary" />
                {vehicleName}
              </CardTitle>
              {v.vin && (
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  VIN: {v.vin}
                </p>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {vehicleSummary.sessions.map((session, sIdx) => (
                <div key={sIdx} className="border-b last:border-b-0 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Session {sIdx + 1} — {formatDate(session.date)}
                      </p>
                      <p className="text-xs text-muted-foreground italic mt-0.5">
                        "{session.description}"
                      </p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${statusColors[session.status] || ''}`}>
                      {session.status}
                    </Badge>
                  </div>

                  <div className="flex gap-4 text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDuration(session.duration)}
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      <DollarSign className="h-3 w-3" />
                      Labor: {formatCurrency(session.laborCost)}
                    </span>
                  </div>

                  {session.parts.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold flex items-center gap-1 mb-1">
                        <Wrench className="h-3 w-3" /> Parts
                      </p>
                      <Table>
                        <TableHeader>
                          <TableRow className="text-[10px]">
                            <TableHead className="h-7 px-2 text-xs">Part</TableHead>
                            <TableHead className="h-7 px-2 text-xs text-center">Qty</TableHead>
                            <TableHead className="h-7 px-2 text-xs text-right">Price</TableHead>
                            <TableHead className="h-7 px-2 text-xs text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {session.parts.map((part, pIdx) => (
                            <TableRow key={pIdx} className="text-xs">
                              <TableCell className="py-1 px-2">{part.name}</TableCell>
                              <TableCell className="py-1 px-2 text-center">{part.quantity}</TableCell>
                              <TableCell className="py-1 px-2 text-right">{formatCurrency(part.price)}</TableCell>
                              <TableCell className="py-1 px-2 text-right font-medium">
                                {formatCurrency(part.price * part.quantity)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <p className="text-xs font-semibold text-right mt-1 pr-2">
                        Parts Total: {formatCurrency(session.partsCost)}
                      </p>
                    </div>
                  )}

                  <div className="text-xs font-bold text-right border-t pt-1 text-foreground">
                    Session Total: {formatCurrency(session.laborCost + session.partsCost)}
                  </div>
                </div>
              ))}

              {/* Vehicle subtotal */}
              <div className="p-3 bg-muted/50 text-xs space-y-0.5">
                <div className="flex justify-between">
                  <span>Vehicle Labor:</span>
                  <span className="font-semibold">{formatCurrency(vehicleSummary.totalLabor)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Vehicle Parts:</span>
                  <span className="font-semibold">{formatCurrency(vehicleSummary.totalParts)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm border-t pt-1 mt-1">
                  <span>Vehicle Total:</span>
                  <span>{formatCurrency(vehicleSummary.vehicleTotal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {costSummary.vehicles.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No work records found.
        </div>
      )}

      {/* Grand total */}
      {costSummary.vehicles.length > 0 && (
        <Card className="bg-primary/5 border-primary/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between text-sm">
              <span>Total Labor:</span>
              <span className="font-semibold">{formatCurrency(costSummary.grandTotalLabor)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Total Parts:</span>
              <span className="font-semibold">{formatCurrency(costSummary.grandTotalParts)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2 text-primary">
              <span>GRAND TOTAL:</span>
              <span>{formatCurrency(costSummary.grandTotal)}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
