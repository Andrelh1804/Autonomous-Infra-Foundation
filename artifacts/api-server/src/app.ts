import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const FASTAPI_PORT = process.env["FASTAPI_PORT"] || "8008";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route (handled locally)
app.use("/api", router);

// Proxy all remaining /api/* requests to the FastAPI backend
app.use("/api", async (req: Request, res: Response) => {
  const targetUrl = `http://localhost:${FASTAPI_PORT}${req.originalUrl}`;
  try {
    const headers: Record<string, string> = {
      "content-type": (req.headers["content-type"] as string) ?? "application/json",
      "accept": (req.headers["accept"] as string) ?? "application/json",
    };
    if (req.headers["authorization"]) {
      headers["authorization"] = req.headers["authorization"] as string;
    }
    if (req.headers["x-forwarded-for"]) {
      headers["x-forwarded-for"] = req.headers["x-forwarded-for"] as string;
    }
    if (req.headers["user-agent"]) {
      headers["user-agent"] = req.headers["user-agent"] as string;
    }

    const hasBody = !["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase());
    const fetchOpts: RequestInit = {
      method: req.method,
      headers,
    };
    if (hasBody && req.body && Object.keys(req.body).length > 0) {
      fetchOpts.body = JSON.stringify(req.body);
    }

    const upstream = await fetch(targetUrl, fetchOpts);
    const text = await upstream.text();

    res.status(upstream.status);
    const ct = upstream.headers.get("content-type");
    if (ct) res.setHeader("content-type", ct);

    res.send(text);
  } catch (err) {
    logger.error({ err, url: targetUrl }, "FastAPI proxy error");
    res.status(502).json({ detail: "Backend unavailable — proxy error" });
  }
});

export default app;
