-- CreateTable
CREATE TABLE "Committee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Member" (
    "cin" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'COMMITTEE_MEMBER',
    "joinedDate" DATETIME,
    "leftDate" DATETIME,
    "committeeId" INTEGER,
    "subscriptionStatus" BOOLEAN NOT NULL DEFAULT false,
    "memberType" TEXT NOT NULL DEFAULT 'WORKER',
    CONSTRAINT "Member_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Family" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "registrationDate" DATETIME NOT NULL,
    "OrphansLastName" TEXT NOT NULL,
    "Housing" TEXT NOT NULL,
    "HousingType" TEXT NOT NULL,
    "RentalAmount" TEXT NOT NULL,
    "importantNeeds" TEXT NOT NULL,
    "committeeId" INTEGER NOT NULL,
    "widowId" INTEGER NOT NULL,
    CONSTRAINT "Family_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Family_widowId_fkey" FOREIGN KEY ("widowId") REFERENCES "Widow" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Widow" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "WidowsName" TEXT NOT NULL,
    "HealthStatus" TEXT NOT NULL,
    "AddressOfHeadOfFamily" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "cinNumber" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "diplome" TEXT NOT NULL,
    "Job" TEXT NOT NULL,
    "salaire" TEXT NOT NULL,
    "ExtraSalaire" TEXT NOT NULL,
    "importantNeeds" TEXT NOT NULL,
    "committeeId" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Child" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fullName" TEXT NOT NULL,
    "dateOfBirth" DATETIME NOT NULL,
    "gender" TEXT NOT NULL,
    "schoolLevel" TEXT NOT NULL,
    "avatar" TEXT,
    "familyId" INTEGER NOT NULL,
    "committeeId" INTEGER NOT NULL,
    CONSTRAINT "Child_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Child_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Image" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "url" TEXT NOT NULL,
    "fullUrl" TEXT DEFAULT '',
    "postId" INTEGER NOT NULL,
    CONSTRAINT "Image_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Post" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Member" ("cin") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SemesterGrade" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "yearNumber" INTEGER NOT NULL,
    "yearLabel" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "childId" INTEGER NOT NULL,
    CONSTRAINT "SemesterGrade_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "levelTargeted" TEXT DEFAULT 'الكل',
    "committeeId" INTEGER NOT NULL,
    "teacherId" TEXT NOT NULL,
    "target" TEXT NOT NULL DEFAULT 'ORPHAN',
    CONSTRAINT "Subject_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Subject_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Member" ("cin") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrphanSubjectEnrollment" (
    "childId" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "enrollmentDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("childId", "subjectId"),
    CONSTRAINT "OrphanSubjectEnrollment_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrphanSubjectEnrollment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WidowSubjectEnrollment" (
    "widowId" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "enrollmentDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("widowId", "subjectId"),
    CONSTRAINT "WidowSubjectEnrollment_widowId_fkey" FOREIGN KEY ("widowId") REFERENCES "Widow" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WidowSubjectEnrollment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Class" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "classDate" DATETIME NOT NULL,
    "startTime" TEXT NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "target" TEXT NOT NULL DEFAULT 'ORPHAN',
    CONSTRAINT "Class_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Remark" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "content" TEXT NOT NULL,
    "widowId" INTEGER,
    "childId" INTEGER,
    "subjectId" INTEGER NOT NULL,
    CONSTRAINT "Remark_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Remark_widowId_fkey" FOREIGN KEY ("widowId") REFERENCES "Widow" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Remark_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Absence" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "childId" INTEGER,
    "widowId" INTEGER,
    "classId" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "isAbsent" BOOLEAN NOT NULL DEFAULT false,
    "isJustified" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Absence_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Absence_widowId_fkey" FOREIGN KEY ("widowId") REFERENCES "Widow" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Absence_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Absence_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "Date" DATETIME NOT NULL,
    "committeeBudget" REAL NOT NULL,
    "externalBudget" REAL NOT NULL,
    "totalBudget" REAL NOT NULL,
    "forOrphans" BOOLEAN NOT NULL,
    "totalBenificiaries" INTEGER NOT NULL,
    "committeeId" INTEGER NOT NULL,
    CONSTRAINT "Project_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_FamilyToProject" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_FamilyToProject_A_fkey" FOREIGN KEY ("A") REFERENCES "Family" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_FamilyToProject_B_fkey" FOREIGN KEY ("B") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_ChildToProject" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_ChildToProject_A_fkey" FOREIGN KEY ("A") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ChildToProject_B_fkey" FOREIGN KEY ("B") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_cin_key" ON "Member"("cin");

-- CreateIndex
CREATE UNIQUE INDEX "Family_widowId_key" ON "Family"("widowId");

-- CreateIndex
CREATE INDEX "Remark_subjectId_idx" ON "Remark"("subjectId");

-- CreateIndex
CREATE INDEX "Remark_childId_idx" ON "Remark"("childId");

-- CreateIndex
CREATE INDEX "Remark_widowId_idx" ON "Remark"("widowId");

-- CreateIndex
CREATE INDEX "Absence_childId_subjectId_idx" ON "Absence"("childId", "subjectId");

-- CreateIndex
CREATE INDEX "Absence_widowId_subjectId_idx" ON "Absence"("widowId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "Absence_childId_widowId_classId_subjectId_key" ON "Absence"("childId", "widowId", "classId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "_FamilyToProject_AB_unique" ON "_FamilyToProject"("A", "B");

-- CreateIndex
CREATE INDEX "_FamilyToProject_B_index" ON "_FamilyToProject"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ChildToProject_AB_unique" ON "_ChildToProject"("A", "B");

-- CreateIndex
CREATE INDEX "_ChildToProject_B_index" ON "_ChildToProject"("B");
