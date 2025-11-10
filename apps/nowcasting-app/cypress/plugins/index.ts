// module.exports = (on, config) => {
//   // initPlugin(on, config);
//   on("before:browser:launch", (browser = {}, launchOptions) => {
//     // @ts-ignore
//     const isChromium = browser.name === "chrome" || browser.family === "chromium";
//     if (!isChromium) return launchOptions;
//
//     // Remove any accidental "--disable-gpu"
//     launchOptions.args = launchOptions.args.filter((a) => a !== "--disable-gpu");
//
//     // Good defaults for WebGL in CI and local
//     launchOptions.args.push(
//       "--ignore-gpu-blocklist",
//       "--enable-webgl",
//       "--enable-accelerated-2d-canvas",
//       "--enable-gpu-rasterization"
//     );
//
//     // Prefer ANGLE Metal on macOS (Chrome 110+)
//     if (process.platform === "darwin") {
//       launchOptions.args.push("--use-angle=metal");
//     } else {
//       // Reasonable fallbacks on Linux/Windows
//       // @ts-ignore
//       if (browser.isHeadless) {
//         // SwiftShader gives you a software GL context when no GPU
//         launchOptions.args.push("--use-gl=swiftshader", "--use-angle=swiftshader");
//       } else {
//         // EGL often behaves better than default OSMesa on Linux
//         launchOptions.args.push("--use-gl=egl");
//       }
//     }
//
//     // Optional: quick sanity log
//     console.log("[cypress] chrome flags:", launchOptions.args.join(" "));
//     return launchOptions;
//   });
//   return config;
// };
