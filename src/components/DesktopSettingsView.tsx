import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Settings } from '@/types';
import { Save } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { BackupView } from './BackupView';

interface DesktopSettingsViewProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
}

export const DesktopSettingsView = ({ settings, onSave }: DesktopSettingsViewProps) => {
  const { toast } = useNotifications();
  const [defaultHourlyRate, setDefaultHourlyRate] = useState(settings.defaultHourlyRate?.toString() || '75');
  const [notificationsEnabled, setNotificationsEnabled] = useState(settings.notificationsEnabled !== false);
  const [defaultCloningRate, setDefaultCloningRate] = useState(settings.defaultCloningRate?.toString() || '');
  const [defaultProgrammingRate, setDefaultProgrammingRate] = useState(settings.defaultProgrammingRate?.toString() || '');
  const [defaultAddKeyRate, setDefaultAddKeyRate] = useState(settings.defaultAddKeyRate?.toString() || '');
  const [defaultAllKeysLostRate, setDefaultAllKeysLostRate] = useState(settings.defaultAllKeysLostRate?.toString() || '');

  useEffect(() => {
    setDefaultHourlyRate(settings.defaultHourlyRate?.toString() || '75');
    setNotificationsEnabled(settings.notificationsEnabled !== false);
    setDefaultCloningRate(settings.defaultCloningRate?.toString() || '');
    setDefaultProgrammingRate(settings.defaultProgrammingRate?.toString() || '');
    setDefaultAddKeyRate(settings.defaultAddKeyRate?.toString() || '');
    setDefaultAllKeysLostRate(settings.defaultAllKeysLostRate?.toString() || '');
  }, [settings]);

  const handleSave = () => {
    onSave({
      ...settings,
      defaultHourlyRate: parseFloat(defaultHourlyRate) || 75,
      notificationsEnabled,
      defaultCloningRate: defaultCloningRate ? parseFloat(defaultCloningRate) : undefined,
      defaultProgrammingRate: defaultProgrammingRate ? parseFloat(defaultProgrammingRate) : undefined,
      defaultAddKeyRate: defaultAddKeyRate ? parseFloat(defaultAddKeyRate) : undefined,
      defaultAllKeysLostRate: defaultAllKeysLostRate ? parseFloat(defaultAllKeysLostRate) : undefined,
    });
    toast({ title: 'Settings Saved' });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="grid grid-cols-2 gap-6">
        {/* Default Hourly Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Default Hourly Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Rate ($/hr)</Label>
              <Input
                type="number"
                value={defaultHourlyRate}
                onChange={(e) => setDefaultHourlyRate(e.target.value)}
                placeholder="75"
                min={0}
                step={0.01}
              />
              <p className="text-xs text-muted-foreground">Applied to all sessions unless overridden per client</p>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Popup Notifications</Label>
                <p className="text-xs text-muted-foreground">Show confirmation toasts</p>
              </div>
              <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
            </div>
          </CardContent>
        </Card>

        {/* Default Cloning Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Default Cloning Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Rate ($)</Label>
              <Input
                type="number"
                value={defaultCloningRate}
                onChange={(e) => setDefaultCloningRate(e.target.value)}
                placeholder="Leave empty if not used"
                min={0}
                step={0.01}
              />
              <p className="text-xs text-muted-foreground">Added per session when marked as "Cloning"</p>
            </div>
          </CardContent>
        </Card>

        {/* Default Programming Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Default Programming Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Rate ($)</Label>
              <Input
                type="number"
                value={defaultProgrammingRate}
                onChange={(e) => setDefaultProgrammingRate(e.target.value)}
                placeholder="Leave empty if not used"
                min={0}
                step={0.01}
              />
              <p className="text-xs text-muted-foreground">Added per session when marked as "Programming"</p>
            </div>
          </CardContent>
        </Card>

        {/* Default Add Key Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Default Add Key Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Rate ($)</Label>
              <Input
                type="number"
                value={defaultAddKeyRate}
                onChange={(e) => setDefaultAddKeyRate(e.target.value)}
                placeholder="Leave empty if not used"
                min={0}
                step={0.01}
              />
              <p className="text-xs text-muted-foreground">Added per session when marked as "Add Key"</p>
            </div>
          </CardContent>
        </Card>

        {/* Default All Keys Lost Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Default All Keys Lost Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Rate ($)</Label>
              <Input
                type="number"
                value={defaultAllKeysLostRate}
                onChange={(e) => setDefaultAllKeysLostRate(e.target.value)}
                placeholder="Leave empty if not used"
                min={0}
                step={0.01}
              />
              <p className="text-xs text-muted-foreground">Added per session when marked as "All Keys Lost"</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
