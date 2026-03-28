import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Client } from '@/types';
import { useNotifications } from '@/hooks/useNotifications';

interface AddClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (client: Omit<Client, 'id' | 'createdAt'>) => void;
}

export const AddClientDialog = ({ open, onOpenChange, onSave }: AddClientDialogProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [itin, setItin] = useState('');
  const [notes, setNotes] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [cloningRate, setCloningRate] = useState('');
  const [programmingRate, setProgrammingRate] = useState('');
  const [addKeyRate, setAddKeyRate] = useState('');
  const [allKeysLostRate, setAllKeysLostRate] = useState('');
  const [prepaidAmount, setPrepaidAmount] = useState('');
  const { toast } = useNotifications();

  const handleSave = () => {
    if (!name.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Client name is required',
        variant: 'destructive',
      });
      return;
    }

    onSave({
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      zip: zip.trim() || undefined,
      companyName: companyName.trim() || undefined,
      itin: itin.trim() || undefined,
      notes: notes.trim() || undefined,
      hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined,
      cloningRate: cloningRate ? parseFloat(cloningRate) : undefined,
      programmingRate: programmingRate ? parseFloat(programmingRate) : undefined,
      addKeyRate: addKeyRate ? parseFloat(addKeyRate) : undefined,
      allKeysLostRate: allKeysLostRate ? parseFloat(allKeysLostRate) : undefined,
      prepaidAmount: prepaidAmount ? parseFloat(prepaidAmount) : undefined,
    });

    // Reset form
    setName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setCity('');
    setState('');
    setZip('');
    setCompanyName('');
    setItin('');
    setNotes('');
    setHourlyRate('');
    setCloningRate('');
    setProgrammingRate('');
    setAddKeyRate('');
    setAllKeysLostRate('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full h-full m-0 p-0 rounded-none flex flex-col">
        <header className="border-b bg-purple-500/10 backdrop-blur-sm shadow-sm">
          <div className="px-4 py-3 flex items-center justify-between">
            <DialogTitle className="text-base font-bold text-primary">Add New Client</DialogTitle>
          </div>
        </header>

        <div className="px-4 py-3 space-y-4 overflow-y-auto flex-1">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Client name" />
          </div>

          <div className="space-y-2">
            <Label>Company Name</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Business name" />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@example.com" />
          </div>

          <div className="space-y-2">
            <Label>Phone</Label>
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
          </div>

          <div className="space-y-2">
            <Label>Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="ST" />
            </div>
            <div className="space-y-2">
              <Label>ZIP</Label>
              <Input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="12345" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>ITIN</Label>
            <Input value={itin} onChange={(e) => setItin(e.target.value)} placeholder="Individual Taxpayer ID" />
          </div>

          <div className="space-y-2">
            <Label>Custom Hourly Rate</Label>
            <Input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="Leave empty to use default" min={0} step={0.01} />
          </div>

          <div className="space-y-2">
            <Label>Cloning Rate</Label>
            <Input type="number" value={cloningRate} onChange={(e) => setCloningRate(e.target.value)} placeholder="Leave empty to use default" min={0} step={0.01} />
          </div>

          <div className="space-y-2">
            <Label>Programming Rate</Label>
            <Input type="number" value={programmingRate} onChange={(e) => setProgrammingRate(e.target.value)} placeholder="Leave empty to use default" min={0} step={0.01} />
          </div>

          <div className="space-y-2">
            <Label>Add Key Rate</Label>
            <Input type="number" value={addKeyRate} onChange={(e) => setAddKeyRate(e.target.value)} placeholder="Leave empty to use default" min={0} step={0.01} />
          </div>

          <div className="space-y-2">
            <Label>All Keys Lost Rate</Label>
            <Input type="number" value={allKeysLostRate} onChange={(e) => setAllKeysLostRate(e.target.value)} placeholder="Leave empty to use default" min={0} step={0.01} />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <textarea className="flex min-h-[60px] w-full rounded-md border-2 border-input bg-white dark:bg-gray-900 px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes" />
          </div>
        </div>

        <DialogFooter className="px-4 py-3 border-t bg-card/80 backdrop-blur-sm">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
