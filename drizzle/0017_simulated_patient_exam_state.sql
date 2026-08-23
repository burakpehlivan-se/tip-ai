ALTER TABLE "learning_attempts" ADD COLUMN "exam_findings" jsonb DEFAULT '[]'::jsonb NOT NULL;
