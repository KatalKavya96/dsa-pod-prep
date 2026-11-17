/**
 * k6 load test: simulates members browsing concurrently.
 *   SESSION_COOKIE="better-auth.session_token=..." BASE_URL=https://staging... k6 run loadtest/dashboard.js
 * Run against a staging/preview deployment, never production during a contest.
 */
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    browse: {
      executor: "ramping-vus",
      stages: [
        { duration: "1m", target: 500 },
        { duration: "3m", target: 5000 },
        { duration: "1m", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
  },
};

const BASE = __ENV.BASE_URL || "http://localhost:3000";
const params = { headers: { Cookie: __ENV.SESSION_COOKIE || "" }, redirects: 0 };
const pages = ["/dashboard", "/contests", "/tasks", "/resources", "/leaderboard"];

export default function browse() {
  const res = http.get(`${BASE}${pages[Math.floor(Math.random() * pages.length)]}`, params);
  check(res, { "status 200": (r) => r.status === 200 });
  sleep(1 + Math.random() * 3);
}
