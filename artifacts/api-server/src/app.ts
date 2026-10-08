import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET is required to protect browser-session credentials.");
}

app.set("trust proxy", 1);

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
app.use(
  session({
    name: "notebook.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: false,
    cookie: {
      httpOnly: true,
      sameSite: "strict",
      secure: "auto",
      path: "/api",
      maxAge: 12 * 60 * 60 * 1000,
    },
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status: unknown }).status)
    : 500;
  if (status === 413) {
    res.status(413).json({ error: "Голосовая запись слишком большая. Запишите короткий вопрос." });
    return;
  }
  res.status(status >= 400 && status < 500 ? status : 500).json({ error: "Не удалось обработать запрос." });
});

export default app;
