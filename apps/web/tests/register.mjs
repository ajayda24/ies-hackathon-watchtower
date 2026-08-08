import { register } from "node:module"
import { pathToFileURL } from "node:url"
register("./tests/resolver.mjs", pathToFileURL("./"))
