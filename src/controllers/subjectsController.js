import { PrismaClient } from '@prisma/client';
import { createSubjectSchema, createClassSchema, updateSubjectSchema, addRemarkSchema, deleteRemarkSchema, updateClassSchema, attendanceSchema } from '../utils/index.js';



const prisma = new PrismaClient();

export const createSubject = async (req, res) => {
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

        const validationResult = createSubjectSchema.safeParse(req.body);
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

        const result = await prisma.$transaction(async (prisma) => {
            const subject = await prisma.subject.create({
                data: {
                    name: formData.subjectName,
                    target: formData.target,
                    ...(formData.target === 'ORPHAN' && { levelTargeted: formData.level }),
                    committeeId: user.committeeId,
                    teacherId: formData.teacher
                }
            });

            // Handle enrollments based on target
            if (formData.target === 'ORPHAN') {
                await prisma.orphanSubjectEnrollment.createMany({
                    data: formData.selectedStudents.map(child => ({
                        childId: child.id,
                        subjectId: subject.id,
                    })),
                });
            } else {
                await prisma.widowSubjectEnrollment.createMany({
                    data: formData.selectedStudents.map(widow => ({
                        widowId: widow.id,
                        subjectId: subject.id,
                    })),
                });
            }

            return subject;
        });

        return res.status(201).json({
            success: true,
            data: result,
            message: `${formData.target.toLowerCase()} subject created successfully`
        });
    } catch (error) {
        console.error('Error creating subject:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create subject',
            details: error.message
        });
    }
};


export const getAllSubjects = async (req, res) => {
    try {
        const cin = req.user.cin;
        const { committeeId, target } = req.body;
        if (!committeeId || !target) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }
        if (target !== 'ORPHAN' && target !== 'WIDOW') {
            return res.status(400).json({
                success: false,
                message: 'Invalid target type'
            });
        }

        const committeeIdInt = parseInt(committeeId);

        const user = await prisma.member.findUnique({
            where: { cin },
            select: {
                committeeId: true,
                role: true
            }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        const subjects = await prisma.subject.findMany({
            where: {
                committeeId: user.committeeId === null ? committeeIdInt : user.committeeId,
                target: target,
                ...((user.memberType === 'ORPHANTEACHER' || user.memberType === 'WIDOWTEACHER') && { teacherId: cin })
            },
            include: {
                orphanEnrollments: target === 'ORPHAN' ? true : false,
                widowEnrollments: target === 'WIDOW' ? true : false,
            }
        });

        const result = subjects.map(subject => ({
            id: subject.id,
            name: subject.name,
            level: subject.levelTargeted,
            studentsCount: target === 'ORPHAN'
                ? subject.orphanEnrollments.length
                : subject.widowEnrollments.length
        }));

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching subjects:', error);
        return res.status(500).json({
            error: 'Failed to fetch subjects',
            details: error.message
        });
    }
};

export const createClass = async (req, res) => {
    try {
        const validationResult = createClassSchema.safeParse(req.body);
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
        const subject = await prisma.subject.findUnique({
            where: {
                id: formData.subjectId
            },
            include: {
                orphanEnrollments: {
                    select: {
                        childId: true
                    }
                },
                widowEnrollments: {
                    select: {
                        widowId: true
                    }
                }
            }
        });

        if (!subject) {
            return res.status(404).json({
                success: false,
                error: 'Subject not found'
            });
        }

        const newClass = await prisma.class.create({
            data: {
                name: formData.name,
                classDate: new Date(formData.date),
                startTime: formData.time,
                target: subject.target, // ORPHAN or WIDOW
                Subject: {
                    connect: {
                        id: formData.subjectId
                    }
                }
            }
        });

        if (subject.target === 'ORPHAN') {
            const absenceRecords = subject.orphanEnrollments.map(enrollment => ({
                childId: enrollment.childId,
                widowId: null,
                classId: newClass.id,
                subjectId: formData.subjectId,
                isAbsent: false,
                isJustified: false
            }));

            if (absenceRecords.length > 0) {
                await prisma.absence.createMany({
                    data: absenceRecords
                });
            }
        } else if (subject.target === 'WIDOW') {
            const absenceRecords = subject.widowEnrollments.map(enrollment => ({
                childId: null,
                widowId: enrollment.widowId,
                classId: newClass.id,
                subjectId: formData.subjectId,
                isAbsent: false,
                isJustified: false
            }));

            if (absenceRecords.length > 0) {
                await prisma.absence.createMany({
                    data: absenceRecords
                });
            }
        }

        return res.status(201).json({
            success: true,
            message: 'Class created successfully with attendance records',
            data: newClass
        });

    } catch (error) {
        console.error('Error creating class:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create class',
            details: error.message
        });
    }
};

