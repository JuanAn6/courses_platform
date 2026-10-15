-- AlterTable
ALTER TABLE `entries` MODIFY `type` ENUM('TEXT', 'VIDEO', 'AUDIO', 'DOCUMENT', 'PRESENTATION', 'LINK', 'EMBED', 'QUIZ', 'ASSIGNMENT') NOT NULL;

-- CreateTable
CREATE TABLE `questions` (
    `id` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `type` ENUM('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'NUMERIC', 'MATCHING', 'ORDERING', 'FILL_BLANKS', 'ESSAY', 'FILE_UPLOAD') NOT NULL,
    `prompt` JSON NOT NULL,
    `data` JSON NOT NULL,
    `explanation` TEXT NULL,
    `points` DOUBLE NOT NULL DEFAULT 1,
    `tags` VARCHAR(500) NOT NULL DEFAULT '',
    `difficulty` INTEGER NULL,
    `createdById` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `questions_courseId_deletedAt_idx`(`courseId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quiz_attempts` (
    `id` VARCHAR(191) NOT NULL,
    `entryId` VARCHAR(191) NOT NULL,
    `classId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `number` INTEGER NOT NULL,
    `status` ENUM('IN_PROGRESS', 'NEEDS_GRADING', 'GRADED') NOT NULL DEFAULT 'IN_PROGRESS',
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deadlineAt` DATETIME(3) NULL,
    `submittedAt` DATETIME(3) NULL,
    `score` DOUBLE NULL,
    `maxScore` DOUBLE NOT NULL,
    `snapshot` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `quiz_attempts_classId_status_idx`(`classId`, `status`),
    INDEX `quiz_attempts_userId_idx`(`userId`),
    UNIQUE INDEX `quiz_attempts_entryId_classId_userId_number_key`(`entryId`, `classId`, `userId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quiz_answers` (
    `id` VARCHAR(191) NOT NULL,
    `attemptId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `response` JSON NOT NULL,
    `autoScore` DOUBLE NULL,
    `manualScore` DOUBLE NULL,
    `feedback` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `quiz_answers_attemptId_questionId_key`(`attemptId`, `questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quiz_answer_files` (
    `answerId` VARCHAR(191) NOT NULL,
    `fileId` VARCHAR(191) NOT NULL,

    INDEX `quiz_answer_files_fileId_idx`(`fileId`),
    PRIMARY KEY (`answerId`, `fileId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `submissions` (
    `id` VARCHAR(191) NOT NULL,
    `entryId` VARCHAR(191) NOT NULL,
    `classId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `number` INTEGER NOT NULL,
    `text` TEXT NULL,
    `status` ENUM('SUBMITTED', 'GRADED') NOT NULL DEFAULT 'SUBMITTED',
    `late` BOOLEAN NOT NULL DEFAULT false,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `submissions_classId_status_idx`(`classId`, `status`),
    UNIQUE INDEX `submissions_entryId_classId_userId_number_key`(`entryId`, `classId`, `userId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `submission_files` (
    `submissionId` VARCHAR(191) NOT NULL,
    `fileId` VARCHAR(191) NOT NULL,

    INDEX `submission_files_fileId_idx`(`fileId`),
    PRIMARY KEY (`submissionId`, `fileId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grades` (
    `id` VARCHAR(191) NOT NULL,
    `classId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `entryId` VARCHAR(191) NOT NULL,
    `score` DOUBLE NULL,
    `maxScore` DOUBLE NOT NULL,
    `feedback` TEXT NULL,
    `rubric` JSON NULL,
    `gradedById` VARCHAR(191) NULL,
    `gradedAt` DATETIME(3) NULL,
    `released` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `grades_entryId_idx`(`entryId`),
    UNIQUE INDEX `grades_classId_userId_entryId_key`(`classId`, `userId`, `entryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `questions` ADD CONSTRAINT `questions_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questions` ADD CONSTRAINT `questions_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quiz_attempts` ADD CONSTRAINT `quiz_attempts_entryId_fkey` FOREIGN KEY (`entryId`) REFERENCES `entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quiz_attempts` ADD CONSTRAINT `quiz_attempts_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `classes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quiz_attempts` ADD CONSTRAINT `quiz_attempts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quiz_answers` ADD CONSTRAINT `quiz_answers_attemptId_fkey` FOREIGN KEY (`attemptId`) REFERENCES `quiz_attempts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quiz_answer_files` ADD CONSTRAINT `quiz_answer_files_answerId_fkey` FOREIGN KEY (`answerId`) REFERENCES `quiz_answers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quiz_answer_files` ADD CONSTRAINT `quiz_answer_files_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submissions` ADD CONSTRAINT `submissions_entryId_fkey` FOREIGN KEY (`entryId`) REFERENCES `entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submissions` ADD CONSTRAINT `submissions_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `classes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submissions` ADD CONSTRAINT `submissions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submission_files` ADD CONSTRAINT `submission_files_submissionId_fkey` FOREIGN KEY (`submissionId`) REFERENCES `submissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submission_files` ADD CONSTRAINT `submission_files_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grades` ADD CONSTRAINT `grades_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `classes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grades` ADD CONSTRAINT `grades_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grades` ADD CONSTRAINT `grades_entryId_fkey` FOREIGN KEY (`entryId`) REFERENCES `entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grades` ADD CONSTRAINT `grades_gradedById_fkey` FOREIGN KEY (`gradedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
