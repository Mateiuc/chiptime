import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Copy, Check, Link } from 'lucide-react';
import { appSyncService } from '@/services/appSyncService';
import { useNotifications } from '@/hooks/useNotifications';

export const SyncKeySection = () => {
  const { toast } = useNotifications();
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);

  const syncKey = appSyncService.getSyncId();
  const maskedKey = syncKey.slice(0, 4) + '••••••••••••••••••••••••' + syncKey.slice(-4);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(syncKey);
    setCopied(true);
    toast({ title: 'Sync key copied' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLinkDevice = () => {
    const trimmed = linkInput.trim();
    if (trimmed.length !== 32 || !/^[0-9a-f]+$/i.test(trimmed)) {
      toast({ title: 'Invalid sync key', description: 'Key must be 32 hex characters', variant: 'destructive' });
      return;
    }
    if (trimmed === syncKey) {
      toast({ title: 'Same key', description: 'This device already uses this key' });
      return;
    }
    appSyncService.setSyncId(trimmed);
    setLinkInput('');
    setShowLinkInput(false);
    toast({ title: 'Sync key updated', description: 'Reload to pull data from the linked device' });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Your Sync Key</Label>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={showKey ? syncKey : maskedKey}
            className="font-mono text-xs"
          />
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => setShowKey(!showKey)}>
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Copy this key to link another device. Anyone with this key can access your data.
        </p>
      </div>

      {!showLinkInput ? (
        <Button variant="outline" size="sm" onClick={() => setShowLinkInput(true)}>
          <Link className="h-4 w-4 mr-1" /> Link Another Device
        </Button>
      ) : (
        <div className="space-y-2">
          <Label className="text-xs">Paste sync key from another device</Label>
          <div className="flex gap-2">
            <Input
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="Paste 32-character key"
              className="font-mono text-xs"
            />
            <Button size="sm" onClick={handleLinkDevice}>Apply</Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowLinkInput(false); setLinkInput(''); }}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
};
