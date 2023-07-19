// Should translate AAs to numbers?
const TRANSLATE_AA_TO_NUMBERS = false;

const {
  loadCanonicalNameMap,
  getPackageNameForModulePath,
} = require("@lavamoat/aa");

// Temporary implementation
// TODO: use real AA
/**
 * @param {string} modulePath
 * @returns
 */
const fakeAA = (modulePath) => {
  // TODO: properly resolve what belongs to which compartment
  let chunks = modulePath.split("node_modules/");
  chunks[0] = "$root$";
  chunks = chunks.map((chunk) => {
    // only keep the @scope/package or package name
    const parts = chunk.split("/");
    if (parts[0].startsWith("@")) {
      return parts.slice(0, 2).join("/");
    }
    return parts[0];
  });
  if (chunks.length > 1) {
    chunks.shift();
  }
  return chunks.join(">");
};

const lookUp = (needle, haystack) => {
  const value = haystack[needle];
  if (value === undefined) {
    // webpack may attempt to go through out-of-policy stuff as we're plugging into webpack's `resolve` and that may be used by plugins to resolve things not in the bundle. Eg. app/node_modules/esbuild-loader/dist/index.cjs is being resolved.
    console.trace(`Cannot find a match for ${needle} in policy`);
    // console.log(haystack);
  }
  return value;
};

exports.generateIdentifierLookup = ({ paths, policy, canonicalNameMap }) => {
  const pathsToIdentifiers = (paths) => {
    const mapping = {};
    for (const p of paths) {
      if (p.path) {
        mapping[p.path] = {
          aa: getPackageNameForModulePath(canonicalNameMap, p.path),
          moduleId: p.moduleId,
        };
      }
    }
    return mapping;
  };

  const usedIdentifiers = Object.keys(policy.resources);
  const usedIdentifiersIndex = Object.fromEntries(
    usedIdentifiers.map((id, index) => [id, index])
  );
  // choose the implementation - to translate from AA to numbers or not
  let translate;
  if (TRANSLATE_AA_TO_NUMBERS) {
    translate = (i) => lookUp(i, usedIdentifiersIndex);
  } else {
    translate = (i) => i;
  }

  // TODO: it's likely that the current way we generate real AAs from node_modules would produce different identifiers than it'd otherwise produce from just looking at the paths in use.
  // We'll need to persist enough data to look up paths OR make sure policy generation only takes into account the paths involved.
  // Also, the numbers should probably come from webpack itself for later lookup at runtime

  const pathLookup = pathsToIdentifiers(paths);
  const identifiersWithKnownPaths = new Set(
    Object.values(pathLookup).map((pl) => pl.aa)
  );
  const identifiersForModuleIds = Object.entries(
    Object.entries(pathLookup).reduce((acc, [_path, { aa, moduleId }]) => {
      const key = translate(aa);
      if (acc[key] === undefined) {
        acc[key] = [];
      }
      acc[key].push(moduleId);
      return acc;
    }, {})
  );

  const translateResource = (resource) => ({
    ...resource,
    packages:
      resource.packages &&
      Object.fromEntries(
        Object.entries(resource.packages).map(([id, value]) => [
          translate(id),
          value,
        ])
      ),
  });

  return {
    identifiersForModuleIds,
    pathToResourceId: (path) => {
      const pathInfo = lookUp(path, pathLookup);
      if (!pathInfo) return undefined;
      return translate(pathInfo.aa);
    },
    policyIdentifierToResourceId: (id) => translate(id),
    getTranslatedPolicy: () => {
      if (!TRANSLATE_AA_TO_NUMBERS) {
        return policy;
      }
      const translatedPolicy = {
        ...policy,
        resources: Object.fromEntries(
          Object.entries(policy.resources)
            .filter(([id]) => identifiersWithKnownPaths.has(id)) // only saves resources that are actually used
            .map(([id, resource]) => [
              translate(id),
              translateResource(resource),
            ])
        ),
      };
      return translatedPolicy;
    },
  };
};
