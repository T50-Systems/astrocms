module.exports = {
  forbidden: [
    {
      name: "no-packages-importing-apps",
      comment: "Packages must not depend on application entry points.",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
    {
      name: "contracts-is-leaf",
      comment: "Contracts is the dependency base and only uses external dependencies.",
      severity: "error",
      from: { path: "^packages/contracts/" },
      to: { path: "^packages/(?!contracts/)|^apps/" },
    },
    {
      name: "core-not-importing-server",
      comment: "CMS core must not depend on application server code.",
      severity: "error",
      from: { path: "^packages/cms-core/" },
      to: { path: "^apps/" },
    },
    {
      name: "no-circular",
      comment: "Circular dependencies make package boundaries fragile.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules|dist|build|\\.astro",
    },
    exclude: {
      path: "(node_modules|dist|build|\\.astro)|\\.(test|spec)\\.(ts|tsx)$|test-utils\\.tsx$|(^|/)[^/]*\\.(config|conf)\\.(js|cjs|mjs|ts)$",
    },
  },
};
