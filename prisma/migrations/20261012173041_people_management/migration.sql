/*
  Warnings:

  - You are about to drop the column `phone` on the `student_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `teacher_profiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `sessions` ADD COLUMN `impersonatedBy` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `student_profiles` DROP COLUMN `phone`,
    ADD COLUMN `officeNotes` TEXT NULL;

-- AlterTable
ALTER TABLE `teacher_profiles` DROP COLUMN `phone`;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `phone` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `student_documents` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `fileId` VARCHAR(191) NOT NULL,
    `type` ENUM('ID_DOCUMENT', 'TRANSCRIPT', 'CONTRACT', 'MEDICAL', 'PHOTO', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `title` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `uploadedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `student_documents_fileId_key`(`fileId`),
    INDEX `student_documents_studentId_idx`(`studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `files` (
    `id` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(512) NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `mime` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `ownerId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `files_storageKey_key`(`storageKey`),
    INDEX `files_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `student_profiles_documentId_idx` ON `student_profiles`(`documentId`);

-- CreateIndex
CREATE INDEX `users_deletedAt_idx` ON `users`(`deletedAt`);

-- AddForeignKey
ALTER TABLE `student_documents` ADD CONSTRAINT `student_documents_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_documents` ADD CONSTRAINT `student_documents_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_documents` ADD CONSTRAINT `student_documents_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `files` ADD CONSTRAINT `files_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
