// Vite discovers every supported image in this folder during development/build.
const images = import.meta.glob<string>('./assets/cities/*.{jpg,jpeg,png,webp,avif}', {
  eager: true, query: '?url', import: 'default',
});

export function chooseCityBackground() {
  const entries = Object.entries(images);
  if (!entries.length) return null;
  const [path, url] = entries[Math.floor(Math.random() * entries.length)];
  const name = path.split('/').at(-1)!.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
  return { url, name: name.toUpperCase() };
}
