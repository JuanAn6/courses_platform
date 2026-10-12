-- AlterTable
ALTER TABLE `files` ADD COLUMN `sourceId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `files_sourceId_idx` ON `files`(`sourceId`);

-- AddForeignKey
ALTER TABLE `files` ADD CONSTRAINT `files_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
