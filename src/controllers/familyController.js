import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { PORT, BASE_URL } from '../config.js';
import { fileURLToPath } from 'url';
import { createFamilySchema, updateFamilySchema, globalChildSchema } from '../utils/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, '..', '../uploads');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}


const cleanAvatarUrl = (avatarUrl) => {
    if (!avatarUrl) return null;
    if (avatarUrl.startsWith('data:image')) {
        const base64Data = avatarUrl.split(';base64,').pop();
        const fileName = `child_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, base64Data, { encoding: 'base64' });
        return `/uploads/${fileName}`;
    }
    try {
        const url = new URL(avatarUrl);
        const pathname = url.pathname;
        if (pathname.startsWith('/uploads/')) {
            return pathname;
        }
        return null;
    } catch (error) {
        if (avatarUrl.startsWith('/uploads/')) {
            return avatarUrl;
        }
        return null;
    }
};


export const createFamily = async (req, res) => {
    try {
        const cin = req.user?.cin;
        if (!cin) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        const user = await prisma.member.findUnique({
            where: {
                cin: cin
            },
            select: {
                committeeId: true
            }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        const validationResult = createFamilySchema.safeParse(req.body);
        if (!validationResult.success) {
            console.log(validationResult.error.errors);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: validationResult.error.errors.map(error => ({
                    path: error.path.join('.'),
                    message: error.message
                }))
            });
        }



        const formData = validationResult.data;

        const uploadDir = path.join(__dirname, '..', '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        formData.children.forEach((child, index) => {
            if (child.data.avatar && child.data.avatar.startsWith('data:image')) {
                const base64Data = child.data.avatar.split(';base64,').pop();
                const fileName = `child_${Date.now()}_${index}.png`;
                const filePath = path.join(uploadDir, fileName);

                fs.writeFileSync(filePath, base64Data, { encoding: 'base64' });
                child.data.avatar = `/uploads/${fileName}`;
            }
        });

        const widowWithSameCin = await prisma.widow.findFirst({
            where: {
                cinNumber: formData.cinNumber
            }
        });

        if (widowWithSameCin) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: [{
                    path: 'cinNumber',
                    message: 'رقم البطاقة الوطنية موجود مسبقا'
                }]
            });
        }

        // Create family with related widow and children
        const family = await prisma.family.create({
            data: {
                registrationDate: new Date(formData.registrationDate),
                OrphansLastName: formData.OrphansLastName,
                Housing: formData.Housing,
                HousingType: formData.HousingType,
                RentalAmount: formData.RentalAmount,
                importantNeeds: formData.importantNeeds.join(','),
                committee: {
                    connect: {
                        id: user.committeeId
                    }
                },

                // Create related widow
                Widow: {
                    create: {
                        WidowsName: formData.WidowsName,
                        HealthStatus: formData.HealthStatus,
                        AddressOfHeadOfFamily: formData.AddressOfHeadOfFamily,
                        phoneNumber: formData.phoneNumber,
                        cinNumber: formData.cinNumber,
                        level: formData.level,
                        diplome: formData.diplome,
                        Job: formData.Job,
                        salaire: formData.salaire,
                        ExtraSalaire: formData.ExtraSalaire,
                        importantNeeds: formData.importantNeeds.join(','),
                        committeeId: user.committeeId
                    }
                },
                children: {
                    create: formData.children.map(child => ({
                        fullName: child.data.fullName,
                        dateOfBirth: new Date(child.data.dateOfBirth),
                        gender: child.data.gender,
                        schoolLevel: child.data.schoolLevel,
                        avatar: child.data.avatar || null,
                        committee: {
                            connect: {
                                id: user.committeeId
                            }
                        },
                        semesterGrades: {
                            create: child.data.semesterGrades.map(grade => ({
                                yearNumber: grade.yearNumber,
                                yearLabel: grade.yearLabel,
                                grade: grade.grade
                            }))
                        }
                    }))
                }
            },
            include: {
                Widow: true,
                children: {
                    include: {
                        semesterGrades: true
                    }
                }
            }
        });

        res.status(201).json({
            success: true,
            message: 'Family created successfully',
            data: family
        });

    } catch (error) {
        console.error('Error creating family:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating family',
            error: error.message
        });
    }
};


export const updateFamily = async (req, res) => {
    try {
        const cin = req.user?.cin;
        if (!cin) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        const user = await prisma.member.findUnique({
            where: { cin },
            select: { committeeId: true }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        const existingFamily = await prisma.family.findUnique({
            where: { id: req.body?.id },
            include: {
                children: {
                    include: { semesterGrades: true }
                },
                Widow: true
            }
        });

        if (!existingFamily) {
            return res.status(404).json({
                success: false,
                message: 'العائلة غير موجودة'
            });
        }

        if (req.body?.committee) {
            const newCommittee = await prisma.committee.findUnique({
                where: { id: req.body?.committee }
            });

            if (!newCommittee) {
                return res.status(404).json({
                    success: false,
                    message: 'اللجنة غير موجودة'
                });
            }
            const updatedFamily = await prisma.$transaction(async (prisma) => {
                const family = await prisma.family.update({
                    where: { id: req.body?.id },
                    data: {
                        committeeId: req.body?.committee
                    },
                    include: {
                        children: true,
                        Widow: true
                    }
                });
                await prisma.widow.update({
                    where: { id: family.Widow.id },
                    data: {
                        committeeId: req.body?.committee
                    }
                });
                await prisma.child.updateMany({
                    where: { familyId: req.body?.id },
                    data: {
                        committeeId: req.body?.committee
                    }
                });
                return prisma.family.findUnique({
                    where: { id: req.body?.id },
                    include: {
                        children: {
                            include: { semesterGrades: true }
                        },
                        Widow: true
                    }
                });
            });

            return res.status(200).json({
                success: true,
                message: 'Family committee updated successfully',
                data: updatedFamily
            });
        }


        const validationResult = updateFamilySchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: validationResult.error.errors.map(error => ({
                    path: error.path.join('.'),
                    message: error.message
                }))
            });
        }
        const formData = validationResult.data;
        const familyId = formData.id;

        const widowWithSameCin = await prisma.widow.findFirst({
            where: {
                cinNumber: formData.cinNumber
            }
        });

        if (widowWithSameCin && widowWithSameCin.id !== existingFamily.Widow.id) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: [{
                    path: 'cinNumber',
                    message: 'رقم البطاقة الوطنية موجود مسبقا'
                }]
            });
        }

        const existingChildrenIds = existingFamily.children.map(child => child.id);
        const newChildrenIds = formData.children
            .map(child => typeof child.id === 'string' && child.id.startsWith('new_') ? null : parseInt(child.id))
            .filter(id => id !== null);
        const childrenToDelete = existingChildrenIds.filter(id => !newChildrenIds.includes(id));

        // Ensure uploads directory exists
        const uploadDir = path.join(__dirname, '..', '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Perform all updates in a transaction
        const updatedFamily = await prisma.$transaction(async (prisma) => {
            // 1. Delete children if necessary
            if (childrenToDelete.length > 0) {
                await prisma.semesterGrade.deleteMany({
                    where: { childId: { in: childrenToDelete } }
                });
                await prisma.child.deleteMany({
                    where: { id: { in: childrenToDelete } }
                });
            }

            // 2. Update family data
            const updatedFamilyData = await prisma.family.update({
                where: { id: familyId },
                data: {
                    registrationDate: new Date(formData.registrationDate),
                    OrphansLastName: formData.OrphansLastName,
                    Housing: formData.Housing,
                    HousingType: formData.HousingType,
                    RentalAmount: formData.RentalAmount,
                    importantNeeds: Array.isArray(formData.importantNeeds)
                        ? formData.importantNeeds.join(',')
                        : formData.importantNeeds,
                },
                include: {
                    children: {
                        include: { semesterGrades: true }
                    },
                    Widow: true
                }
            });

            // 3. Update widow data
            await prisma.widow.update({
                where: { id: existingFamily.Widow.id },
                data: {
                    WidowsName: formData.WidowsName,
                    HealthStatus: formData.HealthStatus,
                    AddressOfHeadOfFamily: formData.AddressOfHeadOfFamily,
                    phoneNumber: formData.phoneNumber,
                    cinNumber: formData.cinNumber,
                    level: formData.level,
                    diplome: formData.diplome,
                    Job: formData.Job,
                    salaire: formData.salaire,
                    ExtraSalaire: formData.ExtraSalaire,
                    importantNeeds: Array.isArray(formData.importantNeeds)
                        ? formData.importantNeeds.join(',')
                        : formData.importantNeeds,
                    committeeId: user.committeeId
                }
            });

            // 4. Handle children updates and creation
            for (const child of formData.children) {
                const childData = {
                    fullName: child.data.fullName,
                    dateOfBirth: new Date(child.data.dateOfBirth),
                    gender: child.data.gender,
                    schoolLevel: child.data.schoolLevel,
                    avatar: cleanAvatarUrl(child.data.avatar),
                    committeeId: user.committeeId,
                };

                if (typeof child.id === 'string' && child.id.startsWith('new_')) {
                    // Create new child
                    await prisma.child.create({
                        data: {
                            ...childData,
                            familyId: familyId,
                            semesterGrades: {
                                create: (child.data.semesterGrades || []).map(grade => ({
                                    yearNumber: parseInt(grade.yearNumber),
                                    yearLabel: grade.yearLabel,
                                    grade: grade.grade
                                }))
                            }
                        }
                    });
                } else {
                    // Update existing child
                    await prisma.child.update({
                        where: { id: parseInt(child.id) },
                        data: {
                            ...childData,
                            semesterGrades: {
                                deleteMany: {},
                                create: (child.data.semesterGrades || []).map(grade => ({
                                    yearNumber: parseInt(grade.yearNumber),
                                    yearLabel: grade.yearLabel,
                                    grade: grade.grade
                                }))
                            }
                        }
                    });
                }
            }

            // 5. Fetch and return updated family data
            return prisma.family.findUnique({
                where: { id: familyId },
                include: {
                    children: {
                        include: { semesterGrades: true }
                    },
                    Widow: true
                }
            });
        });

        res.status(200).json({
            success: true,
            message: 'Family updated successfully',
            data: updatedFamily
        });

    } catch (error) {
        console.error('Error updating family:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating family',
            error: error.message
        });
    }
};



export const getThreeFamilies = async (req, res) => {
    const cin = req.user.cin;
    if (!cin) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }
    try {
        const user = await prisma.member.findUnique({
            where: {
                cin: cin
            },
            select: {
                committeeId: true
            }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'عضو غير موجود'
            });
        }

        const whereClause = user.committeeId === null ? {} : { committeeId: user.committeeId };

        const countFamilies = await prisma.family.count({
            where: whereClause
        });

        const families = await prisma.family.findMany({
            where: whereClause,
            take: 3,
            select: {
                id: true,
                OrphansLastName: true,
                Widow: {
                    select: {
                        WidowsName: true
                    }
                }
            }
        });

        // Format the response to include both family and widow information
        const formattedFamilies = families.map(family => ({
            id: family.id,
            OrphansLastName: family.OrphansLastName,
            WidowsName: family.Widow?.WidowsName || '' // Assuming one widow per family
        }));

        res.status(200).json({
            success: true,
            message: 'Families retrieved successfully',
            data: formattedFamilies,
            count: countFamilies
        });
    } catch (error) {
        console.error('Error fetching families:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching families',
            error: error.message
        });
    }
};

export const getFamilyData = async (req, res) => {
    try {
        const id = parseInt(req.body.id, 10);
        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Invalid family ID'
            });
        }
        const family = await prisma.family.findUnique({
            where: { id: id },
            select: {
                id: true,
                registrationDate: true,
                OrphansLastName: true,
                Widow: {
                    select: {
                        WidowsName: true,
                        AddressOfHeadOfFamily: true,
                        phoneNumber: true,
                        cinNumber: true,
                        Job: true,
                    }
                }
            }
        });

        if (!family) {
            return res.status(404).json({
                success: false,
                message: 'Family not found'
            });
        }

        const numberOfChildren = await prisma.child.count({
            where: {
                familyId: id
            }
        });

        const formattedFamily = {
            id: family.id,
            registrationDate: family.registrationDate,
            OrphansLastName: family.OrphansLastName,
            ...family.Widow,
            numberOfChildren
        };

        res.status(200).json({
            success: true,
            message: 'Family data retrieved successfully',
            data: formattedFamily
        });
    } catch (error) {
        console.error('Error fetching family data:', error);
        res.status(400).json({
            success: false,
            message: 'Error fetching family data',
            error: error.message
        });
    }
}

export const getFamilesOfPage = async (req, res) => {
    try {
        const cin = req.user.cin;
        const page = parseInt(req.body.page, 10);

        if (!page || !cin) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request'
            });
        }

        const user = await prisma.member.findUnique({
            where: { cin },
            select: { committeeId: true }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        const families = await prisma.family.findMany({
            where: user.committeeId === null ? {} : { committeeId: user.committeeId },
            skip: (page - 1) * 10,
            take: 10,
            select: {
                id: true,
                registrationDate: true,
                OrphansLastName: true,
                Widow: {
                    select: {
                        WidowsName: true,
                        AddressOfHeadOfFamily: true,
                        phoneNumber: true,
                        cinNumber: true,
                        Job: true,
                    }
                }
            }
        });

        const formattedFamilies = families.map(family => ({
            id: family.id,
            registrationDate: family.registrationDate,
            OrphansLastName: family.OrphansLastName,
            ...family.Widow // Spread widow information
        }));

        res.status(200).json({
            success: true,
            message: 'Families retrieved successfully',
            data: formattedFamilies
        });
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: 'Failed to fetch families' });
    }
}

export const getFourChildren = async (req, res) => {
    try {
        const cin = req.user.cin;
        if (!cin) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const user = await prisma.member.findUnique({
            where: { cin },
            select: { committeeId: true }
        });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        const children = await prisma.child.findMany({
            where: user.committeeId === null ? {} : { committeeId: user.committeeId },
            take: 4,
            select: {
                id: true,
                fullName: true,
                dateOfBirth: true,
                subjectEnrollments: true
            }
        });

        const formattedChildren = children.map(child => ({
            id: child.id,
            fullName: child.fullName,
            dateOfBirth: child.dateOfBirth,
            Beneficiary: child.subjectEnrollments.length !== 0
        }));

        res.status(200).json({
            success: true,
            message: 'Children retrieved successfully',
            data: formattedChildren
        });
    } catch (error) {
        console.error('Error fetching children:', error);
        res.status(400).json({
            success: false,
            message: 'Error fetching children',
            error: error.message
        });
    }
}

export const getChildrenOfPage = async (req, res) => {
    try {
        const page = parseInt(req.body.page, 10);
        if (!page) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request'
            });
        }
        const children = await prisma.child.findMany({
            skip: (page - 1) * 20,
            take: 20,
            select: {
                id: true,
                fullName: true,
                dateOfBirth: true,
                subjectEnrollments: true
            }
        });

        const formattedChildren = children.map(child => ({
            id: child.id,
            fullName: child.fullName,
            dateOfBirth: child.dateOfBirth,
            Beneficiary: child.subjectEnrollments.length !== 0
        }));

        res.status(200).json({
            success: true,
            message: 'Children retrieved successfully',
            data: formattedChildren
        });
    } catch (error) {
        console.error('Error fetching children:', error);
        res.status(400).json({
            success: false,
            message: 'Error fetching children',
            error: error.message
        });
    }
}

export const searchChildren = async (req, res) => {
    try {
        const { searchTerm } = req.body;

        if (!searchTerm) {
            return res.status(400).json({
                success: false,
                message: 'Invalid search term'
            });
        }


        const children = await prisma.child.findMany({
            where: {
                OR: [
                    {
                        fullName: {
                            contains: searchTerm.toLowerCase()
                        }
                    },
                    {
                        fullName: {
                            contains: searchTerm.toUpperCase()
                        }
                    }
                ]
            }
        });

        res.json({ success: true, data: children });
    } catch (error) {
        console.error("Search error:", error);
        res.status(500).json({ success: false, error: "Search failed" });
    }
}

export const getFamilyUpdateData = async (req, res) => {
    try {
        const id = parseInt(req.body.id, 10);
        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Invalid family ID'
            });
        }

        const family = await prisma.family.findUnique({
            where: { id: id },
            include: {
                children: {
                    include: {
                        semesterGrades: true
                    }
                },
                Widow: true
            }
        });

        if (!family) {
            return res.status(404).json({
                success: false,
                message: 'Family not found',
            });
        }

        const updatedFamily = {
            ...family,
            ...family.Widow,
            children: family.children.map(child => ({
                ...child,
                avatar: child.avatar ? `http://${BASE_URL}:${PORT}${child.avatar}` : null,
            }))
        };

        delete updatedFamily.Widow;

        res.status(200).json({
            success: true,
            message: 'Family data retrieved successfully',
            data: updatedFamily,
        });
    } catch (error) {
        console.error('Error fetching family data:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching family data',
            error: error.message,
        });
    }
}

