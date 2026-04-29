# 🌸 Poppylat Stories — Project Plan

> A micro-storytelling platform where people share real, heartfelt stories about **respect, gratitude, and love** — in under 500 words, readable in 2 minutes.

---

## 1. 🏗️ System Architecture Overview

```
User (Browser/App)
       ↓
   Frontend (Next.js)
       ↓
   API Gateway (Node.js / Express or Next.js API routes)
       ↓
   ┌──────────────────────────────────────┐
   │         AI Moderation Pipeline       │
   │  Agent 1: Content Safety Check       │
   │  Agent 2: Theme Relevance Check      │
   │  Agent 3: Quality & Readability      │
   │  Orchestrator: Final Verdict         │
   └──────────────────────────────────────┘
       ↓
   MongoDB (Stories, Users, Moderation Logs)
       ↓
   Story Published / Rejected (Email Notification)
```

---

## 2. 👤 Authentication System

| Method | Provider |
|---|---|
| Google / Gmail | OAuth 2.0 via Google |
| Facebook / Instagram | OAuth via Meta |
| Twitter/X | OAuth 2.0 |
| Poppylat Native | Email + Password (JWT) |
| **Anonymous** | No login required — guest token |

**Tech:** `NextAuth.js` or `Auth0` handles all OAuth flows cleanly. Native accounts stored in MongoDB with bcrypt-hashed passwords.

---

## 3. 📝 Story Submission Flow

```
User writes story (≤500 words)
       ↓
Choose: Post as [Name] or [Anonymous]
       ↓
Select theme tag: Respect / Gratitude / Love
       ↓
Submit → Story enters "Pending Review" state
       ↓
AI Moderation Pipeline runs (async)
       ↓
  ✅ Approved → Published
  ❌ Rejected → User notified with reason
```

---

## 4. 🤖 AI Moderation Pipeline (Multi-Agent)

Three specialized agents run in sequence, orchestrated by a coordinator.

### Agent 1 — 🛡️ Content Safety Agent
- Detects: profanity, vulgarity, hate speech, communal/religious slurs, violence
- Uses: Claude API with a strict safety prompt
- Output: `{ safe: true/false, flags: [...] }`

### Agent 2 — 🎯 Theme Relevance Agent
- Checks: Is the story genuinely about respect, gratitude, or love?
- Rejects: Spam, off-topic rants, promotional content
- Output: `{ relevant: true/false, theme_confidence: 0-1 }`

### Agent 3 — ✍️ Quality & Readability Agent
- Checks: Coherent story? Minimum 50 words? Readable?
- Output: `{ quality_pass: true/false, word_count: N }`

### Orchestrator Agent
- Collects all three outputs and makes final decision: **Approve / Reject / Flag for Human Review**
- Logs reasoning to MongoDB

```js
// Orchestrator Logic
if (safety.safe && relevance.relevant && quality.quality_pass) {
  status = "approved"
} else if (!safety.safe) {
  status = "rejected"
  reason = "Content policy violation"
} else {
  status = "human_review"
}
```

> Use **Anthropic Claude API** (`claude-sonnet-4-20250514`) for all agent calls.

---

## 5. 🗄️ MongoDB Data Models

### `users` collection
```json
{
  "_id": "ObjectId",
  "name": "Priya S.",
  "email": "priya@example.com",
  "auth_provider": "google | facebook | poppylat | anonymous",
  "created_at": "ISODate"
}
```

### `stories` collection
```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId | null",
  "display_name": "Priya S. | Anonymous",
  "title": "The Day My Father Hugged Me",
  "body": "Story text here...",
  "theme": ["gratitude", "love"],
  "word_count": 312,
  "status": "pending | approved | rejected | human_review",
  "submitted_at": "ISODate",
  "published_at": "ISODate | null"
}
```

### `moderation_logs` collection
```json
{
  "_id": "ObjectId",
  "story_id": "ObjectId",
  "safety_result": {},
  "relevance_result": {},
  "quality_result": {},
  "final_verdict": "approved",
  "processing_time_ms": 1200,
  "reviewed_at": "ISODate"
}
```

---

## 6. 🖥️ Frontend Pages

| Page | Description |
|---|---|
| `/` | Homepage — featured stories, 3 theme filters |
| `/stories` | Browse all approved stories |
| `/stories/[id]` | Read a single story (2-min read badge) |
| `/submit` | Story submission form |
| `/profile` | User's submitted stories & status |
| `/admin` | Stories flagged for human review |

**Tech:** Next.js 14 (App Router) + Tailwind CSS

---

## 7. 🔧 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, Tailwind CSS |
| Backend | Next.js API Routes or Express.js |
| Auth | NextAuth.js (OAuth + credentials) |
| Database | MongoDB Atlas |
| ODM | Mongoose |
| AI Agents | Anthropic Claude API (claude-sonnet-4-20250514) |
| Queue | BullMQ + Redis (async moderation jobs) |
| Email | Resend or Nodemailer |
| Hosting | Vercel (frontend) + Railway/Render (backend) |

---

## 8. 📅 Build Phases

### Phase 1 — Foundation (Weeks 1–2)
- [ ] Set up Next.js project + MongoDB Atlas
- [ ] Auth system (Google, Poppylat native, Anonymous)
- [ ] Story submission form + DB schema

### Phase 2 — AI Pipeline (Weeks 3–4)
- [ ] Build 3 moderation agents with Claude API
- [ ] Set up BullMQ job queue for async processing
- [ ] Moderation logs + status updates

### Phase 3 — Frontend (Weeks 5–6)
- [ ] Homepage, browse, single story pages
- [ ] User profile page
- [ ] Admin review dashboard

### Phase 4 — Polish & Launch (Weeks 7–8)
- [ ] Email notifications
- [ ] Rate limiting (1 story/hour per user)
- [ ] SEO meta tags for stories
- [ ] Beta testing + feedback

---

## 9. 🚀 Nice-to-Have (Post-Launch)

- ❤️ Appreciate button (warmer alternative to "like")
- 🔖 Save stories to a personal reading list
- 🌍 Multilingual story support
- 📧 Weekly newsletter of top stories
- 🎙️ Audio narration of stories (TTS)

---

## 10. 💰 Cost Estimate (Early Stage)

| Service | Cost |
|---|---|
| MongoDB Atlas | Free (512MB) → $9/mo |
| Vercel | Free tier |
| Claude API | ~$0.003/story moderated |
| Redis (Upstash) | Free tier |
| **Total** | **~$0–15/month to start** |

---

## 11. 📁 Recommended Folder Structure

```
poppylat-stories/
├── app/                        # Next.js App Router
│   ├── (auth)/
│   │   └── login/
│   ├── stories/
│   │   ├── page.tsx            # Browse stories
│   │   └── [id]/page.tsx       # Single story
│   ├── submit/page.tsx
│   ├── profile/page.tsx
│   └── admin/page.tsx
├── components/
│   ├── StoryCard.tsx
│   ├── SubmitForm.tsx
│   └── ThemeFilter.tsx
├── lib/
│   ├── mongodb.ts              # DB connection
│   ├── auth.ts                 # NextAuth config
│   └── agents/
│       ├── safetyAgent.ts
│       ├── relevanceAgent.ts
│       ├── qualityAgent.ts
│       └── orchestrator.ts
├── models/
│   ├── User.ts
│   ├── Story.ts
│   └── ModerationLog.ts
├── pages/api/                  # API routes
│   ├── stories/
│   └── auth/
├── public/
├── .env.local
├── PROJECT_PLAN.md             # ← You are here
└── package.json
```

---

*Built with love, for stories about love. 🌸*
