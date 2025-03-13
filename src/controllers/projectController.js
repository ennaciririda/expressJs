import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
import ExcelJS from "exceljs";
import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createProjectSchema, updateProjectSchema } from "../utils/index.js";

export const createProject = async (req, res) => {
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

    const validationResult = createProjectSchema.safeParse(req.body);
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

    const project = await prisma.project.create({
      data: {
        name: formData.name,
        description: formData.description,
        Date: new Date(formData.date),
        committeeBudget: formData.amounts.committee,
        externalBudget: formData.amounts.external,
        totalBudget: formData.amounts.committee + formData.amounts.external,
        forOrphans: formData.isForOrphans === true,
        totalBenificiaries: formData.beneficiariesList.length,
        committeeId: user.committeeId,
        ...(formData.isForOrphans
          ? {
            orphanBenificiaries: {
              connect: formData.beneficiariesList.map((id) => ({ id: parseInt(id) })),
            },
          }
          : {
            familyBenificiaries: {
              connect: formData.beneficiariesList.map((id) => ({ id: parseInt(id) })),
            },
          }),
      },
      include: {
        committee: true,
        familyBenificiaries: !formData.isForOrphans,
        orphanBenificiaries: formData.isForOrphans,
      },
    });

    return res.status(201).json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error("Project creation error:", error);

    return res.status(500).json({
      error: "Failed to create project",
      details: error.message,
    });
  }
};




export const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, date, committeeBudget, externalBudget, beneficiariesList } = req.body;

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

    const formattedData = {
      id: parseInt(id),
      name,
      description,
      date,
      amounts: {
        committee: parseFloat(committeeBudget),
        external: parseFloat(externalBudget),
        total: parseFloat(committeeBudget) + parseFloat(externalBudget),
      },
      beneficiariesList,
    }

    const validationResult = updateProjectSchema.safeParse(formattedData);
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
    const existingProject = await prisma.project.findUnique({
      where: { id: parseInt(id) },
      include: {
        committee: true,
        orphanBenificiaries: true,
        familyBenificiaries: true,
      },
    });

    if (!existingProject) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Update the project
    const updatedProject = await prisma.project.update({
      where: { id: parseInt(id) },
      data: {
        name,
        description,
        Date: new Date(date),
        committeeBudget: parseFloat(committeeBudget),
        externalBudget: parseFloat(externalBudget),
        totalBudget: parseFloat(committeeBudget) + parseFloat(externalBudget),
        committeeId: user.committeeId || existingProject.committeeId,
      },
      include: {
        committee: true,
        orphanBenificiaries: true,
        familyBenificiaries: true,
      },
    });

    // Update beneficiaries if provided
    if (beneficiariesList && beneficiariesList.length > 0) {
      if (existingProject.forOrphans) {
        await prisma.project.update({
          where: { id: parseInt(id) },
          data: {
            orphanBenificiaries: {
              set: beneficiariesList.map((beneficiaryId) => ({
                id: parseInt(beneficiaryId),
              })),
            },
            totalBenificiaries: beneficiariesList.length,
          },
        });
      } else {
        await prisma.project.update({
          where: { id: parseInt(id) },
          data: {
            familyBenificiaries: {
              set: beneficiariesList.map((beneficiaryId) => ({
                id: parseInt(beneficiaryId),
              })),
            },
            totalBenificiaries: beneficiariesList.length,
          },
        });
      }
    }

    res.json(updatedProject);
  } catch (error) {
    console.error("Project update error:", error);
    res
      .status(500)
      .json({ message: "Failed to update project", error: error.message });
  }
};

export const getProjects = async (req, res) => {
  const committeeId = req.query.committeeId;
  let projects;
  try {
    if (committeeId) {
      projects = await prisma.project.findMany({
        where: {
          committeeId: Number(committeeId),
        },
        include: {
          familyBenificiaries: true,
          orphanBenificiaries: true,
          committee: true,
        },
      });
    } else {
      projects = await prisma.project.findMany({
        include: {
          familyBenificiaries: true,
          orphanBenificiaries: true,
          committee: true,
        },
      });
    }
    res.json(projects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
};

export const getOrphans = async (req, res) => {
  try {
    const orphans = await prisma.child.findMany();
    res.json(orphans);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
};

export const getFamilies = async (req, res) => {
  try {
    const families = await prisma.family.findMany({

      include: {
        Widow: {
          select: {
            WidowsName: true,
          },
        },
      },
    });
    res.json(families);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
};

export const getProjectDetails = async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: {
        id: parseInt(req.params.id),
      },
      include: {
        familyBenificiaries: true,
        orphanBenificiaries: true,
        committee: true,
      },
    });
    res.json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
};

export const getBeneficiaries = async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: {
        id: parseInt(req.params.id),
      },
      include: {
        familyBenificiaries: true,
        orphanBenificiaries: true,
      },
    });
    res.json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
};


