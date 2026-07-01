import cookieSession from "cookie-session";

export const sessionParser = cookieSession({
  name: "session",
  secret: process.env.SESSION_SECRET ?? "dev_secret",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
});

declare module "express-serve-static-core" {
  interface Request {
    session: { userId?: string } & Record<string, unknown>;
  }
}
