const DEFAULT_SLIDE_WIDTH = 12_192_000;
const DEFAULT_SLIDE_HEIGHT = 6_858_000;
const OFFICE_RELATIONSHIPS_NAMESPACE = ['http:', '', 'schemas.openxmlformats.org', 'officeDocument', '2006', 'relationships'].join('/');

const localName = (node) => String(node?.localName || node?.nodeName || '').split(':').pop();
const elementChildren = (node) => [...(node?.childNodes || [])].filter((child) => child.nodeType === 1);

function descendants(node, wanted) {
  const matches = [];
  const visit = (current) => {
    for (const child of elementChildren(current)) {
      if (localName(child) === wanted) matches.push(child);
      visit(child);
    }
  };
  visit(node);
  return matches;
}

const firstDescendant = (node, wanted) => descendants(node, wanted)[0] || null;
const firstChild = (node, wanted) => elementChildren(node).find((child) => localName(child) === wanted) || null;
const numberAttr = (node, name, fallback = 0) => {
  const value = Number(node?.getAttribute?.(name));
  return Number.isFinite(value) ? value : fallback;
};

function colorFrom(container, fallback = '', deep = true) {
  if (!container) return fallback;
  const solidFill = firstChild(container, 'solidFill') || (deep ? firstDescendant(container, 'solidFill') : null);
  if (!solidFill) return fallback;
  const rgb = firstDescendant(solidFill, 'srgbClr')?.getAttribute?.('val');
  if (/^[0-9a-f]{6}$/i.test(String(rgb || ''))) return `#${rgb}`;
  const system = firstDescendant(solidFill, 'sysClr')?.getAttribute?.('lastClr');
  if (/^[0-9a-f]{6}$/i.test(String(system || ''))) return `#${system}`;
  const scheme = firstDescendant(solidFill, 'schemeClr')?.getAttribute?.('val');
  return {
    dk1: '#111827', lt1: '#ffffff', dk2: '#1f2937', lt2: '#f8fafc',
    accent1: '#2563eb', accent2: '#dc2626', accent3: '#16a34a',
    accent4: '#7c3aed', accent5: '#0891b2', accent6: '#d97706',
  }[scheme] || fallback;
}

function normalizeShapeKind(value = '') {
  const kind = String(value).toLowerCase();
  if (kind.includes('ellipse')) return 'ellipse';
  if (kind.includes('triangle')) return 'triangle';
  if (kind.includes('diamond')) return 'diamond';
  if (kind.includes('arrow')) return 'arrow';
  if (kind.includes('line')) return 'line';
  if (kind.includes('roundrect')) return 'roundRect';
  return 'rect';
}

function placeholderKey(node) {
  const placeholder = firstDescendant(node, 'ph');
  if (!placeholder) return '';
  const index = placeholder.getAttribute?.('idx');
  const type = placeholder.getAttribute?.('type');
  if (index != null && String(index) !== '') return `idx:${index}`;
  if (type) return `type:${type}`;
  return 'type:body';
}

function placeholderMapOf(document) {
  const output = new Map();
  const tree = firstDescendant(document, 'spTree');
  for (const node of elementChildren(tree)) {
    const key = placeholderKey(node);
    if (key) output.set(key, node);
  }
  return output;
}

function transformNode(node) {
  return firstDescendant(node, 'xfrm');
}

function transformOf(node, slideWidth, slideHeight, inheritedNode = null) {
  const transform = transformNode(node) || transformNode(inheritedNode);
  const offset = firstChild(transform, 'off') || firstDescendant(transform, 'off');
  const extent = firstChild(transform, 'ext') || firstDescendant(transform, 'ext');
  const percent = (value, total, fallback) => {
    const result = (Number(value) / Math.max(1, total)) * 100;
    return Number.isFinite(result) ? Math.max(-20, Math.min(140, result)) : fallback;
  };
  return {
    x: percent(numberAttr(offset, 'x'), slideWidth, 0),
    y: percent(numberAttr(offset, 'y'), slideHeight, 0),
    w: Math.max(.2, percent(numberAttr(extent, 'cx'), slideWidth, 10)),
    h: Math.max(.2, percent(numberAttr(extent, 'cy'), slideHeight, 10)),
    rotation: numberAttr(transform, 'rot') / 60_000,
    flipH: transform?.getAttribute?.('flipH') === '1',
    flipV: transform?.getAttribute?.('flipV') === '1',
  };
}

function textStyleOf(node, inheritedNode = null) {
  const runProperties = firstDescendant(node, 'rPr') || firstDescendant(node, 'defRPr')
    || firstDescendant(inheritedNode, 'rPr') || firstDescendant(inheritedNode, 'defRPr');
  const paragraphProperties = firstDescendant(node, 'pPr') || firstDescendant(inheritedNode, 'pPr');
  const rawSize = numberAttr(runProperties, 'sz', 1800);
  const alignment = paragraphProperties?.getAttribute?.('algn') || '';
  return {
    color: colorFrom(runProperties, '#111827'),
    fontSize: Math.max(10, Math.min(72, (rawSize / 100) * (96 / 72))),
    bold: ['1', 'true'].includes(runProperties?.getAttribute?.('b')),
    italic: ['1', 'true'].includes(runProperties?.getAttribute?.('i')),
    align: alignment === 'ctr' ? 'center' : alignment === 'r' ? 'right' : alignment === 'just' ? 'justify' : 'left',
  };
}

function textOf(node) {
  return descendants(node, 't').map((item) => String(item.textContent || '').trim()).filter(Boolean).join('\n');
}

