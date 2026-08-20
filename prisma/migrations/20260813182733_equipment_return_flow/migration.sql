-- AlterTable
ALTER TABLE `RentalOrder` ADD COLUMN `lateFee` DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `RentalOrderItem` ADD COLUMN `lateDays` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lateFee` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `returnCondition` ENUM('GOOD', 'NEEDS_CLEANING', 'DAMAGED') NULL,
    ADD COLUMN `returnNote` VARCHAR(500) NULL,
    ADD COLUMN `returnedAt` DATETIME(3) NULL,
    ADD COLUMN `returnedById` INTEGER NULL;

-- CreateIndex
CREATE INDEX `RentalOrderItem_returnedAt_idx` ON `RentalOrderItem`(`returnedAt`);

-- AddForeignKey
ALTER TABLE `RentalOrderItem` ADD CONSTRAINT `RentalOrderItem_returnedById_fkey` FOREIGN KEY (`returnedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
