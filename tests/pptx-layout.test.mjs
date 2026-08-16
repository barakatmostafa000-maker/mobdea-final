import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { DOMParser } from '@xmldom/xmldom';
import {
  parsePptxSlideLayout,
  readPptxRelationships,
  readPptxSlideSize,
} from '../src/services/pptxLayout.js';

const parser = new DOMParser();

function readZipEntries(buffer) {
  let endOffset = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65_557); offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  assert.ok(endOffset >= 0, 'PPTX fixture must contain a ZIP directory');
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  let cursor = buffer.readUInt32LE(endOffset + 16);
  const entries = new Map();
  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(buffer.readUInt32LE(cursor), 0x02014b50);
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + fileNameLength).toString('utf8');
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
    entries.set(name, method === 8 ? inflateRawSync(compressed) : Buffer.from(compressed));
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

test('PowerPoint OOXML layout keeps positions, formatting, shapes and pictures', () => {
  const presentation = parser.parseFromString('<p:presentation xmlns:p="p"><p:sldSz cx="1000" cy="500"/></p:presentation>', 'application/xml');
  const size = readPptxSlideSize(presentation);
  assert.deepEqual(size, { width: 1000, height: 500 });

  const rels = parser.parseFromString('<Relationships><Relationship Id="rId7" Type="office/image" Target="../media/photo.png"/></Relationships>', 'application/xml');
  const relationships = readPptxRelationships(rels, (target) => `ppt/${target.replace('../', '')}`);
  const imageSources = new Map([['ppt/media/photo.png', 'blob:test-photo']]);
  const slide = parser.parseFromString(`
    <p:sld xmlns:p="p" xmlns:a="a" xmlns:r="r">
      <p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFF4DD"/></a:solidFill></p:bgPr></p:bg>
        <p:spTree>
          <p:sp><p:spPr><a:xfrm rot="600000"><a:off x="100" y="50"/><a:ext cx="400" cy="100"/></a:xfrm><a:solidFill><a:srgbClr val="D7AD35"/></a:solidFill><a:prstGeom prst="roundRect"/><a:ln w="12700"><a:solidFill><a:srgbClr val="111827"/></a:solidFill></a:ln></p:spPr><p:txBody><a:p><a:pPr algn="ctr"/><a:r><a:rPr sz="2400" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr><a:t>عنوان الشريحة</a:t></a:r></a:p></p:txBody></p:sp>
          <p:pic><p:blipFill><a:blip r:embed="rId7"/></p:blipFill><p:spPr><a:xfrm><a:off x="600" y="200"/><a:ext cx="300" cy="250"/></a:xfrm></p:spPr></p:pic>
        </p:spTree>
      </p:cSld>
    </p:sld>`, 'application/xml');

  const result = parsePptxSlideLayout(slide, {
    slideWidth: size.width,
    slideHeight: size.height,
    relationships,
    imageSources,
  });
  assert.equal(result.background, '#FFF4DD');
  assert.equal(result.elements.length, 2);
  assert.equal(result.elements[0].type, 'shape');
  assert.equal(result.elements[0].shapeKind, 'roundRect');
  assert.equal(result.elements[0].text, 'عنوان الشريحة');
  assert.equal(result.elements[0].x, 10);
  assert.equal(result.elements[0].y, 10);
  assert.equal(result.elements[0].w, 40);
  assert.equal(result.elements[0].h, 20);
  assert.equal(result.elements[0].rotation, 10);
  assert.equal(result.elements[0].fill, '#D7AD35');
  assert.equal(result.elements[0].stroke, '#111827');
  assert.equal(result.elements[0].bold, true);
  assert.equal(result.elements[0].align, 'center');
  assert.equal(result.elements[1].type, 'image');
  assert.equal(result.elements[1].src, 'blob:test-photo');
  assert.equal(result.elements[1].x, 60);
});

