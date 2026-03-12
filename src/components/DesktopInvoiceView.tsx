import { useState } from 'react';
import { Plus, Trash2, FileDown, Bold, Italic, Underline } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Toggle } from '@/components/ui/toggle';
import { Settings } from '@/types';
import { formatCurrency } from '@/lib/formatTime';
import jsPDF from 'jspdf';
import invoiceBackground from '@/assets/invoice-background.jpg';

interface LineItem {
  id: string;
  description: string;
  time: string;
  amount: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
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
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');

  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: '', time: '', amount: 0, bold: false, italic: false, underline: false },
  ]);
  const [parts, setParts] = useState<PartItem[]>([]);

  const activeLineItems = lineItems.filter(li =>
    li.description.trim() !== '' || (li.time && li.time !== '00:00' && li.time !== '') || li.amount > 0
  );

  const hasAnyTime = activeLineItems.some(li => li.time && li.time !== '00:00' && li.time !== '');
  const hasAnyAmount = activeLineItems.some(li => li.amount > 0) || parts.length > 0;

  const laborTotal = activeLineItems.reduce((s, li) => s + li.amount, 0);
  const partsTotal = parts.reduce((s, p) => s + p.price * p.quantity, 0);
  const grandTotal = laborTotal + partsTotal;

  const addLineItem = () => setLineItems(prev => [...prev, { id: crypto.randomUUID(), description: '', time: '', amount: 0, bold: false, italic: false, underline: false }]);
  const removeLineItem = (id: string) => setLineItems(prev => prev.filter(li => li.id !== id));
  const updateLineItem = (id: string, field: keyof LineItem, value: any) =>
    setLineItems(prev => prev.map(li => li.id === id ? { ...li, [field]: value } : li));

  const addPart = () => setParts(prev => [...prev, { id: crypto.randomUUID(), name: '', quantity: 1, price: 0, description: '' }]);
  const removePart = (id: string) => setParts(prev => prev.filter(p => p.id !== id));
  const updatePart = (id: string, field: keyof PartItem, value: any) =>
    setParts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));

  const getFontStyle = (bold: boolean, italic: boolean): string => {
    if (bold && italic) return 'bolditalic';
    if (bold) return 'bold';
    if (italic) return 'italic';
    return 'normal';
  };

  // Dynamic description width based on visible columns
  const getDescWidth = () => {
    if (!hasAnyTime && !hasAnyAmount) return 170;
    if (hasAnyTime && hasAnyAmount) return 106;
    return 140; // one column visible
  };

  const generatePDF = () => {
    const doc = new jsPDF({ format: 'letter' });
    doc.addImage(invoiceBackground, 'JPEG', 0, 0, 215.9, 279.4);

    const col1X = 20;
    const col2X = 130;
    const col3X = 190.9;
    const descWidth = getDescWidth();

    // To: at y=43
    doc.setFontSize(17);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(128, 0, 128);
    doc.text('To:', 20, 43);

    // Date at y=55, right-aligned, just above stars
    const billedDate = new Date(invoiceDate).toLocaleDateString('en-US');
    doc.text(billedDate, 195.9, 55, { align: 'right' });

    // Due date at y=59
    if (dueDate) {
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Due: ${new Date(dueDate).toLocaleDateString('en-US')}`, 195.9, 59, { align: 'right' });
    }

    // Client info starting at y=48, +4 spacing
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    let clientY = 48;
    if (clientName) { doc.text(clientName, 20, clientY); clientY += 4; }
    if (clientEmail) { doc.text(clientEmail, 20, clientY); clientY += 4; }
    if (clientPhone) { doc.text(clientPhone, 20, clientY); clientY += 4; }
    if (clientAddress) {
      const addrLines = doc.splitTextToSize(clientAddress, 100);
      doc.text(addrLines[0], 20, clientY);
    }

    // Table headers at y=66
    const tableTop = 66;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('DESCRIPTION', 25, tableTop + 6);
    if (hasAnyTime) doc.text('TIME', col2X - 1, tableTop + 6);
    if (hasAnyAmount) doc.text('AMOUNT', 190.9, tableTop + 6, { align: 'right' });

    doc.setLineWidth(0.3);
    doc.setDrawColor(255, 0, 0);
    doc.line(20, tableTop + 8, 195.9, tableTop + 8);

    let yPos = tableTop + 16;
    doc.setFontSize(11);

    // Line items
    activeLineItems.forEach(li => {
      const startY = yPos;
      const fontStyle = getFontStyle(li.bold, li.italic);

      if (li.description.trim()) {
        doc.setFont('helvetica', fontStyle);
        const wrapped = doc.splitTextToSize(li.description, descWidth);
        wrapped.forEach((line: string, i: number) => {
          doc.text(line, col1X + 2, yPos);
          if (li.underline) {
            const textWidth = doc.getTextWidth(line);
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.2);
            doc.line(col1X + 2, yPos + 0.8, col1X + 2 + textWidth, yPos + 0.8);
          }
          if (i < wrapped.length - 1) yPos += 6;
        });
        doc.setFont('helvetica', 'normal');
      }
      if (hasAnyTime && li.time && li.time !== '00:00' && li.time !== '') {
        doc.text(li.time, col2X + 2, startY);
      }
      if (hasAnyAmount && li.amount > 0) {
        doc.text(formatCurrency(li.amount), col3X + 2, startY, { align: 'right' });
      }
      yPos += 8;
    });

    // Parts
    parts.forEach(part => {
      if (!part.name) return;
      const partY = yPos;
      doc.setFont('helvetica', 'normal');
      doc.text(part.name, col1X + 2, partY);
      if (part.description) {
        yPos += 6;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 100, 100);
        const wrapped = doc.splitTextToSize(part.description, descWidth - 4);
        wrapped.forEach((line: string, i: number) => {
          doc.text(line, col1X + 4, yPos);
          if (i < wrapped.length - 1) yPos += 5;
        });
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        yPos += 2;
      }
      if (hasAnyTime) doc.text(`${part.quantity}`, col2X + 2, partY);
      if (hasAnyAmount) doc.text(formatCurrency(part.price * part.quantity), col3X + 2, partY, { align: 'right' });
      yPos += 8;
    });

    // Notes
    if (notes.trim()) {
      yPos += 4;
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      const noteLines = doc.splitTextToSize(notes, 170);
      noteLines.forEach((line: string) => {
        if (yPos < 250) { doc.text(line, col1X + 2, yPos); yPos += 5; }
      });
      doc.setTextColor(0, 0, 0);
    }

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

  // Preview description max-width mirrors PDF logic
  const previewDescMaxW = getDescWidth() * scale;

  return (
    <div className="flex-1 overflow-hidden flex">
      {/* Form panel */}
      <div className="w-[420px] shrink-0 border-r bg-card overflow-y-auto p-5 space-y-5">
        <h2 className="text-lg font-bold text-foreground">Create Invoice</h2>

        {/* Invoice info — date & due date only */}
        <div className="space-y-2">
          <Label>Invoice Date</Label>
          <div className="flex gap-2">
            <Input type="date" className="w-40" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
            <Input type="date" placeholder="Due date" className="w-40" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
        </div>

        {/* Client info */}
        <div className="space-y-2">
          <Label>Client</Label>
          <Input placeholder="Name" value={clientName} onChange={e => setClientName(e.target.value)} />
          <div className="flex gap-2">
            <Input placeholder="Email" className="flex-1" value={clientEmail} onChange={e => setClientEmail(e.target.value)} />
            <Input placeholder="Phone" className="w-36" value={clientPhone} onChange={e => setClientPhone(e.target.value)} />
          </div>
          <Textarea placeholder="Address" className="min-h-[50px] text-sm" value={clientAddress} onChange={e => setClientAddress(e.target.value)} rows={2} />
        </div>

        {/* Line items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Line Items</Label>
            <Button variant="ghost" size="sm" onClick={addLineItem}><Plus className="h-3 w-3 mr-1" />Add</Button>
          </div>
          {lineItems.map(li => (
            <div key={li.id} className="space-y-1">
              <div className="flex gap-1.5 items-start">
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
              <div className="flex gap-0.5 ml-0.5">
                <Toggle size="sm" pressed={li.bold} onPressedChange={v => updateLineItem(li.id, 'bold', v)}
                  className="h-6 w-6 p-0 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  <Bold className="h-3 w-3" />
                </Toggle>
                <Toggle size="sm" pressed={li.italic} onPressedChange={v => updateLineItem(li.id, 'italic', v)}
                  className="h-6 w-6 p-0 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  <Italic className="h-3 w-3" />
                </Toggle>
                <Toggle size="sm" pressed={li.underline} onPressedChange={v => updateLineItem(li.id, 'underline', v)}
                  className="h-6 w-6 p-0 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  <Underline className="h-3 w-3" />
                </Toggle>
              </div>
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

        {/* Notes */}
        <div className="space-y-2">
          <Label>Notes / Terms</Label>
          <Textarea placeholder="Payment terms, notes, etc." className="min-h-[60px] text-sm" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
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

          <div className="absolute inset-0" style={{ fontSize: `${11 * scale * 0.35}px` }}>
            {/* To */}
            <span className="absolute font-bold" style={{ left: 20 * scale, top: 39 * scale, color: '#800080', fontSize: `${17 * scale * 0.35}px` }}>
              To:
            </span>
            {/* Date — above stars */}
            <span className="absolute font-bold" style={{ right: (215.9 - 195.9) * scale, top: 51 * scale, color: '#800080', fontSize: `${17 * scale * 0.35}px` }}>
              {invoiceDate ? new Date(invoiceDate).toLocaleDateString('en-US') : ''}
            </span>
            {/* Due date */}
            {dueDate && (
              <span className="absolute text-muted-foreground" style={{ right: (215.9 - 195.9) * scale, top: 55 * scale, fontSize: `${9 * scale * 0.35}px` }}>
                Due: {new Date(dueDate).toLocaleDateString('en-US')}
              </span>
            )}

            {/* Client info — y=44 with +4 spacing */}
            {(() => {
              let cy = 44;
              const items: React.ReactNode[] = [];
              if (clientName) { items.push(<span key="name" className="absolute" style={{ left: 20 * scale, top: cy * scale }}>{clientName}</span>); cy += 4; }
              if (clientEmail) { items.push(<span key="email" className="absolute" style={{ left: 20 * scale, top: cy * scale }}>{clientEmail}</span>); cy += 4; }
              if (clientPhone) { items.push(<span key="phone" className="absolute" style={{ left: 20 * scale, top: cy * scale }}>{clientPhone}</span>); cy += 4; }
              if (clientAddress) { items.push(<span key="addr" className="absolute truncate" style={{ left: 20 * scale, top: cy * scale, maxWidth: 120 * scale }}>{clientAddress}</span>); }
              return items;
            })()}

            {/* Table headers — dynamic */}
            <span className="absolute font-bold" style={{ left: 25 * scale, top: 68.5 * scale, fontSize: `${16 * scale * 0.35}px` }}>DESCRIPTION</span>
            {hasAnyTime && (
              <span className="absolute font-bold" style={{ left: 129 * scale, top: 68.5 * scale, fontSize: `${16 * scale * 0.35}px` }}>TIME</span>
            )}
            {hasAnyAmount && (
              <span className="absolute font-bold text-right" style={{ right: (215.9 - 190.9) * scale, top: 68.5 * scale, fontSize: `${16 * scale * 0.35}px` }}>AMOUNT</span>
            )}

            {/* Active line items */}
            {activeLineItems.map((li, i) => {
              const yBase = 78 + i * 8;
              return (
                <div key={li.id}>
                  {li.description.trim() && (
                    <span className="absolute" style={{
                      left: 22 * scale,
                      top: yBase * scale,
                      maxWidth: previewDescMaxW,
                      fontWeight: li.bold ? 'bold' : 'normal',
                      fontStyle: li.italic ? 'italic' : 'normal',
                      textDecoration: li.underline ? 'underline' : 'none',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: hasAnyTime || hasAnyAmount ? 'nowrap' : 'normal',
                    }}>
                      {li.description}
                    </span>
                  )}
                  {hasAnyTime && li.time && li.time !== '00:00' && li.time !== '' && (
                    <span className="absolute" style={{ left: 131 * scale, top: yBase * scale }}>
                      {li.time}
                    </span>
                  )}
                  {hasAnyAmount && li.amount > 0 && (
                    <span className="absolute text-right" style={{ right: (215.9 - 193) * scale, top: yBase * scale }}>
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
