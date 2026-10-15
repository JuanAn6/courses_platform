-- CreateTable
CREATE TABLE `question_files` (
    `questionId` VARCHAR(191) NOT NULL,
    `fileId` VARCHAR(191) NOT NULL,

    INDEX `question_files_fileId_idx`(`fileId`),
    PRIMARY KEY (`questionId`, `fileId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `question_files` ADD CONSTRAINT `question_files_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `question_files` ADD CONSTRAINT `question_files_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
