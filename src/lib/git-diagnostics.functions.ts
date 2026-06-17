import { createServerFn } from "@tanstack/react-start";

// Captured once per worker cold-start. Closest proxy to "when this build
// started serving" that we can observe from inside the runtime.
const SERVER_BOOT_AT = new Date().toISOString();

export const getGitDiagnostics = createServerFn({ method: "GET" }).handler(
  async () => {
    const env = process.env;
    // Lovable/Vercel/CF-style build metadata env vars that MIGHT be present.
    // We surface whichever ones exist; never invent values.
    const candidates: Array<[string, string | undefined]> = [
      ["Commit SHA", env.COMMIT_SHA ?? env.VERCEL_GIT_COMMIT_SHA ?? env.CF_PAGES_COMMIT_SHA ?? env.GIT_COMMIT],
      ["Branch", env.GIT_BRANCH ?? env.VERCEL_GIT_COMMIT_REF ?? env.CF_PAGES_BRANCH],
      ["Commit message", env.VERCEL_GIT_COMMIT_MESSAGE],
      ["Commit author", env.VERCEL_GIT_COMMIT_AUTHOR_LOGIN],
      ["Repo", env.VERCEL_GIT_REPO_SLUG ?? env.CF_PAGES_URL],
      ["Build ID", env.CF_PAGES_BUILD_ID ?? env.VERCEL_DEPLOYMENT_ID],
    ];

    const knownMetadata = candidates
      .filter(([, v]) => typeof v === "string" && v.length > 0)
      .map(([k, v]) => ({ key: k, value: v as string }));

    return {
      serverBootAt: SERVER_BOOT_AT,
      observedAt: new Date().toISOString(),
      runtime: typeof navigator !== "undefined" ? navigator.userAgent : "node",
      nodeVersion: typeof process !== "undefined" ? process.version : null,
      knownMetadata,
      // Useful so the user knows what we looked for, even when empty.
      checkedEnvKeys: candidates.flatMap(([k]) => k),
    };
  },
);
