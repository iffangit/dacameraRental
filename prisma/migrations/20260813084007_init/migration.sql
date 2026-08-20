-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `fullName` VARCHAR(120) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `role` ENUM('MEMBER', 'VIP', 'ADMIN') NOT NULL DEFAULT 'MEMBER',
    `grade` ENUM('A', 'B', 'C') NOT NULL DEFAULT 'B',
    `riskScore` INTEGER NOT NULL DEFAULT 70,
    `totalRentals` INTEGER NOT NULL DEFAULT 0,
    `onTimeReturns` INTEGER NOT NULL DEFAULT 0,
    `lateReturns` INTEGER NOT NULL DEFAULT 0,
    `damageIncidents` INTEGER NOT NULL DEFAULT 0,
    `isSuspended` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_role_idx`(`role`),
    INDEX `User_grade_idx`(`grade`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(80) NOT NULL,
    `code` VARCHAR(12) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `Category_name_key`(`name`),
    UNIQUE INDEX `Category_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Equipment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(160) NOT NULL,
    `brand` VARCHAR(60) NOT NULL,
    `categoryId` INTEGER NOT NULL,
    `description` TEXT NULL,
    `imageUrl` VARCHAR(500) NULL,
    `dailyRate` DECIMAL(10, 2) NOT NULL,
    `replacementValue` DECIMAL(12, 2) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Equipment_categoryId_idx`(`categoryId`),
    INDEX `Equipment_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EquipmentUnit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `equipmentId` INTEGER NOT NULL,
    `serialNumber` VARCHAR(64) NOT NULL,
    `status` ENUM('AVAILABLE', 'RENTED', 'MAINTENANCE', 'CLEANING', 'RETIRED') NOT NULL DEFAULT 'AVAILABLE',
    `rentalCount` INTEGER NOT NULL DEFAULT 0,
    `totalDaysUsed` INTEGER NOT NULL DEFAULT 0,
    `cycleLimit` INTEGER NOT NULL DEFAULT 10,
    `usageDaysLimit` INTEGER NOT NULL DEFAULT 50,
    `purchasedAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EquipmentUnit_serialNumber_key`(`serialNumber`),
    INDEX `EquipmentUnit_equipmentId_idx`(`equipmentId`),
    INDEX `EquipmentUnit_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RentalOrder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderCode` VARCHAR(32) NOT NULL,
    `userId` INTEGER NOT NULL,
    `status` ENUM('PENDING_APPROVAL', 'APPROVED', 'ACTIVE_RENTAL', 'RETURNED_INSPECTED', 'CLOSED', 'CANCELLED', 'REJECTED') NOT NULL DEFAULT 'PENDING_APPROVAL',
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `rentalDays` INTEGER NOT NULL,
    `rentalFee` DECIMAL(12, 2) NOT NULL,
    `depositRate` DECIMAL(5, 4) NOT NULL,
    `depositAmount` DECIMAL(12, 2) NOT NULL,
    `totalAmount` DECIMAL(12, 2) NOT NULL,
    `gradeAtRequest` ENUM('A', 'B', 'C') NOT NULL,
    `isRushRequest` BOOLEAN NOT NULL DEFAULT false,
    `customerNote` TEXT NULL,
    `adminNote` TEXT NULL,
    `approvedById` INTEGER NULL,
    `approvedAt` DATETIME(3) NULL,
    `returnedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RentalOrder_orderCode_key`(`orderCode`),
    INDEX `RentalOrder_userId_idx`(`userId`),
    INDEX `RentalOrder_status_idx`(`status`),
    INDEX `RentalOrder_startDate_endDate_idx`(`startDate`, `endDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RentalOrderItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `equipmentUnitId` INTEGER NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `dailyRate` DECIMAL(10, 2) NOT NULL,
    `days` INTEGER NOT NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,

    INDEX `RentalOrderItem_orderId_idx`(`orderId`),
    INDEX `RentalOrderItem_equipmentUnitId_startDate_endDate_idx`(`equipmentUnitId`, `startDate`, `endDate`),
    UNIQUE INDEX `RentalOrderItem_equipmentUnitId_startDate_key`(`equipmentUnitId`, `startDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InspectionLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `equipmentUnitId` INTEGER NOT NULL,
    `phase` ENUM('BEFORE_HANDOVER', 'AFTER_RETURN') NOT NULL,
    `damageNote` TEXT NULL,
    `hasNewDamage` BOOLEAN NOT NULL DEFAULT false,
    `inspectedById` INTEGER NOT NULL,
    `inspectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InspectionLog_orderId_idx`(`orderId`),
    INDEX `InspectionLog_equipmentUnitId_idx`(`equipmentUnitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InspectionPhoto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `logId` INTEGER NOT NULL,
    `angle` ENUM('FRONT', 'BACK', 'LEFT', 'RIGHT', 'EXISTING_DAMAGE') NOT NULL,
    `imageUrl` VARCHAR(500) NOT NULL,
    `caption` VARCHAR(255) NULL,

    INDEX `InspectionPhoto_logId_idx`(`logId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MaintenanceRecord` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `equipmentUnitId` INTEGER NOT NULL,
    `reason` ENUM('RENTAL_CYCLE_LIMIT', 'USAGE_DAYS_LIMIT', 'DAMAGE_REPORTED', 'ROUTINE_CLEANING', 'MANUAL') NOT NULL,
    `isAutomatic` BOOLEAN NOT NULL DEFAULT false,
    `note` TEXT NULL,
    `cost` DECIMAL(10, 2) NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,

    INDEX `MaintenanceRecord_equipmentUnitId_idx`(`equipmentUnitId`),
    INDEX `MaintenanceRecord_completedAt_idx`(`completedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiMarketingPost` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `equipmentId` INTEGER NULL,
    `status` ENUM('DRAFT', 'APPROVED', 'BROADCAST', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `headline` VARCHAR(200) NOT NULL,
    `caption` TEXT NOT NULL,
    `highlights` JSON NULL,
    `triggerReason` VARCHAR(255) NULL,
    `idleDays` INTEGER NULL,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `approvedById` INTEGER NULL,
    `broadcastAt` DATETIME(3) NULL,

    INDEX `AiMarketingPost_status_idx`(`status`),
    INDEX `AiMarketingPost_equipmentId_idx`(`equipmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ActivityLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('ORDER_CREATED', 'ORDER_APPROVED', 'ORDER_REJECTED', 'ORDER_RETURNED', 'UNIT_MAINTENANCE', 'INSPECTION_LOGGED', 'AI_POST_GENERATED', 'AI_POST_BROADCAST') NOT NULL,
    `message` VARCHAR(500) NOT NULL,
    `actorId` INTEGER NULL,
    `refType` VARCHAR(40) NULL,
    `refId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ActivityLog_createdAt_idx`(`createdAt`),
    INDEX `ActivityLog_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Equipment` ADD CONSTRAINT `Equipment_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EquipmentUnit` ADD CONSTRAINT `EquipmentUnit_equipmentId_fkey` FOREIGN KEY (`equipmentId`) REFERENCES `Equipment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RentalOrder` ADD CONSTRAINT `RentalOrder_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RentalOrder` ADD CONSTRAINT `RentalOrder_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RentalOrderItem` ADD CONSTRAINT `RentalOrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `RentalOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RentalOrderItem` ADD CONSTRAINT `RentalOrderItem_equipmentUnitId_fkey` FOREIGN KEY (`equipmentUnitId`) REFERENCES `EquipmentUnit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InspectionLog` ADD CONSTRAINT `InspectionLog_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `RentalOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InspectionLog` ADD CONSTRAINT `InspectionLog_equipmentUnitId_fkey` FOREIGN KEY (`equipmentUnitId`) REFERENCES `EquipmentUnit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InspectionLog` ADD CONSTRAINT `InspectionLog_inspectedById_fkey` FOREIGN KEY (`inspectedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InspectionPhoto` ADD CONSTRAINT `InspectionPhoto_logId_fkey` FOREIGN KEY (`logId`) REFERENCES `InspectionLog`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceRecord` ADD CONSTRAINT `MaintenanceRecord_equipmentUnitId_fkey` FOREIGN KEY (`equipmentUnitId`) REFERENCES `EquipmentUnit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiMarketingPost` ADD CONSTRAINT `AiMarketingPost_equipmentId_fkey` FOREIGN KEY (`equipmentId`) REFERENCES `Equipment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiMarketingPost` ADD CONSTRAINT `AiMarketingPost_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityLog` ADD CONSTRAINT `ActivityLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
