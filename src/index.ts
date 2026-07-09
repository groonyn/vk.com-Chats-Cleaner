import { startVKCleaner } from './cleaner';
import { VKApi } from './vkapi';
import { ProgressUI } from './progress';

export { startVKCleaner, VKApi, ProgressUI };

// Make startVKCleaner available globally in browser
if (typeof window !== 'undefined') {
  (window as any).startVKCleaner = (optionsOrToken?: any) => {
    return startVKCleaner(optionsOrToken);
  };
}