function relationshipId(node) {
  const blip = firstDescendant(node, 'blip');
  return blip?.getAttribute?.('r:embed') || blip?.getAttribute?.('embed') || blip?.getAttributeNS?.(OFFICE_RELATIONSHIPS_NAMESPACE, 'embed') || '';
}

export function readPptxSlideSize(presentationXml) {
  const size = firstDescendant(presentationXml, 'sldSz');
  return {
    width: Math.max(1, numberAttr(size, 'cx', DEFAULT_SLIDE_WIDTH)),
    height: Math.max(1, numberAttr(size, 'cy', DEFAULT_SLIDE_HEIGHT)),
  };
}

export function readPptxRelationships(relationshipsXml, resolveTarget) {
  const output = new Map();
  for (const item of descendants(relationshipsXml, 'Relationship')) {
    const id = item.getAttribute?.('Id') || '';
    const target = item.getAttribute?.('Target') || '';
    const type = item.getAttribute?.('Type') || '';
    if (id && target) output.set(id, { id, type, path: resolveTarget(target) });
  }
  return output;
}

export function parsePptxSlideLayout(slideXml, {
  slideWidth = DEFAULT_SLIDE_WIDTH,
  slideHeight = DEFAULT_SLIDE_HEIGHT,
  relationships = new Map(),
  imageSources = new Map(),
  layoutXml = null,
  layoutRelationships = new Map(),
  layoutImageSources = new Map(),
} = {}) {
  const tree = firstDescendant(slideXml, 'spTree');
  const elements = [];
  const layoutPlaceholders = placeholderMapOf(layoutXml);

  // Non-placeholder artwork belongs to the slide layout itself and should be
  // drawn behind slide-owned content. Placeholder sample text is deliberately
  // ignored; only its geometry/style is inherited below.
  const layoutTree = firstDescendant(layoutXml, 'spTree');
  for (const node of elementChildren(layoutTree)) {
    const kind = localName(node);
    if (!['sp', 'pic', 'cxnSp'].includes(kind) || placeholderKey(node)) continue;
    const transform = transformOf(node, slideWidth, slideHeight);
    if (kind === 'pic') {
      const relation = layoutRelationships.get(relationshipId(node));
      const src = relation ? layoutImageSources.get(relation.path) : '';
      if (src) elements.push({ type: 'image', src, fromLayout: true, ...transform });
      continue;
    }
    const text = textOf(node);
    const shapeProperties = firstChild(node, 'spPr') || firstDescendant(node, 'spPr');
    const geometry = firstDescendant(shapeProperties, 'prstGeom')?.getAttribute?.('prst') || (kind === 'cxnSp' ? 'line' : 'rect');
    const line = firstDescendant(shapeProperties, 'ln');
    const fill = colorFrom(shapeProperties, 'transparent', false);
    const stroke = colorFrom(line, line ? '#64748b' : 'transparent');
    const strokeWidth = Math.max(0, numberAttr(line, 'w') / 12_700);
    const style = textStyleOf(node);
    const hasVisibleShape = kind === 'cxnSp' || fill !== 'transparent' || stroke !== 'transparent';
    if (text || hasVisibleShape) elements.push({
      type: hasVisibleShape ? 'shape' : 'text', text, shapeKind: normalizeShapeKind(geometry),
      fill, stroke, strokeWidth, fromLayout: true, ...style, ...transform,
    });
  }
  for (const node of elementChildren(tree)) {
    const kind = localName(node);
    if (!['sp', 'pic', 'cxnSp'].includes(kind)) continue;
    const inheritedNode = layoutPlaceholders.get(placeholderKey(node)) || null;
    const transform = transformOf(node, slideWidth, slideHeight, inheritedNode);
    if (kind === 'pic') {
      const relation = relationships.get(relationshipId(node));
      const src = relation ? imageSources.get(relation.path) : '';
      if (src) elements.push({ type: 'image', src, ...transform });
      continue;
    }

    const text = textOf(node);
    const localShapeProperties = firstChild(node, 'spPr') || firstDescendant(node, 'spPr');
    const inheritedShapeProperties = firstChild(inheritedNode, 'spPr') || firstDescendant(inheritedNode, 'spPr');
    const localGeometry = firstDescendant(localShapeProperties, 'prstGeom')?.getAttribute?.('prst');
    const inheritedGeometry = firstDescendant(inheritedShapeProperties, 'prstGeom')?.getAttribute?.('prst');
    const geometry = localGeometry || inheritedGeometry || (kind === 'cxnSp' ? 'line' : 'rect');
    const localLine = firstDescendant(localShapeProperties, 'ln');
    const inheritedLine = firstDescendant(inheritedShapeProperties, 'ln');
    const line = localLine || inheritedLine;
    const localFill = colorFrom(localShapeProperties, '', false);
    const inheritedFill = colorFrom(inheritedShapeProperties, '', false);
    const fill = localFill || inheritedFill || 'transparent';
    const stroke = colorFrom(line, line ? '#64748b' : 'transparent');
    const strokeWidth = Math.max(0, numberAttr(line, 'w') / 12_700);
    const style = textStyleOf(node, inheritedNode);
    const hasVisibleShape = kind === 'cxnSp' || fill !== 'transparent' || stroke !== 'transparent';
    elements.push({
      type: hasVisibleShape ? 'shape' : 'text',
      text,
      shapeKind: normalizeShapeKind(geometry),
      fill,
      stroke,
      strokeWidth,
      ...style,
      ...transform,
    });
  }

  const background = colorFrom(firstDescendant(slideXml, 'bg'), '')
    || colorFrom(firstDescendant(layoutXml, 'bg'), '#ffffff');
  return { elements, background };
}
