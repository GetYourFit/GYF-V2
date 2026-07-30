/** Keep EAS's server export while allowing Render Static to request Expo's static output. */
module.exports = ({ config }) => ({
  ...config,
  web: {
    ...config.web,
    output: process.env.GYF_RENDER_STATIC === "true" ? "static" : (config.web?.output ?? "server"),
  },
});
