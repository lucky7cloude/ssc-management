
import express, { Request, Response } from "express";
import { createServer as createViteServer } from "vite";
import classesHandler from "./api/classes";
import timetableHandler from "./api/timetable";
import teachersHandler from "./api/teachers";
import remarksHandler from "./api/remarks";
import examsHandler from "./api/exams";
import meetingsHandler from "./api/meetings";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.all("/api/classes", async (req: Request, res: Response) => {
    try { await classesHandler(req, res); } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
  });

  app.all("/api/timetable", async (req: Request, res: Response) => {
    try { await timetableHandler(req, res); } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
  });

  app.all("/api/teachers", async (req: Request, res: Response) => {
    try { await teachersHandler(req, res); } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
  });

  app.all("/api/remarks", async (req: Request, res: Response) => {
    try { await remarksHandler(req, res); } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
  });

  app.all("/api/exams", async (req: Request, res: Response) => {
    try { await examsHandler(req, res); } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
  });

  app.all("/api/meetings", async (req: Request, res: Response) => {
    try { await meetingsHandler(req, res); } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`DATABASE_URL is ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
  });
}

startServer();
