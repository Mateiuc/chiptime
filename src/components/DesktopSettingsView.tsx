import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Settings } from '@/types';
import { Download, Upload, Save } from 'lucide-react';
import { indexedDB } from '@/lib/indexedDB';
import { exportToXML, downloadXML, parseXMLFile, validateXMLData } from '@/lib/xmlConverter';
import { useNotifications } from '@/hooks/useNotifications';
import { BackupView } from './BackupView';

interface DesktopSettingsViewProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
}

export const DesktopSettingsView = ({ settings, onSave }: DesktopSettingsViewProps) => {
  const { toast } = useNotifications();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hourlyRate, setHourlyRate] = useState(settings.defaultHourlyRate.toString());
  const [googleApiKey, setGoogleApiKey] = useState(settings.googleApiKey || '');
  const [grokApiKey, setGrokApiKey] = useState(settings.grokApiKey || '');
  const [ocrSpaceApiKey, setOcrSpaceApiKey] = useState(settings.ocrSpaceApiKey || '');
  const [ocrProvider, setOcrProvider] = useState<'gemini' | 'grok' | 'ocrspace' | 'tesseract'>(settings.ocrProvider || 'gemini');
  const [notificationsEnabled, setNotificationsEnabled] = useState(settings.notificationsEnabled !== false);

  useEffect(() => {
    setHourlyRate(settings.defaultHourlyRate.toString());
    setGoogleApiKey(settings.googleApiKey || '');
    setGrokApiKey(settings.grokApiKey || '');
    setOcrSpaceApiKey(settings.ocrSpaceApiKey || '');
    setOcrProvider(settings.ocrProvider || 'gemini');
    setNotificationsEnabled(settings.notificationsEnabled !== false);
  }, [settings]);

  const handleSave = () => {
    onSave({
      defaultHourlyRate: parseFloat(hourlyRate) || 75,
      googleApiKey: googleApiKey.trim() || undefined,
      grokApiKey: grokApiKey.trim() || undefined,
      ocrSpaceApiKey: ocrSpaceApiKey.trim() || undefined,
      ocrProvider,
      backup: settings.backup,
      notificationsEnabled,
    });
    toast({ title: 'Settings Saved' });
  };

  const handleExportData = async () => {
    try {
      const allData = await indexedDB.exportAllData();
      const xmlString = exportToXML(allData);
      downloadXML(xmlString, `autotime-backup-${new Date().toISOString().split('T')[0]}.xml`);
      toast({ title: 'Data Exported' });
    } catch {
      toast({ title: 'Export Failed', variant: 'destructive' });
    }
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await parseXMLFile(file);
      if (!validateXMLData(data)) throw new Error('Invalid XML');
      if (confirm('This will replace all existing data. Continue?')) {
        await indexedDB.importAllData(data);
        toast({ title: 'Data Imported', description: 'Reloading...' });
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch {
      toast({ title: 'Import Failed', variant: 'destructive' });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="grid grid-cols-2 gap-6">
        {/* General */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Default Hourly Rate ($)</Label>
              <Input type="number" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} min={0} step={0.01} />
              <p className="text-xs text-muted-foreground">Used unless a custom rate is set per client</p>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Popup Notifications</Label>
                <p className="text-xs text-muted-foreground">Show confirmation toasts</p>
              </div>
              <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
            </div>
          </CardContent>
        </Card>

        {/* OCR */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">OCR Provider (VIN Scanning)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={ocrProvider} onValueChange={v => setOcrProvider(v as any)}>
              <div className="flex items-center space-x-2"><RadioGroupItem value="tesseract" id="d-tesseract" /><Label htmlFor="d-tesseract" className="font-normal cursor-pointer">Tesseract.js (Free - Offline)</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="gemini" id="d-gemini" /><Label htmlFor="d-gemini" className="font-normal cursor-pointer">Google Gemini</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="grok" id="d-grok" /><Label htmlFor="d-grok" className="font-normal cursor-pointer">Grok AI</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="ocrspace" id="d-ocrspace" /><Label htmlFor="d-ocrspace" className="font-normal cursor-pointer">OCR Space</Label></div>
            </RadioGroup>

            {ocrProvider === 'gemini' && (
              <div className="space-y-2">
                <Label>Google AI API Key</Label>
                <Input type="password" value={googleApiKey} onChange={e => setGoogleApiKey(e.target.value)} placeholder="API key" />
              </div>
            )}
            {ocrProvider === 'grok' && (
              <div className="space-y-2">
                <Label>Grok API Key</Label>
                <Input type="password" value={grokApiKey} onChange={e => setGrokApiKey(e.target.value)} placeholder="API key" />
              </div>
            )}
            {ocrProvider === 'ocrspace' && (
              <div className="space-y-2">
                <Label>OCR Space API Key</Label>
                <Input type="password" value={ocrSpaceApiKey} onChange={e => setOcrSpaceApiKey(e.target.value)} placeholder="API key" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data Management</CardTitle>
          <CardDescription>Export and import your data as XML</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button variant="outline" onClick={handleExportData}><Download className="h-4 w-4 mr-2" /> Export XML</Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4 mr-2" /> Import XML</Button>
          <input ref={fileInputRef} type="file" accept=".xml" onChange={handleImportData} className="hidden" />
        </CardContent>
      </Card>

      {/* Backup & Restore */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Backup & Restore</CardTitle>
        </CardHeader>
        <CardContent>
          <BackupView onBack={() => {}} />
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} size="lg"><Save className="h-4 w-4 mr-2" /> Save Settings</Button>
      </div>
    </div>
  );
};