export const getSubjectClasses = async (req, res) => {
    try {
        const { subjectId } = req.body;

        if (!subjectId) {
            return res.status(400).json({
                success: false,
                message: 'Subject ID is required'
            });
        }
        const parsedSubjectId = parseInt(subjectId);
        const classes = await prisma.class.findMany({
            where: {
                subjectId: parsedSubjectId
            },
        });

        return res.status(200).json({
            success: true,
            data: classes
        });
    } catch (error) {
        console.error('Error fetching classes:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch classes',
            details: error.message
        });
    }
}


export const getSubjectData = async (req, res) => {
    try {
        const { id, selectedLevel } = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Subject ID and level are required'
            });
        }
        const subjectId = parseInt(id);

        // First, get the subject's target type
        const subjectType = await prisma.subject.findUnique({
            where: { id: subjectId },
            select: { target: true }
        });

        if (!subjectType) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found'
            });
        }

        // Build the query based on target type
        const subject = await prisma.subject.findUnique({
            where: { id: subjectId },
            include: {
                // Include orphan enrollments only if target is ORPHAN
                ...(subjectType.target === 'ORPHAN' && {
                    orphanEnrollments: {
                        where: selectedLevel !== "الكل" ? {
                            child: { schoolLevel: selectedLevel }
                        } : {},
                        include: {
                            child: {
                                select: {
                                    id: true,
                                    fullName: true,
                                }
                            }
                        }
                    }
                }),
                // Include widow enrollments only if target is WIDOW
                ...(subjectType.target === 'WIDOW' && {
                    widowEnrollments: {
                        include: {
                            widow: {
                                select: {
                                    id: true,
                                    WidowsName: true
                                }
                            }
                        }
                    }
                })
            }
        });

        if (!subject) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found'
            });
        }

        // Transform data based on target type
        const transformedData = {
            subjectName: subject.name,
            teacherId: subject.teacherId,
            target: subject.target,
            ...(subject.target === 'ORPHAN' && { level: subject.levelTargeted }),
            enrolledStudents: subject.target === 'ORPHAN'
                ? subject.orphanEnrollments.map(enrollment => ({
                    id: enrollment.child.id,
                    name: enrollment.child.fullName,
                    schoolLevel: enrollment.child.schoolLevel
                }))
                : subject.widowEnrollments.map(enrollment => ({
                    id: enrollment.widow.id,
                    WidowsName: enrollment.widow.WidowsName
                }))
        };

        return res.status(200).json({
            success: true,
            data: transformedData
        });

    } catch (error) {
        console.error('Error fetching subject data:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch subject data',
            details: error.message
        });
    }
};

