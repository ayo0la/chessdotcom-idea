-- CreateTable
CREATE TABLE "Debrief" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Debrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebriefPrompt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "gameUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebriefPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Debrief_userId_createdAt_idx" ON "Debrief"("userId", "createdAt");
CREATE UNIQUE INDEX "Debrief_userId_gameId_key" ON "Debrief"("userId", "gameId");
CREATE INDEX "DebriefPrompt_userId_createdAt_idx" ON "DebriefPrompt"("userId", "createdAt");
CREATE UNIQUE INDEX "DebriefPrompt_userId_gameId_key" ON "DebriefPrompt"("userId", "gameId");

-- AddForeignKey
ALTER TABLE "Debrief" ADD CONSTRAINT "Debrief_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DebriefPrompt" ADD CONSTRAINT "DebriefPrompt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Broadcast DebriefPrompt inserts via Supabase Realtime (no-op on non-Supabase databases)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "DebriefPrompt";
  END IF;
END $$;