// Controller function to export projects to Excel
export const exportProject = async (req, res) => {
  try {
    const { committeeId, startDate, endDate } = req.body;

    // Build filter conditions
    let whereCondition = {};

    // Filter by committee if specified
    if (committeeId && committeeId !== 'all') {
      whereCondition.committeeId = parseInt(committeeId);
    }

    // Filter by date range if specified
    if (startDate && endDate) {
      whereCondition.Date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }


    // Filter by committee if specified
    if (committeeId && committeeId !== 'all') {
      whereCondition.committeeId = parseInt(committeeId);
    }

    // Filter by date range if specified
    if (startDate && endDate) {
      whereCondition.Date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    // Fetch projects with filters
    const projects = await prisma.project.findMany({
      where: whereCondition,
      include: {
        committee: true,
        familyBenificiaries: true,
        orphanBenificiaries: true
      },
      orderBy: {
        Date: 'desc'
      }
    });

    // Get committee name if filtering by committee
    let committeeName = 'كل اللجان';
    if (committeeId && committeeId !== 'all') {
      const committee = await prisma.committee.findUnique({
        where: { id: parseInt(committeeId) }
      });
      if (committee) {
        committeeName = committee.name;
      }
    }

    // Create a new Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Your Organization';
    workbook.created = new Date();

    // Add a worksheet
    const worksheet = workbook.addWorksheet('المشاريع', {
      properties: { tabColor: { argb: '4167B8' } }
    });

    // Add title and filter information
    worksheet.mergeCells('A1:I1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'تقرير المشاريع';
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center' };

    worksheet.getCell('A2').value = 'اللجنة:';
    worksheet.getCell('B2').value = committeeName;

    worksheet.getCell('A3').value = 'الفترة:';
    worksheet.getCell('B3').value = startDate && endDate
      ? `${dayjs(startDate).format('YYYY/MM/DD')} - ${dayjs(endDate).format('YYYY/MM/DD')}`
      : 'كل الفترات';

    worksheet.getCell('A4').value = 'تاريخ التصدير:';
    worksheet.getCell('B4').value = dayjs().format('YYYY/MM/DD');

    // Add headers
    const headers = [
      'اللجنة',
      'عدد المستفيدين',
      'الميزانية الإجمالية',
      'ميزانية خارجية',
      'ميزانية اللجنة',
      'التاريخ',
      'اسم المشروع',
    ];

    worksheet.getRow(6).values = headers;
    worksheet.getRow(6).font = { bold: true };
    worksheet.getRow(6).alignment = { horizontal: 'center' };

    // Add data
    let rowIndex = 7;
    projects.forEach(project => {
      worksheet.getRow(rowIndex).values = [
        project.name,
        dayjs(project.Date).format('DD/MM/YYYY'),
        project.committeeBudget,
        project.externalBudget,
        project.totalBudget,
        project.totalBenificiaries,
        project.committee.name
      ];

      worksheet.getRow(rowIndex).alignment = { horizontal: 'center' };
      rowIndex++;
    });

    // Set column widths
    worksheet.columns = [
      { width: 20 }, // Project name
      { width: 30 }, // Description
      { width: 12 }, // Date
      { width: 15 }, // Committee budget
      { width: 15 }, // External budget
      { width: 15 }, // Total budget
      { width: 10 }, // For orphans
      { width: 15 }, // Total beneficiaries
      { width: 15 }, // Committee
    ];


    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    // Create directory for exports if it doesn't exist
    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    // Generate filename
    const fileName = `تقرير_المشاريع_${dayjs().format('DDMMYYYY_HHmmss')}.xlsx`;
    const filePath = path.join(exportsDir, fileName);

    // Write to file
    await workbook.xlsx.writeFile(filePath);

    // Send file to client
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        return res.status(500).json({ error: 'Error sending file' });
      }

      // Delete file after sending
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error('Error deleting file:', unlinkErr);
        }
      });
    });

  } catch (error) {
    console.error('Error exporting projects:', error);
    res.status(500).json({ error: 'Failed to export projects' });
  }
};

// Additional function to get project statistics
export const getProjectStats = async (req, res) => {
  try {
    const { committeeId, startDate, endDate } = req.query;

    // Build filter conditions
    let whereCondition = {};

    // Filter by committee if specified
    if (committeeId && committeeId !== 'all') {
      whereCondition.committeeId = parseInt(committeeId);
    }

    // Filter by date range if specified
    if (startDate && endDate) {
      whereCondition.Date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    // Get project count
    const projectCount = await prisma.project.count({
      where: whereCondition
    });

    // Get total budget
    const budgetResult = await prisma.project.aggregate({
      where: whereCondition,
      _sum: {
        totalBudget: true,
        committeeBudget: true,
        externalBudget: true
      }
    });

    // Get beneficiaries count
    const beneficiariesResult = await prisma.project.aggregate({
      where: whereCondition,
      _sum: {
        totalBenificiaries: true
      }
    });

    // Get orphan projects count
    const orphanProjectsCount = await prisma.project.count({
      where: {
        ...whereCondition,
        forOrphans: true
      }
    });

    res.json({
      projectCount,
      totalBudget: budgetResult._sum.totalBudget || 0,
      committeeBudget: budgetResult._sum.committeeBudget || 0,
      externalBudget: budgetResult._sum.externalBudget || 0,
      totalBeneficiaries: beneficiariesResult._sum.totalBenificiaries || 0,
      orphanProjectsCount
    });

  } catch (error) {
    console.error('Error getting project stats:', error);
    res.status(500).json({ error: 'Failed to get project statistics' });
  }
};
