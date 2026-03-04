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
  const [hourlyRate, setHourlyRate] = useState('');
  const [cloningRate, setCloningRate] = useState('');
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
      hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined,
      cloningRate: cloningRate ? parseFloat(cloningRate) : undefined,
    });

    // Reset form
    setName('');
    setEmail('');
    setPhone('');
    setHourlyRate('');
    setCloningRate('');
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
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="Client name"
            />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input 
              type="email"
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Phone</Label>
            <Input 
              type="tel"
              value={phone} 
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
            />
          </div>

          <div className="space-y-2">
            <Label>Custom Hourly Rate</Label>
            <Input 
              type="number"
              value={hourlyRate} 
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="Leave empty to use default"
              min={0}
              step={0.01}
            />
          </div>

          <div className="space-y-2">
            <Label>Cloning Rate</Label>
            <Input 
              type="number"
              value={cloningRate} 
              onChange={(e) => setCloningRate(e.target.value)}
              placeholder="Leave empty to use default"
              min={0}
              step={0.01}
            />
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