export const updateSubject = async (req, res) => {
    try {
        const formattedData = {
            id: req.body?.id,
            subjectName: req.body?.subjectName,
            teacher: req.body?.selectedTeacher,
            selectedStudents: req.body?.selectedStudents.map(student => ({ id: student.id, name: student.WidowsName ? student.WidowsName : student.name })),
            target: req.body?.target,
            level: req.body?.selectedLevel
        }

        const validationResult = updateSubjectSchema.safeParse(formattedData);
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

        await prisma.$transaction(async (prisma) => {
            // 1. Update basic subject information
            await prisma.subject.update({
                where: { id: formData.id },
                data: {
                    name: formData.subjectName,
                    teacherId: formData.teacher,
                    ...(formData.target === 'ORPHAN' && { levelTargeted: formData.level })
                },
            });

            // 2. Get current enrollments
            let currentEnrollments = [];
            if (formData.target === 'ORPHAN') {
                currentEnrollments = await prisma.orphanSubjectEnrollment.findMany({
                    where: { subjectId: formData.id },
                    select: { childId: true }
                });
            } else {
                currentEnrollments = await prisma.widowSubjectEnrollment.findMany({
                    where: { subjectId: formData.id },
                    select: { widowId: true }
                });
            }

            const currentIds = formData.target === 'ORPHAN'
                ? currentEnrollments.map(e => e.childId)
                : currentEnrollments.map(e => e.widowId);

            const newIds = formData.target === 'ORPHAN'
                ? formData.selectedStudents.map(s => parseInt(s.id))
                : formData.selectedStudents.map(s => parseInt(s.id));

            const idsToRemove = currentIds.filter(id => !newIds.includes(id));
            const idsToAdd = newIds.filter(id => !currentIds.includes(id));

            // 3. Handle enrollments
            if (formData.target === 'ORPHAN') {
                // Remove old enrollments
                if (idsToRemove.length > 0) {
                    await prisma.orphanSubjectEnrollment.deleteMany({
                        where: {
                            AND: [
                                { subjectId: formData.id },
                                { childId: { in: idsToRemove } }
                            ]
                        }
                    });
                }

                // Add new enrollments
                if (idsToAdd.length > 0) {
                    await prisma.orphanSubjectEnrollment.createMany({
                        data: idsToAdd.map(childId => ({
                            childId,
                            subjectId: formData.id,
                        })),
                    });
                }
            } else {
                if (idsToRemove.length > 0) {
                    await prisma.widowSubjectEnrollment.deleteMany({
                        where: {
                            AND: [
                                { subjectId: formData.id },
                                { widowId: { in: idsToRemove } }
                            ]
                        }
                    });
                }

                // Add new enrollments
                if (idsToAdd.length > 0) {
                    await prisma.widowSubjectEnrollment.createMany({
                        data: idsToAdd.map(widowId => ({
                            widowId,
                            subjectId: formData.id,
                        })),
                    });
                }
            }

            // 4. Update absence records
            const existingClasses = await prisma.class.findMany({
                where: { subjectId: formData.id },
            });

            // Remove absence records only for removed students
            if (idsToRemove.length > 0) {
                if (formData.target === 'ORPHAN') {
                    await prisma.absence.deleteMany({
                        where: {
                            AND: [
                                { subjectId: formData.id },
                                { childId: { in: idsToRemove } }
                            ]
                        }
                    });
                } else {
                    await prisma.absence.deleteMany({
                        where: {
                            AND: [
                                { subjectId: formData.id },
                                { widowId: { in: idsToRemove } }
                            ]
                        }
                    });
                }
            }

            // Add absence records only for new students
            for (const class_ of existingClasses) {
                if (formData.target === 'ORPHAN') {
                    if (idsToAdd.length > 0) {
                        await prisma.absence.createMany({
                            data: idsToAdd.map(childId => ({
                                childId,
                                classId: class_.id,
                                subjectId: formData.id,
                                isAbsent: false,
                                isJustified: false
                            }))
                        });
                    }
                } else {
                    if (idsToAdd.length > 0) {
                        await prisma.absence.createMany({
                            data: idsToAdd.map(widowId => ({
                                widowId,
                                classId: class_.id,
                                subjectId: formData.id,
                                isAbsent: false,
                                isJustified: false
                            }))
                        });
                    }
                }
            }
        });

        return res.status(200).json({
            success: true,
            message: `${formData.target.toLowerCase()} subject updated successfully`
        });

    } catch (error) {
        console.error('Error updating subject:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to update subject',
            details: error.message
        });
    }
};

export const getSubjectStudents = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Subject ID is required'
            });
        }
        const subjectId = parseInt(id);

        const subject = await prisma.subject.findUnique({
            where: {
                id: subjectId
            },
            include: {
                orphanEnrollments: {
                    include: {
                        child: {
                            select: {
                                id: true,
                                fullName: true,
                            }
                        }
                    }
                },
                widowEnrollments: {
                    include: {
                        widow: {
                            select: {
                                id: true,
                                WidowsName: true,
                            }
                        }
                    }
                }
            }
        });

        if (!subject) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found'
            });
        }

        const formattedStudents = subject.target === 'ORPHAN'
            ? subject.orphanEnrollments.map(item => ({
                id: item.child.id,
                name: item.child.fullName,
            }))
            : subject.widowEnrollments.map(item => ({
                id: item.widow.id,
                name: item.widow.WidowsName,
            }));

        return res.status(200).json({
            success: true,
            data: {
                students: formattedStudents
            }
        });

    } catch (error) {
        console.error('Error in getSubjectStudents:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching students data'
        });
    }
};


