/*
  Warnings:

  - Added the required column `updatedAt` to the `files` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `files` ADD COLUMN `derived` JSON NULL,
    ADD COLUMN `status` ENUM('READY', 'PROCESSING', 'FAILED') NOT NULL DEFAULT 'READY',
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- CreateTable
CREATE TABLE `units` (
    `id` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `classId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `releaseAt` DATETIME(3) NULL,
    `prerequisiteUnitId` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `units_courseId_classId_position_idx`(`courseId`, `classId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `entries` (
    `id` VARCHAR(191) NOT NULL,
    `unitId` VARCHAR(191) NOT NULL,
    `type` ENUM('TEXT', 'VIDEO', 'AUDIO', 'DOCUMENT', 'PRESENTATION', 'LINK', 'EMBED') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `required` BOOLEAN NOT NULL DEFAULT true,
    `releaseAt` DATETIME(3) NULL,
    `dueAt` DATETIME(3) NULL,
    `content` JSON NOT NULL,
    `settings` JSON NULL,
    `createdById` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `entries_unitId_position_idx`(`unitId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `entry_files` (
    `entryId` VARCHAR(191) NOT NULL,
    `fileId` VARCHAR(191) NOT NULL,

    INDEX `entry_files_fileId_idx`(`fileId`),
    PRIMARY KEY (`entryId`, `fileId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `entry_class_overrides` (
    `entryId` VARCHAR(191) NOT NULL,
    `classId` VARCHAR(191) NOT NULL,
    `hidden` BOOLEAN NOT NULL DEFAULT false,
    `releaseAt` DATETIME(3) NULL,
    `dueAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `entry_class_overrides_classId_idx`(`classId`),
    PRIMARY KEY (`entryId`, `classId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `unit_class_overrides` (
    `unitId` VARCHAR(191) NOT NULL,
    `classId` VARCHAR(191) NOT NULL,
    `hidden` BOOLEAN NOT NULL DEFAULT false,
    `releaseAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `unit_class_overrides_classId_idx`(`classId`),
    PRIMARY KEY (`unitId`, `classId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `entry_progress` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `entryId` VARCHAR(191) NOT NULL,
    `classId` VARCHAR(191) NOT NULL,
    `status` ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED') NOT NULL DEFAULT 'IN_PROGRESS',
    `percent` INTEGER NOT NULL DEFAULT 0,
    `lastPosition` DOUBLE NULL,
    `timeSpentSec` INTEGER NOT NULL DEFAULT 0,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `entry_progress_classId_userId_idx`(`classId`, `userId`),
    INDEX `entry_progress_entryId_idx`(`entryId`),
    UNIQUE INDEX `entry_progress_userId_entryId_classId_key`(`userId`, `entryId`, `classId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `units` ADD CONSTRAINT `units_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `units` ADD CONSTRAINT `units_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `classes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `units` ADD CONSTRAINT `units_prerequisiteUnitId_fkey` FOREIGN KEY (`prerequisiteUnitId`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entries` ADD CONSTRAINT `entries_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entries` ADD CONSTRAINT `entries_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entry_files` ADD CONSTRAINT `entry_files_entryId_fkey` FOREIGN KEY (`entryId`) REFERENCES `entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entry_files` ADD CONSTRAINT `entry_files_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entry_class_overrides` ADD CONSTRAINT `entry_class_overrides_entryId_fkey` FOREIGN KEY (`entryId`) REFERENCES `entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entry_class_overrides` ADD CONSTRAINT `entry_class_overrides_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `classes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `unit_class_overrides` ADD CONSTRAINT `unit_class_overrides_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `unit_class_overrides` ADD CONSTRAINT `unit_class_overrides_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `classes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entry_progress` ADD CONSTRAINT `entry_progress_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entry_progress` ADD CONSTRAINT `entry_progress_entryId_fkey` FOREIGN KEY (`entryId`) REFERENCES `entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entry_progress` ADD CONSTRAINT `entry_progress_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `classes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
