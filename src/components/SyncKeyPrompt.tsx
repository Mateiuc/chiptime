import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound, Plus } from 'lucide-react';
import { appSyncService } from '@/services/appSyncService';
import { useNotifications } from '@/hooks/useNotifications';

interface SyncKeyPromptProps {
  open: boolean;
  onLinked: () => void;
  onStartFresh: () => void;
}

export const SyncKeyPrompt = ({ open, onLinked, onStartFresh }: SyncKeyPromptProps) => {
  const { toast } = useNotifications();
  const [keyInput, setKeyInput] = useState('');
  const [mode, setMode] = useState<'choose' | 'paste'>('choose');

  const handleApply = async () => {
    const trimmed = keyInput.trim();
    if (trimmed.length !== 32 || !/^[0-9a-f]+$/i.test(trimmed)) {
      toast({ title: 'Invalid sync key', description: 'Key must be 32 hex characters', variant: 'destructive' });
      return;
    }
    await appSyncService.setSyncId(trimmed);
    toast({ title: 'Sync key applied', description: 'Pulling data from cloud...' });
    onLinked();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-md w-full h-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" /> Link Your Devices
          </DialogTitle>
          <DialogDescription>
            No data was found for this device. Do you have a sync key from your mobile device?
          </DialogDescription>
        </DialogHeader>

        {mode === 'choose' ? (
          <div className="space-y-3 pt-2">
            <Button className="w-full justify-start gap-2" variant="outline" onClick={() => setMode('paste')}>
              <KeyRound className="h-4 w-4" /> I have a sync key from another device
            </Button>
            <Button className="w-full justify-start gap-2" variant="ghost" onClick={onStartFresh}>
              <Plus className="h-4 w-4" /> Start fresh on this device
            </Button>
            <p className="text-xs text-muted-foreground">
              Find your sync key in Settings on your mobile device.
            </p>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Paste sync key from mobile</Label>
              <Input
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Paste 32-character hex key"
                className="font-mono text-xs"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleApply} disabled={!keyInput.trim()}>Apply & Sync</Button>
              <Button variant="ghost" onClick={() => { setMode('choose'); setKeyInput(''); }}>Back</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
