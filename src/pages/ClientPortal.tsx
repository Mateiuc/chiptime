import { useState, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClientCostBreakdown } from '@/components/ClientCostBreakdown';
import { ClientCostSummary, decodeClientData, fetchPortalFromCloud } from '@/lib/clientPortalUtils';
import { Lock, Wrench } from 'lucide-react';

const ClientPortal = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const [costSummary, setCostSummary] = useState<ClientCostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expectedCode, setExpectedCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'billed' | 'paid'>('pending');

  const cloudPortalId = searchParams.get('id');
  const isSharedMode = location.pathname === '/client-view' && !cloudPortalId;

  useEffect(() => {
    const load = async () => {
      try {
        if (cloudPortalId) {
          const result = await fetchPortalFromCloud(cloudPortalId);
          setCostSummary(result.data);
          setExpectedCode(result.accessCode);
        } else if (isSharedMode) {
          const hash = location.hash.slice(1);
          if (!hash) {
            setError('No data found in link.');
            setLoading(false);
            return;
          }
          const { data, accessCode } = await decodeClientData(hash);
          setCostSummary(data);
          setExpectedCode(accessCode);
        } else {
          setError('Invalid portal link.');
        }
      } catch (e) {
        console.error('Portal load error:', e);
        setError('Failed to load data.');
      }
      setLoading(false);
    };
    load();
  }, [cloudPortalId, isSharedMode, location.hash]);

  const handleVerify = () => {
    if (!expectedCode) {
      // No code set — allow access
      setVerified(true);
      return;
    }
    if (pin === expectedCode) {
      setVerified(true);
      setError('');
    } else {
      setError('Incorrect code. Please try again.');
      setPin('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error && !costSummary) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 gap-4">
        <p className="text-destructive font-semibold">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    );
  }

  // PIN screen
  if (!verified && expectedCode) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b-2 border-border px-4 py-3 flex items-center gap-2 bg-card">
          <Wrench className="h-5 w-5 text-primary" />
          <span className="font-bold text-foreground">Client Portal</span>
        </header>

        <div className="flex-1 flex items-center justify-center p-6 md:p-8 lg:p-12">
          <Card className="w-full max-w-xs md:max-w-sm lg:max-w-md">
            <CardContent className="pt-6 space-y-6 text-center">
              <Lock className="h-10 w-10 mx-auto text-primary" />
              <div>
                <h2 className="font-bold text-lg text-foreground">Enter Access Code</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the 4-digit code provided by your mechanic
                </p>
              </div>

              <div className="flex justify-center">
                <InputOTP maxLength={4} value={pin} onChange={setPin}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {error && <p className="text-destructive text-xs font-medium">{error}</p>}

              <Button onClick={handleVerify} disabled={pin.length < 4} className="w-full">
                View My Costs
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Cost breakdown view
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-2 border-border px-4 py-3 sticky top-0 z-10 bg-card space-y-3 md:space-y-0 md:flex md:items-center md:justify-between md:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          <span className="font-bold text-foreground">Client Portal</span>
        </div>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pending' | 'billed' | 'paid')}>
          <TabsList className="w-full md:w-auto">
            <TabsTrigger value="pending" className="flex-1 md:flex-none">Pending</TabsTrigger>
            <TabsTrigger value="billed" className="flex-1 md:flex-none">Billed</TabsTrigger>
            <TabsTrigger value="paid" className="flex-1 md:flex-none">Paid</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <div className="p-4 pb-8 md:p-8 lg:p-12 md:max-w-[720px] lg:max-w-[1200px] xl:max-w-[1400px] md:mx-auto">
        {costSummary && <ClientCostBreakdown costSummary={costSummary} filter={activeTab} />}
      </div>
    </div>
  );
};

export default ClientPortal;