export const getClassData = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Class ID is required'
            });
        }
        const classId = parseInt(id);

        const classData = await prisma.class.findUnique({
            where: {
                id: classId
            },
            select: {
                name: true,
                classDate: true,
                startTime: true,
                Subject: {
                    select: {
                        id: true,
                        name: true,
                        target: true
                    }
                }
            }
        });

        if (!classData) {
            return res.status(404).json({
                success: false,
                message: 'Class not found'
            });
        }

        // Format the response
        const formattedData = {
            name: classData.name,
            classDate: classData.classDate,
            startTime: classData.startTime,
            subject: {
                id: classData.Subject.id,
                name: classData.Subject.name,
                target: classData.Subject.target
            }
        };

        return res.status(200).json({
            success: true,
            data: formattedData
        });
    }
    catch (error) {
        console.error('Error fetching class data:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch class data',
            details: error.message
        });
    }
};



export const addRemark = async (req, res) => {
    try {
        // const { studentId, subjectId, content, target } = req.body;

        const validationResult = addRemarkSchema.safeParse(req.body);
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

        const subject = await prisma.subject.findUnique({
            where: { id: formData.subjectId },
            select: { target: true }
        });

        if (!subject || subject.target !== formData.target) {
            return res.status(400).json({
                success: false,
                error: 'Invalid subject or target mismatch'
            });
        }

        const existingRemark = await prisma.remark.findFirst({
            where: {
                subjectId: formData.subjectId,
                ...(formData.target === 'ORPHAN'
                    ? { childId: formData.studentId }
                    : { widowId: formData.studentId }
                )
            },
        });

        let remark;

        if (existingRemark) {
            remark = await prisma.remark.update({
                where: {
                    id: existingRemark.id
                },
                data: {
                    content: formData.content,
                    updatedAt: new Date(),
                }
            });
        } else {
            // Create new remark
            remark = await prisma.remark.create({
                data: {
                    content: formData.content,
                    subjectId: formData.subjectId,
                    ...(formData.target === 'ORPHAN'
                        ? { childId: formData.studentId }
                        : { widowId: formData.studentId }
                    )
                }
            });
        }

        const remarkWithDetails = await prisma.remark.findUnique({
            where: { id: remark.id },
            include: {
                ...(formData.target === 'ORPHAN'
                    ? {
                        child: {
                            select: {
                                id: true,
                                fullName: true
                            }
                        }
                    }
                    : {
                        widow: {
                            select: {
                                id: true,
                                WidowsName: true
                            }
                        }
                    }
                )
            }
        });

        const formattedRemark = {
            id: remarkWithDetails.id,
            content: remarkWithDetails.content,
            createdAt: remarkWithDetails.createdAt,
            updatedAt: remarkWithDetails.updatedAt,
            student: {
                id: formData.target === 'ORPHAN'
                    ? remarkWithDetails.child?.id
                    : remarkWithDetails.widow?.id,
                name: formData.target === 'ORPHAN'
                    ? remarkWithDetails.child?.fullName
                    : remarkWithDetails.widow?.WidowsName
            },
            subjectId: remarkWithDetails.subjectId
        };
        return res.status(200).json({
            success: true,
            data: formattedRemark,
            message: existingRemark
                ? `${formData.target.toLowerCase()} remark updated successfully`
                : `${formData.target.toLowerCase()} remark created successfully`
        });
    }
    catch (error) {
        console.error('Error managing remark:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to manage remark',
            details: error.message
        });
    }
};


