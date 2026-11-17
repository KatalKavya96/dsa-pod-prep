/** Parse a problem link into (platform, key). Pure and unit-tested. */
export type ParsedProblem = { platform: "leetcode" | "codeforces" | "codechef"; problemKey: string; url: string; title: string };

export function parseProblemUrl(raw: string): ParsedProblem | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  const parts = u.pathname.split("/").filter(Boolean);
  if (host === "leetcode.com" || host === "leetcode.cn") {
    const i = parts.indexOf("problems");
    const slug = i >= 0 ? parts[i + 1] : undefined;
    if (!slug) return null;
    return { platform: "leetcode", problemKey: slug.toLowerCase(), url: `https://leetcode.com/problems/${slug}/`, title: titleize(slug) };
  }
  if (host === "codeforces.com") {
    // /problemset/problem/1850/A  |  /contest/1850/problem/A  |  /gym/... (unsupported)
    let cid: string | undefined, idx: string | undefined;
    if (parts[0] === "problemset" && parts[1] === "problem") [cid, idx] = [parts[2], parts[3]];
    else if (parts[0] === "contest" && parts[2] === "problem") [cid, idx] = [parts[1], parts[3]];
    if (!cid || !idx || !/^\d+$/.test(cid)) return null;
    return {
      platform: "codeforces",
      problemKey: `${cid}${idx}`.toLowerCase(),
      url: `https://codeforces.com/problemset/problem/${cid}/${idx.toUpperCase()}`,
      title: `CF ${cid}${idx.toUpperCase()}`,
    };
  }
  if (host === "codechef.com") {
    const i = parts.indexOf("problems");
    const code = i >= 0 ? parts[i + 1] : undefined;
    if (!code) return null;
    return { platform: "codechef", problemKey: code.toLowerCase(), url: `https://www.codechef.com/problems/${code.toUpperCase()}`, title: code.toUpperCase() };
  }
  return null;
}

const titleize = (slug: string) => slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
