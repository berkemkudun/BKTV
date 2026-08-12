import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");

/**
 * Node'un test runner'ı tsconfig "paths" bilmez.
 * Bu loader "@/lib/..." importlarını proje köküne çevirir.
 */
export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const target = path.join(root, specifier.slice(2));
    const withExtension = path.extname(target) ? target : `${target}.ts`;
    return next(pathToFileURL(withExtension).href, context);
  }
  return next(specifier, context);
}
