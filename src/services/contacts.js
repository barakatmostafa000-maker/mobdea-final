export function normalizeEgyptPhone(value = '') {
  let digits = String(value).replace(/\D/g, '');
  if (digits.startsWith('0020')) digits = digits.slice(4);
  if (digits.startsWith('20') && digits.length >= 12) digits = digits.slice(2);
  if (digits.startsWith('0')) return digits.slice(0, 11);
  if (digits.length === 10 && digits.startsWith('1')) return `0${digits}`;
  return digits;
}

export async function pickPhoneFromContacts() {
  if (!('contacts' in navigator) || typeof navigator.contacts.select !== 'function') {
    return { supported: false, phone: '' };
  }
  const result = await navigator.contacts.select(['name', 'tel'], { multiple: false });
  const contact = result?.[0];
  const phone = normalizeEgyptPhone(contact?.tel?.[0] || '');
  return { supported: true, phone, name: contact?.name?.[0] || '' };
}
