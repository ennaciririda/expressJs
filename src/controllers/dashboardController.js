import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();



export const getStatistics = async (req, res) => {
    try {
        const cin = req.user.cin;
        const user = await prisma.member.findUnique({
            where: { cin: cin },
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
        const numberOfFamilies = await prisma.family.count({
            where: user.committeeId === null ? {} : { committeeId: user.committeeId }
        })
        const numberOfChildren = await prisma.child.count({
            where: user.committeeId === null ? {} : { committeeId: user.committeeId }
        })
        res.status(200).json({
            success: true,
            message: 'Statistics retrieved successfully',
            data: [
                { count: numberOfFamilies, label: "أسرة" },
                { count: numberOfChildren, label: "طفل" },
                { count: 0, label: "مشروع" },
            ]
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching statistics',
            error: error.message,
        });
    }
}