import { useEffect, useMemo, useState } from 'react';
import { registerPlugin } from '@capacitor/core';
import { ChevronLeft, ChevronRight, ExternalLink, Presentation } from 'lucide-react';
import { releaseNativeAsset, stageBlobForNative } from '../../services/nativeAssetBridge';
import { parsePptxSlideLayout, readPptxRelationships, readPptxSlideSize } from '../../services/pptxLayout';

const NativePptxRenderer = registerPlugin('MobdeaPptxRenderer');

function findEndOfCentralDirectory(view) {
  const minimum = Math.max(0, view.byteLength - 0xffff - 22);
  for (let offset = view.byteLength - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  return -1;
}

function normalizeZipPath(value = '') {
  const parts = [];
  String(value).replace(/\\/g, '/').split('/').forEach((part) => {
    if (!part || part === '.') return;
    if (part === '..') parts.pop();
    else parts.push(part);
  });
  return parts.join('/');
}

function resolveRelationshipTarget(sourcePart, target) {
  const base = sourcePart.split('/').slice(0, -1).join('/');
  return normalizeZipPath(`${base}/${target}`);
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('عارض PowerPoint الداخلي غير مدعوم في هذا المتصفح. افتح الملف على الجهاز.');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZipEntries(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const endOffset = findEndOfCentralDirectory(view);
  if (endOffset < 0) throw new Error('ملف PowerPoint غير صالح أو ليس بصيغة PPTX.');
  const entryCount = view.getUint16(endOffset + 10, true);
  let cursor = view.getUint32(endOffset + 16, true);
  const decoder = new TextDecoder('utf-8');
  const entries = new Map();

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) break;
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const fileNameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);
    const fileNameBytes = new Uint8Array(arrayBuffer, cursor + 46, fileNameLength);
    const name = normalizeZipPath(decoder.decode(fileNameBytes));

    if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
      cursor += 46 + fileNameLength + extraLength + commentLength;
      continue;
    }
    const localNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = new Uint8Array(arrayBuffer, dataOffset, compressedSize);
    entries.set(name, { name, method, compressed });
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  const cache = new Map();
  const read = async (name) => {
    const key = normalizeZipPath(name);
    if (cache.has(key)) return cache.get(key);
    const entry = entries.get(key);
    if (!entry) return null;
    const bytes = entry.method === 0
      ? new Uint8Array(entry.compressed)
      : entry.method === 8
        ? await inflateRaw(entry.compressed)
        : null;
    if (!bytes) throw new Error('يستخدم العرض ضغطًا غير مدعوم داخل التطبيق. افتحه على الجهاز.');
    cache.set(key, bytes);
    return bytes;
  };

  return { entries, read };
}

function xmlNodes(document, localName) {
  return [...document.getElementsByTagNameNS('*', localName)];
}

function mediaMime(path) {
  const extension = String(path).split('.').pop()?.toLowerCase();
  return {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff',
  }[extension] || 'application/octet-stream';
}


function relationshipsPartName(partName) {
  const normalized = normalizeZipPath(partName);
  const parts = normalized.split('/');
  const fileName = parts.pop();
  return normalizeZipPath(`${parts.join('/')}/_rels/${fileName}.rels`);
}

async function loadRelationshipImages(archive, relationships, objectUrls) {
  const imageSources = new Map();
  for (const imagePath of [...new Set([...relationships.values()]
    .filter((item) => item.type.includes('/image'))
    .map((item) => item.path))]) {
    const imageBytes = await archive.read(imagePath);
    if (!imageBytes) continue;
    const objectUrl = URL.createObjectURL(new Blob([imageBytes], { type: mediaMime(imagePath) }));
    objectUrls.push(objectUrl);
    imageSources.set(imagePath, objectUrl);
  }
  return imageSources;
}

