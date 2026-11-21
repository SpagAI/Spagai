# PromptDoc

Check, fix and test prompts for AI assistants, WhatsApp bots, voice agents and chatbots.

- `index.html`: the whole app in one file. The quick check, templates and guide run in the browser, with no server.
- `functions/api/ai.js`: optional Cloudflare Pages Function that powers **Check with AI** and **Run both** on the public site.

## Put it online with Cloudflare Pages (about 2 minutes)

1. Go to https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Pick the **SpagAI/Spagai** repository.
3. Settings:
   - **Production branch:** `claude/modest-davinci-r1tuf2` (or `main` once this is merged)
   - **Framework preset:** None
   - **Build command:** leave empty
   - **Build output directory:** `.`
   - **Root directory (advanced):** `promptdoc`
4. Click **Save and Deploy**. You get a free link like `https://promptdoc.pages.dev`.

### Switch on the AI buttons (optional)

1. In the Pages project: **Settings** → **Variables and Secrets** → **Add** → type **Secret**, name `ANTHROPIC_API_KEY`, value = your Anthropic API key.
2. Optional: a plain variable `CLAUDE_MODEL` to choose another model (default `claude-opus-5-5`).
3. **Deployments** → **Retry deployment** so the secret takes effect.

Anyone with the link can use the AI buttons on your key. Set a monthly spend limit in the Anthropic Console before sharing the link.

### Faster, no Git

**Workers & Pages** → **Create** → **Pages** → **Upload assets**, then drag in the `promptdoc` folder. This gives you the quick check, templates and guide. The AI buttons need the Git setup above, because uploaded folders skip the function.
