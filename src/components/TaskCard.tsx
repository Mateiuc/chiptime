import { Task, Client, Vehicle, WorkSession, WorkPeriod, SessionPhoto, Settings } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ChevronDown, ChevronUp, FileText, DollarSign, CheckCircle2, Play, MoreVertical, Edit, Wrench, Pause, Square, Trash, Camera as CameraIcon, Eye } from 'lucide-react';
import { formatDuration, formatCurrency, formatTime, calcPeriodCost } from '@/lib/formatTime';
import { applyLaborDiscount } from '@/lib/discount';
import { ceilDollars } from '@/lib/billing';
import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import { useNotifications } from '@/hooks/useNotifications';
import { EditTaskDialog } from './EditTaskDialog';
import { getVehicleColorScheme, VehicleColorScheme } from '@/lib/vehicleColors';
import { renderBillPdf } from '@/lib/billPdfRenderer';
import { stripDiacritics, mergePdfs } from '@/lib/pdfUtils';
import { supabase } from '@/integrations/supabase/client';
import { resolveDiagnosticPdfUrl } from '@/services/diagnosticPdfService';
import { PORTAL_BASE_URL } from '@/lib/clientPortalUtils';
import { ImportedBadge } from '@/components/ImportedBadge';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { photoStorageService } from '@/services/photoStorageService';
import { capacitorStorage } from '@/lib/capacitorStorage';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { ShareBillDialog } from './ShareBillDialog';
import { useNavigate } from 'react-router-dom';
interface TaskCardProps {
  task: Task;
  client: Client | undefined;
  vehicle: Vehicle | undefined;
  settings: Pick<Settings,
    'defaultHourlyRate' | 'defaultCloningRate' | 'defaultProgrammingRate' |
    'defaultAddKeyRate' | 'defaultAllKeysLostRate'
  >;
  onMarkBilled: (taskId: string) => void;
  onMarkPaid: (taskId: string) => void;
  onRestartTimer: (taskId: string) => void;
  onPauseTimer?: () => void;
  onStopTimer?: (taskId: string) => void;
  onUpdateTask?: (updatedTask: Task) => Promise<void> | void;
  onUpdateVehicle?: (vehicleId: string, updates: Partial<Vehicle>) => void;
  onDelete?: (taskId: string) => void;
  vehicleColorScheme?: VehicleColorScheme;
}
export const TaskCard = ({
  task,
  client,
  vehicle,
  settings,
  onMarkBilled,
  onMarkPaid,
  onRestartTimer,
  onPauseTimer,
  onStopTimer,
  onUpdateTask,
  onUpdateVehicle,
  onDelete,
  vehicleColorScheme
}: TaskCardProps) => {
  const { toast } = useNotifications();
  const navigate = useNavigate();
  // Get vehicle color scheme (use provided or compute from vehicle ID)
  const colorScheme = vehicleColorScheme || getVehicleColorScheme(vehicle?.id || task.vehicleId);
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentElapsed, setCurrentElapsed] = useState(0);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [billShareData, setBillShareData] = useState<{
    pdfUri: string;
    clientName: string;
    vehicleInfo: string;
    totalAmount: string;
    clientPhone?: string;
  } | null>(null);
  const isActive = ['pending', 'in-progress', 'paused'].includes(task.status);
  const isCompleted = ['completed', 'billed', 'paid'].includes(task.status);

  // Live timer for active tasks
  useEffect(() => {
    if (task.status === 'in-progress' && task.startTime) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - task.startTime!.getTime()) / 1000);
        setCurrentElapsed(elapsed);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setCurrentElapsed(0);
    }
  }, [task.status, task.startTime]);

  // For active tasks: show current period time only
  // For completed tasks: show total accumulated time
  let displayTime: number;
  if (isActive) {
    // Active tasks: show current period time
    if (task.status === 'in-progress' && task.startTime) {
      // Live current period timer
      displayTime = currentElapsed;
    } else if (task.status === 'paused' && task.activeSessionId) {
      // Show the last period's duration from the active session
      const activeSession = task.sessions.find(s => s.id === task.activeSessionId);
      const lastPeriod = activeSession?.periods?.[activeSession.periods.length - 1];
      displayTime = lastPeriod?.duration || 0;
    } else {
      // Pending tasks
      displayTime = 0;
    }
  } else {
    // Completed tasks: show total accumulated time
    displayTime = task.totalTime;
  }

  // Helper function to format date as dd-mm-yyyy
  const formatDateForFilename = (date: Date | string | number | undefined): string => {
    // Ensure date is a Date object
    let dateObj: Date;
    if (!date) {
      dateObj = new Date();
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      dateObj = new Date(date);
    }
    
    // Validate the date is valid
    if (isNaN(dateObj.getTime())) {
      dateObj = new Date();
    }
    
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Helper function to sanitize strings for filenames
  const sanitizeForFilename = (str: string | undefined): string => {
    if (!str) return 'Unknown';
    return str.replace(/[^a-zA-Z0-9]/g, '_');
  };

  // Helper function to safely format session date
  const formatSessionDate = (date: Date | string | undefined): string => {
    if (!date) return 'Date Not Available';
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      return 'Date Not Available';
    }
    
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  // Generate detail PDF (plain format for records)
  const generateDetailPDF = () => {
    const doc = new jsPDF();

    // Add header
    doc.setFontSize(20);
    doc.text('Work Detail', 105, 20, {
      align: 'center'
    });

    // Two-column layout: Client (left) and Vehicle (right)
    let yPos = 40;

    // Left column: Client Information
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Client Information:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Name: ${client?.companyName || client?.name || 'N/A'}`, 20, yPos + 8);
    doc.text(`Phone: ${client?.phone || 'N/A'}`, 20, yPos + 16);

    // Right column: Vehicle Information
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Vehicle Information:', 110, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`${vehicle?.year || ''} ${vehicle?.make || ''} ${vehicle?.model || ''}`, 110, yPos + 8);
    doc.text(`VIN: ${vehicle?.vin || 'N/A'}`, 110, yPos + 16);

    yPos = 70; // Move to next section

    // Work Sessions
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Work Sessions:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 8;

    (task.sessions || []).forEach((session, sessionIndex) => {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Session ${sessionIndex + 1}`, 20, yPos);
      doc.setFont('helvetica', 'normal');
      yPos += 7;
      
      // Description FIRST
      if (session.description) {
        doc.setFontSize(9);
        const maxWidth = 170;
        const wrappedDesc = doc.splitTextToSize(`Description: ${session.description}`, maxWidth - 5);
        wrappedDesc.forEach((line: string) => {
          doc.text(line, 25, yPos);
          yPos += 6;
        });
      }
      
      // Periods with full date/time info (sorted by startTime)
      const sortedPeriods = [...(session.periods || [])].sort((a, b) => 
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
      
      sortedPeriods.forEach((period, periodIndex) => {
        const startDate = new Date(period.startTime);
        const endDate = new Date(period.endTime);
        
        const dateStr = startDate.toLocaleDateString('en-US');
        const startTimeStr = startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const endTimeStr = endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const durationStr = formatDuration(period.duration);
        
        doc.setFontSize(9);
        doc.text(`Period ${periodIndex + 1}: ${dateStr} ${startTimeStr} - ${endTimeStr} (${durationStr})`, 25, yPos);
        yPos += 6;
      });
      
      yPos += 3;
    });

    // Parts Section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Parts:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 8;

    let hasParts = false;
    (task.sessions || []).forEach((session) => {
      if (session.parts && session.parts.length > 0) {
        hasParts = true;
        session.parts.forEach(part => {
          doc.setFontSize(10);
          doc.text(`${part.quantity}x ${part.name} - ${formatCurrency(part.price * part.quantity)}`, 25, yPos);
          yPos += 6;
          
          if (part.description) {
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            const maxWidth = 170;
            const wrappedText = doc.splitTextToSize(`  ${part.description}`, maxWidth - 30);
            wrappedText.forEach((line: string) => {
              doc.text(line, 30, yPos);
              yPos += 5;
            });
            doc.setTextColor(0, 0, 0);
          }
        });
      }
    });

    if (!hasParts) {
      doc.setFontSize(10);
      doc.text('No parts used', 25, yPos);
      yPos += 6;
    }

    yPos += 5;

    // Cost Breakdown (at the end)
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Cost Breakdown:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    yPos += 8;
    doc.text(`Labor (${formatDuration(task.totalTime)} @ ${formatCurrency(hourlyRate)}/hr): ${formatCurrency(baseLabor)}`, 20, yPos);
    yPos += 7;
    if (totalMinHourAdj > 0) {
      doc.text(`Min 1 Hour adjustment (x${minHourCount}): ${formatCurrency(totalMinHourAdj)}`, 20, yPos);
      yPos += 7;
    }
    if (totalCloning > 0) {
      doc.text(`Cloning (x${cloningCount}): ${formatCurrency(totalCloning)}`, 20, yPos);
      yPos += 7;
    }
    if (totalProgramming > 0) {
      doc.text(`Programming (x${programmingCount}): ${formatCurrency(totalProgramming)}`, 20, yPos);
      yPos += 7;
    }
    doc.text(`Parts: ${formatCurrency(partsCost)}`, 20, yPos);
    yPos += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total: ${formatCurrency(totalCost)}`, 20, yPos);

    // Save PDF
    const fileName = `detail_${vehicle?.vin}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    toast({
      title: "Detail Generated",
      description: `PDF saved as ${fileName}`
    });
  };

  // Generate billing PDF (branded format for invoicing).
  // Delegates to the shared renderer; this wrapper handles only filename
  // construction, optional diagnostic-PDF merge, and the share-payload return
  // shape used by handleGenerateBill / Share.
  const generateBillingPDF = async () => {
    try {
      const doc = await renderBillPdf({ task, client, vehicle, settings });

      const clientNameSafe = sanitizeForFilename(client?.name);
      const carBrand = sanitizeForFilename(vehicle?.make);
      const workStartDate = formatDateForFilename(task.createdAt);
      const fileName = `bill_${clientNameSafe}_${carBrand}_${workStartDate}.pdf`;

      const vehicleInfoStr = [vehicle?.year, vehicle?.make, vehicle?.model]
        .filter(Boolean)
        .join(' ') || 'your vehicle';
      const deposit = vehicle?.prepaidAmount || 0;
      const displayedTotal = deposit > 0 ? Math.max(0, totalCost - deposit) : totalCost;

      // Merge diagnostic PDF if available (task-level).
      if (task.diagnosticPdfUrl || task.diagnosticPdfPath) {
        try {
          const freshUrl = await resolveDiagnosticPdfUrl({ path: task.diagnosticPdfPath, url: task.diagnosticPdfUrl });
          if (!freshUrl) throw new Error('Could not resolve diagnostic PDF URL');
          const billBlob = doc.output('blob');
          const mergedBlob = await mergePdfs(billBlob, freshUrl);
          const reader = new FileReader();
          const mergedBase64 = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(mergedBlob);
          });
          return {
            pdfBase64: mergedBase64,
            fileName,
            totalCost: displayedTotal,
            vehicleInfo: vehicleInfoStr,
            clientName: client?.name || 'Client',
            clientPhone: client?.phone,
          };
        } catch (mergeError) {
          console.warn('Failed to merge diagnostic PDF:', mergeError);
        }
      }

      const pdfBase64 = doc.output('datauristring').split(',')[1];
      return {
        pdfBase64,
        fileName,
        totalCost: displayedTotal,
        vehicleInfo: vehicleInfoStr,
        clientName: client?.name || 'Client',
        clientPhone: client?.phone,
      };
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: 'Bill Generation Failed',
        description: 'There was an error creating the PDF. Please try again.',
        variant: 'destructive',
      });
      return null;
    }
  };

  // Generate preview PDF (same renderer, different filename + direct save).
  const generatePreviewPDF = async () => {
    try {
      toast({ title: 'Generating Preview', description: 'Creating PDF preview...' });
      if (!task.sessions || task.sessions.length === 0) {
        toast({
          title: 'No Work Sessions',
          description: 'This task has no work sessions to preview.',
          variant: 'destructive',
        });
        return;
      }

      const doc = await renderBillPdf({ task, client, vehicle, settings });
      const fileName = `preview_${sanitizeForFilename(client?.name)}_${sanitizeForFilename(vehicle?.make)}_${formatDateForFilename(task.createdAt)}.pdf`;

      if (task.diagnosticPdfUrl || task.diagnosticPdfPath) {
        try {
          const freshUrl = await resolveDiagnosticPdfUrl({ path: task.diagnosticPdfPath, url: task.diagnosticPdfUrl });
          if (!freshUrl) throw new Error('Could not resolve diagnostic PDF URL');
          const billBlob = doc.output('blob');
          const mergedBlob = await mergePdfs(billBlob, freshUrl);
          const url = URL.createObjectURL(mergedBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
          toast({ title: 'Preview Generated', description: 'Includes diagnostic report' });
          return;
        } catch (mergeError) {
          console.warn('Failed to merge diagnostic PDF in preview:', mergeError);
        }
      }

      doc.save(fileName);
      toast({ title: 'Preview Generated', description: `Preview saved as ${fileName}` });
    } catch (error) {
      console.error('Preview PDF generation error:', error);
      toast({
        title: 'Preview Generation Failed',
        description: error instanceof Error ? error.message : 'There was an error creating the preview. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleGenerateBill = async () => {
    const result = await generateBillingPDF();
    if (!result) return;

    const { pdfBase64, fileName, totalCost: total, vehicleInfo: vInfo, clientName: cName, clientPhone: cPhone } = result;

    // Mark as billed first
    onMarkBilled(task.id);

    // Check if we're on a native platform
    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      try {
        // Save PDF to cache for sharing
        await Filesystem.writeFile({
          path: fileName,
          data: pdfBase64,
          directory: Directory.Cache,
        });

        const fileUri = await Filesystem.getUri({
          path: fileName,
          directory: Directory.Cache,
        });

        // Show share dialog
        setBillShareData({
          pdfUri: fileUri.uri,
          clientName: cName,
          vehicleInfo: vInfo,
          totalAmount: formatCurrency((vehicle?.prepaidAmount || 0) > 0 ? Math.max(0, total - (vehicle?.prepaidAmount || 0)) : total),
          clientPhone: cPhone,
        });
        setShowShareDialog(true);
      } catch (error) {
        console.error('Error preparing bill for sharing:', error);
        // Fall back to just downloading
        const doc = new jsPDF();
        // Can't recover easily, just show error
        toast({
          title: "Share Failed",
          description: "Bill was marked as billed but sharing failed. Please try the Share option from the menu.",
          variant: "destructive"
        });
      }
    } else {
      // Web: just download the PDF
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${pdfBase64}`;
      link.download = fileName;
      link.click();
      
      toast({
        title: "Bill Generated",
        description: `Bill saved as ${fileName}`
      });

      // Still show share dialog for copy message option
      setBillShareData({
        pdfUri: '',
        clientName: cName,
        vehicleInfo: vInfo,
        totalAmount: formatCurrency((vehicle?.prepaidAmount || 0) > 0 ? Math.max(0, total - (vehicle?.prepaidAmount || 0)) : total),
        clientPhone: cPhone,
      });
      setShowShareDialog(true);
    }
  };

  const handleShareBill = async (message: string) => {
    if (!billShareData) return;

    const isNative = Capacitor.isNativePlatform();

    try {
      if (isNative && billShareData.pdfUri) {
        await Share.share({
          title: 'Bill',
          text: message,
          url: billShareData.pdfUri,
          dialogTitle: 'Share Bill',
        });
      } else {
        // Web fallback: just copy the message
        await navigator.clipboard.writeText(message);
        toast({
          title: 'Message Copied',
          description: 'Paste it in your messaging app along with the downloaded PDF.',
        });
      }
    } catch (error) {
      console.error('Share failed:', error);
      toast({
        title: 'Share Failed',
        description: 'Could not share the bill. Please try again.',
        variant: 'destructive',
      });
    }

    setShowShareDialog(false);
    setBillShareData(null);
  };

  // Handle capturing photo for active session
  const handleCapturePhoto = async () => {
    try {
      let base64String: string | undefined;
      if (Capacitor.isNativePlatform()) {
        const photo = await Camera.getPhoto({
          quality: 80,
          allowEditing: false,
          resultType: CameraResultType.Base64,
          source: CameraSource.Camera,
        });
        base64String = photo.base64String;
      } else {
        const { captureSessionPhotoWeb } = await import('@/lib/webPhotoCapture');
        const result = await captureSessionPhotoWeb();
        base64String = result ?? undefined;
      }

      if (base64String) {
        // Fetch fresh task data from storage to avoid stale state issues
        const currentTasks = await capacitorStorage.getTasks();
        const freshTask = currentTasks.find(t => t.id === task.id);
        
        if (!freshTask) return;

        const photoId = crypto.randomUUID();

        // Save photo to filesystem and get the file path
        const filePath = await photoStorageService.savePhoto(
          base64String,
          task.id,
          photoId
        );

        let targetSessionId: string;
        let sessions: WorkSession[];

        const hasSessions = freshTask.sessions && freshTask.sessions.length > 0;

        if (!hasSessions) {
          // No sessions at all — auto-create an "info" session with a 1-min period
          const now = new Date();
          const periodId = crypto.randomUUID();
          const newSessionId = crypto.randomUUID();
          const autoPeriod: WorkPeriod = {
            id: periodId,
            startTime: new Date(now.getTime() - 60_000),
            endTime: now,
            duration: 60,
          };
          const autoSession: WorkSession = {
            id: newSessionId,
            createdAt: now,
            description: 'info',
            periods: [autoPeriod],
            parts: [],
            photos: [],
          };
          targetSessionId = newSessionId;
          sessions = [autoSession];
        } else {
          // Use active session or fall back to most recent session
          targetSessionId = freshTask.activeSessionId || freshTask.sessions[freshTask.sessions.length - 1].id;
          sessions = freshTask.sessions;
        }

        const sessionIndex = sessions.findIndex(s => s.id === targetSessionId);

        const newPhoto: SessionPhoto = {
          id: photoId,
          filePath,
          capturedAt: new Date(),
          sessionNumber: sessionIndex + 1,
        };

        const updatedTask = {
          ...freshTask,
          sessions: sessions.map(session =>
            session.id === targetSessionId
              ? { ...session, photos: [...(session.photos || []), newPhoto] }
              : session
          ),
        };

        await onUpdateTask?.(updatedTask);
        toast({
          title: 'Photo Captured',
          description: `Photo added to Session ${sessionIndex + 1}`,
        });

        // Background cloud upload (fire-and-forget). Re-fetch the task before
        // merging cloud fields so concurrent updates aren't clobbered.
        photoStorageService.uploadPhotoToCloud(base64String!, task.id, photoId)
          .then(async ({ url: cloudUrl, path: cloudPath }) => {
            try {
              const freshTasks = await capacitorStorage.getTasks();
              const latest = freshTasks.find(t => t.id === task.id);
              if (!latest) return;
              const merged = {
                ...latest,
                sessions: latest.sessions.map(session => ({
                  ...session,
                  photos: session.photos?.map(p =>
                    p.id === photoId ? { ...p, cloudUrl, cloudPath } : p
                  ),
                })),
              };
              onUpdateTask?.(merged);
            } catch (mergeErr) {
              console.warn('[TaskCard] Cloud merge failed:', mergeErr);
            }
          })
          .catch(err => {
            console.error('[TaskCard] Failed to upload photo to cloud:', err);
            toast({
              variant: 'destructive',
              title: 'Photo upload failed',
              description: "The photo was saved locally but couldn't reach the cloud. It will retry on next sync.",
            });
          });
      }
    } catch (error) {
      // User cancelled or camera error
      if ((error as Error).message?.includes('cancelled')) {
        return; // User cancelled, no error message needed
      }
      console.error('[TaskCard] Camera error:', error);
      toast({
        title: 'Camera Error',
        description: 'Could not capture photo. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle uploading diagnostic PDF for this task
  const handleUploadDiagnosticPdf = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        toast({ title: 'Uploading...', description: 'Uploading diagnostic PDF' });
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const { data, error } = await supabase.functions.invoke('upload-diagnostic', {
          body: { base64, taskId: task.id, fileName: file.name },
        });

        if (error) throw error;
        if (onUpdateTask) {
          onUpdateTask({ ...task, diagnosticPdfUrl: data.url, diagnosticPdfPath: data.path });
        }
        toast({ title: 'Uploaded', description: 'Diagnostic PDF attached to this task' });
      } catch (err) {
        console.error('Upload diagnostic error:', err);
        toast({ title: 'Upload Failed', description: 'Could not upload diagnostic PDF', variant: 'destructive' });
      }
    };
    input.click();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in-progress':
        return 'bg-primary text-primary-foreground';
      case 'paused':
        return 'bg-warning text-warning-foreground';
      case 'completed':
        return 'bg-success text-success-foreground';
      case 'billed':
        return 'bg-accent text-accent-foreground';
      case 'paid':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };
  const hourlyRate = client?.hourlyRate || settings.defaultHourlyRate;
  const cloningRate = client?.cloningRate || (settings as any).defaultCloningRate || 0;
  const programmingRate = client?.programmingRate || (settings as any).defaultProgrammingRate || 0;
  const addKeyRate = client?.addKeyRate || (settings as any).defaultAddKeyRate || 0;
  const allKeysLostRate = client?.allKeysLostRate || (settings as any).defaultAllKeysLostRate || 0;
  let baseLabor = 0, totalMinHourAdj = 0, totalCloning = 0, totalProgramming = 0, totalAddKey = 0, totalAllKeysLost = 0;
  let minHourCount = 0, cloningCount = 0, programmingCount = 0, addKeyCount = 0, allKeysLostCount = 0;
  // Phase 2: imported (XLS) tasks lock labor to importedSalary; per-session
  // breakdown is suppressed so the displayed total matches computeTaskTotal.
  const isImported = task.importedSalary != null && task.importedSalary > 0;
  if (isImported) {
    baseLabor = task.importedSalary as number;
  } else {
    (task.sessions || []).forEach(session => {
      session.periods.forEach(period => {
        if (period.chargeMinimumHour && period.duration < 3600) {
          baseLabor += Math.ceil(hourlyRate);
          minHourCount++;
        } else {
          baseLabor += calcPeriodCost(period.duration, hourlyRate);
        }
      });
      const sessionDur = session.periods.reduce((sum, p) => sum + p.duration, 0);
      const hasPeriodFlags = session.periods.some(p => p.chargeMinimumHour);
      if (!hasPeriodFlags && session.chargeMinimumHour && sessionDur < 3600) {
        totalMinHourAdj += Math.ceil(((3600 - sessionDur) / 3600) * hourlyRate);
        minHourCount++;
      }
      if (session.isCloning && cloningRate > 0) { totalCloning += cloningRate; cloningCount++; }
      if (session.isProgramming && programmingRate > 0) { totalProgramming += programmingRate; programmingCount++; }
      if (session.isAddKey && addKeyRate > 0) { totalAddKey += addKeyRate; addKeyCount++; }
      if (session.isAllKeysLost && allKeysLostRate > 0) { totalAllKeysLost += allKeysLostRate; allKeysLostCount++; }
    });
  }
  const calculatedLabor = baseLabor + totalMinHourAdj + totalCloning + totalProgramming + totalAddKey + totalAllKeysLost;
  // Phase 2: importedSalary short-circuits computeTaskTotal (locks task labor
  // to the imported figure); render via the amber Imported badge when present.
  // Otherwise total = live labor + services + parts, with per-vehicle discount on labor.
  const partsCost = (task.sessions || []).reduce((total, session) => {
    return total + (session.parts || []).reduce((sum, part) => sum + (part.providedByClient ? 0 : part.price * part.quantity), 0);
  }, 0);
  const rawLabor = calculatedLabor;
  const { discount: laborDiscount, laborAfter: laborCost } = applyLaborDiscount(rawLabor, vehicle);
  const totalCost = ceilDollars(laborCost + partsCost);
  return <Card className={`overflow-hidden transition-all hover:shadow-md ${colorScheme.card} border ${colorScheme.border}`}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className="p-3 py-0">
          {/* Status bar at top of card */}
          <div className={`-mx-3 px-3 py-1 mb-2 flex items-center justify-between text-xs font-medium ${
            task.status === 'in-progress' ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300' :
            task.status === 'paused' ? 'bg-orange-500/15 text-orange-700 dark:text-orange-300' :
            task.status === 'pending' ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300' :
            task.status === 'completed' ? 'bg-green-500/10 text-green-700 dark:text-green-300' :
            task.status === 'billed' ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300' :
            task.status === 'paid' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' :
            'bg-muted/50 text-muted-foreground'
          }`}>
            <div className="flex items-center gap-1.5">
              {task.status === 'in-progress' && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
              )}
              <span className="capitalize">{task.status.replace('-', ' ')}</span>
              {(task.importedSalary != null && task.importedSalary > 0) && <ImportedBadge />}

            </div>
            {task.status === 'in-progress' && task.startTime && (
              <span className="font-mono font-bold">{formatDuration(displayTime)}</span>
            )}
          </div>

          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <p className="text-sm font-semibold">
                {vehicle?.year} {vehicle?.make} {vehicle?.model}
              </p>
              {vehicle?.vin && <p className="text-xs text-muted-foreground mt-1 cursor-pointer hover:text-foreground transition-colors font-mono" onClick={() => { navigator.clipboard.writeText(vehicle.vin); toast({ title: 'VIN Copied!', description: vehicle.vin }); }} title="Click to copy VIN">VIN: {vehicle.vin}</p>}
              {task.diagnosticPdfUrl && (
                <Badge variant="outline" className="text-xs mt-1 text-emerald-600 border-emerald-500/40">
                  <FileText className="h-3 w-3 mr-1" />Diagnostic PDF
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="More options" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover z-50">
                  <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCapturePhoto}>
                      <CameraIcon className="h-4 w-4 mr-2" />
                      Capture Photo
                    </DropdownMenuItem>
                  {task.status === 'completed' && <>
                      <DropdownMenuItem onClick={generatePreviewPDF}>
                        <FileText className="h-4 w-4 mr-2" />
                        Preview Bill
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleGenerateBill}>
                        <FileText className="h-4 w-4 mr-2" />
                        Generate Bill & Mark Billed
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onRestartTimer(task.id)}>
                        <Play className="h-4 w-4 mr-2" />
                        Resume Work
                      </DropdownMenuItem>
                    </>}
                {task.status === 'billed' && <>
                    <DropdownMenuItem onClick={generateBillingPDF}>
                      <FileText className="h-4 w-4 mr-2" />
                      Bill
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onMarkPaid(task.id)}>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Paid
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive"
                    >
                      <Trash className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </>}
                  {task.status === 'paid' && (
                      <DropdownMenuItem 
                        onClick={() => setShowDeleteDialog(true)}
                        className="text-destructive"
                      >
                        <Trash className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  {(task.status === 'billed' || task.status === 'paid') && <DropdownMenuItem onClick={generateDetailPDF}>
                      <FileText className="h-4 w-4 mr-2" />
                      Print detail
                    </DropdownMenuItem>}
                  {isCompleted && client && (
                    <DropdownMenuItem onClick={() => {
                      if (client.portalId) {
                        window.open(`${PORTAL_BASE_URL}/client-view?id=${client.portalId}&preview=1`, '_blank');
                      }
                    }} disabled={!client.portalId}>
                      <Eye className="h-4 w-4 mr-2" />
                      Client Portal
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleUploadDiagnosticPdf}>
                    <FileText className="h-4 w-4 mr-2" />
                    {task.diagnosticPdfUrl ? 'Replace Diagnostic PDF' : 'Upload Diagnostic PDF'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
          </div>
        </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-2 text-sm">
            <div className="text-center">
              <div className="text-muted-foreground text-xs font-medium mb-1">{isActive ? 'Period' : 'Total'}</div>
              <div className={`font-bold text-sm ${task.status === 'in-progress' ? 'text-blue-600 dark:text-blue-400' : ''}`}>{formatDuration(displayTime)}</div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground text-xs font-medium mb-1">Sessions</div>
              <div className="font-bold text-sm">{(task.sessions || []).length}</div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground text-xs font-medium mb-1">{task.status === 'paid' ? 'Cost' : 'Due'}</div>
              <div className={`font-bold text-sm ${task.status === 'paid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary'}`}>{formatCurrency(task.status === 'paid' ? totalCost : Math.max(0, totalCost - (vehicle?.prepaidAmount || 0)))}</div>
            </div>
          </div>

          <div className="flex gap-2 w-full mt-2">
            <CollapsibleTrigger asChild>
              {isCompleted && <Button variant="outline" size="sm" className="gap-1 h-9 px-3 flex-1">
                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  <span className="text-xs">Details</span>
                </Button>}
            </CollapsibleTrigger>

            {/* Active Tab Buttons */}
            {isActive && <>
                {task.status === 'pending' && <Button variant="default" size="sm" onClick={() => onRestartTimer(task.id)} className="gap-1 h-9 px-3">
                    <Play className="h-3.5 w-3.5" />
                    <span className="text-xs">Start</span>
                  </Button>}

                {task.status === 'in-progress' && <>
                    {onPauseTimer && <Button variant="secondary" size="sm" onClick={onPauseTimer} className="gap-1 h-9 px-3">
                        <Pause className="h-3.5 w-3.5" />
                        <span className="text-xs">Pause</span>
                      </Button>}
                    {onStopTimer && <Button variant="default" size="sm" onClick={() => onStopTimer(task.id)} className="gap-1 h-9 px-3">
                        <Square className="h-3.5 w-3.5" />
                        <span className="text-xs">Stop</span>
                      </Button>}
                  </>}

                {task.status === 'paused' && <>
                    <Button variant="default" size="sm" onClick={() => onRestartTimer(task.id)} className="gap-1 h-9 px-3">
                      <Play className="h-3.5 w-3.5" />
                      <span className="text-xs">Resume</span>
                    </Button>
                    {onStopTimer && <Button variant="secondary" size="sm" onClick={() => onStopTimer(task.id)} className="gap-1 h-9 px-3">
                        <Square className="h-3.5 w-3.5" />
                        <span className="text-xs">Stop</span>
                      </Button>}
                  </>}
              </>}

            {/* Completed Tab Buttons */}
            {isCompleted && <>
                {task.status === 'completed' && task.needsFollowUp && <Button variant="default" size="sm" onClick={() => onRestartTimer(task.id)} className="gap-1 h-9 px-3 flex-1">
                    <Play className="h-3.5 w-3.5" />
                    <span className="text-xs">Restart</span>
                  </Button>}
              </>}
        </div>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-1 border-t pt-3 text-sm">
            {/* Unified Sessions View */}
            <div>
              <h4 className="font-bold text-sm mb-1">Work Sessions ({(task.sessions || []).length})</h4>
              {(task.sessions || []).map((session, sessionIndex) => {
              const sessionDuration = (session.periods || []).reduce((sum, p) => sum + p.duration, 0);
              
              // Build timeline events
              const allEvents: Array<{
                time: Date;
                type: 'started' | 'paused' | 'resumed' | 'completed';
              }> = [];
              (session.periods || []).forEach((period, idx) => {
                if (idx === 0) {
                  allEvents.push({ time: period.startTime, type: 'started' });
                } else {
                  allEvents.push({ time: period.startTime, type: 'resumed' });
                }
                if (idx < (session.periods || []).length - 1) {
                  allEvents.push({ time: period.endTime, type: 'paused' });
                } else {
                  allEvents.push({ time: period.endTime, type: 'completed' });
                }
              });
              
              return <div key={session.id} className={`${colorScheme.session} border rounded-lg p-2 mb-1`}>
                    <div className="text-xs font-semibold mb-1">
                      Session {sessionIndex + 1} ({formatDuration(sessionDuration)})
                    </div>
                    {(session.chargeMinimumHour || session.isCloning || session.isProgramming || session.isAddKey || session.isAllKeysLost) && (
                      <div className="flex gap-1 mb-1 flex-wrap">
                        {session.chargeMinimumHour && <Badge variant="outline" className="text-[9px] px-1.5 py-0">🚩 Min 1hr</Badge>}
                        {session.isCloning && <Badge variant="outline" className="text-[9px] px-1.5 py-0">📋 Cloning</Badge>}
                        {session.isProgramming && <Badge variant="outline" className="text-[9px] px-1.5 py-0">💻 Programming</Badge>}
                        {session.isAddKey && <Badge variant="outline" className="text-[9px] px-1.5 py-0">🔑 Add Key</Badge>}
                        {session.isAllKeysLost && <Badge variant="outline" className="text-[9px] px-1.5 py-0">🔐 All Keys Lost</Badge>}
                      </div>
                    )}
                    
                    {/* Timeline events */}
                    <div className="ml-2 mb-1 space-y-0.5">
                      {allEvents.map((event, idx) => (
                        <div key={idx} className="text-xs font-medium">
                          <span className={
                            event.type === 'started' ? 'text-green-600 dark:text-green-400' : 
                            event.type === 'resumed' ? 'text-blue-600 dark:text-blue-400' : 
                            event.type === 'paused' ? 'text-orange-600 dark:text-orange-400' : 
                            'text-red-600 dark:text-red-400'
                          }>●</span>
                          {' '}
                          <span>
                            {event.type === 'started' ? 'Started' : 
                             event.type === 'resumed' ? 'Resumed' : 
                             event.type === 'paused' ? 'Paused' : 
                             'Stopped'}
                          </span>
                          {': '}
                          {formatTime(event.time)}
                        </div>
                      ))}
                    </div>
                    
                    {session.description && <div className="text-xs text-muted-foreground mb-1">{session.description}</div>}
                    
                    {session.parts && session.parts.length > 0 && <div className="space-y-0.5">
                        <div className="font-semibold text-xs">Parts Used:</div>
                        {session.parts.map((part, i) => <div key={i} className="flex justify-between text-xs text-muted-foreground ml-2">
                            <span>{part.quantity}x {part.name}</span>
                            <span>{formatCurrency(part.price * part.quantity)}</span>
                          </div>)}
                       </div>}
                    
                    {session.photos && session.photos.length > 0 && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <CameraIcon className="h-3 w-3" />
                        {session.photos.length} photo{session.photos.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>;
            })}
            </div>
            {/* Cost Summary */}
            <div className="mt-2 pt-2 border-t space-y-0.5 text-xs">
              <div className="flex justify-between"><span>Labor:</span><span>{formatCurrency(baseLabor + totalMinHourAdj)}</span></div>
              {totalCloning > 0 && <div className="flex justify-between"><span>Cloning (×{cloningCount}):</span><span>{formatCurrency(totalCloning)}</span></div>}
              {totalProgramming > 0 && <div className="flex justify-between"><span>Programming (×{programmingCount}):</span><span>{formatCurrency(totalProgramming)}</span></div>}
              {totalAddKey > 0 && <div className="flex justify-between"><span>Add Key (×{addKeyCount}):</span><span>{formatCurrency(totalAddKey)}</span></div>}
              {totalAllKeysLost > 0 && <div className="flex justify-between"><span>All Keys Lost (×{allKeysLostCount}):</span><span>{formatCurrency(totalAllKeysLost)}</span></div>}
              <div className="flex justify-between"><span>Parts:</span><span>{formatCurrency(partsCost)}</span></div>
              {laborDiscount > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400"><span>Discount{vehicle?.discountType === 'percent' ? ` (${vehicle?.discountValue}%)` : ''}:</span><span>-{formatCurrency(laborDiscount)}</span></div>
              )}
              <div className="flex justify-between font-bold"><span>Total:</span><span>{formatCurrency(totalCost)}</span></div>
              {(vehicle?.prepaidAmount || 0) > 0 && (
                task.status === 'paid' ? (
                  <>
                    <div className="flex justify-between text-muted-foreground"><span>Deposit:</span><span>-{formatCurrency(vehicle?.prepaidAmount || 0)}</span></div>
                    <div className="flex justify-between font-bold text-emerald-600 dark:text-emerald-400"><span>Paid:</span><span>{formatCurrency(totalCost)}</span></div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-destructive"><span>Deposit:</span><span>-{formatCurrency(vehicle?.prepaidAmount || 0)}</span></div>
                    <div className="flex justify-between font-bold text-orange-600"><span>Balance Due:</span><span>{formatCurrency(Math.max(0, totalCost - (vehicle?.prepaidAmount || 0)))}</span></div>
                  </>
                )
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
      
      <EditTaskDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} task={task} onSave={updatedTask => onUpdateTask?.(updatedTask)} onDelete={onDelete} />
      
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="w-[90vw] max-w-sm p-4 rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Delete Task</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Are you sure you want to delete this task? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="m-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete?.(task.id);
                setShowDeleteDialog(false);
              }}
              className="m-0 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ShareBillDialog
        open={showShareDialog}
        onClose={() => {
          setShowShareDialog(false);
          setBillShareData(null);
        }}
        clientName={billShareData?.clientName || ''}
        clientPhone={billShareData?.clientPhone}
        vehicleInfo={billShareData?.vehicleInfo || ''}
        totalAmount={billShareData?.totalAmount || ''}
        onShare={handleShareBill}
      />
    </Card>;
};