import { ChevronLeft, ChevronRight, Files } from 'lucide-react';

import { nextResourceId, resourcesForContentMode } from '../../services/mediaNavigation';

export default function MediaNavigator({
  resources,
  selectedId,
  contentMode,
  onSelect,
}) {
  const filtered = resourcesForContentMode(resources, contentMode);
  if (filtered.length <= 1) return null;
  const currentIndex = Math.max(
    0,
    filtered.findIndex((item) => String(item.id) === String(selectedId)),
  );
  const selected = filtered[currentIndex] || filtered[0];

  const move = (direction) => {
    const id = nextResourceId(filtered, selected?.id || selectedId, direction);
    if (id !== '') onSelect?.(id);
  };

  return (
    <div className="classmode-media-navigator" role="group" aria-label="التنقل بين ملفات الدرس">
      <button type="button" className="icon-action" onClick={() => move(-1)} title="الملف السابق">
        <ChevronRight size={20} />
      </button>
      <div className="classmode-media-navigator-center">
        <Files size={16} />
        <select
          value={selected?.id || ''}
          onChange={(event) => onSelect?.(event.target.value)}
          aria-label="اختيار ملف من ملفات الدرس"
        >
          {filtered.map((item, index) => (
            <option key={item.id} value={item.id}>
              {index + 1}. {item.title || item.fileName || 'ملف الدرس'}
            </option>
          ))}
        </select>
        <span>{currentIndex + 1} من {filtered.length}</span>
      </div>
      <button type="button" className="icon-action" onClick={() => move(1)} title="الملف التالي">
        <ChevronLeft size={20} />
      </button>
    </div>
  );
}