export const getSubjectRemarks = async (req, res) => {
    try {
        const { subjectId } = req.body;
        if (!subjectId) {
            return res.status(400).json({
                success: false,
                error: 'Subject ID is required'
            });
        }
        const parsedSubjectId = parseInt(subjectId);

        const subject = await prisma.subject.findUnique({
            where: { id: parsedSubjectId },
            select: { target: true }
        });

        if (!subject) {
            return res.status(404).json({
                success: false,
                error: 'Subject not found'
            });
        }

        const remarks = await prisma.remark.findMany({
            where: {
                subjectId: parsedSubjectId,
                // Filter based on target type
                ...(subject.target === 'ORPHAN'
                    ? { childId: { not: null } }
                    : { widowId: { not: null } }
                )
            },
            include: {
                ...(subject.target === 'ORPHAN'
                    ? {
                        child: {
                            select: {
                                id: true,
                                fullName: true
                            }
                        }
                    }
                    : {
                        widow: {
                            select: {
                                id: true,
                                WidowsName: true
                            }
                        }
                    }
                )
            }
        });

        // Format the response to have consistent structure
        const formattedRemarks = remarks.map(remark => ({
            id: remark.id,
            content: remark.content,
            createdAt: remark.createdAt,
            updatedAt: remark.updatedAt,
            student: {
                id: subject.target === 'ORPHAN' ? remark.child?.id : remark.widow?.id,
                name: subject.target === 'ORPHAN' ? remark.child?.fullName : remark.widow?.WidowsName
            }
        }));

        return res.status(200).json({
            success: true,
            data: formattedRemarks
        });
    } catch (error) {
        console.error('Error fetching remarks:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch remarks',
            details: error.message
        });
    }
};


export const editClass = async (req, res) => {
    try {
        const validationResult = updateClassSchema.safeParse(req.body);
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
        const classData = await prisma.class.update({
            where: {
                id: formData.classId
            },
            data: {
                name: formData.name,
                classDate: new Date(formData.date),
                startTime: formData.time
            }
        });

        return res.status(200).json({
            success: true,
        });

    }
    catch (error) {
        console.error('Error editing class:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to edit class',
            details: error.message
        });
    }
}


export const getClassAbsence = async (req, res) => {
    try {
        const { classId } = req.body;
        if (!classId) {
            return res.status(400).json({
                success: false,
                error: 'Class ID is required'
            });
        }
        const parsedClassId = parseInt(classId);
        const classData = await prisma.class.findUnique({
            where: {
                id: parsedClassId
            },
            include: {
                Subject: {
                    select: {
                        target: true
                    }
                }
            }
        });

        if (!classData) {
            return res.status(404).json({
                success: false,
                error: 'Class not found'
            });
        }

        let absences;
        if (classData.Subject.target === 'ORPHAN') {
            absences = await prisma.absence.findMany({
                where: {
                    classId: parsedClassId
                },
                select: {
                    id: true,
                    isAbsent: true,
                    isJustified: true,
                    child: {
                        select: {
                            id: true,
                            fullName: true
                        }
                    }
                }
            });

            // Format orphan absences
            const formattedAbsences = absences.map(absence => ({
                id: absence.child.id,
                name: absence.child.fullName,
                isPresent: !absence.isAbsent,
                isJustified: absence.isJustified
            }));

            return res.status(200).json({
                success: true,
                data: formattedAbsences
            });

        } else if (classData.Subject.target === 'WIDOW') {
            absences = await prisma.absence.findMany({
                where: {
                    classId: parsedClassId
                },
                select: {
                    id: true,
                    isAbsent: true,
                    isJustified: true,
                    widow: {
                        select: {
                            id: true,
                            WidowsName: true
                        }
                    }
                }
            });
            const formattedAbsences = absences.map(absence => ({
                id: absence.widow.id,
                name: absence.widow.WidowsName,
                isPresent: !absence.isAbsent,
                isJustified: absence.isJustified
            })).filter(absence => absence.id !== undefined);
            return res.status(200).json({
                success: true,
                data: formattedAbsences
            });
        }

    } catch (error) {
        console.error('Error fetching absences:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch absences',
            details: error.message
        });
    }
};

