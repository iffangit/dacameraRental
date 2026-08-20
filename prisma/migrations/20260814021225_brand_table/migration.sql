-- AlterTable
ALTER TABLE `Equipment` DROP COLUMN `brand`,
    ADD COLUMN `brandId` INTEGER NOT NULL;

-- CreateTable
CREATE TABLE `Brand` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(60) NOT NULL,
    `code` VARCHAR(4) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `Brand_name_key`(`name`),
    UNIQUE INDEX `Brand_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Equipment_brandId_idx` ON `Equipment`(`brandId`);

-- AddForeignKey
ALTER TABLE `Equipment` ADD CONSTRAINT `Equipment_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
