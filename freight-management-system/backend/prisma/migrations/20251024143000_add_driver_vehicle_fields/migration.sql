-- AlterTable
ALTER TABLE "shipments"
  ADD COLUMN "driverPhotoUrl" TEXT,
  ADD COLUMN "driverEta" TIMESTAMP(3),
  ADD COLUMN "driverLastKnownLat" DOUBLE PRECISION,
  ADD COLUMN "driverLastKnownLng" DOUBLE PRECISION,
  ADD COLUMN "driverLocationUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "vehicleType" TEXT,
  ADD COLUMN "vehicleModel" TEXT,
  ADD COLUMN "vehicleRegistration" TEXT;
