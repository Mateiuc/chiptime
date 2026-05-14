import { Contacts } from '@capacitor-community/contacts';
import { Capacitor } from '@capacitor/core';
import { dlog } from '@/lib/devLog';

export interface PhoneNumber {
  number: string;
  type: string;       // 'mobile', 'home', 'work', 'main', 'other', etc.
  isPrimary: boolean;
}

export interface PhoneContact {
  id: string;
  name: string;
  phoneNumbers: PhoneNumber[];
  emails: string[];
}

export const contactsService = {
  // Check if browser Contact Picker API is available (for PWA on Chrome Android)
  isContactPickerSupported(): boolean {
    return 'contacts' in navigator && 'ContactsManager' in window;
  },

  // Pick a single contact using browser's Contact Picker API (PWA)
  async pickContact(): Promise<PhoneContact | null> {
    if (!this.isContactPickerSupported()) {
      dlog('[Contacts] Contact Picker API not supported in this browser');
      return null;
    }

    try {
      dlog('[Contacts] Opening browser contact picker...');
      const props = ['name', 'tel'];
      const contacts = await navigator.contacts!.select(props, { multiple: false });
      
      if (contacts.length > 0) {
        const contact = contacts[0];
        dlog('[Contacts] User selected a contact:', contact.name?.[0]);
        
        return {
          id: crypto.randomUUID(),
          name: contact.name?.[0] || 'Unknown',
          phoneNumbers: contact.tel?.map((t, index) => ({
            number: t,
            type: 'mobile',
            isPrimary: index === 0,
          })) || [],
          emails: [],
        };
      }
      
      dlog('[Contacts] User cancelled contact picker');
      return null;
    } catch (error) {
      console.error('[Contacts] Error picking contact:', error);
      return null;
    }
  },

  async requestPermissions(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      dlog('Not running on native platform');
      return false;
    }

    try {
      const result = await Contacts.requestPermissions();
      return result.contacts === 'granted';
    } catch (error) {
      console.error('Error requesting contacts permission:', error);
      return false;
    }
  },

  async checkPermissions(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }

    try {
      const result = await Contacts.checkPermissions();
      return result.contacts === 'granted';
    } catch (error) {
      console.error('Error checking contacts permission:', error);
      return false;
    }
  },

  async getAllContacts(): Promise<PhoneContact[]> {
    // Check if running on native platform first
    if (!Capacitor.isNativePlatform()) {
      dlog('[Contacts] Not running on native platform - contacts unavailable');
      return [];
    }

    try {
      dlog('[Contacts] Checking permission status...');
      const hasPermission = await this.checkPermissions();
      
      if (!hasPermission) {
        dlog('[Contacts] Permission not granted, requesting...');
        const granted = await this.requestPermissions();
        if (!granted) {
          console.warn(
            '[Contacts] Permission denied. This could mean:\n' +
            '1. User denied the permission request\n' +
            '2. READ_CONTACTS permission is not declared in AndroidManifest.xml\n' +
            '3. App needs to be reinstalled after adding permissions\n' +
            'See ANDROID_STUDIO_SETUP.md for required permissions.'
          );
          return [];
        }
      }

      dlog('[Contacts] Permission granted, fetching contacts from device...');
      const result = await Contacts.getContacts({
        projection: {
          name: true,
          phones: true,
          emails: true,
        }
      });

      dlog(`[Contacts] Successfully fetched ${result.contacts.length} contacts`);
      
      const mappedContacts = result.contacts.map((contact: any) => ({
        id: contact.contactId || Math.random().toString(),
        name: contact.name?.display || 'Unknown',
        phoneNumbers: contact.phones?.map((p: any) => ({
          number: p.number || '',
          type: (p.type || 'other').toLowerCase(),
          isPrimary: p.isPrimary || false,
        })) || [],
        emails: contact.emails?.map((e: any) => e.address || '') || [],
      }));

      // Filter out contacts without names or phone numbers
      const validContacts = mappedContacts.filter(
        c => c.name !== 'Unknown' && c.phoneNumbers.length > 0
      );
      
      dlog(`[Contacts] Returning ${validContacts.length} valid contacts (with name and phone)`);
      return validContacts;
    } catch (error: any) {
      console.error('[Contacts] Error fetching contacts:', error);
      console.error('[Contacts] Error details:', error?.message || 'Unknown error');
      
      // Check for common permission-related errors
      if (error?.message?.includes('permission') || error?.code === 'PERMISSION_DENIED') {
        console.warn(
          '[Contacts] Permission error detected. Ensure READ_CONTACTS is in AndroidManifest.xml'
        );
      }
      
      return [];
    }
  },

  searchContacts(contacts: PhoneContact[], query: string): PhoneContact[] {
    if (!query.trim()) return contacts;
    
    const lowercaseQuery = query.toLowerCase();
    return contacts.filter(contact => 
      contact.name.toLowerCase().includes(lowercaseQuery) ||
      contact.phoneNumbers.some(phone => phone.number.includes(query)) ||
      contact.emails.some(email => email.toLowerCase().includes(lowercaseQuery))
    );
  },

  getBestPhoneNumber(phones: PhoneNumber[]): string | null {
    if (!phones || phones.length === 0) return null;
    
    // Priority 1: isPrimary flag (user explicitly set as preferred)
    const primary = phones.find(p => p.isPrimary);
    if (primary) return primary.number;
    
    // Priority 2: Mobile type (most likely to reach person)
    const mobile = phones.find(p => p.type === 'mobile');
    if (mobile) return mobile.number;
    
    // Priority 3: Main type
    const main = phones.find(p => p.type === 'main');
    if (main) return main.number;
    
    // Priority 4: Work type
    const work = phones.find(p => p.type === 'work');
    if (work) return work.number;
    
    // Fallback: first number in list
    return phones[0]?.number || null;
  },

  formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX for 10 digit numbers
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    
    // Format as +X (XXX) XXX-XXXX for 11 digit numbers (with country code)
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    
    return phone;
  }
};
