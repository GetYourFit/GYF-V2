const path = require("node:path");

const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const reviewStub = path.join(__dirname, "src/lib/review-surface-production.ts");
const reviewModules = new Set([
  "@/components/design/core-route-review",
  "@/design-fixtures/core-route-states",
]);
const defaultResolveRequest = config.resolver.resolveRequest;

// Review fixtures stay available to local development and tests, but production
// exports resolve their graph to an inert module before Metro traverses assets.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (process.env.NODE_ENV === "production" && reviewModules.has(moduleName)) {
    return { type: "sourceFile", filePath: reviewStub };
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
