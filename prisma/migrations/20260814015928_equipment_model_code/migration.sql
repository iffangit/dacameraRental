-- AlterTable
ALTER TABLE `Equipment` ADD COLUMN `code` VARCHAR(16) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Equipment_code_key` ON `Equipment`(`code`);
