# Quick Migration Steps

Run these commands in the `backend/` folder:

\`\`\`bash
# 1. Generate and apply migration
npx prisma migrate dev --name add_calendar_module

# 2. Verify migration
npx prisma studio

# 3. Restart server
npm run dev
\`\`\`

That's it! Your calendar module should now work.
