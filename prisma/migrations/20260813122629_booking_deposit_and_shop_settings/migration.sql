/*
  Warnings:

  - You are about to drop the column `depositRate` on the `RentalOrder` table. All the data in the column will be lost.
  - You are about to drop the column `totalAmount` on the `RentalOrder` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `ActivityLog` MODIFY `type` ENUM('ORDER_CREATED', 'ORDER_APPROVED', 'ORDER_REJECTED', 'ORDER_RETURNED', 'UNIT_MAINTENANCE', 'INSPECTION_LOGGED', 'AI_POST_GENERATED', 'AI_POST_BROADCAST', 'SETTING_CHANGED') NOT NULL;

-- AlterTable
ALTER TABLE `RentalOrder` DROP COLUMN `depositRate`,
    DROP COLUMN `totalAmount`;

-- CreateTable
CREATE TABLE `ShopSetting` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `bookingDeposit` DECIMAL(10, 2) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedById` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ShopSetting` ADD CONSTRAINT `ShopSetting_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
