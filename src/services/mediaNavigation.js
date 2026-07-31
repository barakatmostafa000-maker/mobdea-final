export const MODE_TYPES = Object.freeze({
  pdf: ['textbook', 'pdf'],
  images: ['image'],
  videos: ['video'],
  audio: ['audio'],
  files: ['slides', 'document', 'file', 'link'],
  maps: ['map'],
});

export function resourcesForContentMode(resources = [], contentMode = '') {
  const types = MODE_TYPES[contentMode] || [];
  return (Array.isArray(resources) ? resources : []).filter((resource) => (
    types.includes(resource?.type)
  ));
}

export function nextResourceId(resources = [], selectedId = '', direction = 1) {
  if (!resources.length) return '';
  const currentIndex = resources.findIndex((item) => String(item.id) === String(selectedId));
  const safeIndex = currentIndex < 0 ? 0 : currentIndex;
  const nextIndex = (safeIndex + direction + resources.length) % resources.length;
  return resources[nextIndex]?.id ?? '';
}
