import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Vehicle, Client, Settings } from '@/types';
import { useNotifications } from '@/hooks/useNotifications';
import { decodeVin } from '@/lib/vinDecoder';
import VinScanner from './VinScanner';
import { ChevronLeft } from 'lucide-react';

interface EditVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle;
  client: Client | undefined;
  vehicles: Vehicle[];
  settings: Settings;
  onSave: (vehicleId: string, updates: Partial<Vehicle>) => void;
}

export const EditVehicleDialog = ({
  open,
  onOpenChange,
  vehicle,
  client,
  vehicles,
  settings,
  onSave,
}: EditVehicleDialogProps) => {
  const { toast } = useNotifications();
  const [vin, setVin] = useState(vehicle.vin);
  const [make, setMake] = useState(vehicle.make || '');
  const [model, setModel] = useState(vehicle.model || '');
  const [year, setYear] = useState(vehicle.year?.toString() || '');
  const [color, setColor] = useState(vehicle.color || '');
  const [prepaidAmount, setPrepaidAmount] = useState(vehicle.prepaidAmount?.toString() || '');
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    setVin(vehicle.vin);
    setMake(vehicle.make || '');
    setModel(vehicle.model || '');
    setYear(vehicle.year?.toString() || '');
    setColor(vehicle.color || '');
  }, [vehicle]);

  const handleVinChange = (newVin: string) => {
    setVin(newVin);
  };

  const handleScan = async (scannedVin: string) => {
    setVin(scannedVin);
    setShowScanner(false);
    
    // Auto-decode VIN
    const decoded = await decodeVin(scannedVin);
    if (decoded) {
      setMake(decoded.make || make);
      setModel(decoded.model || model);
      setYear(decoded.year?.toString() || year);
    }
  };

  const handleSave = () => {
    const trimmedVin = vin.trim().toUpperCase();

    if (!trimmedVin) {
      toast({
        title: 'Error',
        description: 'VIN is required',
        variant: 'destructive',
      });
      return;
    }

    if (trimmedVin.length !== 17) {
      toast({
        title: 'Error',
        description: 'VIN must be 17 characters',
        variant: 'destructive',
      });
      return;
    }

    // Check for duplicate VIN (excluding current vehicle)
    const duplicate = vehicles.find(v => v.id !== vehicle.id && v.vin === trimmedVin);
    if (duplicate) {
      toast({
        title: 'Error',
        description: 'This VIN already exists',
        variant: 'destructive',
      });
      return;
    }

    const updates: Partial<Vehicle> = {
      vin: trimmedVin,
      make: make.trim() || undefined,
      model: model.trim() || undefined,
      year: year ? parseInt(year) : undefined,
      color: color.trim() || undefined,
    };

    onSave(vehicle.id, updates);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full h-full m-0 p-0 rounded-none flex flex-col">
          <header className="border-b bg-blue-500/10 backdrop-blur-sm shadow-sm">
            <div className="px-4 py-3 flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <DialogTitle className="text-base font-bold text-primary">Edit Vehicle</DialogTitle>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Client</Label>
              <Input value={client?.name || 'Unknown Client'} disabled className="h-10" />
            </div>

            <div className="space-y-2">
              <Label>VIN *</Label>
              <div className="flex gap-2">
                <Input
                  value={vin}
                  onChange={(e) => handleVinChange(e.target.value.toUpperCase())}
                  placeholder="Enter 17-character VIN"
                  maxLength={17}
                  className="h-10"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowScanner(true)}
                  className="whitespace-nowrap"
                >
                  Scan
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Make</Label>
              <Input
                value={make}
                onChange={(e) => setMake(e.target.value)}
                placeholder="e.g., Honda"
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label>Model</Label>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g., Civic"
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label>Year</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g., 2020"
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="e.g., Blue"
                className="h-10"
              />
            </div>
          </div>

          <DialogFooter className="px-4 py-3 border-t bg-card/80 backdrop-blur-sm flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} className="flex-1">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showScanner && (
        <div className="fixed inset-0 z-50 bg-background">
          <VinScanner
            onVinDetected={handleScan}
            onClose={() => setShowScanner(false)}
            googleApiKey={settings.googleApiKey}
          />
        </div>
      )}
    </>
  );
};