export const getChildData = async (req, res) => {
    try {
        const id = parseInt(req.body.id, 10);
        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Invalid child ID'
            });
        }

        const child = await prisma.child.findUnique({
            where: { id: id },
            select: {
                fullName: true,
                dateOfBirth: true,
                gender: true,
                schoolLevel: true,
                avatar: true,
                committee: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        if (!child) {
            return res.status(404).json({
                success: false,
                message: 'Child not found',
            });
        }
        let avatarUrl = null;
        if (child.avatar) {
            avatarUrl = `http://${BASE_URL}:${PORT}${child.avatar}`;
        }

        res.status(200).json({
            success: true,
            message: 'Child data retrieved successfully',
            data: {
                ...child,
                avatar: avatarUrl,
            },
        });
    } catch (error) {
        console.error('Error fetching child data:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching child data',
            error: error.message,
        });
    }
}

export const childDataUpdate = async (req, res) => {
    try {
        const childId = parseInt(req.body.id, 10);
        if (!childId) {
            return res.status(400).json({
                success: false,
                message: 'Invalid child ID'
            });
        }

        const child = await prisma.child.findUnique({
            where: { id: childId },
            include: {
                semesterGrades: {
                    select: {
                        yearNumber: true,
                        yearLabel: true,
                        grade: true
                    }
                }
            }
        });

        if (!child) {
            return res.status(404).json({ error: 'Child not found' });
        }
        const childAvatar = child.avatar ? `http://${BASE_URL}:${PORT}${child.avatar}` : null;
        const formattedChild = {
            avatar: childAvatar,
            fullName: child.fullName,
            dateOfBirth: child.dateOfBirth,
            gender: child.gender,
            schoolLevel: child.schoolLevel,
            semesterGrades: child.semesterGrades.map(grade => ({
                yearNumber: grade.yearNumber,
                yearLabel: grade.yearLabel,
                grade: grade.grade
            }))
        };

        res.json(formattedChild);
    } catch (error) {
        console.error('Error fetching child:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export const updateChild = async (req, res) => {
    try {
        const formattedData = {
            id: req.body.id,
            data: {
                fullName: req.body.fullName,
                dateOfBirth: req.body.dateOfBirth,
                gender: req.body.gender,
                schoolLevel: req.body.schoolLevel,
                avatar: req.body.avatar,
                semesterGrades: req.body.semesterGrades || []
            }
        };
        const validationResult = globalChildSchema.safeParse(formattedData);
        if (!validationResult.success) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: validationResult.error.errors.map(error => ({
                    path: error.path.join('.'),
                    message: error.message
                }))
            });
        }
        const formData = validationResult.data;
        const childAvatar = cleanAvatarUrl(formData.data.avatar)
        const updatedChild = await prisma.child.update({
            where: {
                id: formData.id
            },
            data: {
                fullName: formData.data.fullName,
                dateOfBirth: new Date(formData.data.dateOfBirth),
                gender: formData.data.gender,
                schoolLevel: formData.data.schoolLevel,
                avatar: childAvatar || undefined,
            },
        });

        if (formData.data.semesterGrades && Array.isArray(formData.data.semesterGrades)) {
            await prisma.semesterGrade.deleteMany({
                where: {
                    childId: parseInt(formData.id)
                }
            });

            const gradesData = formData.data.semesterGrades
                .filter(grade => grade.grade !== '')
                .map(grade => ({
                    yearNumber: grade.yearNumber,
                    yearLabel: grade.yearLabel,
                    grade: grade.grade,
                    childId: formData.id
                }));

            if (gradesData.length > 0) {
                await prisma.semesterGrade.createMany({
                    data: gradesData
                });
            }
        }

        const updatedChildWithGrades = await prisma.child.findUnique({
            where: {
                id: formData.id
            },
            include: {
                semesterGrades: true
            }
        });

        res.status(200).json(updatedChildWithGrades);
    } catch (error) {
        console.error('Error updating child:', error);
        res.status(500).json({
            error: 'Failed to update child',
            details: error.message
        });
    }
};

