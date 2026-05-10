import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Scan } from 'lucide-react';
import { Client, Vehicle, Task, Settings } from '@/types';
import { decodeVin, validateVin } from '@/lib/vinDecoder';
import { useNotifications } from '@/hooks/useNotifications';
import { ContactCombobox } from './ContactCombobox';
import { PhoneContact, contactsService } from '@/services/contactsService';
import VinScanner from './VinScanner';
interface AddVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  tasks: Task[];
  settings: Settings;
  onAddClient: () => void;
  onSave: (vehicle: Omit<Vehicle, 'id'>, clientName?: string, phoneContact?: PhoneContact) => void;
}
export const AddVehicleDialog = ({
  open,
  onOpenChange,
  clients,
  tasks,
  settings,
  onAddClient,
  onSave
}: AddVehicleDialogProps) => {
  const [clientId, setClientId] = useState('');
  const [pendingClientName, setPendingClientName] = useState('');
  const [pendingContactData, setPendingContactData] = useState<PhoneContact | null>(null);
  const [vin, setVin] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');
  const [prepaidAmount, setPrepaidAmount] = useState('');
  const [isDecoding, setIsDecoding] = useState(false);
  const [showVinScanner, setShowVinScanner] = useState(false);
  const {
    toast
  } = useNotifications();

  const handleContactSelect = (contact: PhoneContact) => {
    // Store contact data for auto-creation on save (don't open AddClientDialog)
    setPendingContactData(contact);
    setPendingClientName(contact.name);
    
    // Get the best phone number to display
    const bestPhone = contactsService.getBestPhoneNumber(contact.phoneNumbers);
    
    toast({
      title: 'Contact Selected',
      description: `${contact.name}${bestPhone ? ` - ${contactsService.formatPhoneNumber(bestPhone)}` : ''}`
    });
    // Stay in this dialog - client will be auto-created when vehicle is saved
  };
  const handleDecodeVIN = async (vinCode?: string) => {
    const vinToCheck = vinCode || vin;
    if (!vinToCheck || !validateVin(vinToCheck)) {
      toast({
        title: 'Invalid VIN',
        description: 'VIN must be 17 characters',
        variant: 'destructive'
      });
      return;
    }
    setIsDecoding(true);
    const decoded = await decodeVin(vinToCheck);
    setIsDecoding(false);
    if (decoded) {
      setMake(decoded.make);
      setModel(decoded.model);
      setYear(decoded.year.toString());
      toast({
        title: 'VIN Decoded',
        description: decoded.formatted || `${decoded.year} ${decoded.make} ${decoded.model}`
      });
    } else {
      toast({
        title: 'Decode Failed',
        description: 'Could not decode VIN. Please enter manually.',
        variant: 'destructive'
      });
    }
  };
  const handleVinDetected = (scannedVin: string) => {
    setVin(scannedVin);
    setShowVinScanner(false);
    handleDecodeVIN(scannedVin);
    toast({
      title: 'VIN Scanned',
      description: `VIN ${scannedVin} detected!`
    });
  };
  const handleSave = () => {
    const vinTrimmed = vin.trim().toUpperCase();
    const clientNameTrimmed = pendingClientName.trim();

    // Validate client (either existing clientId or new client name)
    if (!clientId && !clientNameTrimmed) {
      toast({
        title: 'Missing Information',
        description: 'Please select or enter a client name',
        variant: 'destructive'
      });
      return;
    }

    // Validate VIN
    if (!vinTrimmed) {
      toast({
        title: 'Missing Information',
        description: 'Please enter a VIN',
        variant: 'destructive'
      });
      return;
    }

    // Check for duplicate client name (case-insensitive)
    if (!clientId && clientNameTrimmed) {
      const duplicateClient = clients.find(c => c.name.toLowerCase() === clientNameTrimmed.toLowerCase());
      if (duplicateClient) {
        toast({
          title: 'Duplicate Client',
          description: `Client "${duplicateClient.name}" already exists. Please select them from the list.`,
          variant: 'destructive'
        });
        return;
      }
    }

    // Check for duplicate VIN in tasks that are not billed or paid
    const activeTasks = tasks.filter(t => !['billed', 'paid'].includes(t.status));
    const duplicateVIN = activeTasks.find(t => t.carVin.toUpperCase() === vinTrimmed);
    if (duplicateVIN) {
      toast({
        title: 'Duplicate VIN',
        description: `VIN ${vinTrimmed} is already in use by an active task. Complete and bill that task first.`,
        variant: 'destructive'
      });
      return;
    }

    // Determine final clientId (will be generated in parent if creating new client)
    const finalClientId = clientId || 'pending';
    onSave({
      clientId: finalClientId,
      vin: vinTrimmed,
      make: make || undefined,
      model: model || undefined,
      year: year ? parseInt(year) : undefined,
      color: color || undefined,
      prepaidAmount: prepaidAmount ? parseFloat(prepaidAmount) : undefined,
    }, clientId ? undefined : clientNameTrimmed, pendingContactData || undefined);

    // Reset form
    setClientId('');
    setPendingClientName('');
    setPendingContactData(null);
    setVin('');
    setMake('');
    setModel('');
    setYear('');
    setColor('');
    setPrepaidAmount('');
    setDiscountValue('');
    setDiscountType('fixed');
    onOpenChange(false);
  };
  return <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full h-full m-0 p-0 rounded-none flex flex-col">
        <header className="border-b bg-primary/10 backdrop-blur-sm shadow-sm">
          <div className="px-4 py-3 flex items-center justify-between">
            <DialogTitle className="text-lg font-bold text-primary">Add New Vehicle</DialogTitle>
          </div>
        </header>

        <div className="px-4 py-3 space-y-4 overflow-y-auto flex-1">
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-2 flex flex-col justify-center">
              <Label>Client *</Label>
              <ContactCombobox value={clientId} onValueChange={setClientId} clients={clients} onContactSelect={handleContactSelect} onPendingNameChange={setPendingClientName} />
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4 space-y-2 flex flex-col justify-center">
              <Label>VIN *</Label>
              
              <Button 
                onClick={() => setShowVinScanner(true)} 
                className="w-full mb-2 bg-emerald-500/20 border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/30 hover:border-emerald-500/40 dark:text-emerald-300" 
                variant="outline"
              >
                <Scan className="h-4 w-4 mr-2" />
                Scan VIN with Camera
              </Button>

              <Input value={vin} onChange={e => {
                const newVin = e.target.value.toUpperCase();
                setVin(newVin);
                if (newVin.length === 17 && validateVin(newVin)) {
                  handleDecodeVIN(newVin);
                }
              }} placeholder="Or enter VIN manually" maxLength={17} />

              {isDecoding && <Label className="text-sm text-muted-foreground">
                  <span className="text-primary">Decoding VIN...</span>
                </Label>}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Make</Label>
              <Input value={make} onChange={e => setMake(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Input value={model} onChange={e => setModel(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Year</Label>
              <Input type="number" value={year} onChange={e => setYear(e.target.value)} min={1900} max={new Date().getFullYear() + 1} />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <Input value={color} onChange={e => setColor(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Deposit ($)</Label>
            <Input
              type="number"
              step="0.01"
              value={prepaidAmount}
              onChange={e => setPrepaidAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label>Labor Discount</Label>
            <div className="flex gap-2">
              <div className="flex rounded-md border-2 border-input overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => setDiscountType('fixed')}
                  className={`px-3 h-10 text-sm font-bold ${discountType === 'fixed' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground'}`}
                >$</button>
                <button
                  type="button"
                  onClick={() => setDiscountType('percent')}
                  className={`px-3 h-10 text-sm font-bold border-l-2 border-input ${discountType === 'percent' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground'}`}
                >%</button>
              </div>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={discountType === 'percent' ? 100 : undefined}
                value={discountValue}
                onChange={e => setDiscountValue(e.target.value)}
                placeholder={discountType === 'percent' ? '0–100' : '0.00'}
                className="flex-1"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">Applied to each task's labor for this vehicle.</p>
          </div>
        </div>

        <DialogFooter className="px-4 py-3 border-t bg-card/80 backdrop-blur-sm">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Vehicle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Full-screen VIN Scanner overlay */}
    {showVinScanner && (
      <VinScanner
        onVinDetected={handleVinDetected}
        onClose={() => setShowVinScanner(false)}
        googleApiKey={settings.googleApiKey}
        grokApiKey={settings.grokApiKey}
        ocrSpaceApiKey={settings.ocrSpaceApiKey}
        ocrProvider={settings.ocrProvider}
      />
    )}
  </>;
};