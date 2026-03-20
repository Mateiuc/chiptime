import { useState, useMemo } from 'react';
import { ClientCostSummary } from '@/lib/clientPortalUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { formatDuration, formatCurrency } from '@/lib/formatTime';
import { Car, Clock, Wrench, DollarSign, Camera } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ClientCostBreakdownProps {
  costSummary: ClientCostSummary;
  filter?: 'pending' | 'billed' | 'paid';
}

const statusMap: Record<string, string[]> = {
  pending: ['pending', 'in-progress', 'paused', 'completed'],
  billed: ['billed'],
  paid: ['paid'],
};

const statusColors: Record<string, string> = {
  completed: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
  billed: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30',
  paid: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
  'in-progress': 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30',
  pending: 'bg-muted text-muted-foreground border-border',
  paused: 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30',
};

const PhotoGallery = ({ photoUrls }: { photoUrls: string[] }) => {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (photoUrls.length === 0) return null;

  return (
    <>
      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5">
        <Camera className="h-3 w-3" />
        <span>Photos ({photoUrls.length})</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {photoUrls.map((url, i) => (
          <button
            key={i}
            onClick={() => setLightboxUrl(url)}
            className="flex-shrink-0 rounded-md overflow-hidden border border-border hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <img
              src={url}
              alt={`Session photo ${i + 1}`}
              className="w-20 h-16 md:w-48 md:h-36 object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-3xl p-2">
          {lightboxUrl && (
            <img
              src={lightboxUrl}
              alt="Full size photo"
              className="w-full h-auto rounded-md"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export const ClientCostBreakdown = ({ costSummary, filter }: ClientCostBreakdownProps) => {
  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const allowedStatuses = filter ? statusMap[filter] : null;

  const filteredVehicles = costSummary.vehicles
    .map((vehicleSummary) => {
      const sessions = allowedStatuses
        ? vehicleSummary.sessions.filter((s) => allowedStatuses.includes(s.status))
        : vehicleSummary.sessions;
      const totalLabor = sessions.reduce((sum, s) => sum + s.laborCost, 0);
      const totalParts = sessions.reduce((sum, s) => sum + s.partsCost, 0);
      const totalCloning = sessions.reduce((sum, s) => sum + (s.cloningCost || 0), 0);
      const totalProgramming = sessions.reduce((sum, s) => sum + (s.programmingCost || 0), 0);
      const totalMinHourAdj = sessions.reduce((sum, s) => sum + (s.minHourAdj || 0), 0);
      const totalAddKey = sessions.reduce((sum, s) => sum + (s.addKeyCost || 0), 0);
      const totalAllKeysLost = sessions.reduce((sum, s) => sum + (s.allKeysLostCost || 0), 0);
      return { ...vehicleSummary, sessions, totalLabor, totalParts, totalCloning, totalProgramming, totalMinHourAdj, totalAddKey, totalAllKeysLost, vehicleTotal: totalLabor + totalParts };
    })
    .filter((v) => v.sessions.length > 0);

  const grandTotalLabor = filteredVehicles.reduce((sum, v) => sum + v.totalLabor, 0);
  const grandTotalParts = filteredVehicles.reduce((sum, v) => sum + v.totalParts, 0);
  const grandTotalCloning = filteredVehicles.reduce((sum, v) => sum + v.totalCloning, 0);
  const grandTotalProgramming = filteredVehicles.reduce((sum, v) => sum + v.totalProgramming, 0);
  const grandTotalMinHourAdj = filteredVehicles.reduce((sum, v) => sum + v.totalMinHourAdj, 0);
  const grandTotalAddKey = filteredVehicles.reduce((sum, v) => sum + (v.totalAddKey || 0), 0);
  const grandTotalAllKeysLost = filteredVehicles.reduce((sum, v) => sum + (v.totalAllKeysLost || 0), 0);
  const grandTotal = grandTotalLabor + grandTotalParts;

  const monthlyData = useMemo(() => {
    if (filter !== 'paid') return [];
    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const monthMap = new Map<string, { month: string; money: number; cars: Set<string> }>();

    filteredVehicles.forEach(v => {
      const allDates = v.sessions.map(s => new Date(s.date).getTime());
      if (allDates.length === 0) return;
      const lastStopDate = new Date(Math.max(...allDates));
      if (lastStopDate < cutoff) return;

      const key = `${lastStopDate.getFullYear()}-${String(lastStopDate.getMonth() + 1).padStart(2, '0')}`;
      const label = lastStopDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (!monthMap.has(key)) monthMap.set(key, { month: label, money: 0, cars: new Set() });
      const entry = monthMap.get(key)!;
      entry.money += v.sessions.reduce((sum, s) => sum + s.laborCost + s.partsCost, 0);
      entry.cars.add(v.vehicle.vin);
    });

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, v]) => ({ month: v.month, money: Math.round(v.money * 100) / 100, cars: v.cars.size }));
  }, [filteredVehicles, filter]);

  const emptyMessages: Record<string, string> = {
    pending: 'No pending work found.',
    billed: 'No billed work found.',
    paid: 'No paid work found.',
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Client greeting */}
      <div className="text-center py-2">
        <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-foreground">
          Hello, {costSummary.client.name}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Your cost breakdown</p>
      </div>

      {/* Vehicle sections */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-4 lg:space-y-0">
        {filteredVehicles.map((vehicleSummary, vIdx) => {
          const v = vehicleSummary.vehicle;
          const vehicleName = [v.year, v.make, v.model].filter(Boolean).join(' ') || 'Vehicle';

          return (
            <Card key={vIdx} className="overflow-hidden">
              <CardHeader className="py-3 px-4 md:py-4 md:px-6 bg-primary/10">
                <CardTitle className="text-sm md:text-lg font-bold flex items-center gap-2">
                  <Car className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  {vehicleName}
                  {v.color && (
                    <Badge variant="outline" className="text-[10px] md:text-xs ml-auto">
                      {v.color}
                    </Badge>
                  )}
                </CardTitle>
                {v.vin && (
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    VIN: {v.vin}
                  </p>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {vehicleSummary.sessions.map((session, sIdx) => (
                  <div key={sIdx} className="border-b last:border-b-0 p-4 md:p-6 space-y-2 md:space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm md:text-lg font-semibold text-foreground">
                          Session {sIdx + 1} — {formatDate(session.date)}
                        </p>
                        <p className="text-xs md:text-sm text-muted-foreground italic mt-0.5">
                          "{session.description}"
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] md:text-xs ${statusColors[session.status] || ''}`}>
                        {session.status}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs md:text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDuration(session.duration)}
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-foreground">
                        <DollarSign className="h-3 w-3" />
                        Labor: {formatCurrency(session.laborCost - (session.cloningCost || 0) - (session.programmingCost || 0) - (session.minHourAdj || 0) - (session.addKeyCost || 0) - (session.allKeysLostCost || 0))}
                      </span>
                    </div>
                    {((session.minHourAdj || 0) > 0 || (session.cloningCost || 0) > 0 || (session.programmingCost || 0) > 0 || (session.addKeyCost || 0) > 0 || (session.allKeysLostCost || 0) > 0) && (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] md:text-xs text-muted-foreground mt-0.5">
                        {(session.minHourAdj || 0) > 0 && <span>🚩 Min 1hr: {formatCurrency(session.minHourAdj)}</span>}
                        {(session.cloningCost || 0) > 0 && <span>📋 Cloning: {formatCurrency(session.cloningCost)}</span>}
                        {(session.programmingCost || 0) > 0 && <span>💻 Programming: {formatCurrency(session.programmingCost)}</span>}
                        {(session.addKeyCost || 0) > 0 && <span>🔑 Add Key: {formatCurrency(session.addKeyCost)}</span>}
                        {(session.allKeysLostCost || 0) > 0 && <span>🗝️ All Keys Lost: {formatCurrency(session.allKeysLostCost)}</span>}
                      </div>
                    )}

                    {/* Photo gallery */}
                    {session.photoUrls && session.photoUrls.length > 0 && (
                      <PhotoGallery photoUrls={session.photoUrls} />
                    )}

                    {session.parts.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs md:text-sm font-semibold flex items-center gap-1 mb-1">
                          <Wrench className="h-3 w-3" /> Parts
                        </p>
                        <Table>
                          <TableHeader>
                            <TableRow className="text-[10px]">
                              <TableHead className="h-7 px-2 text-xs md:text-sm">Part</TableHead>
                              <TableHead className="h-7 px-2 text-xs md:text-sm text-center">Qty</TableHead>
                              <TableHead className="h-7 px-2 text-xs md:text-sm text-right">Price</TableHead>
                              <TableHead className="h-7 px-2 text-xs md:text-sm text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {session.parts.map((part, pIdx) => (
                              <TableRow key={pIdx} className="text-xs md:text-sm">
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
                        <p className="text-xs md:text-sm font-semibold text-right mt-1 pr-2">
                          Parts Total: {formatCurrency(session.partsCost)}
                        </p>
                      </div>
                    )}

                    <div className="text-xs md:text-sm font-bold text-right border-t pt-1 text-foreground">
                      Session Total: {formatCurrency(session.laborCost + session.partsCost)}
                    </div>
                  </div>
                ))}

                {/* Vehicle subtotal */}
                <div className="p-3 md:p-4 bg-muted/50 text-xs md:text-sm space-y-0.5">
                  <div className="flex justify-between">
                    <span>Vehicle Labor:</span>
                    <span className="font-semibold">{formatCurrency(vehicleSummary.totalLabor - vehicleSummary.totalCloning - vehicleSummary.totalProgramming - vehicleSummary.totalMinHourAdj - (vehicleSummary.totalAddKey || 0) - (vehicleSummary.totalAllKeysLost || 0))}</span>
                  </div>
                  {vehicleSummary.totalMinHourAdj > 0 && (
                    <div className="flex justify-between">
                      <span>Min 1 Hour:</span>
                      <span className="font-semibold">{formatCurrency(vehicleSummary.totalMinHourAdj)}</span>
                    </div>
                  )}
                  {vehicleSummary.totalCloning > 0 && (
                    <div className="flex justify-between">
                      <span>Cloning:</span>
                      <span className="font-semibold">{formatCurrency(vehicleSummary.totalCloning)}</span>
                    </div>
                  )}
                  {vehicleSummary.totalProgramming > 0 && (
                    <div className="flex justify-between">
                      <span>Programming:</span>
                      <span className="font-semibold">{formatCurrency(vehicleSummary.totalProgramming)}</span>
                    </div>
                   )}
                  {(vehicleSummary.totalAddKey || 0) > 0 && (
                    <div className="flex justify-between">
                      <span>Add Key:</span>
                      <span className="font-semibold">{formatCurrency(vehicleSummary.totalAddKey)}</span>
                    </div>
                  )}
                  {(vehicleSummary.totalAllKeysLost || 0) > 0 && (
                    <div className="flex justify-between">
                      <span>All Keys Lost:</span>
                      <span className="font-semibold">{formatCurrency(vehicleSummary.totalAllKeysLost)}</span>
                    </div>
                  )}
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
      </div>

      {filteredVehicles.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          {filter ? emptyMessages[filter] : 'No work records found.'}
        </div>
      )}

      {/* Grand total */}
      {filteredVehicles.length > 0 && (
        <Card className="bg-primary/5 border-primary/30 md:max-w-lg md:mx-auto">
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between text-sm">
              <span>Total Labor:</span>
              <span className="font-semibold">{formatCurrency(grandTotalLabor - grandTotalCloning - grandTotalProgramming - grandTotalMinHourAdj)}</span>
            </div>
            {grandTotalMinHourAdj > 0 && (
              <div className="flex justify-between text-sm">
                <span>Min 1 Hour:</span>
                <span className="font-semibold">{formatCurrency(grandTotalMinHourAdj)}</span>
              </div>
            )}
            {grandTotalCloning > 0 && (
              <div className="flex justify-between text-sm">
                <span>Cloning:</span>
                <span className="font-semibold">{formatCurrency(grandTotalCloning)}</span>
              </div>
            )}
            {grandTotalProgramming > 0 && (
              <div className="flex justify-between text-sm">
                <span>Programming:</span>
                <span className="font-semibold">{formatCurrency(grandTotalProgramming)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span>Total Parts:</span>
              <span className="font-semibold">{formatCurrency(grandTotalParts)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2 text-primary">
              <span>GRAND TOTAL:</span>
              <span>{formatCurrency(grandTotal)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paid tab charts */}
      {filter === 'paid' && monthlyData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm md:text-base">Revenue by Month</CardTitle>
            </CardHeader>
            <CardContent className="p-2 md:p-4">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(value: number) => [formatCurrency(value), 'Revenue']} />
                  <Bar dataKey="money" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm md:text-base">Cars by Month</CardTitle>
            </CardHeader>
            <CardContent className="p-2 md:p-4">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" allowDecimals={false} />
                  <Tooltip formatter={(value: number) => [value, 'Cars']} />
                  <Bar dataKey="cars" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Vehicle count footer */}
      <p className="text-xs text-muted-foreground text-center py-4">
        Showing {filteredVehicles.length} vehicle{filteredVehicles.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
};