export const updateAbsence = async (req, res) => {
    try {
        const validationResult = attendanceSchema.safeParse(req.body);
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

        const classExists = await prisma.class.findUnique({
            where: {
                id: formData.classId
            },
            include: {
                Subject: {
                    select: {
                        id: true,
                        target: true
                    }
                }
            }
        });

        if (!classExists) {
            return res.status(404).json({
                success: false,
                error: 'Class not found'
            });
        }

        const updateOperations = [];

        if (classExists.Subject.target === 'ORPHAN') {
            for (const student of formData.students) {
                const absenceRecord = await prisma.absence.findFirst({
                    where: {
                        childId: student.id,
                        widowId: null,
                        classId: formData.classId,
                        subjectId: classExists.Subject.id
                    }
                });

                if (!absenceRecord) {
                    throw new Error(`Absence record not found for childId: ${student.id}`);
                }

                updateOperations.push(
                    prisma.absence.update({
                        where: {
                            id: absenceRecord.id
                        },
                        data: {
                            isAbsent: !student.isPresent,
                            isJustified: student.isJustified
                        }
                    })
                );
            }
        } else if (classExists.Subject.target === 'WIDOW') {
            for (const student of formData.students) {
                const absenceRecord = await prisma.absence.findFirst({
                    where: {
                        childId: null,
                        widowId: student.id,
                        classId: formData.classId,
                        subjectId: classExists.Subject.id
                    }
                });

                if (!absenceRecord) {
                    throw new Error(`Absence record not found for widowId: ${student.id}`);
                }

                updateOperations.push(
                    prisma.absence.update({
                        where: {
                            id: absenceRecord.id
                        },
                        data: {
                            isAbsent: !student.isPresent,
                            isJustified: student.isJustified
                        }
                    })
                );
            }
        }

        // Execute all updates in a transaction
        await prisma.$transaction(updateOperations);

        return res.status(200).json({
            success: true,
            message: `${classExists.Subject.target.toLowerCase()} attendance updated successfully`
        });

    } catch (error) {
        console.error('Error updating absence:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to update absence',
            details: error.message
        });
    }
};



export const deleteRemark = async (req, res) => {
    try {

        const validationResult = deleteRemarkSchema.safeParse(req.body);
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

        const subject = await prisma.subject.findUnique({
            where: { id: formData.subjectId },
            select: { target: true }
        });

        if (!subject || subject.target !== formData.target) {
            return res.status(400).json({
                success: false,
                error: 'Invalid subject or target mismatch'
            });
        }

        await prisma.remark.deleteMany({
            where: {
                subjectId: formData.subjectId,
                ...(formData.target === 'ORPHAN'
                    ? { childId: formData.studentId }
                    : { widowId: formData.studentId }
                )
            }
        });

        return res.status(200).json({
            success: true,
            message: `${formData.target.toLowerCase()} remark deleted successfully`
        });
    }
    catch (error) {
        console.error('Error deleting remark:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to delete remark',
            details: error.message
        });
    }
};

export const deleteSubject = async (req, res) => {
    try {
        const { subjectId } = req.body;

        if (!subjectId) {
            return res.status(400).json({
                success: false,
                error: 'Subject ID is required'
            });
        }
        const parsedSubjectId = parseInt(subjectId);
        const subject = await prisma.subject.findUnique({
            where: { id: parsedSubjectId }
        });

        if (!subject) {
            return res.status(404).json({
                success: false,
                error: 'Subject not found'
            });
        }

        await prisma.subject.delete({
            where: { id: parsedSubjectId }
        })

        return res.status(200).json({
            success: true,
            message: 'Subject deleted successfully'
        })

    } catch {
        return res.status(500).json({
            success: false,
            error: 'Failed to delete subject',
            details: error.message
        });

    }
}


export const deleteClass = async (req, res) => {
    try {
        const { classId } = req.body;

        if (!classId) {
            return res.status(400).json({
                success: false,
                error: 'Class ID is required'
            });
        }
        const parsedClassId = parseInt(classId);
        const classtodelete = await prisma.class.findUnique({
            where: { id: parsedClassId }
        });

        if (!classtodelete) {
            return res.status(404).json({
                success: false,
                error: 'Class not found'
            });
        }

        await prisma.class.delete({
            where: { id: parsedClassId }
        });

        return res.status(200).json({
            success: true,
            message: 'Class deleted successfully'
        });

    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to delete class',
            details: error.message
        });
    }
}


export const getExportSubjects = async (req, res) => {
    try {
        const { exportSelectedCommittees, target } = req.body;

        if (!exportSelectedCommittees || !target) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        if (target !== 'ORPHAN' && target !== 'WIDOW') {
            return res.status(400).json({
                success: false,
                message: 'Invalid target type'
            });
        }

        const committeeIds = exportSelectedCommittees.map(committee => committee.id);

        const subjects = await prisma.subject.findMany({
            where: {
                AND: [
                    { committeeId: { in: committeeIds } },
                    { target: target }
                ]
            },
            select: {
                id: true,
                name: true
            }
        });

        return res.status(200).json({
            success: true,
            data: subjects
        });

    } catch (error) {
        console.error('Error fetching subjects:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch subjects',
            details: error.message
        });
    }
}