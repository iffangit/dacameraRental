-- AlterTable
ALTER TABLE `RentalOrder` ADD COLUMN `channel` ENUM('ONLINE', 'WALK_IN') NOT NULL DEFAULT 'ONLINE',
    ADD COLUMN `discountAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `discountNote` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `User` MODIFY `email` VARCHAR(191) NULL,
    MODIFY `passwordHash` VARCHAR(255) NULL;

-- CreateIndex
CREATE INDEX `RentalOrder_channel_idx` ON `RentalOrder`(`channel`);

-- CreateIndex
CREATE INDEX `User_phone_idx` ON `User`(`phone`);
