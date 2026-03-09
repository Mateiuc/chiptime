import { useState, useMemo } from 'react';
import { Plus, Trash2, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Settings } from '@/types';
import { formatCurrency } from '@/lib/formatTime';
import jsPDF from 'jspdf';
import invoiceBackground from '@/assets/invoice-background.jpg';

interface LineItem {
  id: string;
  description: string;
  time: string;
  amount: number;
}

interface PartItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  description: string;
}

interface Props {
  settings: Settings;
}

export const DesktopInvoiceView = ({ settings }: Props) => {
  // Client fields
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');

  // Vehicle fields
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleVin, setVehicleVin] = useState('');

  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: '', time: '00:00', amount: 0 },
  ]);
  const [parts, setParts] = useState<PartItem[]>([]);

  const [minHourEnabled, setMinHourEnabled] = useState(false);
  const [minHourCount, setMinHourCount] = useState(1);
  const [cloningEnabled, setCloningEnabled] = useState(false);
  const [cloningCount, setCloningCount] = useState(1);
  const [programmingEnabled, setProgrammingEnabled] = useState(false);
  const [programmingCount, setProgrammingCount] = useState(1);

  const hourlyRate = settings.defaultHourlyRate;
  const cloningRate = settings.defaultCloningRate || 0;
  const programmingRate = settings.defaultProgrammingRate || 0;

  const minHourAdj = minHourEnabled ? minHourCount * hourlyRate : 0;
  const cloningTotal = cloningEnabled ? cloningCount * cloningRate : 0;
  const programmingTotal = programmingEnabled ? programmingCount * programmingRate : 0;

  // Filter active line items (have content + time or amount)
  const activeLineItems = lineItems.filter(li =>
    li.description.trim() !== '' && (li.time !== '00:00' || li.amount > 0)
  );

  const laborTotal = activeLineItems.reduce((s, li) => s + li.amount, 0) + minHourAdj + cloningTotal + programmingTotal;
  const partsTotal = parts.reduce((s, p) => s + p.price * p.quantity, 0);
  const grandTotal = laborTotal + partsTotal;

  const vehicleInfo = useMemo(() => {
    const info = [vehicleYear, vehicleMake, vehicleModel].filter(Boolean).join(' ');
    return info + (vehicleVin ? ` (VIN: ${vehicleVin})` : '');
  }, [vehicleYear, vehicleMake, vehicleModel, vehicleVin]);

  const addLineItem = () => setLineItems(prev => [...prev, { id: crypto.randomUUID(), description: '', time: '00:00', amount: 0 }]);
  const removeLineItem = (id: string) => setLineItems(prev => prev.filter(li => li.id !== id));
  const updateLineItem = (id: string, field: keyof LineItem, value: any) =>
    setLineItems(prev => prev.map(li => li.id === id ? { ...li, [field]: value } : li));

  const addPart = () => setParts(prev => [...prev, { id: crypto.randomUUID(), name: '', quantity: 1, price: 0, description: '' }]);
  const removePart = (id: string) => setParts(prev => prev.filter(p => p.id !== id));
  const updatePart = (id: string, field: keyof PartItem, value: any) =>
    setParts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));

  const generatePDF = () => {
    const doc = new jsPDF({ format: 'letter' });
    doc.addImage(invoiceBackground, 'JPEG', 0, 0, 215.9, 279.4);

    // To
    doc.setFontSize(17);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(128, 0, 128);
    doc.text('To:', 20, 42);

    // Date right
    const billedDate = new Date(invoiceDate).toLocaleDateString('en-US');
    doc.text(billedDate, 195.9, 42, { align: 'right' });

    // Client name
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(clientName || 'N/A', 20, 47);

    // Vehicle
    doc.text(vehicleInfo || 'Vehicle Info Not Available', 20, 52);

    // Table
    const tableTop = 66;
    const col1X = 20;
    const col2X = 130;
    const col3X = 190.9;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('DESCRIPTION', 25, tableTop + 6);
    doc.text('TIME', col2X - 1, tableTop + 6);
    doc.text('AMOUNT', 190.9, tableTop + 6, { align: 'right' });

    doc.setLineWidth(0.3);
    doc.setDrawColor(255, 0, 0);
    doc.line(20, tableTop + 8, 195.9, tableTop + 8);

    let yPos = tableTop + 16;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    // Only active line items
    activeLineItems.forEach(li => {
      const col1Width = col2X - col1X - 4;
      const wrapped = doc.splitTextToSize(li.description, col1Width);
      const startY = yPos;
      wrapped.forEach((line: string, i: number) => {
        doc.text(line, col1X + 2, yPos);
        if (i < wrapped.length - 1) yPos += 6;
      });
      if (li.time !== '00:00') doc.text(li.time, col2X + 2, startY);
      if (li.amount > 0) doc.text(formatCurrency(li.amount), col3X + 2, startY, { align: 'right' });
      yPos += 8;
    });

    // Billing extras
    if (minHourEnabled && minHourAdj > 0) {
      doc.text(`Min 1 Hour adjustment (×${minHourCount})`, col1X + 2, yPos);
      doc.text(formatCurrency(minHourAdj), col3X + 2, yPos, { align: 'right' });
      yPos += 8;
    }
    if (cloningEnabled && cloningTotal > 0) {
      doc.text(`Cloning (×${cloningCount})`, col1X + 2, yPos);
      doc.text(formatCurrency(cloningTotal), col3X + 2, yPos, { align: 'right' });
      yPos += 8;
    }
    if (programmingEnabled && programmingTotal > 0) {
      doc.text(`Programming (×${programmingCount})`, col1X + 2, yPos);
      doc.text(formatCurrency(programmingTotal), col3X + 2, yPos, { align: 'right' });
      yPos += 8;
    }

    // Parts
    parts.forEach(part => {
      if (!part.name) return;
      const partY = yPos;
      doc.text(part.name, col1X + 2, partY);
      if (part.description) {
        yPos += 6;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 100, 100);
        const wrapped = doc.splitTextToSize(part.description, col2X - col1X - 6);
        wrapped.forEach((line: string, i: number) => {
          doc.text(line, col1X + 4, yPos);
          if (i < wrapped.length - 1) yPos += 5;
        });
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        yPos += 2;
      }
      doc.text(`${part.quantity}`, col2X + 2, partY);
      doc.text(formatCurrency(part.price * part.quantity), col3X + 2, partY, { align: 'right' });
      yPos += 8;
    });

    // Total
    yPos = 261;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', col3X - 45, yPos);
    doc.text(formatCurrency(grandTotal), col3X + 2, yPos, { align: 'right' });

    // Timestamp
    const now = new Date();
    const ts = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getFullYear()).slice(-2)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(ts, 107.95, 277.4, { align: 'center' });

    doc.save(`Invoice_${clientName || 'invoice'}.pdf`);
  };

  // Preview scaling
  const previewW = 500;
  const previewH = previewW * (279.4 / 215.9);
  const scale = previewW / 215.9;

  return (
    <div className="flex-1 overflow-hidden flex">
      {/* Form panel */}
      <div className="w-[420px] shrink-0 border-r bg-card overflow-y-auto p-5 space-y-5">
        <h2 className="text-lg font-bold text-foreground">Create Invoice</h2>

        {/* Client info */}
        <div className="space-y-2">
          <Label>Client</Label>
          <Input placeholder="Name" value={clientName} onChange={e => setClientName(e.target.value)} />
          <div className="flex gap-2">
            <Input placeholder="Email" className="flex-1" value={clientEmail} onChange={e => setClientEmail(e.target.value)} />
            <Input placeholder="Phone" className="w-36" value={clientPhone} onChange={e => setClientPhone(e.target.value)} />
          </div>
        </div>

        {/* Vehicle info */}
        <div className="space-y-2">
          <Label>Vehicle</Label>
          <div className="flex gap-2">
            <Input placeholder="Year" className="w-20" value={vehicleYear} onChange={e => setVehicleYear(e.target.value)} />
            <Input placeholder="Make" className="flex-1" value={vehicleMake} onChange={e => setVehicleMake(e.target.value)} />
            <Input placeholder="Model" className="flex-1" value={vehicleModel} onChange={e => setVehicleModel(e.target.value)} />
          </div>
          <Input placeholder="VIN" value={vehicleVin} onChange={e => setVehicleVin(e.target.value)} />
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
        </div>

        {/* Line items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Line Items</Label>
            <Button variant="ghost" size="sm" onClick={addLineItem}><Plus className="h-3 w-3 mr-1" />Add</Button>
          </div>
          {lineItems.map(li => (
            <div key={li.id} className="flex gap-1.5 items-start">
              <Textarea placeholder="Description" className="flex-1 text-xs min-h-[36px] resize-y" value={li.description}
                onChange={e => updateLineItem(li.id, 'description', e.target.value)} rows={1} />
              <Input placeholder="hh:mm" className="w-16 text-xs h-8" value={li.time}
                onChange={e => updateLineItem(li.id, 'time', e.target.value)} />
              <Input type="number" placeholder="$" className="w-20 text-xs h-8" value={li.amount || ''}
                onChange={e => updateLineItem(li.id, 'amount', parseFloat(e.target.value) || 0)} />
              {lineItems.length > 1 && (
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeLineItem(li.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Parts */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Parts</Label>
            <Button variant="ghost" size="sm" onClick={addPart}><Plus className="h-3 w-3 mr-1" />Add</Button>
          </div>
          {parts.map(p => (
            <div key={p.id} className="space-y-1">
              <div className="flex gap-1.5 items-start">
                <Input placeholder="Part name" className="flex-1 text-xs h-8" value={p.name}
                  onChange={e => updatePart(p.id, 'name', e.target.value)} />
                <Input type="number" placeholder="Qty" className="w-14 text-xs h-8" value={p.quantity || ''}
                  onChange={e => updatePart(p.id, 'quantity', parseInt(e.target.value) || 0)} />
                <Input type="number" placeholder="$" className="w-20 text-xs h-8" value={p.price || ''}
                  onChange={e => updatePart(p.id, 'price', parseFloat(e.target.value) || 0)} />
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removePart(p.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <Input placeholder="Description (optional)" className="text-xs h-7" value={p.description}
                onChange={e => updatePart(p.id, 'description', e.target.value)} />
            </div>
          ))}
        </div>

        {/* Billing extras */}
        <div className="space-y-2">
          <Label>Billing Extras</Label>
          <div className="flex items-center gap-2">
            <Checkbox checked={minHourEnabled} onCheckedChange={v => setMinHourEnabled(!!v)} />
            <span className="text-sm">Min 1 Hour</span>
            {minHourEnabled && (
              <Input type="number" className="w-14 h-7 text-xs" value={minHourCount}
                onChange={e => setMinHourCount(parseInt(e.target.value) || 1)} min={1} />
            )}
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={cloningEnabled} onCheckedChange={v => setCloningEnabled(!!v)} />
            <span className="text-sm">Cloning ({formatCurrency(cloningRate)})</span>
            {cloningEnabled && (
              <Input type="number" className="w-14 h-7 text-xs" value={cloningCount}
                onChange={e => setCloningCount(parseInt(e.target.value) || 1)} min={1} />
            )}
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={programmingEnabled} onCheckedChange={v => setProgrammingEnabled(!!v)} />
            <span className="text-sm">Programming ({formatCurrency(programmingRate)})</span>
            {programmingEnabled && (
              <Input type="number" className="w-14 h-7 text-xs" value={programmingCount}
                onChange={e => setProgrammingCount(parseInt(e.target.value) || 1)} min={1} />
            )}
          </div>
        </div>

        {/* Total & generate */}
        <div className="border-t pt-3 space-y-3">
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>{formatCurrency(grandTotal)}</span>
          </div>
          <Button className="w-full" onClick={generatePDF}>
            <FileDown className="h-4 w-4 mr-2" />Generate PDF
          </Button>
        </div>
      </div>

      {/* Preview panel */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-6 bg-muted/30">
        <div className="relative shadow-2xl rounded-sm" style={{ width: previewW, height: previewH }}>
          <img src={invoiceBackground} alt="Invoice background" className="w-full h-full object-cover rounded-sm" />

          <div className="absolute inset-0" style={{ fontSize: `${17 * scale * 0.35}px` }}>
            {/* To */}
            <span className="absolute font-bold" style={{ left: 20 * scale, top: 38 * scale, color: '#800080', fontSize: `${17 * scale * 0.35}px` }}>
              To:
            </span>
            {/* Client name */}
            <span className="absolute" style={{ left: 20 * scale, top: 43 * scale, fontSize: `${11 * scale * 0.35}px` }}>
              {clientName}
            </span>
            {/* Vehicle */}
            <span className="absolute" style={{ left: 20 * scale, top: 48 * scale, fontSize: `${11 * scale * 0.35}px` }}>
              {vehicleInfo}
            </span>
            {/* Date */}
            <span className="absolute font-bold" style={{ right: (215.9 - 195.9) * scale, top: 38 * scale, color: '#800080', fontSize: `${17 * scale * 0.35}px` }}>
              {invoiceDate ? new Date(invoiceDate).toLocaleDateString('en-US') : ''}
            </span>

            {/* Table headers */}
            <span className="absolute font-bold" style={{ left: 25 * scale, top: 68.5 * scale, fontSize: `${16 * scale * 0.35}px` }}>DESCRIPTION</span>
            <span className="absolute font-bold" style={{ left: 129 * scale, top: 68.5 * scale, fontSize: `${16 * scale * 0.35}px` }}>TIME</span>
            <span className="absolute font-bold text-right" style={{ right: (215.9 - 190.9) * scale, top: 68.5 * scale, fontSize: `${16 * scale * 0.35}px` }}>AMOUNT</span>

            {/* Active line items only */}
            {activeLineItems.map((li, i) => {
              const yBase = 78 + i * 8;
              return (
                <div key={li.id}>
                  <span className="absolute truncate" style={{ left: 22 * scale, top: yBase * scale, fontSize: `${11 * scale * 0.35}px`, maxWidth: 105 * scale }}>
                    {li.description}
                  </span>
                  {li.time !== '00:00' && (
                    <span className="absolute" style={{ left: 131 * scale, top: yBase * scale, fontSize: `${11 * scale * 0.35}px` }}>
                      {li.time}
                    </span>
                  )}
                  {li.amount > 0 && (
                    <span className="absolute text-right" style={{ right: (215.9 - 193) * scale, top: yBase * scale, fontSize: `${11 * scale * 0.35}px` }}>
                      {formatCurrency(li.amount)}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Total */}
            <span className="absolute font-bold" style={{ right: (215.9 - 145.9) * scale, top: 258 * scale, fontSize: `${16 * scale * 0.35}px` }}>
              TOTAL:
            </span>
            <span className="absolute font-bold text-right" style={{ right: (215.9 - 193) * scale, top: 258 * scale, fontSize: `${16 * scale * 0.35}px` }}>
              {formatCurrency(grandTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
