-- CreateTable
CREATE TABLE `sequences` (
    `name` VARCHAR(191) NOT NULL,
    `value` INTEGER NOT NULL,

    PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
