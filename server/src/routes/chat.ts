import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/authenticate";
import { chatLimiter } from "../middleware/rateLimiter";
import {
  sendChatMessage,
  getChatHistory,
  clearChatHistory,
} from "../services/chatService";

const router = Router();

router.use(authenticate);

// ─── POST /api/chat ───────────────────────────────────────────────────────────

router.post("/", chatLimiter, async (req: AuthRequest, res: Response) => {
  const { message } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  try {
    const reply = await sendChatMessage(req.userId!, message.trim());
    res.json({ reply });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// ─── GET /api/chat/history ────────────────────────────────────────────────────

router.get("/history", async (req: AuthRequest, res: Response) => {
  try {
    const messages = await getChatHistory(req.userId!);
    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/chat/history ─────────────────────────────────────────────────

router.delete("/history", async (req: AuthRequest, res: Response) => {
  try {
    await clearChatHistory(req.userId!);
    res.json({ message: "Chat history cleared" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
