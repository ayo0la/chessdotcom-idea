-- CreateTable
CREATE TABLE "TiltEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lossCount" INTEGER NOT NULL,
    "rushing" BOOLEAN NOT NULL DEFAULT false,
    "suggestion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TiltEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TiltEvent_userId_createdAt_idx" ON "TiltEvent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "TiltEvent" ADD CONSTRAINT "TiltEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Broadcast TiltEvent inserts via Supabase Realtime (no-op on non-Supabase databases)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "TiltEvent";
  END IF;
END $$;