export const getAllChildrenData = async (req, res) => {
    try {
        const { selectedLevel } = req.body;
        const cin = req.user.cin;
        if (!cin) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        if (!selectedLevel) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request'
            });
        }
        const user = await prisma.member.findUnique({
            where: {
                cin: cin
            },
            select: {
                committeeId: true
            }
        });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        const children = await prisma.child.findMany({
            where: {
                committeeId: user.committeeId,
                ...(selectedLevel !== "الكل" && { schoolLevel: selectedLevel })
            },
            select: {
                id: true,
                fullName: true
            }
        });
        res.status(200).json({
            success: true,
            message: 'Children data retrieved successfully',
            data: children
        });

    }
    catch (error) {
        console.error('Error fetching children data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export const getAllWidows = async (req, res) => {
    try {
        const cin = req.user.cin;
        if (!cin) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        const user = await prisma.member.findUnique({
            where: {
                cin: cin
            },
            select: {
                committeeId: true
            }
        });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }
        const widows = await prisma.widow.findMany({
            where: {
                committeeId: user.committeeId
            },
            select: {
                id: true,
                WidowsName: true
            }
        });

        return res.status(200).json({
            success: true,
            data: widows
        });

    } catch (error) {
        console.error('Error fetching widow names:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch widow names'
        });
    }
}