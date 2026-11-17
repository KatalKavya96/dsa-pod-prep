import { codechef } from "./codechef";
import { codeforces } from "./codeforces";
import { leetcode } from "./leetcode";
import type { JudgeAdapter, JudgePlatform } from "./types";

export const adapters: Record<JudgePlatform, JudgeAdapter> = { leetcode, codeforces, codechef };
export const JUDGE_PLATFORMS: JudgePlatform[] = ["leetcode", "codeforces", "codechef"];
export * from "./types";
