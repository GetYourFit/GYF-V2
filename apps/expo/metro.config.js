const path = require("node:path");

const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const reviewStub = path.join(__dirname, "src/lib/review-surface-production.ts");
const webImageStub = path.join(__dirname, "src/lib/expo-image-web.tsx");
const productionDesignRoute = path.join(__dirname, "src/lib/design-production-route.tsx");
const reviewModules = new Set([
  "@/components/design/core-route-review",
  "@/design-fixtures/core-route-states",
]);
const defaultResolveRequest = config.resolver.resolveRequest;

// Review fixtures stay available to local development and tests, but production
// exports resolve their graph to an inert module before Metro traverses assets.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "expo-image") {
    return { type: "sourceFile", filePath: webImageStub };
  }
  if (process.env.NODE_ENV === "production") {
    if (reviewModules.has(moduleName)) {
      return { type: "sourceFile", filePath: reviewStub };
    }
    if (
      moduleName === path.join(__dirname, "src/app/design.tsx") ||
      moduleName.endsWith("/src/app/design.tsx")
    ) {
      return { type: "sourceFile", filePath: productionDesignRoute };
    }
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
