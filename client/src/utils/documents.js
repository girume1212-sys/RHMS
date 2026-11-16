const UPLOAD_PREFIX_RE = /^\d{10,}-(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-)?/i;

export function cleanDocumentName(value) {
  let name = String(value || '');
  try {
    name = decodeURIComponent(name);
  } catch (e) {
    // keep the original value when it is not URL encoded
  }
  name = name.split('?')[0].split('#')[0].replace(/\\/g, '/').split('/').pop() || '';
  return name.replace(UPLOAD_PREFIX_RE, '') || 'document';
}

export function documentKind(nameOrPath) {
  const ext = String(nameOrPath || '').toLowerCase().split('?')[0].split('#')[0].split('.').pop();
  if (ext === 'doc' || ext === 'docx') return 'word';
  if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') return 'excel';
  if (ext === 'ppt' || ext === 'pptx') return 'powerpoint';
  return null;
}

export function isOfficeDocument(nameOrPath) {
  return !!documentKind(nameOrPath);
}

export const DOCUMENT_META = {
  word: {
    label: 'Word document',
    color: '#2B579A',
    soft: 'rgba(43,87,154,0.12)',
    officeName: 'Microsoft Word',
    officeBadge: 'W',
    officeColor: '#2B579A',
    wpsName: 'WPS Writer',
  },
  excel: {
    label: 'Excel workbook',
    color: '#217346',
    soft: 'rgba(33,115,70,0.12)',
    officeName: 'Microsoft Excel',
    officeBadge: 'X',
    officeColor: '#217346',
    wpsName: 'WPS Spreadsheets',
  },
  powerpoint: {
    label: 'PowerPoint presentation',
    color: '#D24726',
    soft: 'rgba(210,71,38,0.12)',
    officeName: 'Microsoft PowerPoint',
    officeBadge: 'P',
    officeColor: '#D24726',
    wpsName: 'WPS Presentation',
  },
};

export function documentApps(kind) {
  const meta = DOCUMENT_META[kind];
  if (!meta) return [];
  return [
    {
      id: 'wps',
      name: meta.wpsName,
      badge: 'WPS',
      color: 'linear-gradient(135deg,#E53935 0%,#FF8F00 100%)',
      hint: 'Open the original file in WPS Office on this computer',
    },
    {
      id: 'office',
      name: meta.officeName,
      badge: meta.officeBadge,
      color: meta.officeColor,
      hint: 'Open the original file in Microsoft Office on this computer',
    },
  ];
}
