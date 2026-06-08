import { Router, Response } from "express";
import * as bcrypt from "bcryptjs";
import { authenticate, AuthRequest } from "../middleware/authenticate";
import { prisma } from "../lib/prisma";

const router = Router();
router.use(authenticate);

// GET /api/users/me
router.get("/me", async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        avatar: true,
        phone: true,
        city: true,
        role: true,
        createdAt: true,
        _count: { select: { favorites: true, viewed: true, inquiries: true } },
      },
    });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json(user);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/users/me
router.patch("/me", async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, city, username, avatar } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (city !== undefined) data.city = city;
    if (username !== undefined) data.username = username;
    if (avatar !== undefined) data.avatar = avatar;

    const user = await prisma.user.update({
      where: { id: req.userId },
      data,
      select: { id: true, email: true, name: true, username: true, avatar: true, phone: true, city: true, role: true, createdAt: true },
    });
    res.json(user);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/users/me/change-password
router.post("/me/change-password", async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) { res.status(400).json({ error: "Current and new password are required" }); return; }
    if (newPassword.length < 8) { res.status(400).json({ error: "New password must be at least 8 characters" }); return; }
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (!user.passwordHash) {
      res.status(400).json({
        error: "Password change is not available for Google accounts"
      });
      return;
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) { res.status(400).json({ error: "Current password is incorrect" }); return; }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.userId }, data: { passwordHash } });
    res.json({ message: "Password updated successfully" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/users/me/settings
router.get("/me/settings", async (req: AuthRequest, res: Response) => {
  try {
    let settings = await prisma.userSettings.findUnique({ where: { userId: req.userId } });
    if (!settings) {
      settings = await prisma.userSettings.create({ data: { userId: req.userId! } });
    }
    res.json(settings);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/users/me/settings
router.patch("/me/settings", async (req: AuthRequest, res: Response) => {
  try {
    const { emailNotifications, priceAlerts, weeklyDigest, newsletterOptIn } = req.body;
    const data: any = {};
    if (emailNotifications !== undefined) data.emailNotifications = emailNotifications;
    if (priceAlerts !== undefined) data.priceAlerts = priceAlerts;
    if (weeklyDigest !== undefined) data.weeklyDigest = weeklyDigest;
    if (newsletterOptIn !== undefined) data.newsletterOptIn = newsletterOptIn;
    const settings = await prisma.userSettings.upsert({
      where: { userId: req.userId },
      create: { userId: req.userId!, ...data },
      update: data,
    });
    res.json(settings);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/users/me/favorite-ids
router.get("/me/favorite-ids", async (req: AuthRequest, res: Response) => {
  try {
    const favs = await prisma.favorite.findMany({ where: { userId: req.userId }, select: { propertyId: true } });
    res.json(favs.map((f) => f.propertyId));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/users/me/favorites
router.get("/me/favorites", async (req: AuthRequest, res: Response) => {
  try {
    const favs = await prisma.favorite.findMany({ where: { userId: req.userId }, include: { property: true }, orderBy: { savedAt: "desc" } });
    res.json(favs.map((f) => f.property));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/users/me/favorites/:propertyId
router.post("/me/favorites/:propertyId", async (req: AuthRequest, res: Response) => {
  try {
    await prisma.favorite.upsert({
      where: { userId_propertyId: { userId: req.userId!, propertyId: req.params.propertyId } },
      create: { userId: req.userId!, propertyId: req.params.propertyId },
      update: {},
    });
    res.json({ saved: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/users/me/favorites/:propertyId
router.delete("/me/favorites/:propertyId", async (req: AuthRequest, res: Response) => {
  try {
    await prisma.favorite.deleteMany({ where: { userId: req.userId, propertyId: req.params.propertyId } });
    res.json({ saved: false });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/users/me
router.delete("/me", async (req: AuthRequest, res: Response) => {
  try {
    await prisma.user.delete({ where: { id: req.userId } });
    res.json({ message: "Account deleted" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
