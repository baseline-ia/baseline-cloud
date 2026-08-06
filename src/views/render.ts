import { Eta } from 'eta';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VIEWS_DIR = __dirname;

export const eta = new Eta({
  views: VIEWS_DIR,
  cache: process.env.NODE_ENV === 'production',
  useWith: true,
});

export interface RenderOptions {
  layout?: 'base' | 'auth' | 'none';
}

export async function render(template: string, data: Record<string, unknown>, opts: RenderOptions = {}) {
  // Make sure the data object has a `t` helper and `locale` (the
  // i18nHook on the request attaches these). If the page forgot to
  // pass them, fall back to a no-op helper.
  const safe = {
    ...data,
    t: typeof data.t === 'function' ? data.t : () => '',
    locale: data.locale ?? 'en',
    currentPath: data.currentPath ?? '/dashboard/',
  };
  const body = await eta.renderAsync(`./pages/${template}.eta`, safe);
  if (!opts.layout || opts.layout === 'none') return body;
  return eta.renderAsync(`./layouts/${opts.layout}.eta`, { ...safe, body });
}

export async function renderPartial(template: string, data: Record<string, unknown>) {
  const safe = {
    ...data,
    t: typeof data.t === 'function' ? data.t : () => '',
    locale: data.locale ?? 'en',
  };
  return eta.renderAsync(`./partials/${template}.eta`, safe);
}

export function layout(layoutName: string) {
  return readFileSync(join(VIEWS_DIR, 'layouts', `${layoutName}.eta`), 'utf-8');
}