async function parsePptxInBrowser(blob, url) {
  let buffer;
  if (blob instanceof Blob) buffer = await blob.arrayBuffer();
  else {
    const response = await fetch(url);
    if (!response.ok) throw new Error('تعذر قراءة ملف PowerPoint من ذاكرة الجهاز.');
    buffer = await response.arrayBuffer();
  }
  const archive = await readZipEntries(buffer);
  const slideNames = [...archive.entries.keys()]
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((left, right) => Number(left.match(/slide(\d+)/i)?.[1] || 0) - Number(right.match(/slide(\d+)/i)?.[1] || 0));
  if (!slideNames.length) throw new Error('لم يتم العثور على شرائح قابلة للعرض داخل الملف.');

  const parser = new DOMParser();
  const objectUrls = [];
  const slides = [];
  const presentationBytes = await archive.read('ppt/presentation.xml');
  const presentationXml = presentationBytes
    ? parser.parseFromString(new TextDecoder().decode(presentationBytes), 'application/xml')
    : null;
  const slideSize = readPptxSlideSize(presentationXml);

  for (const slideName of slideNames) {
    const slideBytes = await archive.read(slideName);
    const slideXml = parser.parseFromString(new TextDecoder().decode(slideBytes), 'application/xml');
    const texts = xmlNodes(slideXml, 't').map((node) => node.textContent?.trim()).filter(Boolean);
    const slideNumber = Number(slideName.match(/slide(\d+)/i)?.[1] || slides.length + 1);
    const relsName = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;
    const relationshipBytes = await archive.read(relsName);
    let relationships = new Map();

    if (relationshipBytes) {
      const relationshipXml = parser.parseFromString(new TextDecoder().decode(relationshipBytes), 'application/xml');
      relationships = readPptxRelationships(relationshipXml, (target) => resolveRelationshipTarget(slideName, target));
    }

    const imageSources = await loadRelationshipImages(archive, relationships, objectUrls);
    const images = [...imageSources.values()];

    const layoutRelationship = [...relationships.values()].find((item) => item.type.includes('/slideLayout'));
    let layoutXml = null;
    let layoutRelationships = new Map();
    let layoutImageSources = new Map();
    if (layoutRelationship) {
      const layoutBytes = await archive.read(layoutRelationship.path);
      if (layoutBytes) {
        layoutXml = parser.parseFromString(new TextDecoder().decode(layoutBytes), 'application/xml');
        const layoutRelationshipBytes = await archive.read(relationshipsPartName(layoutRelationship.path));
        if (layoutRelationshipBytes) {
          const relationshipXml = parser.parseFromString(new TextDecoder().decode(layoutRelationshipBytes), 'application/xml');
          layoutRelationships = readPptxRelationships(
            relationshipXml,
            (target) => resolveRelationshipTarget(layoutRelationship.path, target),
          );
          layoutImageSources = await loadRelationshipImages(archive, layoutRelationships, objectUrls);
        }
      }
    }

    const layout = parsePptxSlideLayout(slideXml, {
      slideWidth: slideSize.width,
      slideHeight: slideSize.height,
      relationships,
      imageSources,
      layoutXml,
      layoutRelationships,
      layoutImageSources,
    });
    slides.push({ id: slideName, number: slideNumber, texts, images, ...layout });
  }

  return { slides, cleanup: () => objectUrls.forEach((urlItem) => URL.revokeObjectURL(urlItem)) };
}

async function parsePptxNative(blob) {
  if (!(blob instanceof Blob)) throw new Error('ملف PowerPoint غير متاح داخل ذاكرة المنصة.');
  if (blob.size > 100 * 1024 * 1024) throw new Error('حجم ملف PowerPoint أكبر من الحد المدعوم للعرض الداخلي.');
  const assetPath = await stageBlobForNative(blob);
  try {
    const result = await NativePptxRenderer.parse({ assetPath });
    return {
      slides: Array.isArray(result?.slides) ? result.slides : [],
      cleanup: () => releaseNativeAsset(assetPath),
    };
  } catch (error) {
    await releaseNativeAsset(assetPath);
    throw error;
  }
}

