import { Request, Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "No token provided" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      sub: string;
      role: string;
    };
    req.userId = payload.sub;
    req.userRole = payload.role;

    // Check if user still exists (account not deleted)
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    next();
  } catch {
    res.status(401).json({ error: "Token expired or invalid" });
  }
}

// Optional auth — attaches user if token present but doesn't block if missing
export function optionalAuth(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(
        authHeader.split(" ")[1],
        process.env.JWT_SECRET!
      ) as { sub: string; role: string };
      req.userId = payload.sub;
      req.userRole = payload.role;
    } catch {
      // token invalid but that's okay for optional auth
    }
  }
  next();
}
