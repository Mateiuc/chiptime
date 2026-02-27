import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
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
  const [notificationsEnabled, setNotificationsEnabled] = useState(settings.notificationsEnabled !== false);

  useEffect(() => {
    setNotificationsEnabled(settings.notificationsEnabled !== false);
  }, [settings]);

  const handleSave = () => {
    onSave({
      ...settings,
      notificationsEnabled,
    });
    toast({ title: 'Settings Saved' });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="grid grid-cols-2 gap-6">
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