export default function PptxPreview({ url, blob, title, onOpenExternal }) {
  const [slides, setSlides] = useState([]);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let cleanup = () => {};
    setSlides([]);
    setIndex(0);
    setError('');
    setStatus(blob || url ? 'loading' : 'missing');
    if (!blob && !url) return () => {};

    const parser = globalThis.Capacitor?.isNativePlatform?.() && blob
      ? parsePptxNative(blob)
      : parsePptxInBrowser(blob, url);

    parser.then((result) => {
      if (!active) {
        result.cleanup();
        return;
      }
      cleanup = result.cleanup;
      if (!result.slides.length) throw new Error('لم يتم العثور على شرائح قابلة للعرض.');
      setSlides(result.slides);
      setStatus('ready');
    }).catch((reason) => {
      if (!active) return;
      cleanup();
      cleanup = () => {};
      setError(reason?.message || 'تعذر عرض PowerPoint داخل المنصة.');
      setStatus('error');
    });

    return () => {
      active = false;
      cleanup();
    };
  }, [blob, url]);

  const slide = slides[index] || null;
  const counter = useMemo(() => slides.length ? `${index + 1} من ${slides.length}` : '', [index, slides.length]);

  if (status === 'loading') return <div className="pptx-preview-state"><Presentation size={44}/><strong>جارٍ تجهيز شرائح PowerPoint…</strong><small>يتم فتح العرض داخل المنصة دون الخروج من وضع الحصة.</small></div>;
  if (status !== 'ready' || !slide) return <div className="pptx-preview-state error"><Presentation size={44}/><strong>{error || 'لا يوجد عرض متاح.'}</strong><button className="primary-btn" type="button" onClick={onOpenExternal}><ExternalLink size={16}/> فتح الملف على الجهاز</button></div>;

  return (
    <div className="pptx-preview" aria-label={`عرض ${title || 'PowerPoint'}`}>
      <div className={`pptx-slide ${slide.elements?.length ? 'layout-aware' : 'fallback-layout'}`} style={{ background: slide.background || '#fff' }}>
        {slide.elements?.length ? (
          <div className="pptx-layout-canvas" dir="auto">
            {slide.elements.map((element, elementIndex) => {
              const style = {
                left: `${element.x || 0}%`,
                top: `${element.y || 0}%`,
                width: `${element.w || 10}%`,
                height: `${element.h || 10}%`,
                transform: `rotate(${Number(element.rotation || 0)}deg) scale(${element.flipH ? -1 : 1}, ${element.flipV ? -1 : 1})`,
              };
              if (element.type === 'image') {
                return <img className="pptx-layout-image" key={`${slide.id}:e:${elementIndex}`} src={element.src} alt="" style={style}/>;
              }
              if (element.type === 'shape') {
                const shapeKind = element.shapeKind || 'rect';
                return (
                  <div
                    className={`pptx-layout-shape shape-${shapeKind}`}
                    key={`${slide.id}:e:${elementIndex}`}
                    style={{
                      ...style,
                      '--pptx-shape-fill': element.fill || 'transparent',
                      '--pptx-shape-stroke': element.stroke || 'transparent',
                      '--pptx-shape-stroke-width': `${Math.max(0, Number(element.strokeWidth || 0))}px`,
                      color: element.color || '#111827',
                      fontSize: `${Math.max(10, Math.min(72, Number(element.fontSize || 22)))}px`,
                      fontWeight: element.bold ? 800 : 500,
                      fontStyle: element.italic ? 'italic' : 'normal',
                      textAlign: element.align || 'start',
                    }}
                  ><span>{element.text}</span></div>
                );
              }
              return (
                <div
                  className="pptx-layout-text"
                  key={`${slide.id}:e:${elementIndex}`}
                  style={{
                    ...style,
                    color: element.color || '#111827',
                    fontSize: `${Math.max(10, Math.min(72, Number(element.fontSize || 22)))}px`,
                    fontWeight: element.bold ? 800 : 500,
                    fontStyle: element.italic ? 'italic' : 'normal',
                    textAlign: element.align || 'start',
                  }}
                >{element.text}</div>
              );
            })}
          </div>
        ) : (
          <>
            {slide.images?.length > 0 && <div className={`pptx-slide-images images-${Math.min(slide.images.length, 4)}`}>{slide.images.map((src, imageIndex) => <img key={`${slide.id}:${imageIndex}`} src={src} alt="" />)}</div>}
            <div className="pptx-slide-text">{slide.texts?.length ? slide.texts.map((text, textIndex) => textIndex === 0 ? <h2 key={`${slide.id}:t:${textIndex}`}>{text}</h2> : <p key={`${slide.id}:t:${textIndex}`}>{text}</p>) : <p>شريحة تحتوي عناصر رسومية بدون نص قابل للاستخراج.</p>}</div>
          </>
        )}
      </div>
      <div className="pptx-slide-controls">
        <button type="button" onClick={() => setIndex((value) => (value - 1 + slides.length) % slides.length)} disabled={slides.length < 2}><ChevronRight size={20}/> السابق</button>
        <strong>{counter}</strong>
        <button type="button" onClick={() => setIndex((value) => (value + 1) % slides.length)} disabled={slides.length < 2}>التالي <ChevronLeft size={20}/></button>
      </div>
    </div>
  );
}
