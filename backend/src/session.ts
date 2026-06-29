import session from "express-session";
import { RedisStore } from "connect-redis";
import { redis } from "./redis.js";

export const sessionParser = session({
  store: new RedisStore({ client: redis }),
  secret: process.env.SESSION_SECRET ?? "dev_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
});

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}
