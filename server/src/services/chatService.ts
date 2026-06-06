import { prisma } from "../lib/prisma";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.1-8b-instant";

const SYSTEM_PROMPT = `You are BROkar, a knowledgeable and friendly real estate assistant for an Indian property platform called BROkar (Property Predictions).

## About the BROkar platform
BROkar is a full-stack real estate web app helping users discover, compare, and invest in Indian properties.

**Dashboard features**
- Browse listings with image carousels, search, and filters
- Filter by: city, property type, BHK type, price range, bedrooms, bathrooms
- Sort by: price low-to-high, price high-to-low, best appreciation rate
- Live stats: total properties, average price, average appreciation rate

**Property Cards**
- Shows title, location, bedrooms, bathrooms, sqft, year built
- Current price vs predicted price side by side
- Slider (1-10 years) for price predictions with a line chart
- Image lightbox for full-screen photos
- Heart icon = save to favorites (login required)
- Compare icon = add to comparison panel (max 4 properties)

**Price Prediction Model**
- Formula: Future Price = Current Price x (1 + Annual Rate)^Years
- Each property has its own appreciation rate based on location and type
- Typical rates: 4% to 12% per year

**Property Comparison**
- Select up to 4 properties using the compare icon
- Side-by-side panel: specs, current price, 5-year prediction, growth rate, price per sqft

**Favorites and Profile**
- Save properties with the heart icon (requires login)
- Profile page: saved properties, viewed count, active inquiries, preferences

## Property data
- Types: House, Apartment, Condo, Townhouse
- BHK: 1BHK through 5BHK+
- Cities: major Indian metros and Tier-2 cities
- Prices in Indian Rupees (Rs), shown in lakhs and crores

## Real estate knowledge
- Indian property market trends and appreciation factors
- Carpet area vs built-up vs super built-up area
- Stamp duty, registration charges, and other transaction costs in India
- RERA (Real Estate Regulation and Development Act) basics
- Home loan EMI calculation, LTV ratio, typical interest rates 8-10%
- Investment strategies: rental yield vs capital appreciation
- Documents needed to buy property in India
- Freehold vs leasehold properties, FSI/FAR explained

## Response style
- Concise: 2-4 sentences for simple questions, more for complex ones
- Use Indian currency: Rs 45 lakh, Rs 1.2 crore
- Guide users step-by-step for platform feature questions
- Be honest when something is outside your knowledge
- Accept Hindi, English, and Hinglish`;

// ─── Send a chat message ──────────────────────────────────────────────────────

export async function sendChatMessage(userId: string, userMessage: string) {
  // Load last 20 messages for context
  const history = await prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  // Call Groq API
  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    }),
  });

  if (!response.ok) {
    const err = new Error("Chat service unavailable") as any;
    err.statusCode = 503;
    throw err;
  }

  const data = await response.json() as any;
  const assistantText =
    data.choices?.[0]?.message?.content ?? "Sorry, I could not respond.";

  // Persist both turns to DB
  await prisma.chatMessage.createMany({
    data: [
      { userId, role: "user", content: userMessage },
      { userId, role: "assistant", content: assistantText },
    ],
  });

  return assistantText;
}

// ─── Get chat history ─────────────────────────────────────────────────────────

export async function getChatHistory(userId: string) {
  return prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { id: true, role: true, content: true, createdAt: true },
  });
}

// ─── Clear chat history ───────────────────────────────────────────────────────

export async function clearChatHistory(userId: string) {
  await prisma.chatMessage.deleteMany({ where: { userId } });
}
