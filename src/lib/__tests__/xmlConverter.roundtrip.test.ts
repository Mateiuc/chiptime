// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { exportToXML, parseXMLString } from '@/lib/xmlConverter';

describe('XML backup round trip', () => {
  it('keeps deposits, paid date, deposit used, discounts and portal settings', () => {
    const paidAt = new Date('2026-08-20T06:04:03.199Z');
    const data: any = {
      version: '1.0',
      exportDate: '2026-10-18T00:00:00.000Z',
      clients: [{
        id: 'c1', name: 'Client "A" & Co', createdAt: new Date('2026-01-01T00:00:00Z'), prepaidAmount: 6700,
        deposits: [{ id: 'd1', amount: 4700, date: '2026-01-21', note: 'Initial deposit' }, { id: 'd2', amount: 2000, date: '2026-10-10', method: 'zelle' }],
        portalBgColor: '#123456',
      }],
      vehicles: [{ id: 'v1', clientId: 'c1', vin: 'VIN1', discountType: 'percent', discountValue: 10, diagnosticPdfPath: 'p/1.pdf', prepaidAmount: 300, deposits: [{ id: 'd3', amount: 300, date: '2026-02-01' }] }],
      tasks: [{
        id: 't1', clientId: 'c1', vehicleId: 'v1', customerName: 'A', carVin: 'VIN1', status: 'paid', totalTime: 60, needsFollowUp: false,
        createdAt: new Date('2026-08-01T00:00:00Z'), paidAt, createdBy: 'u1', diagnosticPdfPath: 'p/t1.pdf',
        depositApplied: { vehicle: 0, client: 721, at: paidAt },
        sessions: [{
          id: 's1', createdAt: new Date('2026-08-01T00:00:00Z'), createdBy: 'u1',
          periods: [], parts: [{ name: 'Key', quantity: 1, price: 10, createdBy: 'u2' }],
          jobs: [{ id: 'j1', name: 'Brakes', price: 250, createdBy: 'u2' }],
          photos: [{ id: 'ph1', capturedAt: new Date('2026-08-01T00:00:00Z'), sessionNumber: 1, cloudPath: 'photos/ph1.jpg' }],
        }],
      }],
      settings: {
        defaultHourlyRate: 80, paymentMethods: [{ label: 'Zelle', url: 'https://example.com' }],
        portalBusinessName: 'Shop', ocrProvider: 'claude', notificationsEnabled: true,
      },
      schedule: [],
    };

    const back: any = parseXMLString(exportToXML(data));
    expect(back.clients[0].name).toBe('Client "A" & Co');
    expect(back.clients[0].deposits).toEqual(data.clients[0].deposits);
    expect(back.clients[0].portalBgColor).toBe('#123456');
    expect(back.vehicles[0]).toMatchObject({ discountType: 'percent', discountValue: 10, diagnosticPdfPath: 'p/1.pdf', deposits: data.vehicles[0].deposits });
    const t = back.tasks[0];
    expect(t.paidAt.toISOString()).toBe(paidAt.toISOString());
    expect(t.depositApplied.client).toBe(721);
    expect(t.depositApplied.at.toISOString()).toBe(paidAt.toISOString());
    expect(t).toMatchObject({ createdBy: 'u1', diagnosticPdfPath: 'p/t1.pdf' });
    expect(t.sessions[0].createdBy).toBe('u1');
    expect(t.sessions[0].parts[0].createdBy).toBe('u2');
    expect(t.sessions[0].jobs[0].createdBy).toBe('u2');
    expect(t.sessions[0].photos[0].cloudPath).toBe('photos/ph1.jpg');
    expect(back.settings).toMatchObject({ paymentMethods: data.settings.paymentMethods, portalBusinessName: 'Shop', ocrProvider: 'claude', notificationsEnabled: true });
  });
});