test('a real PPTX fixture contains text, an embedded image, shapes and different slide layouts', () => {
  const fixture = fs.readFileSync(new URL('./fixtures/classroom-layouts.pptx', import.meta.url));
  const entries = readZipEntries(fixture);
  const slideNames = [...entries.keys()].filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort();
  assert.equal(slideNames.length, 3);
  assert.ok([...entries.keys()].some((name) => /^ppt\/media\/image\d+\.png$/.test(name)));

  const relationshipTargets = slideNames.map((_, index) => {
    const xml = entries.get(`ppt/slides/_rels/slide${index + 1}.xml.rels`).toString('utf8');
    return xml.match(/Target="\.\.\/slideLayouts\/(slideLayout\d+\.xml)"/)?.[1] || '';
  });
  assert.equal(new Set(relationshipTargets).size, 3);

  const presentationXml = parser.parseFromString(entries.get('ppt/presentation.xml').toString('utf8'), 'application/xml');
  const size = readPptxSlideSize(presentationXml);
  const imageRelsXml = parser.parseFromString(entries.get('ppt/slides/_rels/slide2.xml.rels').toString('utf8'), 'application/xml');
  const imageRelationships = readPptxRelationships(imageRelsXml, (target) => `ppt/${target.replace('../', '')}`);
  const imageSources = new Map([...imageRelationships.values()]
    .filter((item) => item.type.includes('/image'))
    .map((item) => [item.path, `fixture:${item.path}`]));
  const imageSlide = parsePptxSlideLayout(
    parser.parseFromString(entries.get('ppt/slides/slide2.xml').toString('utf8'), 'application/xml'),
    { slideWidth: size.width, slideHeight: size.height, relationships: imageRelationships, imageSources },
  );
  assert.ok(imageSlide.elements.some((element) => element.type === 'image'));
  assert.ok(imageSlide.elements.some((element) => element.type === 'text'));

  const shapesSlide = parsePptxSlideLayout(
    parser.parseFromString(entries.get('ppt/slides/slide3.xml').toString('utf8'), 'application/xml'),
    { slideWidth: size.width, slideHeight: size.height, relationships: new Map(), imageSources: new Map() },
  );
  const shapes = shapesSlide.elements.filter((element) => element.type === 'shape');
  assert.ok(shapes.length >= 4);
  assert.ok(shapes.some((element) => element.rotation !== 0));
  assert.ok(shapes.some((element) => element.text.includes('أشكال')));
});

test('PowerPoint placeholders inherit geometry from their slide layout when slide XML omits xfrm', () => {
  const layout = parser.parseFromString(`
    <p:sldLayout xmlns:p="p" xmlns:a="a">
      <p:cSld><p:spTree>
        <p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
          <p:spPr><a:xfrm><a:off x="100" y="50"/><a:ext cx="800" cy="100"/></a:xfrm></p:spPr>
          <p:txBody><a:p><a:r><a:rPr sz="3200" b="1"/><a:t>Master title</a:t></a:r></a:p></p:txBody>
        </p:sp>
      </p:spTree></p:cSld>
    </p:sldLayout>`, 'application/xml');
  const slide = parser.parseFromString(`
    <p:sld xmlns:p="p" xmlns:a="a">
      <p:cSld><p:spTree>
        <p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/>
          <p:txBody><a:p><a:r><a:t>Inherited position</a:t></a:r></a:p></p:txBody>
        </p:sp>
      </p:spTree></p:cSld>
    </p:sld>`, 'application/xml');
  const result = parsePptxSlideLayout(slide, { slideWidth: 1000, slideHeight: 500, layoutXml: layout });
  assert.equal(result.elements.length, 1);
  assert.equal(result.elements[0].text, 'Inherited position');
  assert.equal(result.elements[0].x, 10);
  assert.equal(result.elements[0].y, 10);
  assert.equal(result.elements[0].w, 80);
  assert.equal(result.elements[0].h, 20);
  assert.equal(result.elements[0].fontSize, Math.min(72, (32) * (96 / 72)));
  assert.equal(result.elements[0].bold, true);
});
