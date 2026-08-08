import { fileURLToPath, pathToFileURL } from "node:url"
import { dirname, resolve as resolvePath } from "node:path"
import { existsSync, statSync } from "node:fs"

/**
 * Module resolver for the test runner.
 *
 * The application uses two conveniences the Next bundler provides and Node's
 * ESM resolver does not: the `@/` path alias, and extensionless imports. Rather
 * than reshape application source to suit the test runner — which would trade
 * correct production code for test convenience — this hook teaches Node the
 * same two rules.
 *
 * Registered via `--import ./tests/resolver.mjs`.
 */

const root = dirname(dirname(fileURLToPath(import.meta.url)))

/**
 * Candidate files for an extensionless specifier, in resolution order.
 *
 * `.ts` is tried before the bare path: `lib/store` is both a directory and,
 * conceptually, `lib/store/index.ts`, and offering the directory first
 * resolves to something Node cannot import.
 */
function candidates(base) {
  return [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, base]
}

export function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const base = resolvePath(root, specifier.slice(2))
    for (const candidate of candidates(base)) {
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        return next(pathToFileURL(candidate).href, context)
      }
    }
  }

  // Relative imports without an extension, as the bundler allows.
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
    const parentPath = context.parentURL
      ? dirname(fileURLToPath(context.parentURL))
      : root
    const base = resolvePath(parentPath, specifier)
    for (const candidate of candidates(base)) {
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        return next(pathToFileURL(candidate).href, context)
      }
    }
  }

  return next(specifier, context)
}
