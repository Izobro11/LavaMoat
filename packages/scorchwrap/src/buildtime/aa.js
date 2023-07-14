// Temporary implementation
// TODO: use real AA
/**
 * @param {string} modulePath
 * @returns
 */
const fakeAA = (modulePath) => {
  // TODO: properly resolve what belongs to which compartment
  let chunks = modulePath.split("node_modules/");
  chunks[0] = "app";
  chunks = chunks.map((chunk) => {
    // only keep the @scope/package or package name
    const parts = chunk.split("/");
    if (parts[0].startsWith("@")) {
      return parts.slice(0, 2).join("/");
    }
    return parts[0];
  });
  return chunks.join(">");
};

const pathsToIdentifiers = (paths) => {
  return Object.fromEntries(paths.map((p) => [p, fakeAA(p)]));
};

exports.pathsToIdentifiers = pathsToIdentifiers;

const lookUp = (needle, haystack) => {
  const value = haystack[needle];
  if (value === undefined) {
    throw new Error(`Cannot find a match for ${needle} in policy`);
  }
  return value;
};

exports.generateIdentifierLookup = (paths, policy) => {
  const usedIdentifiers = Object.keys(policy.resources);

  // TODO: it's likely that the current way we generate real AAs from node_modules would produce some shorter identifiers than it'd otherwise produce from just looking at the paths in use.
  // We'll need to persist enough data to look up paths OR make sure policy generation only takes into account the paths involved.

  const pathLookup = pathsToIdentifiers(paths);
  const usedIdentifiersIndex = Object.fromEntries(
    usedIdentifiers.map((id, index) => [id, index])
  );

  return {
    pathToModuleId: (path) =>
      lookUp(lookUp(path, pathLookup), usedIdentifiersIndex),
    policyIdentifierToModuleId: (id) => lookUp(id, usedIdentifiersIndex),
  };
};
