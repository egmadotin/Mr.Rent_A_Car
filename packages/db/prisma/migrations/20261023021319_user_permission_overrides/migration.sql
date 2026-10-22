-- AlterTable
ALTER TABLE "user" ADD COLUMN     "permissionsAdded" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "permissionsRemoved" TEXT[] DEFAULT ARRAY[]::TEXT[];

