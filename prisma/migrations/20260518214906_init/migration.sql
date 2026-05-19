-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptNode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "parentTopic" TEXT,
    "mastery" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "difficultyTier" TEXT NOT NULL DEFAULT 'foundation',
    "lastReviewed" TIMESTAMP(3),
    "reviewInterval" INTEGER NOT NULL DEFAULT 1,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "exposureCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConceptNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'TEACH',
    "messages" JSONB NOT NULL,
    "conceptsHit" TEXT[],
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizResult" (
    "id" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "confidence" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "feedback" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "ConceptNode_userId_mastery_idx" ON "ConceptNode"("userId", "mastery");

-- CreateIndex
CREATE INDEX "ConceptNode_userId_lastReviewed_idx" ON "ConceptNode"("userId", "lastReviewed");

-- CreateIndex
CREATE UNIQUE INDEX "ConceptNode_userId_topic_key" ON "ConceptNode"("userId", "topic");

-- AddForeignKey
ALTER TABLE "ConceptNode" ADD CONSTRAINT "ConceptNode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizResult" ADD CONSTRAINT "QuizResult_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "ConceptNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
